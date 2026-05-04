let currentParams = {};
let currentResult = null;
let charts = {};

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

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function updateStatusBar(message, isError = false) {
  const statusBar = document.getElementById('statusBar');
  if (!statusBar) return;

  statusBar.className = isError ? 'statusbar statusbar--err' : 'statusbar statusbar--ok';
  statusBar.textContent = message;
}

function updateStatusIndicator(text) {
  const indicator = document.getElementById('statusIndicator');
  if (indicator) {
    indicator.textContent = text;
  }
}

// RNG: mulberry32
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randomNormal(rng, mean = 0, std = 1) {
  let u = 0, v = 0;
  // Avoid 0
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + std * z;
}

function getParams() {
  const base_demand_requests = clamp(parseNum(document.getElementById('base_demand_requests').value, 10000), 2000, 30000);
  const avg_price = clamp(parseNum(document.getElementById('avg_price').value, 500), 200, 1200);
  const price_elasticity = clamp(parseNum(document.getElementById('price_elasticity').value, 1.1), 0.3, 2.5);
  const eta_elasticity = clamp(parseNum(document.getElementById('eta_elasticity').value, 1.3), 0.5, 3.0);
  const season_amp = clamp(parseNum(document.getElementById('season_amp').value, 0.15), 0, 0.3);

  const active_drivers_start = clamp(parseNum(document.getElementById('active_drivers_start').value, 400), 100, 1200);
  const trips_per_driver_per_week = clamp(parseNum(document.getElementById('trips_per_driver_per_week').value, 25), 10, 50);
  const onboard_per_week = clamp(parseNum(document.getElementById('onboard_per_week').value, 8), 0, 40);
  const base_churn_rate = clamp(parseNum(document.getElementById('base_churn_rate').value, 0.015), 0, 0.1);
  const churn_over_k = clamp(parseNum(document.getElementById('churn_over_k').value, 0.12), 0, 0.5);
  const target_util = clamp(parseNum(document.getElementById('target_util').value, 0.7), 0.5, 0.9);

  const base_eta = clamp(parseNum(document.getElementById('base_eta').value, 6), 3, 15);
  const eta_k = clamp(parseNum(document.getElementById('eta_k').value, 3), 1, 5);
  const eta_pow = clamp(parseNum(document.getElementById('eta_pow').value, 2.5), 2, 4);

  const take_rate_raw = clamp(parseNum(document.getElementById('take_rate').value, 22), 5, 40);
  const take_rate = take_rate_raw / 100;
  const driver_bonus_per_trip = clamp(parseNum(document.getElementById('driver_bonus_per_trip').value, 50), 0, 400);
  const sla_penalty_per_unfulfilled = clamp(parseNum(document.getElementById('sla_penalty_per_unfulfilled').value, 30), 0, 500);
  const onboard_cost_per_driver = clamp(parseNum(document.getElementById('onboard_cost_per_driver').value, 2000), 0, 10000);

  const noise_level = clamp(parseNum(document.getElementById('noise_level').value, 0.07), 0, 0.25);
  const random_seed = Math.trunc(clamp(parseNum(document.getElementById('random_seed').value, 42), 1, 999));

  const scenarioEl = document.getElementById('scenario');
  const scenario = scenarioEl ? scenarioEl.value : 'baseline';

  return {
    base_demand_requests,
    avg_price,
    price_elasticity,
    eta_elasticity,
    season_amp,
    active_drivers_start,
    trips_per_driver_per_week,
    onboard_per_week,
    base_churn_rate,
    churn_over_k,
    target_util,
    base_eta,
    eta_k,
    eta_pow,
    take_rate,
    driver_bonus_per_trip,
    sla_penalty_per_unfulfilled,
    onboard_cost_per_driver,
    noise_level,
    random_seed,
    scenario
  };
}

function applyScenario(name) {
  const scenario = name || 'baseline';
  const selectEl = document.getElementById('scenario');
  if (selectEl) {
    selectEl.value = scenario;
  }

  const presets = {
    baseline: {
      base_demand_requests: 10000,
      avg_price: 500,
      price_elasticity: 1.1,
      eta_elasticity: 1.3,
      season_amp: 0.15,
      active_drivers_start: 400,
      trips_per_driver_per_week: 25,
      onboard_per_week: 8,
      base_churn_rate: 0.015,
      churn_over_k: 0.12,
      target_util: 0.7,
      base_eta: 6,
      eta_k: 3,
      eta_pow: 2.5,
      take_rate: 22,
      driver_bonus_per_trip: 50,
      sla_penalty_per_unfulfilled: 30,
      onboard_cost_per_driver: 2000,
      noise_level: 0.07,
      random_seed: 42
    },
    rain_peak: {
      base_demand_requests: 14000,
      avg_price: 520,
      price_elasticity: 1.0,
      eta_elasticity: 1.6,
      season_amp: 0.25,
      active_drivers_start: 380,
      trips_per_driver_per_week: 25,
      onboard_per_week: 6,
      base_churn_rate: 0.018,
      churn_over_k: 0.16,
      target_util: 0.72,
      base_eta: 6,
      eta_k: 3.5,
      eta_pow: 2.7,
      take_rate: 22,
      driver_bonus_per_trip: 60,
      sla_penalty_per_unfulfilled: 40,
      onboard_cost_per_driver: 2200,
      noise_level: 0.09,
      random_seed: 101
    },
    driver_strike: {
      base_demand_requests: 11000,
      avg_price: 500,
      price_elasticity: 1.1,
      eta_elasticity: 1.3,
      season_amp: 0.12,
      active_drivers_start: 350,
      trips_per_driver_per_week: 23,
      onboard_per_week: 4,
      base_churn_rate: 0.04,
      churn_over_k: 0.35,
      target_util: 0.68,
      base_eta: 6,
      eta_k: 3.2,
      eta_pow: 2.6,
      take_rate: 22,
      driver_bonus_per_trip: 80,
      sla_penalty_per_unfulfilled: 50,
      onboard_cost_per_driver: 2500,
      noise_level: 0.08,
      random_seed: 202
    }
  };

  const p = presets[scenario] || presets.baseline;
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setVal('base_demand_requests', p.base_demand_requests);
  setVal('avg_price', p.avg_price);
  setVal('price_elasticity', p.price_elasticity);
  setVal('eta_elasticity', p.eta_elasticity);
  setVal('season_amp', p.season_amp);

  setVal('active_drivers_start', p.active_drivers_start);
  setVal('trips_per_driver_per_week', p.trips_per_driver_per_week);
  setVal('onboard_per_week', p.onboard_per_week);
  setVal('base_churn_rate', p.base_churn_rate);
  setVal('churn_over_k', p.churn_over_k);
  setVal('target_util', p.target_util);

  setVal('base_eta', p.base_eta);
  setVal('eta_k', p.eta_k);
  setVal('eta_pow', p.eta_pow);

  setVal('take_rate', p.take_rate);
  setVal('driver_bonus_per_trip', p.driver_bonus_per_trip);
  setVal('sla_penalty_per_unfulfilled', p.sla_penalty_per_unfulfilled);
  setVal('onboard_cost_per_driver', p.onboard_cost_per_driver);

  setVal('noise_level', p.noise_level);
  setVal('random_seed', p.random_seed);
}

function resetParams() {
  applyScenario('baseline');
}

function simulate(params) {
  const WEEKS = 52;
  const base_price = 500;
  const max_eta = 25;

  const requests = new Array(WEEKS).fill(0);
  const matched = new Array(WEEKS).fill(0);
  const cancel_rate = new Array(WEEKS).fill(0);
  const fulfilled = new Array(WEEKS).fill(0);
  const unfulfilled = new Array(WEEKS).fill(0);
  const drivers = new Array(WEEKS).fill(0);
  const capacity = new Array(WEEKS).fill(0);
  const utilization = new Array(WEEKS).fill(0);
  const match_rate = new Array(WEEKS).fill(0);
  const eta = new Array(WEEKS).fill(0);
  const gmv = new Array(WEEKS).fill(0);
  const gross_rev = new Array(WEEKS).fill(0);
  const costs = new Array(WEEKS).fill(0);
  const net_rev = new Array(WEEKS).fill(0);

  const weekIndex = new Array(WEEKS).fill(0).map((_, i) => i + 1);

  let rng = mulberry32(params.random_seed);

  drivers[0] = params.active_drivers_start;
  eta[0] = params.base_eta;

  function price_effect(p) {
    const ratio = p / base_price;
    const expArg = -params.price_elasticity * (ratio - 1);
    const v = Math.exp(expArg);
    return Number.isFinite(v) ? v : 0;
  }

  function eta_demand_effect(prevEta) {
    const ratio = prevEta / params.base_eta;
    const expArg = -params.eta_elasticity * (ratio - 1);
    const v = Math.exp(expArg);
    return Number.isFinite(v) ? v : 0;
  }

  for (let t = 0; t < WEEKS; t++) {
    const seasonality_t = 1 + params.season_amp * Math.sin(2 * Math.PI * t / 52);
    const noise_t = Math.exp(randomNormal(rng, 0, params.noise_level));

    const prevEta = t === 0 ? eta[0] : eta[t - 1];
    const pe = price_effect(params.avg_price);
    const se = eta_demand_effect(prevEta);

    let req = params.base_demand_requests * seasonality_t * pe * se * noise_t;
    if (!Number.isFinite(req) || req < 0) req = 0;
    requests[t] = req;

    const drv = drivers[t];
    const cap = Math.max(0, drv * params.trips_per_driver_per_week);
    capacity[t] = cap;

    const util_pressure = cap > 0 ? clamp(req / cap, 0, 1) : 0;
    const overload = Math.max(0, util_pressure - params.target_util);

    let eta_t = params.base_eta * (1 + params.eta_k * Math.pow(overload / Math.max(1e-6, (1 - params.target_util)), params.eta_pow));
    if (!Number.isFinite(eta_t)) eta_t = params.base_eta;
    eta_t = clamp(eta_t, params.base_eta, max_eta);
    eta[t] = eta_t;

    const mr_eta_k = 0.08;
    const mr_over_k = 2.0;
    let mr = Math.exp(-mr_eta_k * Math.max(0, eta_t - params.base_eta)) * Math.exp(-mr_over_k * overload);
    mr = clamp(mr, 0, 1);

    const base_cancel = 0.03;
    const cancel_k = 0.02;
    let cr = base_cancel + cancel_k * Math.max(0, eta_t - params.base_eta);
    cr = clamp(cr, 0, 0.6);

    const matchedTrips = req * mr;
    const afterCancel = matchedTrips * (1 - cr);
    const fulfilledTrips = Math.min(afterCancel, cap);
    const unfulfilledTrips = Math.max(0, req - fulfilledTrips);

    matched[t] = Number.isFinite(matchedTrips) ? matchedTrips : 0;
    cancel_rate[t] = Number.isFinite(cr) ? cr : 0;
    fulfilled[t] = Number.isFinite(fulfilledTrips) ? fulfilledTrips : 0;
    unfulfilled[t] = Number.isFinite(unfulfilledTrips) ? unfulfilledTrips : 0;

    const utilReal = cap > 0 ? fulfilledTrips / cap : 0;
    utilization[t] = clamp(Number.isFinite(utilReal) ? utilReal : 0, 0, 1);
    match_rate[t] = clamp(Number.isFinite(mr) ? mr : 0, 0, 1);

    const gmv_t = fulfilledTrips * params.avg_price;
    const gross_t = gmv_t * params.take_rate;
    const costs_t =
      fulfilledTrips * params.driver_bonus_per_trip +
      unfulfilledTrips * params.sla_penalty_per_unfulfilled +
      params.onboard_per_week * params.onboard_cost_per_driver;
    const net_t = gross_t - costs_t;

    gmv[t] = Number.isFinite(gmv_t) ? gmv_t : 0;
    gross_rev[t] = Number.isFinite(gross_t) ? gross_t : 0;
    costs[t] = Number.isFinite(costs_t) ? costs_t : 0;
    net_rev[t] = Number.isFinite(net_t) ? net_t : 0;

    if (t < WEEKS - 1) {
      const overload_for_churn = Math.max(0, utilization[t] - params.target_util);
      let churn_rate = params.base_churn_rate + params.churn_over_k * overload_for_churn;
      churn_rate = clamp(churn_rate, 0, 1);

      const nextDrivers = Math.max(0, drv * (1 - churn_rate) + params.onboard_per_week);
      drivers[t + 1] = Number.isFinite(nextDrivers) ? nextDrivers : drv;
    }
  }

  const sum = arr => arr.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
  const mean = arr => {
    if (!arr.length) return 0;
    return sum(arr) / arr.length;
  };

  const summary = {
    total_net_revenue: sum(net_rev),
    total_gmv: sum(gmv),
    avg_eta: mean(eta),
    avg_match_rate: mean(match_rate),
    avg_utilization: mean(utilization),
    end_drivers: drivers[WEEKS - 1]
  };

  return {
    week: weekIndex,
    requests,
    matched,
    cancel_rate,
    fulfilled,
    unfulfilled,
    drivers,
    capacity,
    utilization,
    match_rate,
    eta,
    gmv,
    gross_rev,
    costs,
    net_rev,
    summary
  };
}

function resizeCanvases() {
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
  });
}

window.addEventListener('resize', () => {
  resizeCanvases();
  if (currentResult) {
    renderCharts();
  }
});

function formatMoneyRU(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) {
    return `₽${(value / 1e9).toFixed(abs >= 1e10 ? 1 : 2)} млрд`;
  } else if (abs >= 1e6) {
    return `₽${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)} млн`;
  } else if (abs >= 1e3) {
    return `₽${(value / 1e3).toFixed(abs >= 1e4 ? 1 : 2)} тыс`;
  } else {
    return `₽${Math.round(value).toLocaleString('ru-RU')}`;
  }
}

function renderHTMLLegend(containerId, series) {
  const container = document.getElementById(containerId);
  if (!container || !series || series.length === 0) return;

  // Очистка
  while (container.firstChild) container.firstChild.remove();

  const ul = document.createElement('ul');
  ul.style.display = 'flex';
  ul.style.flexWrap = 'wrap';
  ul.style.gap = '12px';
  ul.style.margin = '0';
  ul.style.padding = '0';
  ul.style.listStyle = 'none';
  ul.style.alignItems = 'center';

  series.forEach((s, idx) => {
    const color = s.color || ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea'][idx % 5];
    const name = s.name || `Серия ${idx + 1}`;

    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '8px';
    li.style.cursor = 'default';
    li.style.userSelect = 'none';

    const box = document.createElement('span');
    box.style.display = 'inline-block';
    box.style.width = '10px';
    box.style.height = '10px';
    box.style.borderRadius = '3px';
    box.style.background = color;
    box.style.border = '1px solid rgba(17,24,39,0.25)';

    const text = document.createElement('span');
    text.textContent = name;
    text.style.color = '#111827';
    text.style.fontSize = '12px';
    text.style.fontWeight = '600';
    text.style.lineHeight = '1';

    li.appendChild(box);
    li.appendChild(text);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

function renderKPITiles() {
  if (!currentResult || !currentResult.summary) return;
  const s = currentResult.summary;
  const el = document.getElementById('kpiTiles');
  if (!el) return;

  el.innerHTML = `
    <div class="kpi-tile">
      <div class="kpi-tile-label">Выручка нетто (итого)</div>
      <div class="kpi-tile-value">${formatMoneyRU(s.total_net_revenue)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">GMV (итого)</div>
      <div class="kpi-tile-value">${formatMoneyRU(s.total_gmv)}</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Средний ETA</div>
      <div class="kpi-tile-value">${s.avg_eta.toFixed(1)} мин</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Средний match rate</div>
      <div class="kpi-tile-value">${(s.avg_match_rate * 100).toFixed(1)}%</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Средняя загрузка supply</div>
      <div class="kpi-tile-value">${(s.avg_utilization * 100).toFixed(1)}%</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-tile-label">Активные водители (конец)</div>
      <div class="kpi-tile-value">${Math.round(s.end_drivers).toLocaleString('ru-RU')}</div>
    </div>
  `;
}

function renderCharts() {
  if (!currentResult) return;

  try {
    resizeCanvases();

    // 1) Demand vs Fulfilled vs Unfulfilled
    const demandCanvas = document.getElementById('chartDemand');
    if (!demandCanvas) throw new Error('chartDemand canvas not found');
    const seriesDemand = [
      {
        name: 'Запросы',
        data: currentResult.requests,
        color: '#2563eb',
        formatter: v => `${Math.round(v).toLocaleString('ru-RU')}`
      },
      {
        name: 'Выполненные',
        data: currentResult.fulfilled,
        color: '#16a34a',
        formatter: v => `${Math.round(v).toLocaleString('ru-RU')}`
      },
      {
        name: 'Невыполненные',
        data: currentResult.unfulfilled,
        color: '#dc2626',
        formatter: v => `${Math.round(v).toLocaleString('ru-RU')}`
      }
    ];
    if (!charts.demand) {
      charts.demand = new LineChart(demandCanvas, seriesDemand, { showPoints: false });
    } else {
      charts.demand.series = seriesDemand;
      charts.demand.options.showPoints = false;
      charts.demand.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-demand', seriesDemand);

    // 2) Drivers + Capacity
    const supplyCanvas = document.getElementById('chartSupply');
    if (!supplyCanvas) throw new Error('chartSupply canvas not found');
    const seriesSupply = [
      {
        name: 'Водители',
        data: currentResult.drivers,
        color: '#9333ea',
        formatter: v => `${Math.round(v).toLocaleString('ru-RU')}`
      },
      {
        name: 'Ёмкость (поездок в неделю)',
        data: currentResult.capacity,
        color: '#2563eb',
        formatter: v => `${Math.round(v).toLocaleString('ru-RU')}`
      }
    ];
    if (!charts.supply) {
      charts.supply = new LineChart(supplyCanvas, seriesSupply, { showPoints: false });
    } else {
      charts.supply.series = seriesSupply;
      charts.supply.options.showPoints = false;
      charts.supply.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-supply', seriesSupply);

    // 3) Utilization + Match rate (в процентах)
    const utilMatchCanvas = document.getElementById('chartUtilMatch');
    if (!utilMatchCanvas) throw new Error('chartUtilMatch canvas not found');
    const utilPercent = currentResult.utilization.map(v => v * 100);
    const matchPercent = currentResult.match_rate.map(v => v * 100);
    const seriesUtilMatch = [
      {
        name: 'Utilization',
        data: utilPercent,
        color: '#0ea5e9',
        formatter: v => `${v.toFixed(1)}%`
      },
      {
        name: 'Match rate',
        data: matchPercent,
        color: '#16a34a',
        formatter: v => `${v.toFixed(1)}%`
      }
    ];
    if (!charts.utilMatch) {
      charts.utilMatch = new LineChart(utilMatchCanvas, seriesUtilMatch, { chartType: 'percent', showPoints: false });
    } else {
      charts.utilMatch.series = seriesUtilMatch;
      charts.utilMatch.options.chartType = 'percent';
      charts.utilMatch.options.showPoints = false;
      charts.utilMatch.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-util', seriesUtilMatch);

    // 4) ETA
    const etaCanvas = document.getElementById('chartETA');
    if (!etaCanvas) throw new Error('chartETA canvas not found');
    const seriesEta = [
      {
        name: 'ETA (мин)',
        data: currentResult.eta,
        color: '#f97316',
        formatter: v => `${v.toFixed(1)} мин`
      }
    ];
    if (!charts.eta) {
      charts.eta = new LineChart(etaCanvas, seriesEta, { showPoints: false });
    } else {
      charts.eta.series = seriesEta;
      charts.eta.options.showPoints = false;
      charts.eta.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-eta', seriesEta);

    // 5) Net revenue per week
    const netCanvas = document.getElementById('chartNetRevenue');
    if (!netCanvas) throw new Error('chartNetRevenue canvas not found');
    const seriesNet = [
      {
        name: 'Выручка нетто (неделя)',
        data: currentResult.net_rev,
        color: '#22c55e',
        formatter: v => formatMoneyRU(v)
      }
    ];
    if (!charts.net) {
      charts.net = new LineChart(netCanvas, seriesNet, { chartType: 'money', showPoints: false });
    } else {
      charts.net.series = seriesNet;
      charts.net.options.chartType = 'money';
      charts.net.options.showPoints = false;
      charts.net.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-net', seriesNet);

    // 6) GMV per week
    const gmvCanvas = document.getElementById('chartGMV');
    if (!gmvCanvas) throw new Error('chartGMV canvas not found');
    const seriesGMV = [
      {
        name: 'GMV (неделя)',
        data: currentResult.gmv,
        color: '#3b82f6',
        formatter: v => formatMoneyRU(v)
      }
    ];
    if (!charts.gmv) {
      charts.gmv = new LineChart(gmvCanvas, seriesGMV, { chartType: 'money', showPoints: false });
    } else {
      charts.gmv.series = seriesGMV;
      charts.gmv.options.chartType = 'money';
      charts.gmv.options.showPoints = false;
      charts.gmv.render({ hoverIndex: appState.hoverIndex });
    }
    renderHTMLLegend('legend-gmv', seriesGMV);

    updateStatusIndicator('Модель пересчитана');

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    updateStatusBar(`OK: пересчёт в ${timeStr}`, false);
  } catch (err) {
    console.error(err);
    updateStatusBar(`Ошибка в renderCharts: ${err.message}`, true);
  }
}

function exportCSV() {
  if (!currentResult) return;

  const headers = [
    'week',
    'requests',
    'matched',
    'cancel_rate',
    'fulfilled',
    'unfulfilled',
    'drivers',
    'capacity',
    'utilization',
    'eta',
    'match_rate',
    'gmv',
    'gross_revenue',
    'costs',
    'net_revenue'
  ];

  const rows = [headers.join(',')];

  for (let i = 0; i < currentResult.week.length; i++) {
    const row = [
      currentResult.week[i],
      Math.round(currentResult.requests[i]),
      Math.round(currentResult.matched[i]),
      Number(currentResult.cancel_rate[i].toFixed(4)),
      Math.round(currentResult.fulfilled[i]),
      Math.round(currentResult.unfulfilled[i]),
      Math.round(currentResult.drivers[i]),
      Math.round(currentResult.capacity[i]),
      Number(currentResult.utilization[i].toFixed(4)),
      Number(currentResult.eta[i].toFixed(2)),
      Number(currentResult.match_rate[i].toFixed(4)),
      Math.round(currentResult.gmv[i]),
      Math.round(currentResult.gross_rev[i]),
      Math.round(currentResult.costs[i]),
      Math.round(currentResult.net_rev[i])
    ];
    rows.push(row.join(','));
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ride_hailing_simulation_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function initApp() {
  try {
    window.appState = appState;
    window.charts = charts;

    const inputs = document.querySelectorAll('#controls input[type="number"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        currentParams = getParams();
        currentResult = simulate(currentParams);
        renderKPITiles();
        renderCharts();
      });
    });

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetParams();
        currentParams = getParams();
        currentResult = simulate(currentParams);
        renderKPITiles();
        renderCharts();
      });
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    resetParams();
    currentParams = getParams();
    currentResult = simulate(currentParams);
    renderKPITiles();
    renderCharts();
  } catch (err) {
    console.error(err);
    updateStatusBar(`Ошибка в initApp: ${err.message}`, true);
  }
}

document.addEventListener('DOMContentLoaded', initApp);

