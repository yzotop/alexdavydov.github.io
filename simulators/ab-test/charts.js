/* charts.js — canvas chart rendering (light theme) */
(() => {
  'use strict';
  const U = window.Utils;

  /* ── Light-theme palette ────────────────────────────────── */
  const C = {
    ctrl:   '#3b82f6',              // blue-500
    test:   '#e67700',              // warm amber-orange (neutral, no green=good bias)
    alpha:  '#dc2626',              // red-600
    alphaBg:'rgba(220,38,38,0.04)',
    ci:     '#6366f1',              // indigo-500
    ciBg:   'rgba(99,102,241,0.07)',
    users:  '#8b5cf6',              // violet-500
    grid:   'rgba(0,0,0,0.06)',
    gridTxt:'rgba(0,0,0,0.42)',
    axis:   'rgba(0,0,0,0.14)',
    zero:   'rgba(0,0,0,0.10)',
    line2:  '#475569',              // slate-600 (p-val / delta line)
    decision: '#dc2626',
    tipBg:  'rgba(255,255,255,0.96)',
    tipBdr: 'rgba(0,0,0,0.08)',
    cross:  'rgba(0,0,0,0.12)',
  };

  /* ── Helpers ────────────────────────────────────────────── */
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function yRange(arrays, pad) {
    let mn = Infinity, mx = -Infinity;
    for (const arr of arrays) for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; }
    if (!Number.isFinite(mn)) { mn = 0; mx = 1; }
    const r = mx - mn || 0.01;
    mn -= r * (pad || 0.05);
    mx += r * (pad || 0.05);
    return [mn, mx];
  }

  const PAD = { top: 20, right: 16, bottom: 32, left: 56 };

  function drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, yFmt) {
    const pw = w - PAD.left - PAD.right, ph = h - PAD.top - PAD.bottom;
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.fillStyle = C.gridTxt;
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const frac = i / 5, y = PAD.top + ph * (1 - frac), val = yMin + (yMax - yMin) * frac;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + pw, y); ctx.stroke();
      ctx.fillText(yFmt ? yFmt(val) : val.toFixed(2), PAD.left - 6, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const maxD = Math.ceil(xMax), step = maxD <= 10 ? 1 : maxD <= 20 ? 2 : 5;
    for (let d = step; d <= maxD; d += step) {
      const x = PAD.left + (d / (xMax || 1)) * pw;
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + ph); ctx.stroke();
      ctx.fillText('D' + d, x, PAD.top + ph + 6);
    }
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + ph);
    ctx.lineTo(PAD.left + pw, PAD.top + ph); ctx.stroke();
  }

  function mapX(v, xMin, xMax, w) { return PAD.left + ((v - xMin) / ((xMax - xMin) || 1)) * (w - PAD.left - PAD.right); }
  function mapY(v, yMin, yMax, h) { return PAD.top + (1 - (v - yMin) / ((yMax - yMin) || 1)) * (h - PAD.top - PAD.bottom); }

  function drawLine(ctx, xs, ys, xMin, xMax, yMin, yMax, w, h, color, width) {
    if (xs.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const px = mapX(xs[i], xMin, xMax, w), py = mapY(ys[i], yMin, yMax, h);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawBand(ctx, xs, yLo, yHi, xMin, xMax, yMin, yMax, w, h, color) {
    if (xs.length < 2) return;
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < xs.length; i++) { const px = mapX(xs[i], xMin, xMax, w); i === 0 ? ctx.moveTo(px, mapY(yHi[i], yMin, yMax, h)) : ctx.lineTo(px, mapY(yHi[i], yMin, yMax, h)); }
    for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(mapX(xs[i], xMin, xMax, w), mapY(yLo[i], yMin, yMax, h));
    ctx.closePath(); ctx.fill();
  }

  function drawHLine(ctx, y, yMin, yMax, w, h, color, dash) {
    const py = mapY(y, yMin, yMax, h);
    if (py < PAD.top || py > h - PAD.bottom) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash(dash || [4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(w - PAD.right, py); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawVLine(ctx, x, xMin, xMax, w, h, color, label) {
    const px = mapX(x, xMin, xMax, w);
    if (px < PAD.left || px > w - PAD.right) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, h - PAD.bottom); ctx.stroke();
    ctx.setLineDash([]);
    if (label) { ctx.fillStyle = color; ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'center'; ctx.fillText(label, px, PAD.top - 6); }
  }

  /* ── Tooltip ────────────────────────────────────────────── */
  function drawTooltip(ctx, mouseX, xs, datasets, xMin, xMax, yMin, yMax, w, h, fmtY) {
    if (mouseX < PAD.left || mouseX > w - PAD.right || xs.length < 2) return;
    const frac = (mouseX - PAD.left) / (w - PAD.left - PAD.right);
    const xVal = xMin + frac * (xMax - xMin);
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < xs.length; i++) { const d = Math.abs(xs[i] - xVal); if (d < bestD) { bestD = d; bestI = i; } }

    const px = mapX(xs[bestI], xMin, xMax, w);
    ctx.strokeStyle = C.cross; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, h - PAD.bottom); ctx.stroke();
    ctx.setLineDash([]);

    let tooltipY = PAD.top + 8;
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'left';
    for (const ds of datasets) {
      const val = ds.data[bestI], py = mapY(val, yMin, yMax, h);
      ctx.fillStyle = ds.color; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      const txt = ds.label + ': ' + (fmtY ? fmtY(val) : val.toFixed(4));
      const tw = ctx.measureText(txt).width + 14;
      const tx = px + 10 > w - PAD.right - tw ? px - tw - 10 : px + 10;
      // light tooltip card
      ctx.fillStyle = C.tipBg; ctx.fillRect(tx - 6, tooltipY - 4, tw + 4, 20);
      ctx.strokeStyle = C.tipBdr; ctx.lineWidth = 1; ctx.strokeRect(tx - 6, tooltipY - 4, tw + 4, 20);
      ctx.fillStyle = ds.color; ctx.fillText(txt, tx, tooltipY + 10);
      tooltipY += 24;
    }
    ctx.fillStyle = C.gridTxt; ctx.textAlign = 'center';
    ctx.fillText(U.fmtDayHour(xs[bestI]), px, h - PAD.bottom + 18);
  }

  /* ══════════════════════════════════════════════════════════ */
  function createCharts(canvasMain, canvasSec) {
    let mouseMainX = -1, mouseSecX = -1;
    let secondaryMode = 'pvalue';

    canvasMain.addEventListener('mousemove', e => { mouseMainX = e.offsetX; });
    canvasMain.addEventListener('mouseleave', () => { mouseMainX = -1; });
    canvasSec.addEventListener('mousemove', e => { mouseSecX = e.offsetX; });
    canvasSec.addEventListener('mouseleave', () => { mouseSecX = -1; });

    function setSecondaryMode(m) { secondaryMode = m; }

    function renderMain(series, decisionTime) {
      const { ctx, w, h } = setupCanvas(canvasMain);
      ctx.clearRect(0, 0, w, h);
      const times = series.time.toArray(), crCtrl = series.crCtrl.toArray(), crTest = series.crTest.toArray();
      if (times.length < 2) { ctx.fillStyle = C.gridTxt; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Waiting for data…', w / 2, h / 2); return; }
      const xMin = 0, xMax = Math.max(times[times.length - 1], 1);
      const [yMin, yMax] = yRange([crCtrl, crTest], 0.15);
      drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, v => U.fmtPct(v, 1));
      drawHLine(ctx, 0.05, yMin, yMax, w, h, C.zero, [2, 4]);
      drawLine(ctx, times, crCtrl, xMin, xMax, yMin, yMax, w, h, C.ctrl, 2);
      drawLine(ctx, times, crTest, xMin, xMax, yMin, yMax, w, h, C.test, 2);
      if (decisionTime != null) drawVLine(ctx, decisionTime, xMin, xMax, w, h, C.decision, '▼ Решение');
      if (mouseMainX >= 0) drawTooltip(ctx, mouseMainX, times,
        [{ label: 'Control', data: crCtrl, color: C.ctrl }, { label: 'Test', data: crTest, color: C.test }],
        xMin, xMax, yMin, yMax, w, h, v => U.fmtPct(v, 3));
    }

    function renderSecondary(series, decisionTime) {
      const { ctx, w, h } = setupCanvas(canvasSec);
      ctx.clearRect(0, 0, w, h);
      const times = series.time.toArray();
      if (times.length < 2) return;
      const xMin = 0, xMax = Math.max(times[times.length - 1], 1);

      if (secondaryMode === 'pvalue') {
        const pvals = series.pVal.toArray();
        const yMin = 0, yMax = Math.min(1, Math.max(0.15, ...pvals) * 1.1);
        drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, v => v.toFixed(2));
        const alphaY = mapY(0.05, yMin, yMax, h);
        ctx.fillStyle = C.alphaBg;
        ctx.fillRect(PAD.left, alphaY, w - PAD.left - PAD.right, h - PAD.bottom - alphaY);
        drawHLine(ctx, 0.05, yMin, yMax, w, h, C.alpha, [6, 3]);
        ctx.fillStyle = C.alpha; ctx.font = '10px ui-monospace, SFMono-Regular, monospace'; ctx.textAlign = 'left';
        ctx.fillText('α = 0.05', PAD.left + 4, alphaY - 4);
        drawLine(ctx, times, pvals, xMin, xMax, yMin, yMax, w, h, C.line2, 2);
        if (decisionTime != null) drawVLine(ctx, decisionTime, xMin, xMax, w, h, C.decision, '▼');
        if (mouseSecX >= 0) drawTooltip(ctx, mouseSecX, times, [{ label: 'p-value', data: pvals, color: C.line2 }], xMin, xMax, yMin, yMax, w, h, U.fmtP);

      } else if (secondaryMode === 'ci') {
        const ciLo = series.ciLo.toArray(), ciHi = series.ciHi.toArray(), delta = series.delta.toArray();
        const [yMin, yMax] = yRange([ciLo, ciHi], 0.10);
        drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, v => U.fmtPct(v, 2));
        drawHLine(ctx, 0, yMin, yMax, w, h, C.zero, [3, 3]);
        drawBand(ctx, times, ciLo, ciHi, xMin, xMax, yMin, yMax, w, h, C.ciBg);
        drawLine(ctx, times, ciLo, xMin, xMax, yMin, yMax, w, h, C.ci, 1);
        drawLine(ctx, times, ciHi, xMin, xMax, yMin, yMax, w, h, C.ci, 1);
        drawLine(ctx, times, delta, xMin, xMax, yMin, yMax, w, h, C.line2, 2);
        if (decisionTime != null) drawVLine(ctx, decisionTime, xMin, xMax, w, h, C.decision, '▼');
        if (mouseSecX >= 0) drawTooltip(ctx, mouseSecX, times,
          [{ label: 'Δ', data: delta, color: C.line2 }, { label: 'CI lo', data: ciLo, color: C.ci }, { label: 'CI hi', data: ciHi, color: C.ci }],
          xMin, xMax, yMin, yMax, w, h, v => U.fmtPct(v, 3));

      } else {
        const users = series.cumUsers.toArray();
        const yMin = 0, yMax = Math.max(100, ...users) * 1.05;
        drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v));
        drawLine(ctx, times, users, xMin, xMax, yMin, yMax, w, h, C.users, 2);
        if (decisionTime != null) drawVLine(ctx, decisionTime, xMin, xMax, w, h, C.decision, '▼');
        if (mouseSecX >= 0) drawTooltip(ctx, mouseSecX, times, [{ label: 'Users', data: users, color: C.users }], xMin, xMax, yMin, yMax, w, h, v => U.fmtNum(Math.round(v)));
      }
    }

    return { renderMain, renderSecondary, setSecondaryMode };
  }

  window.Charts = { createCharts };
})();
