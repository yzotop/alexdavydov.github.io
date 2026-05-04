/* render.js — Canvas rendering: session stream + heat strip + mini charts */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before render.js');

  function getCpmBucket(cpm, stats) {
    const x = Number(cpm);
    const p25 = Number(stats && stats.cpmP25);
    const p75 = Number(stats && stats.cpmP75);
    const mean = Number(stats && stats.cpmMean);

    const hasQuantiles = Number.isFinite(p25) && Number.isFinite(p75) && (p75 > p25 * 1.02);
    let lowThr, highThr;
    if (hasQuantiles) {
      lowThr = p25;
      highThr = p75;
    } else {
      // fallback around bid value mean
      const m = Number.isFinite(mean) && mean > 0 ? mean : 1;
      lowThr = 0.7 * m;
      highThr = 1.3 * m;
    }

    if (!Number.isFinite(x)) {
      return { strokeColor: 'rgba(251,191,36,0.95)', label: 'mid' };
    }
    if (x < lowThr) return { strokeColor: 'rgba(251,113,133,0.95)', label: 'low' };
    if (x > highThr) return { strokeColor: 'rgba(52,211,153,0.95)', label: 'high' };
    return { strokeColor: 'rgba(251,191,36,0.95)', label: 'mid' };
  }

  function resizeCanvasToElement(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { cssW: rect.width, cssH: rect.height, w, h, dpr };
  }

  function fatigueColor(f) {
    // Map fatigue to color: low → cyan-ish, high → orange/red.
    const t = U.clamp(f / 2.0, 0, 1);
    const r = Math.round(U.lerp(90, 255, t));
    const g = Math.round(U.lerp(220, 90, t));
    const b = Math.round(U.lerp(255, 70, t));
    return { r, g, b };
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

  function fmtUSDCompact(x) {
    if (!Number.isFinite(x)) return '—';
    if (Math.abs(x) >= 1000) return `$${(x / 1000).toFixed(1)}K`;
    return `$${x.toFixed(2)}`;
  }

  class Renderer {
    constructor({ mainCanvas, chartCanvases }) {
      this.mainCanvas = mainCanvas;
      this.ctx = mainCanvas.getContext('2d', { alpha: true, desynchronized: true });
      if (!this.ctx) throw new Error('2D context not available for main canvas');

      this.charts = chartCanvases;
      this.chartCtx = {};
      for (const k of Object.keys(chartCanvases)) {
        const c = chartCanvases[k];
        const ctx = c.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) throw new Error(`2D context not available for chart canvas: ${k}`);
        this.chartCtx[k] = ctx;
      }

      this._fps = 0;
      this._simHz = 0;
    }

    draw(sim, alpha, dtFrameSec) {
      const { w, h, dpr } = resizeCanvasToElement(this.mainCanvas);
      const ctx = this.ctx;

      ctx.save();
      ctx.scale(dpr, dpr);

      const W = w / dpr;
      const H = h / dpr;
      ctx.clearRect(0, 0, W, H);

      // background grid
      this._drawGrid(ctx, W, H);

      // heat strip
      if (sim.params.show_heat_strip) this._drawHeatStrip(ctx, W, H, sim);

      // opportunity marks (ticks)
      this._drawOpportunityMarks(ctx, W, H, sim);

      // banner impressions (rectangles)
      this._drawBanners(ctx, W, H, sim);

      // ended sessions (fade out)
      this._drawGhosts(ctx, W, H, sim);

      // sessions
      this._drawSessions(ctx, W, H, sim, alpha);

      // flashes
      if (sim.params.show_ad_flashes) this._drawFlashes(ctx, W, H, sim, alpha);

      // small legend
      this._drawLegend(ctx, W, H, sim);

      ctx.restore();
    }

    _drawGrid(ctx, W, H) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.08)';
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x <= W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawHeatStrip(ctx, W, H, sim) {
      const stripH = 14;
      const pad = 10;
      const x0 = pad;
      const y0 = pad;
      const w = W - 2 * pad;

      // background
      ctx.save();
      drawRoundedRect(ctx, x0, y0, w, stripH, 7);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const series = sim.pressure60.toArray();
      const n = 60;
      const segW = w / n;
      // normalize against a reasonable range
      const maxRate = Math.max(1e-6, Math.min(0.6, sim.params.target_ad_rate * 2 + 0.02));
      for (let i = 0; i < n; i++) {
        const v = (i < series.length) ? series[Math.max(0, series.length - n + i)] : 0;
        const t = U.clamp(v / maxRate, 0, 1);
        const r = Math.round(U.lerp(96, 255, t));
        const g = Math.round(U.lerp(165, 120, t));
        const b = Math.round(U.lerp(250, 70, t));
        ctx.fillStyle = `rgba(${r},${g},${b},${0.15 + 0.65 * t})`;
        ctx.fillRect(x0 + i * segW, y0, Math.ceil(segW), stripH);
      }

      ctx.restore();
    }

    _sessionXY(s, W, H, alpha) {
      const padX = 18;
      const padY = 26;
      const tAlive = U.lerp(s.t_alive_prev, s.t_alive, alpha);
      const prog = U.clamp(tAlive / Math.max(1e-6, s.t_target), 0, 1);
      const x = padX + prog * (W - 2 * padX);

      // lane mapping
      const laneH = 12;
      const lanes = Math.max(10, Math.floor((H - 2 * padY) / laneH));
      const laneIdx = Math.floor((s.y01 * lanes)) % lanes;
      const baseY = padY + laneIdx * laneH + laneH * 0.5;
      const y = baseY + s.jitter * laneH * 0.35;
      return { x, y, prog };
    }

    _ghostXY(g, W, H) {
      const padX = 18;
      const padY = 26;
      const prog = U.clamp(g.prog, 0, 1);
      const x = padX + prog * (W - 2 * padX);

      const laneH = 12;
      const lanes = Math.max(10, Math.floor((H - 2 * padY) / laneH));
      const laneIdx = Math.floor((g.y01 * lanes)) % lanes;
      const baseY = padY + laneIdx * laneH + laneH * 0.5;
      const y = baseY + g.jitter * laneH * 0.35;
      return { x, y };
    }

    _markXY(m, W, H) {
      const padX = 18;
      const padY = 26;
      const prog = U.clamp(m.prog, 0, 1);
      const x = padX + prog * (W - 2 * padX);

      const laneH = 12;
      const lanes = Math.max(10, Math.floor((H - 2 * padY) / laneH));
      const laneIdx = Math.floor((m.y01 * lanes)) % lanes;
      const baseY = padY + laneIdx * laneH + laneH * 0.5;
      const y = baseY + m.jitter * laneH * 0.35;
      return { x, y };
    }

    _drawOpportunityMarks(ctx, W, H, sim) {
      // requirement: show marks only when "Show ad flashes" is ON
      if (!sim.params.show_ad_flashes) return;
      const marks = sim.oppMarks;
      if (!marks || marks.length === 0) return;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(229,231,235,0.28)';
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        const age = sim.time - m.t0;
        const t = U.clamp(1 - age / m.ttl, 0, 1);
        const { x, y } = this._markXY(m, W, H);
        ctx.globalAlpha = 0.22 * t;
        ctx.beginPath();
        ctx.moveTo(x, y - 3.2);
        ctx.lineTo(x, y + 3.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawBanners(ctx, W, H, sim) {
      const banners = sim.banners;
      if (!banners || banners.length === 0) return;

      const stats = sim.stats || { cpmP25: sim.cpmP25, cpmP75: sim.cpmP75, cpmMean: sim.params.bid_cpm_mean };

      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      // small, fast rectangles; cap draw count to keep 60fps under extreme load
      const maxDraw = 8000;
      const start = Math.max(0, banners.length - maxDraw);
      for (let i = start; i < banners.length; i++) {
        const b = banners[i];
        const age = sim.time - b.t0;
        const t = U.clamp(1 - age / b.ttl, 0, 1);
        const { x, y } = this._markXY(b, W, H);

        // position slightly ahead of user
        const bx = x + 8;
        const by = y - 3;
        const bw = 8;
        const bh = 6;

        // Banner should look banner-like: constant orange fill.
        // CPM quality is a secondary cue via outline color.
        const bucket = getCpmBucket(b.cpm, stats);

        ctx.globalAlpha = 0.18 + 0.60 * t;
        ctx.fillStyle = 'rgba(255,165,0,1)'; // orange banner
        ctx.fillRect(bx, by, bw, bh);
        ctx.globalAlpha = 0.14 + 0.44 * t;
        ctx.strokeStyle = bucket.strokeColor;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

        if (b.label && t > 0.55) {
          ctx.globalAlpha = 0.50 * t;
          ctx.fillStyle = 'rgba(229,231,235,0.75)';
          ctx.fillText(b.label, bx + bw + 6, by + bh * 0.5);
        }
      }
      ctx.restore();
    }

    _drawGhosts(ctx, W, H, sim) {
      const ghosts = sim.ghosts;
      if (!ghosts || ghosts.length === 0) return;
      ctx.save();
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        const age = sim.time - g.t0;
        const t = U.clamp(1 - age / g.ttl, 0, 1);
        const { x, y } = this._ghostXY(g, W, H);
        const c = fatigueColor(g.fatigue);
        ctx.globalAlpha = 0.55 * t;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},1)`;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawSessions(ctx, W, H, sim, alpha) {
      const p = sim.params;
      const sessions = sim.sessions;
      if (!sessions || sessions.length === 0) return;

      ctx.save();

      // trails first (behind)
      if (p.show_trails) {
        ctx.strokeStyle = 'rgba(229,231,235,0.10)';
        ctx.lineWidth = 1;
        for (let i = 0; i < sessions.length; i++) {
          const s = sessions[i];
          if (!s.trail || s.trail.length < 2) continue;
          ctx.beginPath();
          for (let j = 0; j < s.trail.length; j++) {
            const prog = U.clamp(s.trail[j].prog, 0, 1);
            const x = 18 + prog * (W - 36);
            // keep y stable
            const { y } = this._sessionXY(s, W, H, alpha);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }

      // dots
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        const { x, y } = this._sessionXY(s, W, H, alpha);
        const f = U.lerp(s.fatigue_prev, s.fatigue, alpha);
        const c = fatigueColor(f);
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.95)`;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    _drawFlashes(ctx, W, H, sim, alpha) {
      const flashes = sim.flashes;
      if (!flashes || flashes.length === 0) return;
      ctx.save();
      for (let i = 0; i < flashes.length; i++) {
        const f = flashes[i];
        const age = sim.time - f.t0;
        const t = U.clamp(1 - age / f.ttl, 0, 1);
        // locate session by id (small linear scan; flashes are short-lived)
        let s = null;
        for (let j = 0; j < sim.sessions.length; j++) {
          if (sim.sessions[j].id === f.sessionId) { s = sim.sessions[j]; break; }
        }
        if (!s) continue;
        const { x, y } = this._sessionXY(s, W, H, alpha);
        const r = 3 + (1 - t) * 10;
        ctx.globalAlpha = 0.45 * t;
        ctx.strokeStyle = 'rgba(96,165,250,1)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawLegend(ctx, W, H, sim) {
      ctx.save();
      const pad = 10;
      const x = pad;
      const y = sim.params.show_heat_strip ? 34 : 10;
      const w = 260;
      const h = 92;
      drawRoundedRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(229,231,235,0.88)';
      ctx.fillText('Fatigue:', x + 10, y + 18);

      // gradient bar
      const gx = x + 64;
      const gy = y + 10;
      const gw = 165;
      const gh = 10;
      const grad = ctx.createLinearGradient(gx, gy, gx + gw, gy);
      grad.addColorStop(0, 'rgba(90,220,255,0.95)');
      grad.addColorStop(1, 'rgba(255,90,70,0.95)');
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, gx, gy, gw, gh, 5);
      ctx.fill();

      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(229,231,235,0.65)';
      ctx.fillText('low', gx, y + 34);
      ctx.fillText('high', gx + gw - 22, y + 34);

      // small hint
      ctx.fillStyle = 'rgba(229,231,235,0.65)';
      ctx.fillText('x = session progress', x + 10, y + 48);

      // opportunity vs impression legend
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      const rowY = y + 64;

      // ● user | opportunity | ■ banner impression
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = 'rgba(229,231,235,0.85)';
      ctx.beginPath();
      ctx.arc(x + 10, rowY, 3.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(229,231,235,0.70)';
      ctx.fillText('user', x + 18, rowY + 4);

      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = 'rgba(229,231,235,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 74, rowY - 6);
      ctx.lineTo(x + 74, rowY + 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(229,231,235,0.70)';
      ctx.fillText('opportunity', x + 82, rowY + 4);

      ctx.globalAlpha = 0.75;
      ctx.fillStyle = 'rgba(255,165,0,0.95)';
      ctx.fillRect(x + 182, rowY - 4, 8, 8);
      ctx.strokeStyle = 'rgba(251,191,36,0.95)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 182 + 0.5, rowY - 4 + 0.5, 7, 7);
      ctx.fillStyle = 'rgba(229,231,235,0.70)';
      ctx.fillText('banner', x + 194, rowY + 4);

      // extra note
      ctx.globalAlpha = 0.55;
      ctx.font = '600 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = 'rgba(229,231,235,0.62)';
      ctx.fillText('outline shows CPM (low/mid/high)', x + 10, y + 84);

      ctx.restore();
    }

    // ---- Mini charts ----
    drawCharts(series) {
      // series: { revenue, impr, cpm, fatigue } arrays length up to 120
      this._drawMini(this.charts.revenue, this.chartCtx.revenue, series.revenue, {
        color: 'rgba(96,165,250,0.95)',
        fmt: fmtUSDCompact,
      });
      this._drawMini(this.charts.impr, this.chartCtx.impr, series.impr, {
        color: 'rgba(251,191,36,0.95)',
        fmt: (v) => `${Math.round(v)}`,
        min0: true,
      });
      this._drawMini(this.charts.cpm, this.chartCtx.cpm, series.cpm, {
        color: 'rgba(52,211,153,0.95)',
        fmt: (v) => `$${v.toFixed(2)}`,
        min0: true,
      });
      this._drawMini(this.charts.fatigue, this.chartCtx.fatigue, series.fatigue, {
        color: 'rgba(251,113,133,0.95)',
        fmt: (v) => v.toFixed(2),
        min0: true,
      });
    }

    _drawMini(canvas, ctx, values, opts) {
      const { w, h, dpr } = resizeCanvasToElement(canvas);
      ctx.save();
      ctx.scale(dpr, dpr);
      const W = w / dpr;
      const H = h / dpr;
      ctx.clearRect(0, 0, W, H);

      // frame
      ctx.fillStyle = 'rgba(2, 6, 23, 0.10)';
      ctx.fillRect(0, 0, W, H);

      const padL = 34;
      const padR = 10;
      const padT = 10;
      const padB = 16;
      const x0 = padL, y0 = padT;
      const x1 = W - padR, y1 = H - padB;
      const plotW = Math.max(1, x1 - x0);
      const plotH = Math.max(1, y1 - y0);

      if (!values || values.length === 0) { ctx.restore(); return; }

      let min = Infinity, max = -Infinity;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (!Number.isFinite(v)) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) { ctx.restore(); return; }
      if (opts.min0) min = Math.min(0, min);
      if (min === max) {
        const bump = (Math.abs(min) > 1) ? Math.abs(min) * 0.08 : 1;
        min -= bump;
        max += bump;
      } else {
        const r = max - min;
        min -= r * 0.12;
        max += r * 0.12;
      }

      // grid
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
      ctx.strokeStyle = opts.color;
      ctx.lineWidth = 2;
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
      ctx.fillStyle = opts.color;
      ctx.beginPath();
      ctx.arc(xx, yy, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // y labels
      ctx.fillStyle = 'rgba(229,231,235,0.60)';
      ctx.font = '10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const fmt = opts.fmt || ((v) => String(v));
      ctx.fillText(fmt(max), 6, y0);
      ctx.fillText(fmt(min), 6, y1);
      ctx.restore();
    }
  }

  function createRenderer(canvases) {
    return new Renderer(canvases);
  }

  window.Render = { createRenderer };
})();

