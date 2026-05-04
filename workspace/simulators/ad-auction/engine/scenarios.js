/**
 * Scenario loading and management
 */
(function() {
  'use strict';

  let scenariosData = {};
  let advertisersData = [];
  let slotsData = [];

  /**
   * Load scenarios from JSON
   * @param {Object} data - Scenarios JSON data
   */
  function loadScenarios(data) {
    scenariosData = data;
  }

  /**
   * Load advertisers from JSON
   * @param {Array} data - Advertisers JSON array
   */
  function loadAdvertisers(data) {
    advertisersData = data;
  }

  /**
   * Load slots from JSON
   * @param {Array} data - Slots JSON array
   */
  function loadSlots(data) {
    slotsData = data;
  }

  /**
   * Get scenario by key
   * @param {string} key - Scenario key
   * @returns {Object|null} Scenario config
   */
  function getScenario(key) {
    return scenariosData[key] || null;
  }

  /**
   * Get all scenario keys
   * @returns {Array<string>}
   */
  function getScenarioKeys() {
    return Object.keys(scenariosData);
  }

  /**
   * Get advertisers
   * @returns {Array}
   */
  function getAdvertisers() {
    return advertisersData;
  }

  /**
   * Get slots
   * @returns {Array}
   */
  function getSlots() {
    return slotsData;
  }

  window.Scenarios = {
    loadScenarios,
    loadAdvertisers,
    loadSlots,
    getScenario,
    getScenarioKeys,
    getAdvertisers,
    getSlots
  };
})();
