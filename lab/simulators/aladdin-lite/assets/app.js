/**
 * Aladdin-Lite: Portfolio Risk & Copilot
 * Client-side portfolio risk calculator
 */
(function() {
  'use strict';

  // Assets configuration
  const ASSETS = [
    { id: 'SPY', name: 'US Equity (SPY)', vol: 0.18 },
    { id: 'QQQ', name: 'Tech Equity (QQQ)', vol: 0.24 },
    { id: 'TLT', name: 'US Bonds (TLT)', vol: 0.16 },
    { id: 'LQD', name: 'IG Credit (LQD)', vol: 0.10 },
    { id: 'GLD', name: 'Gold (GLD)', vol: 0.15 },
    { id: 'OIL', name: 'Oil (OIL)', vol: 0.35 },
    { id: 'EEM', name: 'EM Equity (EEM)', vol: 0.22 },
    { id: 'CASH', name: 'Cash (CASH)', vol: 0.01 }
  ];

  // Correlation matrix (8x8, symmetric, diag=1)
  const CORR_MATRIX = [
    [1.00, 0.90, -0.25, 0.25, 0.05, 0.20, 0.75, 0.00], // SPY
    [0.90, 1.00, -0.30, 0.20, 0.00, 0.15, 0.65, 0.00], // QQQ
    [-0.25, -0.30, 1.00, 0.55, 0.10, -0.10, -0.20, 0.10], // TLT
    [0.25, 0.20, 0.55, 1.00, 0.10, 0.05, 0.25, 0.05], // LQD
    [0.05, 0.00, 0.10, 0.10, 1.00, 0.10, 0.05, 0.00], // GLD
    [0.20, 0.15, -0.10, 0.05, 0.10, 1.00, 0.20, 0.00], // OIL
    [0.75, 0.65, -0.20, 0.25, 0.05, 0.20, 1.00, 0.00], // EEM
    [0.00, 0.00, 0.10, 0.05, 0.00, 0.00, 0.00, 1.00]  // CASH
  ];

  // Stress scenarios
  const STRESSES = [
    {
      name: '2008 equity crash',
      shocks: [-3.0, -3.6, 1.2, -0.8, 0.4, -2.5, -3.8, 0.0]
    },
    {
      name: 'COVID risk-off',
      shocks: [-2.6, -2.2, 1.0, -0.6, 0.7, -4.5, -3.0, 0.0]
    },
    {
      name: 'Rates spike',
      shocks: [-1.2, -1.5, -2.0, -1.0, -0.6, 0.3, -1.4, 0.0]
    },
    {
      name: 'Inflation + commodities',
      shocks: [-0.8, -1.1, -1.4, -0.7, 0.8, 1.6, -0.5, 0.0]
    }
  ];

  // Presets
  const PRESETS = {
    '6040': [60, 0, 35, 0, 0, 0, 0, 5], // SPY, QQQ, TLT, LQD, GLD, OIL, EEM, CASH
    'tech': [20, 55, 15, 0, 5, 0, 0, 5],
    'defensive': [15, 0, 45, 20, 15, 0, 0, 5],
    'riskparity': [20, 10, 25, 15, 10, 5, 10, 5]
  };

  // State
  let weights = [60, 0, 35, 0, 0, 0, 0, 5]; // Default: 60/40
  let updateTimeout = null;

  /**
   * Build covariance matrix from volatilities and correlations
   */
  function buildCovMatrix(vols, corr) {
    const n = vols.length;
    const cov = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        cov[i][j] = vols[i] * vols[j] * corr[i][j];
      }
    }
    
    return cov;
  }

  /**
   * Calculate portfolio volatility
   * @param {Array<number>} w - weights vector
   * @param {Array<Array<number>>} cov - covariance matrix
   * @returns {number} annualized volatility
   */
  function portfolioVol(w, cov) {
    const n = w.length;
    let variance = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += w[i] * w[j] * cov[i][j];
      }
    }
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate VaR (parametric normal)
   * @param {number} z - z-score (1.645 for 95%)
   * @param {number} sigmaAnnual - annualized volatility
   * @param {number} days - horizon in days
   * @returns {number} VaR as percentage
   */
  function varNormal(z, sigmaAnnual, days) {
    const sigmaHorizon = sigmaAnnual * Math.sqrt(days / 252);
    return z * sigmaHorizon * 100; // Convert to percentage
  }

  /**
   * Calculate ES (Expected Shortfall, parametric normal)
   * @param {number} z - z-score (1.645 for 95%)
   * @param {number} sigmaAnnual - annualized volatility
   * @param {number} days - horizon in days
   * @returns {number} ES as percentage
   */
  function esNormal(z, sigmaAnnual, days) {
    const sigmaHorizon = sigmaAnnual * Math.sqrt(days / 252);
    // phi(z) / (1 - alpha) where alpha = 0.95
    // For z = 1.645, phi(1.645) ≈ 0.103
    const phiZ = 0.103; // Approximate value for z=1.645
    return (phiZ / 0.05) * sigmaHorizon * 100; // Convert to percentage
  }

  /**
   * Calculate stress PnL
   * @param {Array<number>} w - weights vector
   * @param {Array<number>} shocks - shock vector
   * @returns {number} portfolio PnL as percentage
   */
  function stressPnL(w, shocks) {
    let pnl = 0;
    for (let i = 0; i < w.length; i++) {
      pnl += (w[i] / 100) * shocks[i];
    }
    return pnl;
  }

  /**
   * Calculate risk contributions
   * @param {Array<number>} w - weights vector (as percentages)
   * @param {Array<Array<number>>} cov - covariance matrix
   * @returns {Array<number>} risk contributions as percentages
   */
  function riskContributions(w, cov) {
    const n = w.length;
    const wNorm = w.map(x => x / 100); // Normalize to 0-1
    
    // Portfolio variance
    let portVar = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portVar += wNorm[i] * wNorm[j] * cov[i][j];
      }
    }
    
    if (portVar === 0) return Array(n).fill(0);
    
    // Marginal contributions
    const marginal = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += wNorm[j] * cov[i][j];
      }
      marginal[i] = wNorm[i] * sum;
    }
    
    // Risk contributions as percentages
    return marginal.map(mc => (mc / portVar) * 100);
  }

  /**
   * Generate copilot text
   */
  function makeCopilotText(metrics, rc, stresses, weights) {
    const bullets = [];
    
    // Top 2 risk contributors
    const rcWithIdx = rc.map((val, idx) => ({ val, idx }))
      .sort((a, b) => b.val - a.val);
    const top2 = rcWithIdx.slice(0, 2);
    
    if (top2.length > 0) {
      const top1 = top2[0];
      const top1Name = ASSETS[top1.idx].name;
      bullets.push(`<strong>${top1Name}</strong> даёт ${top1.val.toFixed(1)}% вклада в риск портфеля.`);
      
      if (top2.length > 1) {
        const top2Name = ASSETS[top2[1].idx].name;
        bullets.push(`<strong>${top2Name}</strong> даёт ${top2[1].val.toFixed(1)}% вклада в риск.`);
      }
    }
    
    // Concentration warning
    const maxWeight = Math.max(...weights);
    if (maxWeight > 45) {
      const maxIdx = weights.indexOf(maxWeight);
      const maxName = ASSETS[maxIdx].name;
      bullets.push(`⚠️ Высокая концентрация: <strong>${maxName}</strong> составляет ${maxWeight.toFixed(1)}% портфеля.`);
    }
    
    // VaR warning
    if (metrics.var1d > 1.8) {
      bullets.push(`⚠️ Риск высокий: VaR 95% (1 день) = ${metrics.var1d.toFixed(2)}%.`);
    }
    
    // Worst stress
    const worstStress = stresses.reduce((worst, stress) => 
      stress.pnl < worst.pnl ? stress : worst, stresses[0]);
    if (worstStress.pnl < -2.5) {
      bullets.push(`⚠️ Уязвим к стрессу "<strong>${worstStress.name}</strong>": потери ${worstStress.pnl.toFixed(2)}%.`);
    }
    
    // Equity beta suggestion
    const equityRc = rc[0] + rc[1] + rc[6]; // SPY + QQQ + EEM
    if (equityRc > 65) {
      bullets.push(`💡 Снизить equity beta: увеличить TLT/GLD/CASH. Сейчас акции дают ${equityRc.toFixed(1)}% вклада в риск.`);
    }
    
    // Duration suggestion
    const durationRc = rc[2] + rc[3]; // TLT + LQD
    const ratesStress = stresses.find(s => s.name === 'Rates spike');
    if (durationRc > 40 && ratesStress && ratesStress.pnl < -1.5) {
      bullets.push(`💡 Снизить duration: меньше TLT, больше CASH/GLD. Duration даёт ${durationRc.toFixed(1)}% вклада в риск.`);
    }
    
    if (bullets.length === 0) {
      bullets.push('Портфель сбалансирован. Риск в пределах нормы.');
    }
    
    return '<ul>' + bullets.map(b => `<li>${b}</li>`).join('') + '</ul>';
  }

  /**
   * Normalize weights to sum to 100%
   */
  function normalizeWeights(w, excludeIdx = -1) {
    const sum = w.reduce((a, b) => a + b, 0);
    if (sum === 0) return w;
    
    if (excludeIdx >= 0) {
      // Proportional normalization excluding one weight
      const excludeVal = w[excludeIdx];
      const otherSum = sum - excludeVal;
      if (otherSum === 0) return w;
      
      const targetOtherSum = 100 - excludeVal;
      const factor = targetOtherSum / otherSum;
      
      return w.map((val, idx) => idx === excludeIdx ? val : val * factor);
    } else {
      // Simple normalization
      const factor = 100 / sum;
      return w.map(val => val * factor);
    }
  }

  /**
   * Update URL with current weights
   */
  function updateURL() {
    const params = new URLSearchParams();
    params.set('weights', weights.join(','));
    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', newURL);
  }

  /**
   * Load weights from URL
   */
  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const weightsStr = params.get('weights');
    if (weightsStr) {
      const parsed = weightsStr.split(',').map(x => parseFloat(x));
      if (parsed.length === 8 && parsed.every(x => !isNaN(x) && x >= 0)) {
        const sum = parsed.reduce((a, b) => a + b, 0);
        if (sum > 0) {
          weights = normalizeWeights(parsed);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Initialize portfolio controls
   */
  function initPortfolioControls() {
    const container = document.getElementById('portfolioControls');
    container.innerHTML = '';
    
    ASSETS.forEach((asset, idx) => {
      const div = document.createElement('div');
      div.className = 'asset-control';
      
      const header = document.createElement('div');
      header.className = 'asset-control__header';
      
      const name = document.createElement('span');
      name.className = 'asset-control__name';
      name.textContent = asset.name;
      
      const value = document.createElement('span');
      value.className = 'asset-control__value mono';
      value.id = `weight-${idx}`;
      value.textContent = weights[idx].toFixed(1) + '%';
      
      header.appendChild(name);
      header.appendChild(value);
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'asset-control__slider';
      slider.min = '0';
      slider.max = '100';
      slider.step = '1';
      slider.value = weights[idx];
      slider.dataset.assetIdx = idx;
      
      slider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.assetIdx);
        const newVal = parseFloat(e.target.value);
        
        // Update this weight
        weights[idx] = newVal;
        
        // Normalize others proportionally
        weights = normalizeWeights(weights, idx);
        
        // Update all sliders and values
        updateAllControls();
        
        // Debounced URL update
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateURL, 300);
        
        // Recalculate
        recalculate();
      });
      
      div.appendChild(header);
      div.appendChild(slider);
      container.appendChild(div);
    });
  }

  /**
   * Update all controls
   */
  function updateAllControls() {
    ASSETS.forEach((asset, idx) => {
      const valueEl = document.getElementById(`weight-${idx}`);
      if (valueEl) {
        valueEl.textContent = weights[idx].toFixed(1) + '%';
      }
      
      const slider = document.querySelector(`.asset-control__slider[data-asset-idx="${idx}"]`);
      if (slider) {
        slider.value = weights[idx];
      }
    });
    
    const totalEl = document.getElementById('totalWeight');
    if (totalEl) {
      const sum = weights.reduce((a, b) => a + b, 0);
      totalEl.textContent = sum.toFixed(1) + '%';
    }
  }

  /**
   * Apply preset
   */
  function applyPreset(presetKey) {
    if (PRESETS[presetKey]) {
      weights = [...PRESETS[presetKey]];
      // Ensure sum is exactly 100
      weights = normalizeWeights(weights);
      updateAllControls();
      updateURL();
      recalculate();
    }
  }

  /**
   * Recalculate all metrics
   */
  function recalculate() {
    // Build covariance matrix
    const vols = ASSETS.map(a => a.vol);
    const cov = buildCovMatrix(vols, CORR_MATRIX);
    
    // Normalize weights to 0-1
    const wNorm = weights.map(x => x / 100);
    
    // Portfolio volatility
    const vol = portfolioVol(wNorm, cov);
    
    // Risk metrics
    const z = 1.645; // 95% confidence
    const var1d = varNormal(z, vol, 1);
    const es1d = esNormal(z, vol, 1);
    const var1m = varNormal(z, vol, 21);
    const es1m = esNormal(z, vol, 21);
    
    // Risk contributions
    const rc = riskContributions(weights, cov);
    
    // Stress scenarios
    const stressResults = STRESSES.map(stress => {
      const pnl = stressPnL(weights, stress.shocks);
      
      // Find top 3 contributors by absolute value
      const contributors = weights.map((w, idx) => ({
        name: ASSETS[idx].id,
        contribution: (w / 100) * stress.shocks[idx]
      }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3);
      
      return {
        name: stress.name,
        pnl: pnl,
        contributors: contributors
      };
    });
    
    // Update UI
    updateMetrics({ vol, var1d, es1d, var1m, es1m });
    updateStressTable(stressResults);
    updateCharts({ var1d, es1d, var1m, es1m }, stressResults);
    updateCopilot({ vol, var1d }, rc, stressResults, weights);
  }

  /**
   * Update metrics display
   */
  function updateMetrics(metrics) {
    document.getElementById('metricVol').textContent = (metrics.vol * 100).toFixed(2) + '%';
    document.getElementById('metricVaR1d').textContent = metrics.var1d.toFixed(2) + '%';
    document.getElementById('metricES1d').textContent = metrics.es1d.toFixed(2) + '%';
    document.getElementById('metricVaR1m').textContent = metrics.var1m.toFixed(2) + '%';
    document.getElementById('metricES1m').textContent = metrics.es1m.toFixed(2) + '%';
  }

  /**
   * Update stress table
   */
  function updateStressTable(stresses) {
    const table = document.getElementById('stressTable');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Сценарий</th>
          <th>PnL портфеля</th>
          <th>Топ-3 вкладчика</th>
        </tr>
      </thead>
      <tbody>
        ${stresses.map(s => `
          <tr>
            <td>${s.name}</td>
            <td class="stress-pnl ${s.pnl < 0 ? 'stress-pnl--negative' : 'stress-pnl--positive'} mono">
              ${s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}%
            </td>
            <td class="stress-contributors">
              ${s.contributors.map(c => `${c.name} ${c.contribution >= 0 ? '+' : ''}${c.contribution.toFixed(2)}%`).join(', ')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  /**
   * Draw bar chart
   */
  function drawBarChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width * dpr;
    const height = rect.height * dpr;
    
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);
    }
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const plotWidth = displayWidth - padding.left - padding.right;
    const plotHeight = displayHeight - padding.top - padding.bottom;
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    if (data.length === 0) return;
    
    const values = data.map(d => d.value);
    const hasNegative = data.some(d => d.value < 0);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = hasNegative ? Math.max(Math.abs(maxVal), Math.abs(minVal)) : maxVal;
    
    const barWidth = plotWidth / data.length * 0.7;
    const barSpacing = plotWidth / data.length;
    const zeroY = hasNegative ? padding.top + plotHeight / 2 : displayHeight - padding.bottom;
    
    // Draw axes
    ctx.strokeStyle = '#e6e6e8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, displayHeight - padding.bottom);
    ctx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    ctx.stroke();
    
    // Draw zero line if there are negative values
    if (hasNegative) {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(displayWidth - padding.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (plotHeight / gridLines) * (gridLines - i);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(displayWidth - padding.right, y);
      ctx.stroke();
    }
    
    // Draw bars
    data.forEach((item, i) => {
      const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const barHeight = (Math.abs(item.value) / range) * (plotHeight / (hasNegative ? 2 : 1));
      
      let y, valueY;
      if (hasNegative) {
        if (item.value >= 0) {
          y = zeroY - barHeight;
          valueY = y;
        } else {
          y = zeroY;
          valueY = y + barHeight;
        }
      } else {
        y = displayHeight - padding.bottom - barHeight;
        valueY = y;
      }
      
      ctx.fillStyle = item.value >= 0 ? '#16a34a' : '#dc2626';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Label
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = hasNegative ? zeroY + 5 : displayHeight - padding.bottom + 5;
      ctx.fillText(item.label, x + barWidth / 2, labelY);
      
      // Value
      ctx.textBaseline = item.value >= 0 ? 'bottom' : 'top';
      if (hasNegative && item.value < 0) {
        ctx.fillText(item.value.toFixed(2) + '%', x + barWidth / 2, valueY + 2);
      } else {
        ctx.fillText(item.value.toFixed(2) + '%', x + barWidth / 2, valueY - 2);
      }
    });
    
    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
      let value, y;
      if (hasNegative) {
        // Center around zero: -range to +range
        value = range * (1 - 2 * i / gridLines);
        y = padding.top + (plotHeight / gridLines) * i;
      } else {
        // Positive only: 0 to range
        value = range * (1 - i / gridLines);
        y = padding.top + (plotHeight / gridLines) * i;
      }
      ctx.fillText(value.toFixed(1) + '%', padding.left - 5, y);
    }
  }

  /**
   * Update charts
   */
  function updateCharts(metrics, stresses) {
    // Risk profile chart
    const riskCanvas = document.getElementById('chartRisk');
    if (riskCanvas) {
      const riskData = [
        { label: 'VaR 1d', value: metrics.var1d },
        { label: 'ES 1d', value: metrics.es1d },
        { label: 'VaR 1m', value: metrics.var1m },
        { label: 'ES 1m', value: metrics.es1m }
      ];
      drawBarChart(riskCanvas, riskData);
    }
    
    // Stress PnL chart
    const stressCanvas = document.getElementById('chartStress');
    if (stressCanvas) {
      const stressData = stresses.map(s => ({
        label: s.name.split(' ')[0], // First word
        value: s.pnl
      }));
      drawBarChart(stressCanvas, stressData);
    }
  }

  /**
   * Update copilot text
   */
  function updateCopilot(metrics, rc, stresses, weights) {
    const copilotEl = document.getElementById('copilotText');
    if (copilotEl) {
      const text = makeCopilotText(metrics, rc, stresses, weights);
      copilotEl.innerHTML = text;
    }
  }

  /**
   * Initialize
   */
  function init() {
    // Load from URL or use default
    const loadedFromURL = loadFromURL();
    if (!loadedFromURL) {
      weights = [...PRESETS['6040']];
      weights = normalizeWeights(weights);
    }
    
    // Initialize controls
    initPortfolioControls();
    updateAllControls();
    
    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        applyPreset(e.target.dataset.preset);
      });
    });
    
    // Reset button
    document.getElementById('btnReset').addEventListener('click', () => {
      applyPreset('6040');
    });
    
    // Initial URL update if not loaded from URL
    if (!loadedFromURL) {
      updateURL();
    }
    
    // Initial calculation
    recalculate();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      setTimeout(recalculate, 100);
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
