/**
 * Auction logic: select winner and compute scores
 */
(function() {
  'use strict';

  /**
   * Compute auction score for an advertiser
   * @param {Advertiser} advertiser
   * @param {number} pctr - Predicted CTR
   * @param {number} quality - Quality multiplier (already in advertiser, but can override)
   * @returns {number} Score
   */
  function computeScore(advertiser, pctr, quality) {
    const q = quality !== undefined ? quality : advertiser.quality;
    return advertiser.bid_cpm * pctr * q;
  }

  /**
   * Run auction for a single slot
   * @param {Array<Advertiser>} advertisers - All advertisers
   * @param {Slot} slot - Slot to fill
   * @param {Function} getPCTR - Function(advertiser, slot) -> pCTR
   * @param {number} floor_cpm_multiplier - Floor multiplier
   * @returns {Object} {winner, second_best_score, all_scores, reason}
   */
  function runAuction(advertisers, slot, getPCTR, floor_cpm_multiplier) {
    // Filter eligible advertisers (check format, budget, and viewability)
    const eligible = advertisers.filter(adv => {
      if (!adv.formats.includes(slot.format)) return false;
      if (adv.remaining_budget !== undefined && adv.remaining_budget <= 0) return false;
      return true;
    });
    
    const eligible_count = eligible.length;
    
    if (eligible.length === 0) {
      return {
        winner: null,
        second_best_score: 0,
        all_scores: [],
        eligible_count: eligible_count,
        reason: 'no_eligible'
      };
    }
    
    // Compute scores for all eligible
    const scored = eligible.map(adv => {
      const pctr = getPCTR(adv, slot);
      const score = computeScore(adv, pctr);
      return {
        advertiser: adv,
        pctr: pctr,
        score: score,
        effective_value: adv.bid_cpm * pctr * adv.quality
      };
    });
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    const winner_candidate = scored[0];
    const floor_cpm = slot.floor_cpm * floor_cpm_multiplier;
    
    // Check floor
    if (winner_candidate.advertiser.bid_cpm < floor_cpm) {
      return {
        winner: null,
        second_best_score: 0,
        all_scores: scored,
        eligible_count: eligible_count,
        reason: 'below_floor'
      };
    }
    
    const second_best = scored.length > 1 ? scored[1] : null;
    
    return {
      winner: winner_candidate.advertiser,
      winner_pctr: winner_candidate.pctr,
      winner_quality: winner_candidate.advertiser.quality,
      winner_effective_value: winner_candidate.effective_value,
      second_best_score: second_best ? second_best.score : 0,
      second_best_effective_value: second_best ? second_best.effective_value : 0,
      all_scores: scored,
      eligible_count: eligible_count,
      reason: 'filled'
    };
  }

  window.Auction = {
    computeScore,
    runAuction
  };
})();
