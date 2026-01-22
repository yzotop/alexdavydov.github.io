/**
 * Fatigue and ad pressure calculations
 */
(function() {
  'use strict';

  /**
   * Calculate ad pressure at time t
   * @param {number} impressions_so_far - Total impressions up to now
   * @param {number} t - Current time (event index)
   * @returns {number}
   */
  function calculateAdPressure(impressions_so_far, t) {
    return impressions_so_far / Math.max(1, t);
  }

  /**
   * Calculate fatigue multiplier
   * @param {number} ad_pressure - Current ad pressure
   * @param {number} fatigue_strength - Strength of fatigue effect (0..2)
   * @returns {number} Multiplier in (0, 1]
   */
  function calculateFatigueMultiplier(ad_pressure, fatigue_strength) {
    return Math.exp(-fatigue_strength * ad_pressure);
  }

  /**
   * Generate baseline noise for pCTR
   * @param {number} baseline_noise - Max noise magnitude (0..0.05)
   * @param {Function} rng - Random number generator
   * @returns {number} Noise in [-baseline_noise, baseline_noise]
   */
  function generateNoise(baseline_noise, rng) {
    return (rng() - 0.5) * 2 * baseline_noise;
  }

  window.Fatigue = {
    calculateAdPressure,
    calculateFatigueMultiplier,
    generateNoise
  };
})();
