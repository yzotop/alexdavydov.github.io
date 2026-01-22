/* charts.js — mini charts for metrics panel */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before charts.js');

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h, dpr };
  }

  function drawLineChart(canvas, series, color, label, formatValue) {
    const { w, h, dpr } = resizeCanvas(canvas);
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    const W = w / dpr;
    const H = h / dpr;

    ctx.clearRect(0, 0, W, H);

    if (!series || series.length === 0) {
      ctx.restore();
      return;
    }

    // Show last 60 seconds (60 points)
    const data = series.slice(-60);
    const n = data.length;
    if (n === 0) {
      ctx.restore();
      return;
    }

    // Find min/max
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = data[i];
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      ctx.restore();
      return;
    }

    // Padding
    const padX = 4;
    const padY = 4;
    const plotW = W - padX * 2;
    const plotH = H - padY * 2;

    // Draw grid
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(padX, padY + plotH);
    ctx.lineTo(padX + plotW, padY + plotH);
    ctx.stroke();

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) continue;
      const x = padX + (i / (n - 1)) * plotW;
      const y = padY + plotH - ((v - min) / (max - min)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw last value label (top right)
    const lastValue = data[n - 1];
    if (Number.isFinite(lastValue)) {
      ctx.fillStyle = 'rgba(229,231,235,0.95)';
      ctx.font = 'bold 10px ui-monospace';
      ctx.textAlign = 'right';
      const labelText = formatValue ? formatValue(lastValue) : lastValue.toFixed(1);
      ctx.fillText(labelText, W - padX, padY + 12);
    }
    
    // Draw label (top left)
    if (label) {
      ctx.fillStyle = 'rgba(229,231,235,0.7)';
      ctx.font = '9px ui-sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, padX, padY + 12);
    }

    ctx.restore();
  }

  const CHARTS = {
    revenue: { canvas: null, color: 'rgba(52,211,153,0.9)' },
    orders: { canvas: null, color: 'rgba(96,165,250,0.9)' },
    eta: { canvas: null, color: 'rgba(251,191,36,0.9)' },
    trust: { canvas: null, color: 'rgba(251,113,133,0.9)' },
  };

  function initCharts() {
    CHARTS.revenue.canvas = document.getElementById('chartRevenue');
    CHARTS.orders.canvas = document.getElementById('chartOrders');
    CHARTS.eta.canvas = document.getElementById('chartETA');
    CHARTS.trust.canvas = document.getElementById('chartTrust');
  }

  function updateCharts(ts) {
    if (!CHARTS.revenue.canvas) initCharts();

    drawLineChart(
      CHARTS.revenue.canvas,
      ts.revenue_per_min.toArray(),
      CHARTS.revenue.color,
      'Revenue/min',
      (v) => U.formatMoney(v)
    );

    drawLineChart(
      CHARTS.orders.canvas,
      ts.orders_per_min.toArray(),
      CHARTS.orders.color,
      'Orders/min',
      (v) => Math.round(v).toString()
    );

    drawLineChart(
      CHARTS.eta.canvas,
      ts.p90_eta.toArray(),
      CHARTS.eta.color,
      'P90 ETA',
      (v) => U.formatSeconds(v)
    );

    drawLineChart(
      CHARTS.trust.canvas,
      ts.trust.toArray(),
      CHARTS.trust.color,
      'Trust',
      (v) => `${(U.clamp(v, 0, 1) * 100).toFixed(0)}%`
    );
  }

  window.Charts = { initCharts, updateCharts };
})();
