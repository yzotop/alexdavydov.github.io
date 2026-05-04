/**
 * pCTR prediction logic
 */
(function() {
  'use strict';

  /**
   * Clamp value to [min, max]
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Predict CTR for an advertiser-slot pair
   * @param {Advertiser} advertiser
   * @param {Slot} slot
   * @param {number} user_multiplier - User-specific quality multiplier
   * @param {number} fatigue_multiplier - Fatigue effect (0..1)
   * @param {number} noise - Random noise
   * @param {boolean} viewability_enabled - Whether to apply viewability
   * @returns {number} pCTR in [0, 1]
   */
  function predictCTR(advertiser, slot, user_multiplier, fatigue_multiplier, noise, viewability_enabled) {
    const slot_multiplier = viewability_enabled ? slot.viewability : 1.0;
    
    const pctr = clamp(
      advertiser.base_pctr * user_multiplier * slot_multiplier * fatigue_multiplier + noise,
      0,
      1
    );
    
    return pctr;
  }

  window.Predictor = {
    predictCTR,
    clamp
  };
})();
