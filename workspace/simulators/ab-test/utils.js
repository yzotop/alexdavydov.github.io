/* utils.js — shared helpers: RNG, RingSeries, statistics, formatters */
(() => {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function nowPerf() { return performance.now(); }

  /* ── Seeded RNG (Mulberry32) ────────────────────────────── */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class RNG {
    constructor(seed) { this.seed = (seed >>> 0) || 1; this._next = mulberry32(this.seed); }
    float() { return this._next(); }
    int(min, max) { return Math.floor(this.float() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min); }
    bool(p) { return this.float() < (p === undefined ? 0.5 : p); }
    normal(mu, sigma) {
      const u1 = this.float() || 1e-10;
      const u2 = this.float();
      return (mu || 0) + (sigma || 1) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
  }

  /* ── Rolling time-series buffer ─────────────────────────── */
  class RingSeries {
    constructor(size) { this.size = size; this.buf = new Float64Array(size); this.idx = 0; this.len = 0; }
    push(v) { this.buf[this.idx] = Number.isFinite(v) ? v : 0; this.idx = (this.idx + 1) % this.size; this.len = Math.min(this.size, this.len + 1); }
    last() { return this.len === 0 ? 0 : this.buf[(this.idx - 1 + this.size) % this.size]; }
    toArray() {
      const out = new Array(this.len);
      const s = (this.idx - this.len + this.size) % this.size;
      for (let i = 0; i < this.len; i++) out[i] = this.buf[(s + i) % this.size];
      return out;
    }
    reset() { this.idx = 0; this.len = 0; }
  }

  /* ── Statistics ─────────────────────────────────────────── */

  /** Normal CDF — Abramowitz & Stegun approximation */
  function normCDF(z) {
    if (z < -8) return 0; if (z > 8) return 1;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  /** Two-proportion z-test (two-tailed) */
  function zTest2Prop(sA, nA, sB, nB) {
    if (nA < 2 || nB < 2) return { z: 0, p: 1, ci: [0, 0], delta: 0, pA: 0, pB: 0 };
    const pA = sA / nA, pB = sB / nB;
    const delta = pB - pA;
    const pool = (sA + sB) / (nA + nB);
    const sePool = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
    const z = sePool > 1e-12 ? delta / sePool : 0;
    const pVal = 2 * (1 - normCDF(Math.abs(z)));
    const seWald = Math.sqrt(pA * (1 - pA) / nA + pB * (1 - pB) / nB);
    const margin = 1.96 * seWald;
    return { z, p: pVal, ci: [delta - margin, delta + margin], delta, pA, pB };
  }

  /* ── Formatters ─────────────────────────────────────────── */
  function fmtPct(v, d) { return Number.isFinite(v) ? (v * 100).toFixed(d === undefined ? 2 : d) + '%' : '—'; }
  function fmtNum(v) { return Number.isFinite(v) ? v.toLocaleString('en-US') : '—'; }
  function fmtP(p) { return !Number.isFinite(p) ? '—' : p < 0.001 ? '< 0.001' : p.toFixed(3); }
  function fmtDay(t) { return 'Day ' + (Math.floor(t) + 1); }
  function fmtDayHour(t) { const d = Math.floor(t) + 1; const h = Math.floor((t % 1) * 24); return 'Day ' + d + ', ' + String(h).padStart(2, '0') + ':00'; }

  window.Utils = { clamp, lerp, nowPerf, RNG, RingSeries, normCDF, zTest2Prop, fmtPct, fmtNum, fmtP, fmtDay, fmtDayHour };
})();
