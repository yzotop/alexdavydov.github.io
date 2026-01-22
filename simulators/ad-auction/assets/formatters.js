/**
 * Formatting utilities for numbers, currency, percentages
 */
(function() {
  'use strict';

  /**
   * Format currency
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  function formatCurrency(value, decimals = 2) {
    if (!Number.isFinite(value)) return '$0.00';
    return '$' + value.toFixed(decimals);
  }

  /**
   * Format percentage
   * @param {number} value - Value in [0, 1] or [0, 100]
   * @param {number} decimals
   * @param {boolean} asDecimal - If true, value is in [0, 1], else [0, 100]
   * @returns {string}
   */
  function formatPercent(value, decimals = 2, asDecimal = true) {
    if (!Number.isFinite(value)) return '0%';
    const pct = asDecimal ? value * 100 : value;
    return pct.toFixed(decimals) + '%';
  }

  /**
   * Format number with commas
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  function formatNumber(value, decimals = 0) {
    if (!Number.isFinite(value)) return '0';
    const num = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format delta percentage
   * @param {number} delta - Delta value
   * @param {boolean} showSign
   * @returns {string}
   */
  function formatDelta(delta, showSign = true) {
    if (!Number.isFinite(delta)) return '—';
    const sign = delta >= 0 ? '+' : '';
    const pct = (delta * 100).toFixed(1);
    return showSign ? `${sign}${pct}%` : `${pct}%`;
  }

  window.Formatters = {
    formatCurrency,
    formatPercent,
    formatNumber,
    formatDelta
  };
})();
