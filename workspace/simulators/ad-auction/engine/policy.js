/**
 * Placement policy: decides how many slots to open at each event
 */
(function() {
  'use strict';

  /**
   * Fixed policy: open slots every N events
   * @param {number} t - Current event time
   * @param {number} every_n_events - Open every N events
   * @param {number} slots_per_open - Number of slots to open
   * @returns {number} Number of slots to open (0 or slots_per_open)
   */
  function fixedPolicy(t, every_n_events, slots_per_open) {
    if (t % every_n_events === 0) {
      return slots_per_open;
    }
    return 0;
  }

  /**
   * Threshold policy: open slots if expected eCPM exceeds threshold
   * @param {number} t - Current event time
   * @param {number} threshold_ecpm - Minimum eCPM threshold
   * @param {number} max_slots - Maximum slots to open
   * @param {Array} advertisers - Available advertisers
   * @param {Slot} slot - Slot to evaluate
   * @param {number} current_ecpm - Current average eCPM (if available)
   * @returns {number} Number of slots to open (0..max_slots)
   */
  function thresholdPolicy(t, threshold_ecpm, max_slots, advertisers, slot, current_ecpm) {
    // Simple heuristic: use current eCPM if available, otherwise estimate from top bidder
    let estimated_ecpm = current_ecpm;
    
    if (!estimated_ecpm || estimated_ecpm === 0) {
      // Estimate from highest bidder matching slot format
      const eligible = advertisers.filter(adv => adv.formats.includes(slot.format));
      if (eligible.length === 0) return 0;
      
      const topBidder = eligible.reduce((max, adv) => 
        adv.bid_cpm > max.bid_cpm ? adv : max
      );
      estimated_ecpm = topBidder.bid_cpm;
    }
    
    if (estimated_ecpm >= threshold_ecpm) {
      return max_slots;
    }
    return 0;
  }

  /**
   * Utility policy: maximize utility = revenue - lambda * annoyance
   * @param {number} t - Current event time
   * @param {number} lambda_annoyance - Weight on annoyance cost
   * @param {number} max_slots - Maximum slots to open
   * @param {number} expected_revenue_per_slot - Expected revenue from opening one slot
   * @param {number} current_pressure - Current ad pressure
   * @returns {number} Number of slots to open (0..max_slots)
   */
  function utilityPolicy(t, lambda_annoyance, max_slots, expected_revenue_per_slot, current_pressure) {
    if (max_slots === 0) return 0;
    
    // Calculate utility for each number of slots
    let best_utility = -Infinity;
    let best_slots = 0;
    
    for (let slots = 0; slots <= max_slots; slots++) {
      const revenue = slots * expected_revenue_per_slot;
      const new_pressure = current_pressure + (slots / Math.max(1, t));
      const annoyance = lambda_annoyance * new_pressure;
      const utility = revenue - annoyance;
      
      if (utility > best_utility) {
        best_utility = utility;
        best_slots = slots;
      }
    }
    
    return best_slots;
  }

  /**
   * Main policy dispatcher
   * @param {string} mode - 'fixed' | 'threshold' | 'utility'
   * @param {Object} params - Policy parameters
   * @param {number} t - Current event time
   * @param {Object} context - Additional context (advertisers, slot, metrics, etc.)
   * @returns {number} Number of slots to open
   */
  function decideSlots(mode, params, t, context) {
    switch (mode) {
      case 'fixed':
        return fixedPolicy(t, params.every_n_events, params.slots_per_open);
      
      case 'threshold':
        return thresholdPolicy(
          t,
          params.threshold_ecpm,
          params.max_slots,
          context.advertisers || [],
          context.slot,
          context.current_ecpm
        );
      
      case 'utility':
        return utilityPolicy(
          t,
          params.lambda_annoyance,
          params.max_slots,
          context.expected_revenue_per_slot || 0.01,
          context.current_pressure || 0
        );
      
      default:
        return 0;
    }
  }

  window.Policy = {
    fixedPolicy,
    thresholdPolicy,
    utilityPolicy,
    decideSlots
  };
})();
