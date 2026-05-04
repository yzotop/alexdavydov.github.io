/* utils.js — shared helpers for the simulator
   Units:
   - Time: seconds
   - Money: USD
*/

(() => {
  'use strict';

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function ema(prev, next, alpha) {
    return prev + alpha * (next - prev);
  }

  function nowPerf() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function sigmoid(x) {
    // numerically safe-ish for our small ranges
    if (x > 20) return 1;
    if (x < -20) return 0;
    return 1 / (1 + Math.exp(-x));
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
    int(min, max) {
      const a = Math.ceil(min);
      const b = Math.floor(max);
      return Math.floor(this.float() * (b - a + 1)) + a;
    }
    bool(p = 0.5) { return this.float() < p; }
  }

  // ---- Distributions ----
  function sampleNormal(rng) {
    // Box-Muller
    const u1 = Math.max(1e-12, rng.float());
    const u2 = rng.float();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function sampleTruncNormal(mean, sd, min, max, rng) {
    if (!(sd > 0)) return clamp(mean, min, max);
    let x = mean;
    for (let i = 0; i < 6; i++) {
      x = mean + sd * sampleNormal(rng);
      if (x >= min && x <= max) return x;
    }
    return clamp(x, min, max);
  }

  function sampleExponential(mean, rng) {
    const u = Math.max(1e-12, 1 - rng.float());
    return -mean * Math.log(u);
  }

  function sampleLogNormalWithMean(mean, sigma, rng) {
    const m = Math.max(1e-6, mean);
    const s = Math.max(0, sigma);
    const mu = Math.log(m) - 0.5 * s * s;
    return Math.exp(mu + s * sampleNormal(rng));
  }

  /** Knuth Poisson sampler for small lambdas + normal approx for large. */
  function samplePoisson(lambda, rng) {
    if (!(lambda > 0)) return 0;
    if (lambda > 12) {
      const z = sampleNormal(rng);
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

  // ---- Rolling series ----
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
    last() {
      if (this.count === 0) return 0;
      const idx = (this.index - 1 + this.size) % this.size;
      return this.values[idx];
    }
    sumLast(n) {
      const k = Math.min(this.count, n);
      let s = 0;
      for (let i = 0; i < k; i++) {
        const idx = (this.index - 1 - i + this.size) % this.size;
        s += this.values[idx];
      }
      return s;
    }
    meanLast(n) {
      const k = Math.min(this.count, n);
      if (k <= 0) return 0;
      return this.sumLast(k) / k;
    }
    toArray() {
      const out = new Array(this.count);
      const start = (this.index - this.count + this.size) % this.size;
      for (let i = 0; i < this.count; i++) out[i] = this.values[(start + i) % this.size];
      return out;
    }
  }

  // ---- Formatting ----
  function fmtSeconds(s) {
    if (!Number.isFinite(s)) return '—';
    if (s < 60) return `${Math.floor(s)}s`;
    const m = Math.floor(s / 60);
    const r = Math.floor(s - 60 * m);
    return `${m}m ${r}s`;
  }

  function fmtUSD(x) {
    if (!Number.isFinite(x)) return '—';
    const abs = Math.abs(x);
    if (abs >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(x / 1e3).toFixed(2)}K`;
    return `$${x.toFixed(2)}`;
  }

  function fmtPct(x, digits = 1) {
    if (!Number.isFinite(x)) return '—';
    return `${(x * 100).toFixed(digits)}%`;
  }

  function fmtNum(x, digits = 2) {
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(digits);
  }

  window.Utils = {
    clamp,
    lerp,
    ema,
    nowPerf,
    sigmoid,
    RNG,
    sampleNormal,
    sampleTruncNormal,
    sampleExponential,
    sampleLogNormalWithMean,
    samplePoisson,
    RingSeries,
    fmtSeconds,
    fmtUSD,
    fmtPct,
    fmtNum,
  };
})();

