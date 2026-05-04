/* utils.js
   Shared utilities: seeded RNG, math helpers, ring buffers, percentile, and formatting.
   Units:
   - Time: seconds
   - Distance: pixels
*/

(() => {
  'use strict';

  /** Clamp value to [min, max]. */
  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  /** Linear interpolation. */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Exponential moving average: prev + alpha*(next-prev). */
  function ema(prev, next, alpha) {
    return prev + alpha * (next - prev);
  }

  function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.hypot(dx, dy);
  }

  function nowPerf() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // ---- Seeded RNG (Mulberry32) ----
  function mulberry32(seed) {
    let a = (seed >>> 0);
    return function next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RNG {
    constructor(seed) {
      this.seed = (seed >>> 0) || 1;
      this._next = mulberry32(this.seed);
    }
    float() { return this._next(); } // [0,1)
    int(min, max) { // inclusive
      const a = Math.ceil(min);
      const b = Math.floor(max);
      return Math.floor(this.float() * (b - a + 1)) + a;
    }
    bool(p = 0.5) { return this.float() < p; }
    choice(arr) { return arr[Math.floor(this.float() * arr.length)]; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.float() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    }
  }

  // ---- Distributions ----

  /** Knuth Poisson sampler (good for small lambda). */
  function samplePoisson(lambda, rng) {
    if (!(lambda > 0)) return 0;
    // This sim uses dt <= 0.2 and lambda_per_sec <= 4, so lambda*dt <= 0.8 typically.
    // Still, make it safe for higher values.
    if (lambda > 12) {
      // Normal approximation for high mean.
      // Variance = lambda. Clamp to non-negative.
      const u1 = Math.max(1e-12, rng.float());
      const u2 = rng.float();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const k = Math.round(lambda + Math.sqrt(lambda) * z);
      return Math.max(0, k);
    }
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.float();
    } while (p > L);
    return k - 1;
  }

  /** Weighted choice by weights array. Returns index. */
  function pickWeightedIndex(weights, rng) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    if (!(total > 0)) return 0;
    let r = rng.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  /** Percentile p in [0,1]. Returns NaN if empty. */
  function percentile(values, p) {
    if (!values || values.length === 0) return NaN;
    const arr = values.slice().sort((a, b) => a - b);
    const idx = (arr.length - 1) * clamp(p, 0, 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return arr[lo];
    const t = idx - lo;
    return lerp(arr[lo], arr[hi], t);
  }

  // ---- Ring buffers / timeseries ----
  class RingSeries {
    constructor(size) {
      this.size = size;
      this.values = new Float64Array(size);
      this.index = 0;
      this.count = 0;
    }
    push(v) {
      this.values[this.index] = Number.isFinite(v) ? v : 0;
      this.index = (this.index + 1) % this.size;
      this.count = Math.min(this.size, this.count + 1);
    }
    /** Oldest -> newest array. */
    toArray() {
      const out = new Array(this.count);
      const start = (this.index - this.count + this.size) % this.size;
      for (let i = 0; i < this.count; i++) {
        out[i] = this.values[(start + i) % this.size];
      }
      return out;
    }
    /** Sum of last n (or all if fewer). */
    sumLast(n) {
      const k = Math.min(this.count, n);
      let s = 0;
      for (let i = 0; i < k; i++) {
        const idx = (this.index - 1 - i + this.size) % this.size;
        s += this.values[idx];
      }
      return s;
    }
    last() {
      if (this.count === 0) return 0;
      const idx = (this.index - 1 + this.size) % this.size;
      return this.values[idx];
    }
  }

  // ---- Formatting ----
  function formatSeconds(s) {
    if (!Number.isFinite(s)) return '—';
    if (s < 1) return `${Math.round(s * 1000)}ms`;
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60);
    const r = Math.round(s - 60 * m);
    return `${m}m ${r}s`;
  }

  function formatPercent01(x, digits = 0) {
    if (!Number.isFinite(x)) return '—';
    return `${(x * 100).toFixed(digits)}%`;
  }

  function formatMoneyRub(x) {
    if (!Number.isFinite(x)) return '—';
    const sgn = x < 0 ? '-' : '';
    const v = Math.abs(x);
    if (v >= 1e9) return `${sgn}₽${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${sgn}₽${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${sgn}₽${(v / 1e3).toFixed(1)}K`;
    return `${sgn}₽${Math.round(v)}`;
  }

  function formatFloat(x, digits = 2) {
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(digits);
  }

  window.Utils = {
    clamp,
    lerp,
    ema,
    dist,
    nowPerf,
    RNG,
    samplePoisson,
    pickWeightedIndex,
    percentile,
    RingSeries,
    formatSeconds,
    formatPercent01,
    formatMoneyRub,
    formatFloat,
  };
})();

