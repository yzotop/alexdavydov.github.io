/**
 * Core data models for advertisers, slots, and simulation state
 */
(function() {
  'use strict';

  /**
   * Advertiser model
   */
  class Advertiser {
    constructor(data) {
      this.id = data.id;
      this.name = data.name;
      this.bid_cpm = data.bid_cpm;
      this.quality = data.quality;
      this.base_pctr = data.base_pctr;
      this.formats = data.formats || [];
      this.budget = data.budget || Infinity; // Legacy: total budget
      this.daily_budget = data.daily_budget; // Optional: daily budget (for pacing)
      this.spent = 0;
      this.remaining_budget = data.daily_budget !== undefined ? data.daily_budget : Infinity;
    }

    canBid(format) {
      if (!this.formats.includes(format)) return false;
      if (this.remaining_budget !== undefined && this.remaining_budget <= 0) return false;
      if (this.budget !== Infinity && this.spent >= this.budget) return false;
      return true;
    }

    reset() {
      this.spent = 0;
      this.remaining_budget = this.daily_budget !== undefined ? this.daily_budget : Infinity;
    }
  }

  /**
   * Slot model
   */
  class Slot {
    constructor(data) {
      this.id = data.id;
      this.name = data.name;
      this.format = data.format;
      this.floor_cpm = data.floor_cpm;
      this.viewability = data.viewability || 1.0;
    }
  }

  /**
   * Event result for a single slot auction
   */
  class SlotResult {
    constructor() {
      this.winner = null;
      this.price_cpm = 0;
      this.pay_cpm = 0; // Final price paid
      this.pctr = 0;
      this.impression = false;
      this.click = false;
      this.reason = 'not_opened';
      this.placement = 0; // Slot index (0, 1, ...)
      this.eligible_count = 0; // Number of eligible advertisers
      this.auction_result = null; // Full auction result for drill-down
    }
  }

  /**
   * Event result for a single time step
   */
  class EventResult {
    constructor(t) {
      this.t = t;
      this.opened_slots = 0;
      this.filled_slots = 0;
      this.slot_results = [];
      this.revenue = 0;
      this.impressions = 0;
      this.clicks = 0;
      this.explain_candidates = []; // Top 8 candidates for first slot auction
    }
  }

  /**
   * Simulation state
   */
  class SimState {
    constructor() {
      this.t = 0;
      this.total_revenue = 0;
      this.total_impressions = 0;
      this.total_clicks = 0;
      this.total_opened_slots = 0;
      this.total_filled_slots = 0;
      this.events = [];
      this.rolling_revenue = [];
      this.rolling_ctr = [];
      this.rolling_fillrate = [];
      this.rolling_pressure = [];
      // World state tracking
      this.recent_fill_rates = []; // Last 100 events
      this.recent_below_floor = []; // Last 100 events (boolean)
      this.current_pressure = 0;
      this.current_fatigue_multiplier = 1.0;
    }

    reset() {
      this.t = 0;
      this.total_revenue = 0;
      this.total_impressions = 0;
      this.total_clicks = 0;
      this.total_opened_slots = 0;
      this.total_filled_slots = 0;
      this.events = [];
      this.rolling_revenue = [];
      this.rolling_ctr = [];
      this.rolling_fillrate = [];
      this.rolling_pressure = [];
      this.recent_fill_rates = [];
      this.recent_below_floor = [];
      this.current_pressure = 0;
      this.current_fatigue_multiplier = 1.0;
    }
  }

  window.Model = {
    Advertiser,
    Slot,
    SlotResult,
    EventResult,
    SimState
  };
})();
