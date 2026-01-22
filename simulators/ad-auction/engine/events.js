/**
 * Event logging and formatting
 */
(function() {
  'use strict';

  /**
   * Format event for display in log table
   * @param {EventResult} event
   * @returns {Object} Formatted event data
   */
  function formatEvent(event) {
    const winners = event.slot_results
      .filter(sr => sr.winner)
      .map(sr => sr.winner.name)
      .join(', ') || '—';
    
    const prices = event.slot_results
      .filter(sr => sr.winner)
      .map(sr => sr.price_cpm.toFixed(2))
      .join(', ') || '—';
    
    const clicks = event.slot_results
      .filter(sr => sr.click)
      .length;
    
    const reason = event.slot_results.length > 0
      ? event.slot_results[0].reason
      : 'not_opened';
    
    return {
      t: event.t,
      opened_slots: event.opened_slots,
      filled_slots: event.filled_slots,
      winners: winners,
      prices: prices,
      clicks: clicks,
      reason: reason
    };
  }

  /**
   * Get paginated events
   * @param {Array<EventResult>} events
   * @param {number} page - Page number (1-indexed)
   * @param {number} page_size - Items per page
   * @returns {Object} {items, total, pages, current_page}
   */
  function getPaginatedEvents(events, page, page_size) {
    const total = events.length;
    const pages = Math.ceil(total / page_size);
    const current_page = Math.max(1, Math.min(page, pages));
    const start = (current_page - 1) * page_size;
    const end = start + page_size;
    const items = events.slice(start, end).map(formatEvent);
    
    return {
      items,
      total,
      pages,
      current_page
    };
  }

  window.Events = {
    formatEvent,
    getPaginatedEvents
  };
})();
