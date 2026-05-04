/* render.js
   Canvas rendering for:
   - City view (drivers/orders/zones/overlays)
   - Mini time-series charts (last 120 seconds at 1-second resolution)
*/

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before render.js');

  function resizeCanvasToElement(canvas, cssW, cssH) {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // cap for perf
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr };
  }

  function clear(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function colorForSurge(mult) {
    // mult: 1..4 (cap). Map to warm ramp.
    const t = U.clamp((mult - 1) / 2.5, 0, 1);
    const r = Math.round(U.lerp(59, 251, t));
    const g = Math.round(U.lerp(130, 113, t));
    const b = Math.round(U.lerp(246, 133, t));
    return `rgb(${r},${g},${b})`;
  }

  function colorForDemandIntensity(t) {
    const tt = U.clamp(t, 0, 1);
    const r = Math.round(U.lerp(16, 251, tt));
    const g = Math.round(U.lerp(185, 191, tt));
    const b = Math.round(U.lerp(129, 36, tt));
    return `rgb(${r},${g},${b})`;
  }

  class Renderer {
    constructor({ cityCanvas, charts }) {
      this.cityCanvas = cityCanvas;
      this.cityCtx = cityCanvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!this.cityCtx) throw new Error('2D context not available for city canvas');

      this.charts = charts;
      this.chartCtx = {};
      for (const key of Object.keys(charts)) {
        const c = charts[key];
        const ctx = c.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) throw new Error(`2D context not available for chart canvas: ${key}`);
        this.chartCtx[key] = ctx;
      }

      // perf HUD
      this._fps = 0;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
      this._lastFpsT = U.nowPerf();
    }

    resizeCityToContainer() {
      const rect = this.cityCanvas.getBoundingClientRect();
      return resizeCanvasToElement(this.cityCanvas, rect.width, rect.height);
    }

    resizeChartsToContainer() {
      for (const key of Object.keys(this.charts)) {
        const canvas = this.charts[key];
        const rect = canvas.getBoundingClientRect();
        resizeCanvasToElement(canvas, rect.width, rect.height);
      }
    }

    updatePerfHUD(dtFrameSec) {
      // EWMA FPS estimate
      const fps = dtFrameSec > 1e-6 ? (1 / dtFrameSec) : 0;
      this._fps = U.ema(this._fps, fps, 0.08);
      return this._fps;
    }

    drawCity(sim, opts, dtFrameSec) {
      const ctx = this.cityCtx;
      const { w, h, dpr } = this.resizeCityToContainer();
      const world = sim.world;

      // World size in sim is logical CSS pixels; scale mapping is 1:1.
      // Ensure sim knows current drawable size (in CSS px).
      sim.setWorldSize(w / dpr, h / dpr);

      ctx.save();
      ctx.scale(dpr, dpr);

      const W = sim.world.width;
      const H = sim.world.height;
      clear(ctx, W, H);

      // background
      ctx.fillStyle = 'rgba(2, 6, 23, 0.08)';
      ctx.fillRect(0, 0, W, H);

      // overlays
      if (opts.showDemandHeat) this._drawDemandHeat(ctx, sim);
      if (opts.showSurgeHeat) this._drawSurgeHeat(ctx, sim);

      if (opts.showZoneBorders) this._drawZoneBorders(ctx, sim);

      // assignment flashes
      this._drawFlashes(ctx, sim);

      // orders
      this._drawOrders(ctx, sim);

      // drivers
      this._drawDrivers(ctx, sim);

      // corner legend
      this._drawMiniLegend(ctx);

      ctx.restore();

      // perf
      return this.updatePerfHUD(dtFrameSec);
    }

    _drawZoneBorders(ctx, sim) {
      const world = sim.world;
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      // vertical
      for (let c = 1; c < world.zoneCols; c++) {
        const x = c * world.zoneW;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, world.height);
        ctx.stroke();
      }
      // horizontal
      for (let r = 1; r < world.zoneRows; r++) {
        const y = r * world.zoneH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(world.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawDemandHeat(ctx, sim) {
      // intensity by pending orders count per zone (normalized)
      const z = sim.world.zoneCount;
      let max = 0;
      for (let i = 0; i < z; i++) max = Math.max(max, sim.zonePending[i] || 0);
      if (max <= 0) return;

      ctx.save();
      for (let i = 0; i < z; i++) {
        const cnt = sim.zonePending[i] || 0;
        if (cnt <= 0) continue;
        const t = U.clamp(cnt / max, 0, 1);
        const rect = zoneRect(i, sim.world);
        ctx.globalAlpha = 0.12 + 0.22 * t;
        ctx.fillStyle = colorForDemandIntensity(t);
        ctx.fillRect(rect.x0, rect.y0, sim.world.zoneW, sim.world.zoneH);
      }
      ctx.restore();
    }

    _drawSurgeHeat(ctx, sim) {
      const z = sim.world.zoneCount;
      ctx.save();
      for (let i = 0; i < z; i++) {
        const mult = 1 + (sim.surge[i] || 0);
        const t = U.clamp((mult - 1) / Math.max(1e-6, sim.cfg.surgeCap || 1), 0, 1);
        if (t <= 0.01) continue;
        const rect = zoneRect(i, sim.world);
        ctx.globalAlpha = 0.08 + 0.22 * t;
        ctx.fillStyle = colorForSurge(mult);
        ctx.fillRect(rect.x0, rect.y0, sim.world.zoneW, sim.world.zoneH);
      }
      ctx.restore();
    }

    _drawFlashes(ctx, sim) {
      if (!sim.flashes || sim.flashes.length === 0) return;
      ctx.save();
      for (let i = 0; i < sim.flashes.length; i++) {
        const f = sim.flashes[i];
        const age = sim.time - f.t0;
        const t = U.clamp(1 - age / f.ttl, 0, 1);
        ctx.globalAlpha = 0.4 * t;
        ctx.strokeStyle = 'rgba(96,165,250,1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawOrders(ctx, sim) {
      const orders = sim.orders;
      if (!orders || orders.length === 0) return;

      ctx.save();
      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        if (o.state === 'waiting') {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.beginPath();
          ctx.arc(o.x, o.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.state === 'assigned') {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(o.x, o.y, 3.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawDrivers(ctx, sim) {
      const drivers = sim.drivers;
      if (!drivers || drivers.length === 0) return;

      ctx.save();
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];
        let fill = 'rgba(148,163,184,0.85)'; // idle gray
        if (d.state === 'to_pickup') fill = 'rgba(96,165,250,0.95)';
        else if (d.state === 'to_dropoff') fill = 'rgba(52,211,153,0.95)';

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 3.0, 0, Math.PI * 2);
        ctx.fill();

        // small heading line for active drivers
        if (d.state !== 'idle') {
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = fill;
          ctx.lineWidth = 1;
          const tx = d.targetX;
          const ty = d.targetY;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + 0.18 * (tx - d.x), d.y + 0.18 * (ty - d.y));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    _drawMiniLegend(ctx) {
      ctx.save();
      const pad = 10;
      const x = pad;
      const y = pad;
      const w = 210;
      const h = 64;
      ctx.globalAlpha = 0.9;
      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(229,231,235,0.85)';
      ctx.fillText('Drivers:', x + 10, y + 18);

      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.fillText('idle', x + 76, y + 18);
      ctx.fillStyle = 'rgba(96,165,250,0.95)';
      ctx.fillText('to pickup', x + 110, y + 18);
      ctx.fillStyle = 'rgba(52,211,153,0.95)';
      ctx.fillText('to dropoff', x + 172, y + 18);

      ctx.fillStyle = 'rgba(229,231,235,0.85)';
      ctx.font = '600 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('Orders:', x + 10, y + 40);
      ctx.fillStyle = 'rgba(251,191,36,0.95)';
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillText('waiting ●  assigned ○', x + 76, y + 40);

      ctx.restore();
    }

    // ---- Mini charts ----
    drawCharts(seriesMap) {
      // seriesMap: { revenue: number[], p90eta: number[], cancelRate: number[], util: number[] }
      this.resizeChartsToContainer();
      if (seriesMap.revenue) this._drawMiniLine(this.chartCtx.revenue, this.charts.revenue, seriesMap.revenue, { color: 'rgba(96,165,250,0.95)', yFmt: U.formatMoneyRub, ySuffix: '', yPad: 0.12 });
      if (seriesMap.p90eta) this._drawMiniLine(this.chartCtx.p90eta, this.charts.p90eta, seriesMap.p90eta, { color: 'rgba(251,191,36,0.95)', yFmt: (v) => `${Math.round(v)}s`, yPad: 0.18 });
      if (seriesMap.cancelRate) this._drawMiniLine(this.chartCtx.cancel, this.charts.cancel, seriesMap.cancelRate, { color: 'rgba(251,113,133,0.95)', yFmt: (v) => `${(v * 100).toFixed(1)}%`, fixedMin: 0, fixedMax: 1 });
      if (seriesMap.util) this._drawMiniLine(this.chartCtx.util, this.charts.util, seriesMap.util, { color: 'rgba(52,211,153,0.95)', yFmt: (v) => `${Math.round(v * 100)}%`, fixedMin: 0, fixedMax: 1 });
    }

    _drawMiniLine(ctx, canvas, values, opts) {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const W = Math.floor(rect.width * dpr);
      const H = Math.floor(rect.height * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

      ctx.save();
      ctx.scale(1, 1);
      clear(ctx, W, H);

      // chart frame
      ctx.fillStyle = 'rgba(2, 6, 23, 0.10)';
      ctx.fillRect(0, 0, W, H);

      const padL = 36 * dpr;
      const padR = 10 * dpr;
      const padT = 10 * dpr;
      const padB = 16 * dpr;
      const x0 = padL, y0 = padT;
      const x1 = W - padR, y1 = H - padB;
      const plotW = Math.max(1, x1 - x0);
      const plotH = Math.max(1, y1 - y0);

      // y-range
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        ctx.restore();
        return;
      }
      if (Number.isFinite(opts.fixedMin)) min = opts.fixedMin;
      if (Number.isFinite(opts.fixedMax)) max = opts.fixedMax;
      if (min === max) {
        const bump = (Math.abs(min) > 1) ? Math.abs(min) * 0.08 : 1;
        min -= bump;
        max += bump;
      } else {
        const pad = (opts.yPad != null) ? opts.yPad : 0.15;
        const r = max - min;
        min -= r * pad;
        max += r * pad;
      }

      // grid (2 lines)
      ctx.strokeStyle = 'rgba(148,163,184,0.10)';
      ctx.lineWidth = 1;
      for (let g = 1; g <= 2; g++) {
        const yy = y0 + (plotH * g) / 3;
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x1, yy);
        ctx.stroke();
      }

      // line
      const n = values.length;
      ctx.strokeStyle = opts.color || 'rgba(96,165,250,0.95)';
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const v = values[i];
        const t = (n <= 1) ? 0 : i / (n - 1);
        const xx = x0 + t * plotW;
        const yy = y1 - ((v - min) / (max - min)) * plotH;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();

      // current dot
      const last = values[n - 1];
      const xx = x1;
      const yy = y1 - ((last - min) / (max - min)) * plotH;
      ctx.fillStyle = opts.color || 'rgba(96,165,250,0.95)';
      ctx.beginPath();
      ctx.arc(xx, yy, 2.6 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // y labels (min/max)
      ctx.fillStyle = 'rgba(229,231,235,0.60)';
      ctx.font = `${Math.round(10 * dpr)}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const fmt = opts.yFmt || ((v) => String(v));
      ctx.fillText(fmt(max), 6 * dpr, y0);
      ctx.fillText(fmt(min), 6 * dpr, y1);

      ctx.restore();
    }
  }

  // zoneRect helper shared with sim.js (duplicated to avoid module imports on file://)
  function zoneRect(zoneId, world) {
    const cx = zoneId % world.zoneCols;
    const cy = Math.floor(zoneId / world.zoneCols);
    const x0 = cx * world.zoneW;
    const y0 = cy * world.zoneH;
    return { x0, y0, x1: x0 + world.zoneW, y1: y0 + world.zoneH, cx, cy };
  }

  function createRenderer(canvases) {
    return new Renderer(canvases);
  }

  window.Render = { createRenderer };
})();

