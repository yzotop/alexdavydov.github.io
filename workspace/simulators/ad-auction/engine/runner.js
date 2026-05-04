/**
 * Step-by-step simulation runner for live playback
 */
(function() {
  'use strict';

  const { Advertiser, Slot, SlotResult, EventResult, SimState } = window.Model;
  const { setSeed, random, bernoulli } = window.RNG;
  const { predictCTR } = window.Predictor;
  const { calculateAdPressure, calculateFatigueMultiplier, generateNoise } = window.Fatigue;
  const { decideSlots } = window.Policy;
  const { runAuction } = window.Auction;
  const { computePrice } = window.Pricing;
  const { updateRollingMetrics, updateWorldState } = window.Metrics;

  /**
   * Initialize simulation state for step-by-step execution
   * @param {Object} config - Simulation configuration
   * @returns {Object} {state, advertisers, slots, primary_slot, config}
   */
  function initSimulation(config) {
    setSeed(config.seed || 1);
    const state = new SimState();
    
    // Load data
    const advertisers = window.Scenarios.getAdvertisers().map(d => new Advertiser(d));
    const slots = window.Scenarios.getSlots().map(d => new Slot(d));
    const primary_slot = slots[0];
    
    // Reset advertisers (including budgets)
    advertisers.forEach(adv => adv.reset());
    
    // Initialize remaining budgets from daily_budget if present
    advertisers.forEach(adv => {
      if (adv.daily_budget !== undefined && adv.daily_budget !== null) {
        adv.remaining_budget = adv.daily_budget;
      } else {
        adv.remaining_budget = Infinity;
      }
    });
    
    // Extract and store config
    const simConfig = {
      horizon: config.horizon || 1000,
      policy_mode: config.policy.mode,
      policy_params: config.policy,
      pricing_type: config.auction.pricing,
      pricing_params: config.auction,
      floor_multiplier: config.auction.floor_multiplier || 1.0,
      fatigue_strength: config.fatigue.fatigue_strength || 0.5,
      baseline_noise: config.fatigue.baseline_noise || 0.01,
      viewability_enabled: config.fatigue.viewability_enabled !== false,
      user_multiplier: 1.0,
      regime_schedule: config.regime_schedule || []
    };
    
    return {
      state,
      advertisers,
      slots,
      primary_slot,
      config: simConfig
    };
  }

  /**
   * Get current regime multipliers for time t
   * @param {Array} regime_schedule - Array of {t_start, bid_multiplier, pctr_multiplier, floor_multiplier_delta}
   * @param {number} t - Current time
   * @returns {Object} {bid_multiplier, pctr_multiplier, floor_multiplier_delta}
   */
  function getCurrentRegime(regime_schedule, t) {
    if (!regime_schedule || regime_schedule.length === 0) {
      return {
        bid_multiplier: 1.0,
        pctr_multiplier: 1.0,
        floor_multiplier_delta: 0.0
      };
    }
    
    // Find the most recent regime that started before or at t
    // Regimes should be sorted by t_start ascending
    let current = { bid_multiplier: 1.0, pctr_multiplier: 1.0, floor_multiplier_delta: 0.0 };
    for (let i = regime_schedule.length - 1; i >= 0; i--) {
      const regime = regime_schedule[i];
      if (t >= regime.t_start) {
        current = {
          bid_multiplier: regime.bid_multiplier !== undefined ? regime.bid_multiplier : 1.0,
          pctr_multiplier: regime.pctr_multiplier !== undefined ? regime.pctr_multiplier : 1.0,
          floor_multiplier_delta: regime.floor_multiplier_delta !== undefined ? regime.floor_multiplier_delta : 0.0
        };
        break;
      }
    }
    return current;
  }

  /**
   * Execute one simulation step
   * @param {Object} simContext - Context from initSimulation
   * @returns {Object} {state, event, done}
   */
  function stepSimulation(simContext) {
    const { state, advertisers, primary_slot, config } = simContext;
    
    if (state.t >= config.horizon) {
      return { state, event: null, done: true };
    }
    
    const t = state.t + 1;
    const event = new EventResult(t);
    
    // Get current regime multipliers
    const regime = getCurrentRegime(config.regime_schedule, t);
    
    // Calculate current ad pressure and fatigue
    const current_pressure = calculateAdPressure(state.total_impressions, t);
    const fatigue_multiplier = calculateFatigueMultiplier(current_pressure, config.fatigue_strength);
    
    // Policy: decide how many slots to open
    const context = {
      advertisers: advertisers,
      slot: primary_slot,
      current_ecpm: state.total_impressions > 0 ? (state.total_revenue * 1000) / state.total_impressions : 0,
      expected_revenue_per_slot: state.total_impressions > 0 ? state.total_revenue / state.total_impressions : 0.01,
      current_pressure: current_pressure
    };
    
    const slots_to_open = decideSlots(config.policy_mode, config.policy_params, t, context);
    event.opened_slots = slots_to_open;
    
    // For each opened slot, run auction
    for (let i = 0; i < slots_to_open; i++) {
      const slot_result = new SlotResult();
      
      // Get pCTR function for this slot (with regime multiplier)
      const getPCTR = (adv, slot) => {
        const noise = generateNoise(config.baseline_noise, random);
        const base_pctr = predictCTR(adv, slot, config.user_multiplier, fatigue_multiplier, noise, config.viewability_enabled);
        return base_pctr * regime.pctr_multiplier;
      };
      
      // Apply regime multipliers to bids and floor
      const effective_floor_multiplier = config.floor_multiplier + regime.floor_multiplier_delta;
      
      // Temporarily modify bids for auction (apply regime bid_multiplier)
      const original_bids = advertisers.map(adv => adv.bid_cpm);
      advertisers.forEach(adv => {
        adv.bid_cpm = adv.bid_cpm * regime.bid_multiplier;
      });
      
      // Run auction
      const auction_result = runAuction(advertisers, primary_slot, getPCTR, effective_floor_multiplier);
      
      // Restore original bids
      advertisers.forEach((adv, idx) => {
        adv.bid_cpm = original_bids[idx];
      });
      
      // Store auction details for tape
      slot_result.auction_result = auction_result;
      slot_result.eligible_count = auction_result.eligible_count || 0;
      slot_result.placement = i;
      
      if (auction_result.winner) {
        // Compute price (using original bid, not multiplied)
        const price_cpm = computePrice(config.pricing_type, config.pricing_params, auction_result, primary_slot, effective_floor_multiplier);
        
        // Check budget constraint before realizing impression
        const cost = price_cpm / 1000;
        if (auction_result.winner.remaining_budget !== Infinity && auction_result.winner.remaining_budget < cost) {
          slot_result.reason = 'budget_exhausted';
          event.slot_results.push(slot_result);
          continue;
        }
        
        // Realize impression (with viewability)
        const impression_prob = config.viewability_enabled ? primary_slot.viewability : 1.0;
        const impression = bernoulli(impression_prob);
        
        if (impression) {
          slot_result.impression = true;
          state.total_impressions++;
          event.impressions++;
          
          // Realize click
          const click = bernoulli(auction_result.winner_pctr);
          if (click) {
            slot_result.click = true;
            state.total_clicks++;
            event.clicks++;
          }
          
          // Record revenue
          const revenue = price_cpm / 1000;
          state.total_revenue += revenue;
          event.revenue += revenue;
          
          // Update advertiser spend and remaining budget
          auction_result.winner.spent += revenue;
          if (auction_result.winner.remaining_budget !== Infinity) {
            auction_result.winner.remaining_budget -= revenue;
            auction_result.winner.remaining_budget = Math.max(0, auction_result.winner.remaining_budget);
          }
        }
        
        slot_result.winner = auction_result.winner;
        slot_result.price_cpm = price_cpm;
        slot_result.pay_cpm = price_cpm;
        slot_result.pctr = auction_result.winner_pctr;
        slot_result.reason = auction_result.reason;
        event.filled_slots++;
        state.total_filled_slots++;
      } else {
        slot_result.reason = auction_result.reason;
      }
      
      event.slot_results.push(slot_result);
    }
    
    state.total_opened_slots += event.opened_slots;
    state.events.push(event);
    state.t = t;
    
    // Update world state
    updateWorldState(state, current_pressure, fatigue_multiplier);
    
    // Update rolling metrics periodically
    updateRollingMetrics(state, 100);
    
    return { state, event, done: state.t >= config.horizon };
  }

  window.Runner = {
    initSimulation,
    stepSimulation,
    getCurrentRegime
  };
})();
