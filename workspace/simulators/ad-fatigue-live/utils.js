/* utils.js — shared helpers for the simulator */

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
    float() { return this._next(); }
    int(min, max) {
      const a = Math.ceil(min);
      const b = Math.floor(max);
      return Math.floor(this.float() * (b - a + 1)) + a;
    }
    bool(p = 0.5) { return this.float() < p; }
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
    RingSeries,
    fmtSeconds,
    fmtUSD,
    fmtPct,
    fmtNum,
  };
})();
