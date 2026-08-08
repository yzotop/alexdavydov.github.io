/* utils.js — shared helpers for the simulator */

(() => {
  'use strict';

  function clamp(v, min, max) {
    if (v < min) return min;
    if (v > max) return max;
    return v;
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

  // ---- Canvas ----
  // Тот же приём, что в ad-fatigue-live/charts.js: разрешение канваса
  // поднимаем до devicePixelRatio, а рисуем в CSS-пикселях через ctx.scale.
  // Без этого на retina текст и линии мылят.
  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return { cssW: rect.width, cssH: rect.height, w, h, dpr };
  }

  // ---- Formatting ----
  function fmtRub(x, digits = 0) {
    if (!Number.isFinite(x)) return '—';
    return `${x.toFixed(digits)} ₽`;
  }

  function fmtPct(x, digits = 0) {
    if (!Number.isFinite(x)) return '—';
    return `${(x * 100).toFixed(digits)}%`;
  }

  function fmtNum(x, digits = 2) {
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(digits);
  }

  function fmtInt(x) {
    if (!Number.isFinite(x)) return '—';
    return String(Math.round(x));
  }

  window.Utils = {
    clamp,
    mulberry32,
    RNG,
    resizeCanvas,
    fmtRub,
    fmtPct,
    fmtNum,
    fmtInt,
  };
})();
