/**
 * Metrics calculation and rolling window management
 */
(function() {
  'use strict';

  /**
   * Calculate metrics from state
   * @param {SimState} state
   * @returns {Object} Metrics object
   */
  function calculateMetrics(state) {
    const revenue = state.total_revenue;
    const impressions = state.total_impressions;
    const clicks = state.total_clicks;
    const opened = state.total_opened_slots;
    const filled = state.total_filled_slots;
    const t = state.t;
    
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const ecpm = impressions > 0 ? (revenue * 1000) / impressions : 0;
    const fillrate = opened > 0 ? filled / opened : 0;
    const pressure = t > 0 ? impressions / t : 0;
    
    return {
      revenue,
      impressions,
      clicks,
      ctr,
      ecpm,
      fillrate,
      pressure,
      opened_slots: opened,
      filled_slots: filled
    };
  }

  /**
   * Update rolling window metrics
   * @param {SimState} state
   * @param {number} window_size - Rolling window size (default 100)
   */
  function updateRollingMetrics(state, window_size = 100) {
    const t = state.t;
    
    // Revenue per 100 events (rolling)
    if (t > 0 && t % 100 === 0) {
      const recent_events = state.events.slice(-100);
      const recent_revenue = recent_events.reduce((sum, e) => sum + e.revenue, 0);
      state.rolling_revenue.push({ t, value: recent_revenue });
    }
    
    // CTR rolling (last 100 events with impressions)
    if (t > 0 && t % 10 === 0) {
      const recent_events = state.events.slice(-100);
      const recent_impressions = recent_events.reduce((sum, e) => sum + e.impressions, 0);
      const recent_clicks = recent_events.reduce((sum, e) => sum + e.clicks, 0);
      const recent_ctr = recent_impressions > 0 ? recent_clicks / recent_impressions : 0;
      state.rolling_ctr.push({ t, value: recent_ctr });
    }
    
    // FillRate rolling
    if (t > 0 && t % 10 === 0) {
      const recent_events = state.events.slice(-100);
      const recent_opened = recent_events.reduce((sum, e) => sum + e.opened_slots, 0);
      const recent_filled = recent_events.reduce((sum, e) => sum + e.filled_slots, 0);
      const recent_fillrate = recent_opened > 0 ? recent_filled / recent_opened : 0;
      state.rolling_fillrate.push({ t, value: recent_fillrate });
    }
    
    // AdPressure (already computed per event, just track)
    if (t > 0) {
      const metrics = calculateMetrics(state);
      state.rolling_pressure.push({ t, value: metrics.pressure });
    }
  }

  /**
   * Get scatter data for AdPressure vs Revenue
   * @param {SimState} state
   * @param {number} bin_size - Bin size in events (default 100)
   * @returns {Array<{pressure, revenue}>}
   */
  function getPressureRevenueScatter(state, bin_size = 100) {
    const bins = [];
    
    for (let i = 0; i < state.events.length; i += bin_size) {
      const bin_events = state.events.slice(i, Math.min(i + bin_size, state.events.length));
      const bin_revenue = bin_events.reduce((sum, e) => sum + e.revenue, 0);
      const bin_impressions = bin_events.reduce((sum, e) => sum + e.impressions, 0);
      const bin_t = bin_events.length;
      const bin_pressure = bin_t > 0 ? bin_impressions / bin_t : 0;
      
      bins.push({
        pressure: bin_pressure,
        revenue: bin_revenue
      });
    }
    
    return bins;
  }

  /**
   * Update world state metrics (fill rates, below floor share, etc.)
   * @param {SimState} state
   * @param {number} current_pressure
   * @param {number} fatigue_multiplier
   */
  function updateWorldState(state, current_pressure, fatigue_multiplier) {
    state.current_pressure = current_pressure;
    state.current_fatigue_multiplier = fatigue_multiplier;
    
    // Track last 100 events fill rates and below_floor
    const recent_events = state.events.slice(-100);
    if (recent_events.length > 0) {
      recent_events.forEach(event => {
        if (event.opened_slots > 0) {
          const fill_rate = event.filled_slots / event.opened_slots;
          state.recent_fill_rates.push(fill_rate);
          if (state.recent_fill_rates.length > 100) {
            state.recent_fill_rates.shift();
          }
          
          // Check if any slot had below_floor reason
          const has_below_floor = event.slot_results.some(sr => sr.reason === 'below_floor');
          state.recent_below_floor.push(has_below_floor);
          if (state.recent_below_floor.length > 100) {
            state.recent_below_floor.shift();
          }
        }
      });
    }
  }

  /**
   * Get world state summary
   * @param {SimState} state
   * @returns {Object} World state metrics
   */
  function getWorldState(state) {
    const fill_rate_last_100 = state.recent_fill_rates.length > 0
      ? state.recent_fill_rates.reduce((a, b) => a + b, 0) / state.recent_fill_rates.length
      : 0;
    
    const share_below_floor_last_100 = state.recent_below_floor.length > 0
      ? state.recent_below_floor.filter(x => x).length / state.recent_below_floor.length
      : 0;
    
    return {
      ad_pressure: state.current_pressure,
      fatigue_multiplier: state.current_fatigue_multiplier,
      fill_rate_last_100: fill_rate_last_100,
      share_below_floor_last_100: share_below_floor_last_100
    };
  }

  window.Metrics = {
    calculateMetrics,
    updateRollingMetrics,
    getPressureRevenueScatter,
    updateWorldState,
    getWorldState
  };
})();
