// Nice ticks algorithm
function niceTicks(min, max, targetCount = 5, isPercent = false) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  
  const range = max - min;
  if (range === 0 || !Number.isFinite(range)) {
    const delta = Math.abs(min) < 1 ? 1 : Math.abs(min) * 0.05;
    return { min: min - delta, max: max + delta, step: delta, ticks: [min - delta, min, min + delta] };
  }
  
  const roughStep = range / targetCount;
  if (!Number.isFinite(roughStep)) {
    return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  }
  
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(roughStep))));
  const normalizedStep = roughStep / magnitude;
  
  let step;
  if (normalizedStep <= 1) step = 1;
  else if (normalizedStep <= 2) step = 2;
  else if (normalizedStep <= 5) step = 5;
  else step = 10;
  
  step *= magnitude;
  
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(v);
  }
  
  return { min: niceMin, max: niceMax, step, ticks };
}

// Format value with RU units
function formatValue(value, chartType = '') {
  if (chartType === 'fill' || chartType === 'percent') {
    return `${value.toFixed(0)}%`;
  }
  
  const abs = Math.abs(value);
  if (abs >= 1e9) {
    return `${(value / 1e9).toFixed(abs >= 1e10 ? 1 : 2)} млрд`;
  } else if (abs >= 1e6) {
    return `${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)} млн`;
  } else if (abs >= 1e3) {
    return `${(value / 1e3).toFixed(abs >= 1e4 ? 1 : 2)} тыс`;
  } else {
    return value % 1 === 0 ? value.toString() : value.toFixed(2);
  }
}

class LineChart {
  constructor(canvas, series = [], options = {}) {
    if (!canvas) {
      throw new Error('Canvas element is null or undefined');
    }
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error(`Failed to get 2d context from canvas with id: ${canvas.id || 'unknown'}`);
    }
    this.ctx = ctx;
    this.series = series;
    this.options = {
      padding: { top: 32, right: 20, bottom: 40, left: 60 },
      grid: { show: true, color: '#e0e0e0' },
      axes: { show: true, color: '#666' },
      legend: { show: true, position: 'top' },
      colors: ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea'],
      chartType: '',
      showPoints: false,
      ...options
    };
    this.mousePos = null;
    this.hoveredIndex = null;
    this.externalHoverIndex = null;
    this.externalHoverSource = false;
    
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.mousePos = null;
      if (window.appState) {
        window.appState.hoverIndex = null;
        window.appState.hoverSourceCanvasId = null;
        this.renderAllCharts();
      } else {
        this.hoveredIndex = null;
        this.render();
      }
    });
    
    this.render();
  }
  
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.mousePos = {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr
    };
    this.updateHovered();
    if (window.appState) {
      window.appState.hoverIndex = this.hoveredIndex;
      window.appState.hoverSourceCanvasId = this.canvas.id;
      this.renderAllCharts();
    } else {
      this.render();
    }
  }
  
  renderAllCharts() {
    if (window.charts) {
      Object.values(window.charts).forEach(chart => {
        if (chart && chart.render) {
          chart.render();
        }
      });
    }
  }
  
  updateHovered() {
    if (!this.mousePos || this.series.length === 0 || !this.series[0].data || this.series[0].data.length === 0) {
      this.hoveredIndex = null;
      return;
    }
    
    const dataLength = this.series[0].data.length;
    const plotArea = this.getPlotArea();
    const xStep = plotArea.width / (dataLength - 1);
    const xInPlot = this.mousePos.x - plotArea.x;
    this.hoveredIndex = Math.round(xInPlot / xStep);
    this.hoveredIndex = Math.max(0, Math.min(dataLength - 1, this.hoveredIndex));
  }
  
  getPlotArea() {
    return {
      x: this.options.padding.left,
      y: this.options.padding.top,
      width: this.canvas.width - this.options.padding.left - this.options.padding.right,
      height: this.canvas.height - this.options.padding.top - this.options.padding.bottom
    };
  }
  
  getDataRange() {
    if (this.series.length === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    let hasFinite = false;
    
    this.series.forEach(s => {
      if (s.data) {
        s.data.forEach(v => {
          if (v != null && Number.isFinite(v)) {
            hasFinite = true;
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
        });
      }
    });
    
    if (!hasFinite || !Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 1, hasData: false };
    }
    
    if (min === max) {
      const delta = Math.abs(min) < 1 ? 1 : Math.abs(min) * 0.05;
      min -= delta;
      max += delta;
    }
    
    return { min, max, hasData: true };
  }
  
  render(options = {}) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    if (!this.canvas || !this.ctx) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Canvas error', width / 2, height / 2);
      return;
    }
    
    if (this.series.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нет данных', width / 2, height / 2);
      return;
    }
    
    const plotArea = this.getPlotArea();
    const rawDataRange = this.getDataRange();
    const dataLength = this.series[0].data ? this.series[0].data.length : 0;
    
    // Check if we have valid data
    if (!rawDataRange.hasData || !Number.isFinite(rawDataRange.min) || !Number.isFinite(rawDataRange.max)) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нет данных', width / 2, height / 2);
      return;
    }
    
    // Use external hoverIndex if provided, otherwise use local
    let activeHoverIndex = null;
    if (options.hoverIndex !== undefined) {
      activeHoverIndex = options.hoverIndex;
    } else if (window.appState && window.appState.hoverIndex !== null) {
      activeHoverIndex = window.appState.hoverIndex;
    } else {
      activeHoverIndex = this.hoveredIndex;
    }
    
    const showTooltip = activeHoverIndex !== null && window.appState && window.appState.hoverSourceCanvasId === this.canvas.id;
    
    // Use nice ticks for rendering (but keep raw range for data positioning)
    const isPercent = this.options.chartType === 'fill' || this.options.chartType === 'percent';
    const tickInfo = niceTicks(rawDataRange.min, rawDataRange.max, 6, isPercent);
    const tickMin = tickInfo.min;
    const tickMax = tickInfo.max;
    const ticks = tickInfo.ticks;
    const dataRange = { min: tickMin, max: tickMax };
    
    // Draw grid
    if (this.options.grid.show) {
      ctx.strokeStyle = this.options.grid.color;
      ctx.lineWidth = 1;
      ticks.forEach(tick => {
        const normalized = (tick - tickMin) / (tickMax - tickMin);
        const y = plotArea.y + plotArea.height * (1 - normalized);
        ctx.beginPath();
        ctx.moveTo(plotArea.x, y);
        ctx.lineTo(plotArea.x + plotArea.width, y);
        ctx.stroke();
      });
    }
    
    // Draw axes
    if (this.options.axes.show) {
      ctx.strokeStyle = this.options.axes.color;
      ctx.lineWidth = 2;
      // Y axis
      ctx.beginPath();
      ctx.moveTo(plotArea.x, plotArea.y);
      ctx.lineTo(plotArea.x, plotArea.y + plotArea.height);
      ctx.stroke();
      // X axis
      ctx.beginPath();
      ctx.moveTo(plotArea.x, plotArea.y + plotArea.height);
      ctx.lineTo(plotArea.x + plotArea.width, plotArea.y + plotArea.height);
      ctx.stroke();
    }
    
    // Draw series
    this.series.forEach((series, idx) => {
      if (!series.data || series.data.length === 0) return;
      
      const sanitizedData = series.data.map(v => (v != null && Number.isFinite(v)) ? v : null);
      
      ctx.strokeStyle = series.color || this.options.colors[idx % this.options.colors.length];
      ctx.lineWidth = 2;
      ctx.setLineDash(series.lineDash || []);
      ctx.beginPath();
      
      let hasMove = false;
      sanitizedData.forEach((value, i) => {
        const x = plotArea.x + (plotArea.width / (dataLength - 1)) * i;
        if (value != null && Number.isFinite(value)) {
          const normalized = (value - tickMin) / (tickMax - tickMin);
          const y = plotArea.y + plotArea.height * (1 - normalized);
          
          if (!hasMove) {
            ctx.moveTo(x, y);
            hasMove = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          hasMove = false;
        }
      });
      
      if (hasMove) {
        ctx.stroke();
      }
      ctx.setLineDash([]);
      
      // Draw points only if showPoints is true
      if (this.options.showPoints) {
        sanitizedData.forEach((value, i) => {
          if (value != null && Number.isFinite(value)) {
            const x = plotArea.x + (plotArea.width / (dataLength - 1)) * i;
            const normalized = (value - tickMin) / (tickMax - tickMin);
            const y = plotArea.y + plotArea.height * (1 - normalized);
            
            ctx.fillStyle = series.color || this.options.colors[idx % this.options.colors.length];
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    });
    
    // Draw crosshair and tooltip
    if (activeHoverIndex !== null && activeHoverIndex >= 0 && activeHoverIndex < dataLength) {
      const x = plotArea.x + (plotArea.width / (dataLength - 1)) * activeHoverIndex;
      
      // Vertical crosshair line
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x, plotArea.y);
      ctx.lineTo(x, plotArea.y + plotArea.height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw hover marker for each series at hovered index
      this.series.forEach((series, idx) => {
        if (!series.data || series.data.length === 0) return;
        const sanitizedData = series.data.map(v => (v != null && Number.isFinite(v)) ? v : null);
        const hoveredValue = sanitizedData[activeHoverIndex];
        if (hoveredValue != null && Number.isFinite(hoveredValue)) {
          const normalized = (hoveredValue - tickMin) / (tickMax - tickMin);
          const y = plotArea.y + plotArea.height * (1 - normalized);
          
          ctx.fillStyle = series.color || this.options.colors[idx % this.options.colors.length];
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      
      // Tooltip (only on hovered chart)
      if (showTooltip && this.mousePos) {
        const week = activeHoverIndex + 1;
        const tooltipLines = [`Неделя: ${week}`];
        
        this.series.forEach((s, idx) => {
          if (s.data && s.data[activeHoverIndex] !== undefined) {
            const val = s.data[activeHoverIndex];
            if (val == null || !Number.isFinite(val)) {
              tooltipLines.push(`${s.name || `Серия ${idx + 1}`}: —`);
            } else {
              const formatted = typeof s.formatter === 'function' 
                ? s.formatter(val) 
                : typeof val === 'number' 
                  ? val.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
                  : val;
              tooltipLines.push(`${s.name || `Серия ${idx + 1}`}: ${formatted}`);
            }
          }
        });
        
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';
        const textMetrics = tooltipLines.map(line => ctx.measureText(line));
        const maxTextWidth = Math.max(...textMetrics.map(m => m.width));
        const lineHeight = 18;
        const padding = 12;
        const tooltipWidth = maxTextWidth + padding * 2;
        const tooltipHeight = tooltipLines.length * lineHeight + padding * 2;
        
        const mouseX = this.mousePos.x;
        const mouseY = this.mousePos.y;
        
        let tooltipX = mouseX + 12;
        let tooltipY = mouseY - tooltipHeight - 12;
        
        // Clamp to canvas bounds
        tooltipX = Math.max(8, Math.min(tooltipX, width - tooltipWidth - 8));
        tooltipY = Math.max(8, Math.min(tooltipY, height - tooltipHeight - 8));
        
        // Draw rounded rectangle background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(tooltipX + radius, tooltipY);
        ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
        ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + radius);
        ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
        ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - radius, tooltipY + tooltipHeight);
        ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
        ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - radius);
        ctx.lineTo(tooltipX, tooltipY + radius);
        ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
        ctx.closePath();
        ctx.fill();
        
        // Draw tooltip text
        ctx.fillStyle = '#fff';
        tooltipLines.forEach((line, i) => {
          ctx.fillText(line, tooltipX + padding, tooltipY + padding + i * lineHeight);
        });
      }
    }
    
    // Draw legend (reserved space at top)
    if (this.options.legend.show && this.options.legend.position === 'top') {
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'middle';
      let xOffset = plotArea.x;
      this.series.forEach((s, idx) => {
        const color = s.color || this.options.colors[idx % this.options.colors.length];
        const name = s.name || `Серия ${idx + 1}`;
        const textWidth = ctx.measureText(name).width;
        
        // Color box
        ctx.fillStyle = color;
        ctx.fillRect(xOffset, 8, 12, 12);
        
        // Label
        ctx.fillStyle = '#333';
        ctx.fillText(name, xOffset + 16, 14);
        
        xOffset += textWidth + 32;
      });
    }
    
    // Draw Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ticks.forEach(tick => {
      const normalized = (tick - tickMin) / (tickMax - tickMin);
      const y = plotArea.y + plotArea.height * (1 - normalized);
      const label = formatValue(tick, this.options.chartType);
      ctx.fillText(label, plotArea.x - 8, y);
    });
    
    // Draw X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xStep = Math.max(1, Math.floor(dataLength / 6));
    for (let i = 0; i < dataLength; i += xStep) {
      const x = plotArea.x + (plotArea.width / (dataLength - 1)) * i;
      ctx.fillText((i + 1).toString(), x, plotArea.y + plotArea.height + 8);
    }
  }
}
