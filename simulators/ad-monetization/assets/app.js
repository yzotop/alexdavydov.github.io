let presetsData = {};
let currentParams = {};
let currentResult = null;
let charts = {};
let storedNoise = null;
let lastFullRun = null;

const appState = {
  hoverIndex: null,
  hoverSourceCanvasId: null
};

function normalizeNumberString(s) {
  if (s == null) return "";
  return String(s)
    .trim()
    .replace(/[\u00A0\u202F\u2009\s]/g, "")
    .replace(/,/g, ".");
}

function parseNum(value, fallback = 0) {
  const t = normalizeNumberString(value);
  if (t === "") return fallback;
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function updateStatusBar(message, isError = false) {
  const statusBar = document.getElementById('statusBar');
  if (!statusBar) return;
  
  statusBar.className = isError ? 'statusbar statusbar--err' : 'statusbar statusbar--ok';
  statusBar.textContent = message;
}

function shortenStack(stack, maxLines = 10) {
  if (!stack) return '';
  const lines = stack.split('\n');
  return lines.slice(0, maxLines).join('\n');
}

async function initApp() {
  try {
    updateStatusBar('Checking canvas elements...', false);
    
    const requiredCanvasIds = ['chartRevenue', 'chartCPM', 'chartFill', 'chartPressurePV', 'chartImpressions'];
    const missingCanvases = [];
    const canvases = {};
    
    requiredCanvasIds.forEach(id => {
      const canvas = document.getElementById(id);
      if (!canvas) {
        missingCanvases.push(id);
      } else {
        canvases[id] = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          missingCanvases.push(id + ' (getContext failed)');
        }
      }
    });
    
    // Check optional cumulative canvas (exists but may be hidden)
    const cumCanvas = document.getElementById('chartRevenueCum');
    if (cumCanvas) {
      const ctx = cumCanvas.getContext('2d');
      if (!ctx) {
        console.warn('chartRevenueCum getContext failed');
      }
    }
    
    if (missingCanvases.length > 0) {
      const errorMsg = `Missing canvas elements:\n${missingCanvases.join('\n')}`;
      updateStatusBar(errorMsg, true);
      return;
    }
    
    updateStatusBar('Canvas elements OK. Loading presets...', false);
    
    // Load presets
    try {
      const response = await fetch('data/presets.json');
      presetsData = await response.json();
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
    
    // Populate preset dropdown
    const presetSelect = document.getElementById('preset');
    Object.keys(presetsData).forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      presetSelect.appendChild(option);
    });
    
    // Load first preset
    const firstPreset = Object.keys(presetsData)[0];
    if (firstPreset) {
      loadPreset(firstPreset);
    }
    
    // Event listeners
    document.getElementById('runBtn').addEventListener('click', () => runSimulation({ fast: false }));
    document.getElementById('resetBtn').addEventListener('click', () => {
      loadPreset(document.getElementById('preset').value);
      runSimulation({ fast: false });
    });
    document.getElementById('exportBtn').addEventListener('click', exportCSV);
    document.getElementById('preset').addEventListener('change', (e) => {
      loadPreset(e.target.value);
      runSimulation({ fast: false });
    });
  
  const toggleCumulativeEl = document.getElementById('toggleCumulative');
  if (toggleCumulativeEl) {
    toggleCumulativeEl.addEventListener('change', () => {
      if (currentResult) {
        renderCharts();
      }
    });
  }
    
    // Live updates for pressure controls
    const liveInputs = document.querySelectorAll('#controls input[data-live]');
    liveInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        validateInput(e);
        runSimulation({ fast: true });
      });
    });
    
    // Slow inputs: Enter triggers full recomputation
    const slowSection = document.querySelector('.param-section-slow');
    if (slowSection) {
      const slowInputs = slowSection.querySelectorAll('input[type="number"]');
      slowInputs.forEach(input => {
        input.addEventListener('input', validateInput);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            runSimulation({ fast: false });
          }
        });
      });
    }
    
    // Preset select
    const presetSelect2 = document.getElementById('preset');
    if (presetSelect2) {
      presetSelect2.addEventListener('input', validateInput);
    }
    
    // Initial run
    try {
      runSimulation({ fast: false });
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      updateStatusBar(`OK: render at ${timeStr}`, false);
    } catch (err) {
      const stack = shortenStack(err.stack || err.toString());
      updateStatusBar(`Error during initial run:\n${err.message}\n${stack}`, true);
    }
  } catch (err) {
    const stack = shortenStack(err.stack || err.toString());
    updateStatusBar(`Error in initApp:\n${err.message}\n${stack}`, true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.onerror = (message, source, lineno, colno, error) => {
    const stack = error ? shortenStack(error.stack || error.toString()) : '';
    const msg = `JavaScript error:\n${message}\n${source}:${lineno}:${colno}\n${stack}`;
    updateStatusBar(msg, true);
    return false;
  };
  
  window.onunhandledrejection = (event) => {
    const error = event.reason;
    const stack = error && error.stack ? shortenStack(error.stack) : String(error);
    const msg = `Unhandled promise rejection:\n${error?.message || error}\n${stack}`;
    updateStatusBar(msg, true);
  };
  
  window.appState = appState;
  window.charts = charts;
  
  initApp();
});

function loadPreset(presetName) {
  const preset = presetsData[presetName];
  if (!preset) return;
  
  document.getElementById('dau0').value = preset.dau0;
  document.getElementById('growth_rate').value = preset.growth_rate;
  document.getElementById('carrying_capacity').value = preset.carrying_capacity;
  document.getElementById('pv_per_user').value = preset.pv_per_user;
  document.getElementById('slots_per_pv').value = preset.slots_per_pv;
  document.getElementById('viewability').value = preset.viewability;
  document.getElementById('fill_rate_base').value = preset.fill_rate_base;
  document.getElementById('cpm0').value = preset.cpm0;
  document.getElementById('commission').value = preset.commission;
  document.getElementById('saturation_sweetspot').value = preset.saturation_sweetspot;
  document.getElementById('alpha_engagement').value = preset.alpha_engagement;
  document.getElementById('beta_cpm').value = preset.beta_cpm;
  document.getElementById('gamma_fill').value = preset.gamma_fill;
  document.getElementById('cap_ads_day').value = preset.cap_ads_day;
  document.getElementById('seed').value = preset.seed;
  document.getElementById('cpm_volatility').value = preset.cpm_volatility;
  document.getElementById('demand_volatility').value = preset.demand_volatility;
  
  // Clear errors
  document.querySelectorAll('.error').forEach(el => el.textContent = '');
}

function getParams() {
  const viewabilityRaw = parseNum(document.getElementById('viewability').value, 0.72);
  const commissionRaw = parseNum(document.getElementById('commission').value, 0.10);
  const fillRateRaw = parseNum(document.getElementById('fill_rate_base').value, 0.88);
  const cpmVolRaw = parseNum(document.getElementById('cpm_volatility').value, 0.08);
  const demandVolRaw = parseNum(document.getElementById('demand_volatility').value, 0.06);
  
  return {
    dau0: parseNum(document.getElementById('dau0').value, 4000000),
    growth_rate: parseNum(document.getElementById('growth_rate').value, 0.015),
    carrying_capacity: parseNum(document.getElementById('carrying_capacity').value, 8000000),
    pv_per_user: parseNum(document.getElementById('pv_per_user').value, 70),
    slots_per_pv: parseNum(document.getElementById('slots_per_pv').value, 0.55),
    viewability: Math.max(0, Math.min(1, viewabilityRaw)),
    fill_rate_base: Math.max(0, Math.min(1, fillRateRaw)),
    cpm0: parseNum(document.getElementById('cpm0').value, 180),
    commission: Math.max(0, Math.min(1, commissionRaw)),
    saturation_sweetspot: parseNum(document.getElementById('saturation_sweetspot').value, 14),
    alpha_engagement: parseNum(document.getElementById('alpha_engagement').value, 0.015),
    beta_cpm: parseNum(document.getElementById('beta_cpm').value, 0.010),
    gamma_fill: parseNum(document.getElementById('gamma_fill').value, 0.008),
    cap_ads_day: parseNum(document.getElementById('cap_ads_day').value, 22),
    seed: Math.trunc(parseNum(document.getElementById('seed').value, 42)),
    cpm_volatility: Math.max(0, Math.min(1, cpmVolRaw)),
    demand_volatility: Math.max(0, Math.min(1, demandVolRaw)),
    demand_multiplier: presetsData[document.getElementById('preset').value]?.demand_multiplier || 1.0
  };
}

function validateInput(e) {
  const input = e.target;
  const errorEl = input.parentElement.querySelector('.error');
  if (!errorEl) return;
  
  const value = parseNum(input.value);
  const min = parseNum(input.min, -Infinity);
  const max = parseNum(input.max, Infinity);
  
  if (!Number.isFinite(value)) {
    errorEl.textContent = 'Invalid number';
    return;
  }
  
  if (Number.isFinite(min) && value < min) {
    input.value = min;
    errorEl.textContent = `Clamped to minimum: ${min}`;
    setTimeout(() => errorEl.textContent = '', 2000);
  } else if (Number.isFinite(max) && value > max) {
    input.value = max;
    errorEl.textContent = `Clamped to maximum: ${max}`;
    setTimeout(() => errorEl.textContent = '', 2000);
  } else {
    errorEl.textContent = '';
  }
}

function runSimulation(options = {}) {
  try {
    const { fast = false } = options;
    
    currentParams = getParams();
    
    if (fast && storedNoise && lastFullRun) {
      currentResult = simulateFast(currentParams, storedNoise, lastFullRun);
      updateStatusIndicator('Live preview');
    } else {
      currentResult = simulate(currentParams);
      storedNoise = extractNoise(currentResult);
      lastFullRun = { ...currentParams };
      updateStatusIndicator('Scenario recalculated');
    }
    
    renderCharts();
    renderKPITiles();
    renderKPITable();
    
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    updateStatusBar(`OK: render at ${timeStr}`, false);
  } catch (err) {
    const stack = shortenStack(err.stack || err.toString());
    updateStatusBar(`Error in runSimulation:\n${err.message}\n${stack}`, true);
    throw err;
  }
}

function extractNoise(result) {
  if (!result || !result.noiseData) return null;
  return result.noiseData;
}

function simulateFast(params, noise, baseParams) {
  if (!noise || !baseParams) {
    return simulate(params);
  }
  
  const fullResult = simulate(params, noise);
  fullResult.noiseData = noise;
  return fullResult;
}

function updateStatusIndicator(text) {
  const indicator = document.getElementById('statusIndicator');
  if (indicator) {
    indicator.textContent = text;
  }
}

function renderCharts() {
  if (!currentResult) return;
  
  try {
    // Resize canvases first to ensure proper dimensions
    resizeCanvases();
    
    // Chart 1: Revenue (net weekly only)
    const revenueCanvas = document.getElementById('chartRevenue');
    if (!revenueCanvas) throw new Error('chartRevenue canvas not found');
  
  let revenueSeries = [
    { name: 'Выручка нетто (неделя)', data: currentResult.revenue_net, color: '#2563eb', formatter: v => `₽${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
  ];
  
  if (!charts.revenue) {
    charts.revenue = new LineChart(revenueCanvas, revenueSeries, { showPoints: false });
  } else {
    charts.revenue.series = revenueSeries;
    charts.revenue.options.showPoints = false;
    charts.revenue.render({ hoverIndex: appState.hoverIndex });
  }
  
  // Cumulative sparkline (if toggle enabled)
  const toggleCumulative = document.getElementById('toggleCumulative');
  const cumWrap = document.getElementById('cumWrap');
  const cumulativeCanvas = document.getElementById('chartRevenueCum');
  
  if (toggleCumulative && toggleCumulative.checked && cumulativeCanvas && cumWrap) {
    cumWrap.classList.add('is-on');
    
    const cumulativeNet = [];
    let sum = 0;
    currentResult.revenue_net.forEach(v => {
      sum += v;
      cumulativeNet.push(sum);
    });
    
    let cumSeries = [
      { name: 'Выручка нетто (накопительно)', data: cumulativeNet, color: '#16a34a', formatter: v => `₽${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
    ];
    
    if (!charts.revenueCum) {
      charts.revenueCum = new LineChart(cumulativeCanvas, cumSeries, { showPoints: false, padding: { top: 8, right: 12, bottom: 20, left: 50 }, legend: { show: false } });
    } else {
      charts.revenueCum.series = cumSeries;
      charts.revenueCum.options.showPoints = false;
      charts.revenueCum.render({ hoverIndex: appState.hoverIndex });
    }
  } else {
    if (cumWrap) cumWrap.classList.remove('is-on');
  }
  
  // Chart 2: CPM
  const cpmCanvas = document.getElementById('chartCPM');
    if (!cpmCanvas) throw new Error('chartCPM canvas not found');
  let cpmSeries = [{ name: 'CPM', data: currentResult.cpm, color: '#dc2626', formatter: v => `₽${v.toFixed(0)}` }];
  if (!charts.cpm) {
    charts.cpm = new LineChart(cpmCanvas, cpmSeries, { showPoints: false });
  } else {
    charts.cpm.series = cpmSeries;
    charts.cpm.options.showPoints = false;
    charts.cpm.render({ hoverIndex: appState.hoverIndex });
  }
  
  // Chart 3: Fill Rate
  const fillCanvas = document.getElementById('chartFill');
    if (!fillCanvas) throw new Error('chartFill canvas not found');
  const fillPercent = currentResult.fill.map(v => v * 100);
  let fillSeries = [{ name: 'Fill Rate', data: fillPercent, color: '#ea580c', formatter: v => `${v.toFixed(1)}%` }];
  if (!charts.fill) {
    charts.fill = new LineChart(fillCanvas, fillSeries, { chartType: 'fill', showPoints: false });
  } else {
    charts.fill.series = fillSeries;
    charts.fill.options.chartType = 'fill';
    charts.fill.options.showPoints = false;
    charts.fill.render({ hoverIndex: appState.hoverIndex });
  }
  
  // Chart 4: Ads per user and PV per user
  const adsCanvas = document.getElementById('chartPressurePV');
  if (!adsCanvas) throw new Error('chartPressurePV canvas not found');
  let adsSeries = [
    { name: 'Ads/user/day', data: currentResult.ads_user_day, color: '#9333ea', formatter: v => v.toFixed(1) },
    { name: 'PV/user', data: currentResult.pv_user, color: '#2563eb', formatter: v => v.toFixed(0) }
  ];
  if (!charts.ads) {
    charts.ads = new LineChart(adsCanvas, adsSeries, { showPoints: false });
  } else {
    charts.ads.series = adsSeries;
    charts.ads.options.showPoints = false;
    charts.ads.render({ hoverIndex: appState.hoverIndex });
  }
  
  // Chart 5: Impressions
  const impressionsCanvas = document.getElementById('chartImpressions');
    if (!impressionsCanvas) throw new Error('chartImpressions canvas not found');
  let impressionsSeries = [{ name: 'Impressions (weekly)', data: currentResult.impressions, color: '#16a34a', formatter: v => v.toLocaleString('en-US', { maximumFractionDigits: 0 }) }];
  if (!charts.impressions) {
    charts.impressions = new LineChart(impressionsCanvas, impressionsSeries, { showPoints: false });
  } else {
    charts.impressions.series = impressionsSeries;
    charts.impressions.options.showPoints = false;
    charts.impressions.render({ hoverIndex: appState.hoverIndex });
  }
  } catch (err) {
    const stack = shortenStack(err.stack || err.toString());
    updateStatusBar(`Error in renderCharts:\n${err.message}\n${stack}`, true);
    throw err;
  }
}

function resizeCanvases() {
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0) return; // Not visible yet
    
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const computedStyle = window.getComputedStyle(canvas);
    const height = parseNum(computedStyle.height, 240);
    
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      // Re-render if chart exists
      Object.values(charts).forEach(chart => {
        if (chart.canvas === canvas) {
          const hoverIndex = window.appState ? window.appState.hoverIndex : null;
          chart.render({ hoverIndex });
        }
      });
    }
  });
}

window.addEventListener('resize', resizeCanvases);

function renderKPITiles() {
  if (!currentResult || !currentResult.summary) return;
  
  const s = currentResult.summary;
  const tilesEl = document.getElementById('kpiTiles');
  if (!tilesEl) return;
  
  function formatMoney(value) {
    const abs = Math.abs(value);
    if (abs >= 1e9) {
      return `${(value / 1e9).toFixed(abs >= 1e10 ? 1 : 2)} млрд`;
    } else if (abs >= 1e6) {
      return `${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)} млн`;
    } else if (abs >= 1e3) {
      return `${(value / 1e3).toFixed(abs >= 1e4 ? 1 : 2)} тыс`;
    } else {
      return value.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
    }
  }
  
  tilesEl.innerHTML = `
    <div class="kpi-tile">
      <div class="kpi-tile-label">Выручка нетто (итого)</div>
      <div class="kpi-tile-value">₽${formatMoney(s.total_net_revenue)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">RPM нетто (среднее)</div>
      <div class="kpi-tile-value">₽${s.avg_rpm.toFixed(2)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">CPM (среднее)</div>
      <div class="kpi-tile-value">₽${s.avg_cpm.toFixed(2)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Fill rate (среднее)</div>
      <div class="kpi-tile-value">${(s.avg_fill * 100).toFixed(1)}%</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">PV/user (среднее)</div>
      <div class="kpi-tile-value">${s.avg_pv_user.toFixed(1)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Ads/user/day (среднее)</div>
      <div class="kpi-tile-value">${s.avg_ads_user_day.toFixed(2)}</div>
    </div>
  `;
}

function renderKPITable() {
  if (!currentResult || !currentResult.summary) return;
  
  const s = currentResult.summary;
  const table = document.getElementById('kpiTable');
  table.innerHTML = `
    <tr>
      <th>Метрика</th>
      <th>Значение</th>
    </tr>
    <tr>
      <td>Выручка нетто (итого)</td>
      <td class="number">₽${s.total_net_revenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
    </tr>
    <tr>
      <td>CPM (среднее)</td>
      <td class="number">₽${s.avg_cpm.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Fill rate (среднее)</td>
      <td class="number">${(s.avg_fill * 100).toFixed(1)}%</td>
    </tr>
    <tr>
      <td>PV на пользователя (среднее)</td>
      <td class="number">${s.avg_pv_user.toFixed(1)}</td>
    </tr>
    <tr>
      <td>Ads на пользователя/день (среднее)</td>
      <td class="number">${s.avg_ads_user_day.toFixed(2)}</td>
    </tr>
    <tr>
      <td>DAU в конце</td>
      <td class="number">${s.end_dau.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
    </tr>
    <tr>
      <td>RPM нетто (среднее)</td>
      <td class="number">₽${s.avg_rpm.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Лучшая неделя (нетто)</td>
      <td class="number">₽${s.best_week_revenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
    </tr>
    <tr>
      <td>Худшая неделя (нетто)</td>
      <td class="number">₽${s.worst_week_revenue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}</td>
    </tr>
  `;
}


function exportCSV() {
  if (!currentResult) return;
  
  const headers = ['Week', 'DAU', 'PV/user', 'Ads/user/day', 'Impressions Possible', 'Impressions', 'CPM', 'Fill', 'Revenue Gross', 'Revenue Net', 'RPM', 'Minutes/user'];
  const rows = [headers.join(',')];
  
  for (let i = 0; i < currentResult.week.length; i++) {
    const row = [
      currentResult.week[i],
      currentResult.dau[i],
      currentResult.pv_user[i],
      currentResult.ads_user_day[i],
      currentResult.impressions_possible[i],
      currentResult.impressions[i],
      currentResult.cpm[i],
      currentResult.fill[i],
      currentResult.revenue_gross[i],
      currentResult.revenue_net[i],
      currentResult.rpm[i],
      currentResult.minutes_user_proxy[i]
    ];
    rows.push(row.join(','));
  }
  
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `simulation_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
