/**
 * Main simulator orchestration - always generates exactly one event per t
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
   * Run simulation - guarantees exactly one event per t from 1..horizon
   * @param {Object} config - Simulation configuration
   * @returns {Array<EventResult>} Array of events, length == horizon
   */
  function runSimulation(config) {
    // Initialize
    setSeed(config.seed || 1);
    const state = new SimState();
    
    // Load data
    const advertisers = window.Scenarios.getAdvertisers().map(d => new Advertiser(d));
    const slots = window.Scenarios.getSlots().map(d => new Slot(d));
    const primary_slot = slots[0];
    
    // Reset advertisers
    advertisers.forEach(adv => adv.reset());
    
    // Extract config
    const horizon = config.horizon || 1000;
    const policy_mode = config.policy.mode;
    const policy_params = config.policy;
    const pricing_type = config.auction.pricing;
    const pricing_params = config.auction;
    const floor_multiplier = config.auction.floor_multiplier || 1.0;
    const fatigue_strength = config.fatigue.fatigue_strength || 0.5;
    const baseline_noise = config.fatigue.baseline_noise || 0.01;
    const viewability_enabled = config.fatigue.viewability_enabled !== false;
    
    // User quality multiplier (constant for this simulation)
    const user_multiplier = 1.0;
    
    // Pre-allocate events array
    const events = [];
    
    // Run events - ALWAYS create one event per t
    for (let t = 1; t <= horizon; t++) {
      const event = new EventResult(t);
      // Always initialize explain_candidates as empty array
      event.explain_candidates = [];
      event.place = 0;
      event.eligible_cnt = 0;
      event.winner_id = null;
      event.pay_cpm = null;
      event.pctr = null;
      event.click = 0;
      event.reason = 'no_slot';
      
      // Calculate current ad pressure and fatigue
      const current_pressure = calculateAdPressure(state.total_impressions, t);
      const fatigue_multiplier = calculateFatigueMultiplier(current_pressure, fatigue_strength);
      
      // Update world state
      updateWorldState(state, current_pressure, fatigue_multiplier);
      
      // Policy: decide how many slots to open
      const context = {
        advertisers: advertisers,
        slot: primary_slot,
        current_ecpm: state.total_impressions > 0 ? (state.total_revenue * 1000) / state.total_impressions : 0,
        expected_revenue_per_slot: state.total_impressions > 0 ? state.total_revenue / state.total_impressions : 0.01,
        current_pressure: current_pressure
      };
      
      const slots_to_open = decideSlots(policy_mode, policy_params, t, context);
      event.opened_slots = slots_to_open;
      
      // If no slots opened, create event with reason "no_slot"
      if (slots_to_open === 0) {
        event.filled_slots = 0;
        event.place = 0;
        event.eligible_cnt = 0;
        event.winner_id = null;
        event.pay_cpm = null;
        event.pctr = null;
        event.click = 0;
        event.reason = 'no_slot';
        event.revenue = 0;
        event.impressions = 0;
        event.clicks = 0;
      } else {
        // For each opened slot, run auction
        for (let i = 0; i < slots_to_open; i++) {
          const slot_result = new SlotResult();
          slot_result.placement = i;
          
          // Get pCTR function for this slot
          const getPCTR = (adv, slot) => {
            const noise = generateNoise(baseline_noise, random);
            return predictCTR(adv, slot, user_multiplier, fatigue_multiplier, noise, viewability_enabled);
          };
          
          // Run auction
          const auction_result = runAuction(advertisers, primary_slot, getPCTR, floor_multiplier);
          slot_result.eligible_count = auction_result.eligible_count || 0;
          slot_result.auction_result = auction_result;
          
          // Store explain candidates for first slot only (always set, even if empty)
          if (i === 0) {
            if (auction_result.all_scores && auction_result.all_scores.length > 0) {
              event.explain_candidates = auction_result.all_scores
                .slice()
                .sort((a, b) => b.score - a.score)
                .slice(0, 8)
                .map(c => ({
                  advertiser_id: c.advertiser.id,
                  advertiser_name: c.advertiser.name,
                  bid_cpm: c.advertiser.bid_cpm,
                  pctr: c.pctr,
                  quality: c.advertiser.quality,
                  score: c.score,
                  effective_value: c.effective_value
                }));
            }
            // If no candidates, explain_candidates is already [] from initialization
          }
          
          if (auction_result.winner) {
            // Compute price
            const price_cpm = computePrice(pricing_type, pricing_params, auction_result, primary_slot, floor_multiplier);
            
            // Realize impression (with viewability)
            const impression_prob = viewability_enabled ? primary_slot.viewability : 1.0;
            const impression = bernoulli(impression_prob);
            
            slot_result.pay_cpm = price_cpm;
            
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
              if (auction_result.winner.remaining_budget !== undefined) {
                auction_result.winner.remaining_budget = Math.max(0, auction_result.winner.remaining_budget - revenue);
              }
              
              slot_result.winner = auction_result.winner;
              slot_result.price_cpm = price_cpm;
              slot_result.pctr = auction_result.winner_pctr;
              slot_result.reason = 'filled';
              event.filled_slots++;
              state.total_filled_slots++;
            } else {
              slot_result.reason = 'no_viewable';
              slot_result.winner = auction_result.winner;
              slot_result.price_cpm = price_cpm;
              slot_result.pctr = auction_result.winner_pctr;
            }
          } else {
            slot_result.reason = auction_result.reason || 'no_eligible';
          }
          
          event.slot_results.push(slot_result);
        }
        
        // Set event-level fields from first slot result (for compatibility)
        const firstSlot = event.slot_results && event.slot_results.length > 0 ? event.slot_results[0] : null;
        if (firstSlot) {
          event.place = firstSlot.placement !== undefined ? firstSlot.placement : 0;
          event.eligible_cnt = firstSlot.eligible_count !== undefined ? firstSlot.eligible_count : 0;
          event.winner_id = firstSlot.winner ? firstSlot.winner.id : null;
          event.pay_cpm = firstSlot.pay_cpm !== undefined && firstSlot.pay_cpm !== null ? firstSlot.pay_cpm : null;
          event.pctr = firstSlot.pctr !== undefined && firstSlot.pctr !== null ? firstSlot.pctr : null;
          event.click = firstSlot.click ? 1 : 0;
          event.reason = firstSlot.reason || 'unknown';
        } else {
          event.place = 0;
          event.eligible_cnt = 0;
          event.winner_id = null;
          event.pay_cpm = null;
          event.pctr = null;
          event.click = 0;
          event.reason = 'no_slot';
        }
      }
      
      state.total_opened_slots += event.opened_slots;
      events.push(event);
      state.t = t;
      
      // Update rolling metrics periodically
      if (t % 10 === 0) {
        updateRollingMetrics(state, 100);
      }
    }
    
    // Verify we have exactly horizon events
    if (events.length !== horizon) {
      throw new Error(`Simulation error: expected ${horizon} events, got ${events.length}`);
    }
    
    return events;
  }

  window.Simulator = {
    runSimulation
  };
})();
