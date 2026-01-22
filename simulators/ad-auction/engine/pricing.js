/**
 * Pricing logic: compute payment for winning advertiser
 */
(function() {
  'use strict';

  /**
   * Compute second-price payment
   * @param {Advertiser} winner
   * @param {number} winner_pctr
   * @param {number} winner_quality
   * @param {number} second_best_effective_value
   * @param {number} floor_cpm
   * @returns {number} Payment CPM
   */
  function secondPrice(winner, winner_pctr, winner_quality, second_best_effective_value, floor_cpm) {
    if (!winner || winner_pctr === 0 || winner_quality === 0) {
      return floor_cpm;
    }
    
    // Convert second-best effective value back to CPM
    // effective_value = bid_cpm * pctr * quality
    // So: pay_cpm = second_best_effective_value / (winner_pctr * winner_quality)
    const denominator = winner_pctr * winner_quality;
    if (denominator === 0) {
      return floor_cpm;
    }
    
    const pay_cpm = second_best_effective_value / denominator;
    return Math.max(floor_cpm, pay_cpm);
  }

  /**
   * Compute first-price payment
   * @param {Advertiser} winner
   * @param {number} floor_cpm
   * @returns {number} Payment CPM
   */
  function firstPrice(winner, floor_cpm) {
    if (!winner) {
      return floor_cpm;
    }
    return Math.max(floor_cpm, winner.bid_cpm);
  }

  /**
   * Compute hybrid payment
   * @param {Advertiser} winner
   * @param {number} winner_pctr
   * @param {number} winner_quality
   * @param {number} second_best_effective_value
   * @param {number} floor_cpm
   * @param {number} alpha - Weight on first price (0 = second price, 1 = first price)
   * @returns {number} Payment CPM
   */
  function hybridPrice(winner, winner_pctr, winner_quality, second_best_effective_value, floor_cpm, alpha) {
    const first = firstPrice(winner, floor_cpm);
    const second = secondPrice(winner, winner_pctr, winner_quality, second_best_effective_value, floor_cpm);
    return alpha * first + (1 - alpha) * second;
  }

  /**
   * Main pricing dispatcher
   * @param {string} pricing_type - 'second_price' | 'first_price' | 'hybrid'
   * @param {Object} params - Pricing parameters
   * @param {Object} auction_result - Result from auction.runAuction
   * @param {Slot} slot - Slot being filled
   * @param {number} floor_multiplier - Floor multiplier
   * @returns {number} Payment CPM
   */
  function computePrice(pricing_type, params, auction_result, slot, floor_multiplier) {
    const floor_cpm = slot.floor_cpm * floor_multiplier;
    
    if (!auction_result.winner) {
      return 0;
    }
    
    switch (pricing_type) {
      case 'second_price':
        return secondPrice(
          auction_result.winner,
          auction_result.winner_pctr,
          auction_result.winner_quality,
          auction_result.second_best_effective_value,
          floor_cpm
        );
      
      case 'first_price':
        return firstPrice(auction_result.winner, floor_cpm);
      
      case 'hybrid':
        return hybridPrice(
          auction_result.winner,
          auction_result.winner_pctr,
          auction_result.winner_quality,
          auction_result.second_best_effective_value,
          floor_cpm,
          params.hybrid_alpha || 0.5
        );
      
      default:
        return floor_cpm;
    }
  }

  window.Pricing = {
    secondPrice,
    firstPrice,
    hybridPrice,
    computePrice
  };
})();
