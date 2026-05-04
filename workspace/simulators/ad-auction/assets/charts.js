/**
 * Minimal canvas charting library
 */
(function() {
  'use strict';

  /**
   * Draw line chart
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{t, value}>} data - Time series data
   * @param {Object} options - Chart options
   */
  function drawLineChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;
    
    // Set canvas size if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);
    }
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const padding = options.padding || { top: 20, right: 20, bottom: 30, left: 50 };
    const color = options.color || '#2563eb';
    const label = options.label || '';
    const yMin = options.yMin !== undefined ? options.yMin : 0;
    const yMax = options.yMax !== undefined ? options.yMax : (Math.max(...data.map(d => d.value), 0) * 1.1);
    
    // Clear
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    if (data.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data', displayWidth / 2, displayHeight / 2);
      return;
    }
    
    // Calculate plot area (use display dimensions)
    const plotWidth = displayWidth - padding.left - padding.right;
    const plotHeight = displayHeight - padding.top - padding.bottom;
    
    // Draw axes
    ctx.strokeStyle = '#e6e6e8';
    ctx.lineWidth = 1;
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(padding.left, displayHeight - padding.bottom);
    ctx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    ctx.stroke();
    
    // Y axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, displayHeight - padding.bottom);
    ctx.stroke();
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(displayWidth - padding.right, y);
      ctx.stroke();
    }
    
    // Y axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTicks; i++) {
      const value = yMin + (yMax - yMin) * (i / yTicks);
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.fillText(value.toFixed(2), padding.left - 5, y);
    }
    
    // Draw line
    if (data.length > 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const tMin = Math.min(...data.map(d => d.t));
      const tMax = Math.max(...data.map(d => d.t));
      const tRange = tMax - tMin || 1;
      
      data.forEach((point, i) => {
        const x = padding.left + ((point.t - tMin) / tRange) * plotWidth;
        const y = padding.top + plotHeight - ((point.value - yMin) / (yMax - yMin)) * plotHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw points
      ctx.fillStyle = color;
      data.forEach(point => {
        const x = padding.left + ((point.t - tMin) / tRange) * plotWidth;
        const y = padding.top + plotHeight - ((point.value - yMin) / (yMax - yMin)) * plotHeight;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    
    // Title
    if (label) {
      ctx.fillStyle = '#333';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, padding.left, 5);
    }
  }

  /**
   * Draw scatter plot
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{pressure, revenue}>} data
   * @param {Object} options
   */
  function drawScatter(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;
    
    // Set canvas size if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);
    }
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const padding = options.padding || { top: 20, right: 20, bottom: 30, left: 50 };
    const color = options.color || '#2563eb';
    const xLabel = options.xLabel || 'X';
    const yLabel = options.yLabel || 'Y';
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    if (data.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data', displayWidth / 2, displayHeight / 2);
      return;
    }
    
    const plotWidth = displayWidth - padding.left - padding.right;
    const plotHeight = displayHeight - padding.top - padding.bottom;
    
    // Calculate ranges
    const xValues = data.map(d => d.pressure);
    const yValues = data.map(d => d.revenue);
    const xMin = Math.min(...xValues, 0);
    const xMax = Math.max(...xValues) * 1.1;
    const yMin = Math.min(...yValues, 0);
    const yMax = Math.max(...yValues) * 1.1;
    
    // Draw axes
    ctx.strokeStyle = '#e6e6e8';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(padding.left, displayHeight - padding.bottom);
    ctx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, displayHeight - padding.bottom);
    ctx.stroke();
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    
    const xTicks = 5;
    const yTicks = 5;
    
    for (let i = 0; i <= xTicks; i++) {
      const x = padding.left + (plotWidth / xTicks) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, displayHeight - padding.bottom);
      ctx.stroke();
    }
    
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(displayWidth - padding.right, y);
      ctx.stroke();
    }
    
    // Axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const value = xMin + (xMax - xMin) * (i / xTicks);
      const x = padding.left + (plotWidth / xTicks) * i;
      ctx.fillText(value.toFixed(2), x, displayHeight - padding.bottom + 5);
    }
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTicks; i++) {
      const value = yMin + (yMax - yMin) * (i / yTicks);
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.fillText(value.toFixed(2), padding.left - 5, y);
    }
    
    // Draw points
    ctx.fillStyle = color;
    data.forEach(point => {
      const x = padding.left + ((point.pressure - xMin) / (xMax - xMin)) * plotWidth;
      const y = padding.top + plotHeight - ((point.revenue - yMin) / (yMax - yMin)) * plotHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, displayWidth / 2, displayHeight - 10);
    
    ctx.save();
    ctx.translate(15, displayHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }

  /**
   * Draw multi-series line chart (for A/B compare)
   * @param {HTMLCanvasElement} canvas
   * @param {Object} series - {control: [...], test: [...]}
   * @param {Object} options
   */
  function drawMultiLineChart(canvas, series, options = {}) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;
    
    // Set canvas size if needed
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);
    }
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const padding = options.padding || { top: 20, right: 20, bottom: 30, left: 50 };
    const colors = options.colors || { control: '#2563eb', test: '#dc2626' };
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    const allData = [...(series.control || []), ...(series.test || [])];
    if (allData.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No data', displayWidth / 2, displayHeight / 2);
      return;
    }
    
    const plotWidth = displayWidth - padding.left - padding.right;
    const plotHeight = displayHeight - padding.top - padding.bottom;
    
    const yMin = options.yMin !== undefined ? options.yMin : 0;
    const yMax = options.yMax !== undefined ? options.yMax : (Math.max(...allData.map(d => d.value), 0) * 1.1);
    
    // Draw axes and grid (same as single line chart)
    ctx.strokeStyle = '#e6e6e8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, displayHeight - padding.bottom);
    ctx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, displayHeight - padding.bottom);
    ctx.stroke();
    
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(displayWidth - padding.right, y);
      ctx.stroke();
    }
    
    // Y axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= yTicks; i++) {
      const value = yMin + (yMax - yMin) * (i / yTicks);
      const y = padding.top + (plotHeight / yTicks) * (yTicks - i);
      ctx.fillText(value.toFixed(2), padding.left - 5, y);
    }
    
    // Draw both series
    ['control', 'test'].forEach(seriesName => {
      const data = series[seriesName] || [];
      if (data.length === 0) return;
      
      const tMin = Math.min(...allData.map(d => d.t));
      const tMax = Math.max(...allData.map(d => d.t));
      const tRange = tMax - tMin || 1;
      
      ctx.strokeStyle = colors[seriesName];
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      data.forEach((point, i) => {
        const x = padding.left + ((point.t - tMin) / tRange) * plotWidth;
        const y = padding.top + plotHeight - ((point.value - yMin) / (yMax - yMin)) * plotHeight;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    });
    
    // Legend
    if (series.control && series.control.length > 0 && series.test && series.test.length > 0) {
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      ['control', 'test'].forEach((seriesName, idx) => {
        const y = padding.top + 15 + idx * 15;
        ctx.fillStyle = colors[seriesName];
        ctx.fillRect(displayWidth - padding.right - 60, y - 5, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText(seriesName === 'control' ? 'Control' : 'Test', displayWidth - padding.right - 45, y);
      });
    }
  }

  /**
   * Incrementally update line chart (append new point)
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{t, value}>} data - All data points
   * @param {Object} options - Chart options
   */
  function updateLineChart(canvas, data, options = {}) {
    // For incremental updates, just redraw the entire chart
    // Canvas is fast enough for this use case
    drawLineChart(canvas, data, options);
  }

  /**
   * Incrementally update scatter plot
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{pressure, revenue}>} data
   * @param {Object} options
   */
  function updateScatter(canvas, data, options = {}) {
    drawScatter(canvas, data, options);
  }

  /**
   * Append a single point to a line chart (for incremental updates)
   * This is a lightweight version that only redraws the last segment
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{t, value}>} data - All data points
   * @param {Object} options - Chart options
   */
  function appendChartPoint(canvas, data, options = {}) {
    // For simplicity, just redraw the entire chart
    // Canvas is fast enough for typical data sizes (< 1000 points)
    drawLineChart(canvas, data, options);
  }

  /**
   * Resize all charts to match their container sizes
   * This should be called on window resize and after layout changes
   */
  function resizeAllCharts() {
    const chartIds = ['chartRevenue', 'chartCTR', 'chartFillRate', 'chartScatter'];
    chartIds.forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas && canvas.parentElement) {
        const rect = canvas.getBoundingClientRect();
        // Only resize if canvas has a valid size
        if (rect.width > 0 && rect.height > 0) {
          const dpr = window.devicePixelRatio || 1;
          const width = rect.width * dpr;
          const height = rect.height * dpr;
          
          if (canvas.width !== width || canvas.height !== height) {
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            ctx.scale(dpr, dpr);
          }
        }
      }
    });
  }

  window.Charts = {
    drawLineChart,
    drawScatter,
    drawMultiLineChart,
    updateLineChart,
    updateScatter,
    appendChartPoint,
    resizeAllCharts
  };
})();
