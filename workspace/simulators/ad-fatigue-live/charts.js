/* charts.js — canvas-based mini charts for metrics */

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
    return { cssW: rect.width, cssH: rect.height, w, h, dpr };
  }

  function drawLineChart(ctx, data, color, dpr, maxVal = null) {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const W = canvasW / dpr;
    const H = canvasH / dpr;
    
    // CRITICAL: Clear canvas completely before drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    
    ctx.save();
    ctx.scale(dpr, dpr);

    if (!data || data.length === 0 || data.length < 3) {
      ctx.restore();
      return false; // Return false to indicate empty
    }

    const max = maxVal !== null ? maxVal : Math.max(...data, 1);
    const min = 0;
    const range = max - min || 1;

    // Draw grid (subtle, 3-4 lines only)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 3; i++) {
      const y = (H / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Draw bottom axis (slightly more visible)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, H);
    ctx.stroke();

    // Draw line (main element - bright and clear)
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1 || 1)) * W;
      const y = H - ((data[i] - min) / range) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Fill area (very subtle - almost invisible, optional)
    ctx.globalAlpha = 0.06;
    // Convert color to rgba with very low opacity for fill
    let fillColor = color;
    if (color.startsWith('rgba')) {
      const baseColor = color.substring(0, color.lastIndexOf(','));
      fillColor = baseColor + ', 0.06)';
    } else if (color.startsWith('rgb')) {
      fillColor = color.replace('rgb', 'rgba').replace(')', ', 0.06)');
    } else {
      fillColor = 'rgba(96, 165, 250, 0.06)'; // fallback
    }
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1 || 1)) * W;
      const y = H - ((data[i] - min) / range) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.restore();
    return true; // Return true to indicate data drawn
  }

  function drawScatterChart(ctx, xData, yData, color, dpr) {
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;
    const W = canvasW / dpr;
    const H = canvasH / dpr;
    
    // CRITICAL: Clear canvas completely before drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    
    ctx.save();
    ctx.scale(dpr, dpr);

    if (!xData || !yData || xData.length === 0 || xData.length < 10) {
      ctx.restore();
      return false; // Return false to indicate empty (need at least 10 points)
    }

    // Draw grid (4-5 lines, subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      const x = (W / 5) * i;
      const y = (H / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Draw axes (more visible)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, H);
    ctx.stroke();

    const xMin = Math.min(...xData);
    const xMax = Math.max(...xData);
    const yMin = Math.min(...yData);
    const yMax = Math.max(...yData);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    // Draw points
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = color;
    for (let i = 0; i < xData.length; i++) {
      const x = ((xData[i] - xMin) / xRange) * W;
      const y = H - ((yData[i] - yMin) / yRange) * H;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw axis labels (muted, small)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '9px ui-sans-serif, system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ad_rate (impr/user-min)', 4, 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('revenue/min', W - 4, H - 4);

    ctx.restore();
    return true; // Return true to indicate data drawn
  }

  class Charts {
    constructor(canvases) {
      this.canvases = canvases;
      this.ctx = {};
      for (const k of Object.keys(canvases)) {
        const c = canvases[k];
        const ctx = c.getContext('2d', { alpha: true, desynchronized: true });
        if (!ctx) throw new Error(`2D context not available for chart: ${k}`);
        this.ctx[k] = ctx;
      }
      // Store saturation event time (only one marker per simulation run)
      this.saturationEventTime = null;
    }

    reset() {
      // Reset saturation marker when simulation resets
      this.saturationEventTime = null;
    }

    _detectSaturation(revenueData, pressureData) {
      // Only detect if we haven't already found saturation
      if (this.saturationEventTime !== null) return this.saturationEventTime;
      
      if (!revenueData || revenueData.length < 20 || !pressureData || pressureData.length < 20) return null;
      
      const n = Math.min(revenueData.length, pressureData.length, 30); // Check last 30 points
      const revenueSlice = revenueData.slice(-n);
      const pressureSlice = pressureData.slice(-n);
      
      // Simple saturation detection: revenue growth < 2% while pressure increases
      // Also check if revenue is plateauing (small variance in last few points)
      for (let i = 3; i < revenueSlice.length; i++) {
        const revGrowth = (revenueSlice[i] - revenueSlice[i-1]) / Math.max(revenueSlice[i-1], 1);
        const pressGrowth = pressureSlice[i] - pressureSlice[i-1];
        // Check if revenue is not growing significantly while pressure increases
        if (Math.abs(revGrowth) < 0.02 && pressGrowth > 0 && revenueSlice[i] > 0) {
          // Additional check: revenue variance in last 4 points is small
          const recent = revenueSlice.slice(i - 3, i + 1);
          const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const variance = recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length;
          if (variance / Math.max(avg, 1) < 0.05) {
            // Found saturation - store the index relative to full array
            const saturationIdx = revenueData.length - n + i;
            this.saturationEventTime = saturationIdx;
            return saturationIdx;
          }
        }
      }
      return null;
    }

    _drawSaturationMarker(ctx, revenueData, dpr) {
      // Only draw if we have detected saturation and haven't drawn it yet
      if (this.saturationEventTime === null || revenueData.length < this.saturationEventTime) return;
      
      const canvasW = ctx.canvas.width;
      const canvasH = ctx.canvas.height;
      const W = canvasW / dpr;
      const H = canvasH / dpr;
      
      ctx.save();
      ctx.scale(dpr, dpr);
      
      const x = (this.saturationEventTime / (revenueData.length - 1 || 1)) * W;
      
      // Draw vertical dashed line
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw label (only once)
      ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Saturation', x + 6, 8);
      
      ctx.restore();
    }

    _showPlaceholder(canvas, hasData, chartType = 'scatter') {
      if (!canvas) return;
      const placeholder = canvas.parentElement ? canvas.parentElement.querySelector('.chart-card__placeholder') : null;
      if (placeholder) {
        if (!hasData) {
          placeholder.style.display = 'block';
          // Update placeholder text based on chart type
          if (chartType === 'scatter') {
            placeholder.innerHTML = 'Collecting bins… run 20–30s<br><span style="font-size: 10px; opacity: 0.8;">Try increasing target ads/session or lowering min gap</span>';
          } else {
            placeholder.innerHTML = 'Run 10–20s to collect data<br><span style="font-size: 10px; opacity: 0.8;">Start simulation to see metrics</span>';
          }
        } else {
          placeholder.style.display = 'none';
        }
      }
    }

    draw(series) {
      // Revenue/min
      if (this.canvases.revenue && series.revenue) {
        const { dpr } = resizeCanvas(this.canvases.revenue);
        const max = Math.max(...series.revenue, 1) * 1.1;
        const hasData = drawLineChart(this.ctx.revenue, series.revenue, 'rgba(96,165,250,0.95)', dpr, max);
        
        // Detect and draw saturation marker (only once)
        if (hasData && series.pressure && series.pressure.length > 0) {
          this._detectSaturation(series.revenue, series.pressure);
          this._drawSaturationMarker(this.ctx.revenue, series.revenue, dpr);
        }
        // Show placeholder if no data
        this._showPlaceholder(this.canvases.revenue, hasData, 'line');
      }

      // Impressions/min
      if (this.canvases.impressions && series.impressions) {
        const { dpr } = resizeCanvas(this.canvases.impressions);
        const max = Math.max(...series.impressions, 1) * 1.1;
        const hasData = drawLineChart(this.ctx.impressions, series.impressions, 'rgba(52,211,153,0.95)', dpr, max);
        this._showPlaceholder(this.canvases.impressions, hasData, 'line');
      }

      // Fatigue
      if (this.canvases.fatigue && series.fatigue) {
        const { dpr } = resizeCanvas(this.canvases.fatigue);
        const hasData = drawLineChart(this.ctx.fatigue, series.fatigue, 'rgba(251,191,36,0.95)', dpr, 1);
        this._showPlaceholder(this.canvases.fatigue, hasData, 'line');
      }

      // Scatter: Ad Pressure vs Revenue
      if (this.canvases.scatter) {
        const { dpr } = resizeCanvas(this.canvases.scatter);
        // Use last 60 points for scatter
        const n = Math.min(60, series.pressure?.length || 0, series.revenue?.length || 0);
        const pressureSlice = series.pressure ? series.pressure.slice(-n) : [];
        const revenueSlice = series.revenue ? series.revenue.slice(-n) : [];
        const hasData = pressureSlice.length >= 10 && revenueSlice.length >= 10 && 
                       pressureSlice.some(v => v > 0) && revenueSlice.some(v => v > 0);
        if (hasData) {
          drawScatterChart(this.ctx.scatter, pressureSlice, revenueSlice, 'rgba(96,165,250,0.70)', dpr);
        }
        // Show placeholder if no data
        this._showPlaceholder(this.canvases.scatter, hasData, 'scatter');
      }
    }
  }

  window.Charts = { createCharts: (canvases) => new Charts(canvases) };
})();
