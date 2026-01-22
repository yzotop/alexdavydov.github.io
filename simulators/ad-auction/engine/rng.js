/**
 * Seeded random number generator using Mulberry32
 * Provides reproducible randomness for simulations
 */
(function() {
  'use strict';

  let seed = 1;

  /**
   * Set the random seed
   * @param {number} s - Seed value
   */
  function setSeed(s) {
    seed = s >>> 0;
  }

  /**
   * Generate next random number [0, 1)
   * @returns {number}
   */
  function random() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), seed | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate random integer in [min, max)
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randomInt(min, max) {
    return Math.floor(random() * (max - min)) + min;
  }

  /**
   * Sample from Bernoulli distribution
   * @param {number} p - Success probability
   * @returns {boolean}
   */
  function bernoulli(p) {
    return random() < p;
  }

  /**
   * Sample from normal distribution (Box-Muller)
   * @param {number} mean
   * @param {number} stddev
   * @returns {number}
   */
  function normal(mean, stddev) {
    const u1 = random();
    const u2 = random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  window.RNG = {
    setSeed,
    random,
    randomInt,
    bernoulli,
    normal
  };
})();
