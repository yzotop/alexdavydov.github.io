/* ui.js — builds controls, binds live params, updates metrics + charts */

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before ui.js');

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = String(v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, String(v));
      }
    }
    if (children) children.forEach((c) => e.appendChild(c));
    return e;
  }

  function fmtVal(v, kind) {
    if (kind === 'int') return `${Math.round(v)}`;
    if (kind === 'sec') return `${Math.round(v)}s`;
    if (kind === 'float1') return `${Number(v).toFixed(1)}`;
    if (kind === 'float2') return `${Number(v).toFixed(2)}`;
    if (kind === 'pct') return `${Math.round(v)}%`;
    if (kind === 'pct1') return `${Number(v).toFixed(1)}%`;
    if (kind === 'pct2') return `${Number(v).toFixed(2)}%`;
    if (kind === 'usd') return `$${Number(v).toFixed(2)}`;
    return String(v);
  }

  function fmt1(x) {
    const v = Number(x);
    return Number.isFinite(v) ? v.toFixed(1) : '—';
  }
  function fmt2(x) {
    const v = Number(x);
    return Number.isFinite(v) ? v.toFixed(2) : '—';
  }
  function fmtUSD(x) {
    const v = Number(x);
    if (!Number.isFinite(v)) return '—';
    return `$${v.toFixed(v < 10 ? 2 : 2)}`;
  }
  function fmtPct(x, digits = 1) {
    const v = Number(x);
    if (!Number.isFinite(v)) return '—';
    return `${(v * 100).toFixed(digits)}%`;
  }

  function createSlider(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('div', { class: 'field__row' });
    const label = el('div', { class: 'field__label', text: spec.label });
    const value = el('div', { class: 'field__value', text: '' });
    row.appendChild(label);
    row.appendChild(value);

    const input = el('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: state[spec.key] });
    const update = () => {
      const raw = Number(input.value);
      value.textContent = spec.valueFmt ? spec.valueFmt(raw) : fmtVal(raw, spec.valueType);
    };
    input.addEventListener('input', () => {
      const raw = Number(input.value);
      state[spec.key] = raw;
      update();
      onChange(spec.toParam ? spec.toParam(raw) : { [spec.key]: raw });
    });
    update();

    wrap.appendChild(row);
    wrap.appendChild(input);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap };
  }

  function createRadio(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const group = el('div', { class: 'radio' });
    const name = `radio_${spec.key}`;
    for (const opt of spec.options) {
      const item = el('label', { class: 'radio__item' });
      const input = el('input', { type: 'radio', name, value: opt.value });
      input.checked = state[spec.key] === opt.value;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        state[spec.key] = opt.value;
        onChange({ [spec.key]: opt.value });
      });
      item.appendChild(input);
      item.appendChild(el('span', { text: opt.label }));
      group.appendChild(item);
    }
    wrap.appendChild(group);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap };
  }

  function createUI({ sim, charts, elements }) {
    const systemStateCard = document.getElementById('systemStateCard');
    const systemStateContent = document.getElementById('systemStateContent');
    const systemStateStatus = systemStateContent?.querySelector('.system-state-card__status');
    const systemStateExplanation = systemStateContent?.querySelector('.system-state-card__explanation');
    const pressureScaleMarker = document.getElementById('pressureScaleMarker');
    const cardPressure = document.getElementById('cardPressure');
    const cardFatigue = document.getElementById('cardFatigue');
    const cardBehavior = document.getElementById('cardBehavior');
    const cardRevenue = document.getElementById('cardRevenue');
    const cardImpressions = document.getElementById('cardImpressions');
    const contextualWarnings = document.getElementById('contextualWarnings');
    
    // Track previous state for warnings
    let prevFatigueZone = null;
    let prevCTR = null;
    let prevRevenue = null;
    
    // Sparkline canvases cache
    const sparklines = {};
    
    // Helper: create sparkline canvas
    function createSparkline(id, data, color) {
      if (!sparklines[id]) {
        const canvas = el('canvas', { class: 'pipeline-card__sparkline' });
        sparklines[id] = { canvas, ctx: canvas.getContext('2d'), data: [] };
      }
      const sl = sparklines[id];
      sl.data = data.slice(-60); // Last 60 points
      if (sl.data.length < 2) return sl.canvas;
      
      // Use requestAnimationFrame to ensure proper sizing after DOM insertion
      requestAnimationFrame(() => {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = sl.canvas.getBoundingClientRect();
        const w = Math.max(100, rect.width || 180);
        const h = 24;
        sl.canvas.width = w * dpr;
        sl.canvas.height = h * dpr;
        sl.canvas.style.width = w + 'px';
        sl.canvas.style.height = h + 'px';
        
        sl.ctx.save();
        sl.ctx.scale(dpr, dpr);
        sl.ctx.clearRect(0, 0, w, h);
        
        const max = Math.max(...sl.data, 1);
        const min = 0;
        const range = max - min || 1;
        
        sl.ctx.strokeStyle = color;
        sl.ctx.lineWidth = 1.5;
        sl.ctx.beginPath();
        for (let i = 0; i < sl.data.length; i++) {
          const x = (i / (sl.data.length - 1 || 1)) * w;
          const y = h - ((sl.data[i] - min) / range) * h;
          if (i === 0) sl.ctx.moveTo(x, y);
          else sl.ctx.lineTo(x, y);
        }
        sl.ctx.stroke();
        sl.ctx.restore();
      });
      
      return sl.canvas;
    }
    
    // Helper: create metric item
    function createMetricItem(label, value, sparklineData, sparklineColor) {
      const item = el('div', { class: 'metric-item' });
      const labelEl = el('div', { class: 'metric-item__label', text: label });
      const valueEl = el('div', { class: 'metric-item__value', text: value });
      item.appendChild(labelEl);
      item.appendChild(valueEl);
      if (sparklineData && sparklineData.length > 1) {
        const sparkContainer = el('div', { class: 'metric-item__sparkline' });
        sparkContainer.appendChild(createSparkline(`spark_${label}`, sparklineData, sparklineColor || 'rgba(96,165,250,0.8)'));
        item.appendChild(sparkContainer);
      }
      return item;
    }
    
    // Helper: create small sparkline for outcome cards
    function createSmallSparkline(id, data, color) {
      if (!sparklines[id]) {
        const canvas = el('canvas', { class: 'pipeline-card__sparkline' });
        sparklines[id] = { canvas, ctx: canvas.getContext('2d'), data: [] };
      }
      const sl = sparklines[id];
      sl.data = data.slice(-60);
      if (sl.data.length < 2) return sl.canvas;
      
      requestAnimationFrame(() => {
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const rect = sl.canvas.getBoundingClientRect();
        const w = Math.max(100, rect.width || 180);
        const h = 24;
        sl.canvas.width = w * dpr;
        sl.canvas.height = h * dpr;
        sl.canvas.style.width = w + 'px';
        sl.canvas.style.height = h + 'px';
        
        sl.ctx.save();
        sl.ctx.scale(dpr, dpr);
        sl.ctx.clearRect(0, 0, w, h);
        
        const max = Math.max(...sl.data, 1);
        const min = 0;
        const range = max - min || 1;
        
        sl.ctx.strokeStyle = color;
        sl.ctx.lineWidth = 1.5;
        sl.ctx.beginPath();
        for (let i = 0; i < sl.data.length; i++) {
          const x = (i / (sl.data.length - 1 || 1)) * w;
          const y = h - ((sl.data[i] - min) / range) * h;
          if (i === 0) sl.ctx.moveTo(x, y);
          else sl.ctx.lineTo(x, y);
        }
        sl.ctx.stroke();
        sl.ctx.restore();
      });
      
      return sl.canvas;
    }
    
    const state = {
      // A) Traffic & Sessions
      users_per_sec: sim.params.users_per_sec,
      mean_session_length_sec: sim.params.mean_session_length_sec,
      base_ctr: sim.params.base_ctr * 100, // convert to % for UI
      base_opportunities_per_sec: sim.params.base_opportunities_per_sec,

      // B) Ad Policy
      policy_mode: sim.params.policy_mode,
      target_ads_per_session: sim.params.target_ads_per_session,
      min_gap_sec: sim.params.min_gap_sec,
      cap_ads_per_session: sim.params.cap_ads_per_session,

      // C) Fatigue & UX
      fatigue_per_impression: sim.params.fatigue_per_impression,
      fatigue_decay_per_sec: sim.params.fatigue_decay_per_sec,
      exit_sensitivity: sim.params.exit_sensitivity,
      ctr_fatigue_penalty: sim.params.ctr_fatigue_penalty,

      // D) Monetization
      ecpm_base: sim.params.ecpm_base,
      ecpm_noise: sim.params.ecpm_noise,
    };

    function applyParams(patch) {
      sim.setParams(patch);
    }

    // ---- Controls specs ----
    const trafficSpecs = [
      { key: 'users_per_sec', label: 'Users per second', min: 1, max: 30, step: 0.5, valueType: 'float1' },
      { key: 'mean_session_length_sec', label: 'Mean session length (sec)', min: 10, max: 180, step: 1, valueType: 'sec' },
      { key: 'base_ctr', label: 'Base CTR (%)', min: 0.2, max: 5.0, step: 0.1, valueType: 'pct1', toParam: (v) => ({ base_ctr: v / 100 }) },
      { key: 'base_opportunities_per_sec', label: 'Opportunities per sec', min: 0.05, max: 1.0, step: 0.01, valueType: 'float2', hint: 'Opportunities cadence per user' },
    ];

    const policySpecs = [
      { kind: 'radio', key: 'policy_mode', label: 'Policy mode', options: [{ value: 'fixed', label: 'Fixed' }, { value: 'adaptive', label: 'Adaptive' }], hint: 'Adaptive reduces shows when fatigue is high.' },
      { key: 'target_ads_per_session', label: 'Target ads per session', min: 0, max: 10, step: 0.5, valueType: 'float1' },
      { key: 'min_gap_sec', label: 'Min gap between ads (sec)', min: 0, max: 30, step: 1, valueType: 'sec' },
      { key: 'cap_ads_per_session', label: 'Cap ads per session', min: 0, max: 20, step: 1, valueType: 'int' },
    ];

    const fatigueSpecs = [
      { key: 'fatigue_per_impression', label: 'Fatigue per impression', min: 0, max: 0.5, step: 0.01, valueType: 'float2' },
      { key: 'fatigue_decay_per_sec', label: 'Fatigue decay per second', min: 0, max: 0.2, step: 0.005, valueType: 'float2' },
      { key: 'exit_sensitivity', label: 'Exit sensitivity', min: 0, max: 5, step: 0.1, valueType: 'float1' },
      { key: 'ctr_fatigue_penalty', label: 'CTR fatigue penalty', min: 0, max: 5, step: 0.1, valueType: 'float1' },
    ];

    const monetizationSpecs = [
      { key: 'ecpm_base', label: 'Base eCPM ($)', min: 0.5, max: 20, step: 0.1, valueType: 'usd' },
      { key: 'ecpm_noise', label: 'eCPM noise', min: 0, max: 0.5, step: 0.01, valueType: 'float2' },
    ];

    function mount(container, specs) {
      container.innerHTML = '';
      for (const spec of specs) {
        if (spec.kind === 'radio') {
          container.appendChild(createRadio(spec, state, applyParams).wrap);
        } else {
          container.appendChild(createSlider(spec, state, applyParams).wrap);
        }
      }
    }

    mount(elements.controlsTraffic, trafficSpecs);
    mount(elements.controlsPolicy, policySpecs);
    mount(elements.controlsFatigue, fatigueSpecs);
    mount(elements.controlsMonetization, monetizationSpecs);

    // Seed input
    elements.seedInput.value = String(sim.seed);
    elements.seedInput.addEventListener('change', () => {
      const s = Math.max(1, Math.min(999999999, Math.trunc(Number(elements.seedInput.value) || 1)));
      elements.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
      charts.reset();
    });
    elements.randomizeSeedBtn.addEventListener('click', () => {
      const s = Math.floor(Math.random() * 999999999) + 1;
      elements.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
      charts.reset();
    });

    // Metrics update helper
    function setText(el, v) { if (el) el.textContent = String(v); }

    // Generate system state (verdict + explanation)
    function generateSystemState(derived, adRate, ts) {
      const { fatigue, early_exit_rate, ctr } = derived;
      const earlyExitPct = early_exit_rate * 100;
      
      // Check revenue trend
      let revenueGrowing = true;
      if (ts && ts.revenue_per_min) {
        const revenueArray = ts.revenue_per_min.toArray();
        if (revenueArray.length >= 10) {
          const recent = revenueArray.slice(-5);
          const earlier = revenueArray.slice(-10, -5);
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
          revenueGrowing = recentAvg >= earlierAvg * 0.98;
        }
      }
      
      // Determine state
      if (adRate > 8 && fatigue > 0.08 && ctr < 0.005 && earlyExitPct > 30) {
        return {
          state: 'Saturated',
          stateClass: 'state-saturated',
          explanation: 'Fatigue is overwhelming the system. Users exit rapidly, CTR has collapsed, and additional pressure no longer increases revenue.'
        };
      }
      if (adRate > 6 && fatigue > 0.05 && earlyExitPct > 20 && !revenueGrowing) {
        return {
          state: 'Over-pressured',
          stateClass: 'state-over',
          explanation: 'Pressure exceeds optimal range. Fatigue is accumulating faster than it decays, and revenue growth has stalled despite more impressions.'
        };
      }
      if (adRate >= 3 && adRate <= 6 && fatigue < 0.05 && earlyExitPct < 25) {
        return {
          state: 'Healthy',
          stateClass: 'state-healthy',
          explanation: 'Pressure and fatigue are balanced. Revenue grows sustainably while user experience remains acceptable.'
        };
      }
      if (adRate < 3 && fatigue < 0.02) {
        return {
          state: 'Under-monetized',
          stateClass: 'state-under',
          explanation: 'Pressure is below optimal. Users are comfortable, but monetization potential is underused.'
        };
      }
      return {
        state: 'Transitioning',
        stateClass: 'state-over',
        explanation: 'System is adjusting to current pressure levels.'
      };
    }
    
    // Get fatigue zone
    function getFatigueZone(fatigue) {
      if (fatigue > 0.08) return { zone: 'Saturated', class: 'zone-saturated' };
      if (fatigue > 0.05) return { zone: 'Borderline', class: 'zone-borderline' };
      return { zone: 'Healthy', class: 'zone-healthy' };
    }
    
    // Update pressure scale marker
    function updatePressureScale(adRate, time) {
      if (!pressureScaleMarker) return;
      // Map adRate 0-12 to 0-100% of scale
      // Zones: Low (0-3), Optimal (3-6), Overpressure (6-9), Saturation (9-12)
      const position = Math.min(100, Math.max(0, (adRate / 12) * 100));
      pressureScaleMarker.style.left = `${position}%`;
      pressureScaleMarker.style.display = time > 1 ? 'block' : 'none';
    }
    
    // Generate contextual warnings (only when thresholds crossed)
    function generateWarnings(derived, adRate, ts, prevState) {
      const warnings = [];
      const { fatigue, ctr } = derived;
      
      // Fatigue zone change warning
      const currentZone = getFatigueZone(fatigue);
      if (prevState && prevState.fatigueZone !== currentZone.class) {
        if (currentZone.class === 'zone-borderline') {
          warnings.push({ type: 'fatigue', text: 'Fatigue zone changed to Borderline — monitor early exits closely.' });
        } else if (currentZone.class === 'zone-saturated') {
          warnings.push({ type: 'fatigue', text: 'Fatigue zone changed to Saturated — revenue growth will stall.' });
        }
      }
      
      // CTR drop before revenue drop
      if (prevState && prevState.ctr && ctr < prevState.ctr * 0.9) {
        const revenueArray = ts.revenue_per_min.toArray();
        if (revenueArray.length >= 5) {
          const recent = revenueArray.slice(-3);
          const earlier = revenueArray.slice(-6, -3);
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
          if (recentAvg >= earlierAvg * 0.95) {
            warnings.push({ type: 'ctr', text: 'CTR is dropping while revenue still grows — revenue collapse will follow soon.' });
          }
        }
      }
      
      // Pressure beyond optimal
      if (adRate > 6.5 || adRate < 2.5) {
        if (adRate > 6.5) {
          warnings.push({ type: 'pressure', text: 'Pressure exceeds optimal range (3–6 ads/user) — fatigue will accumulate faster.' });
        } else {
          warnings.push({ type: 'pressure', text: 'Pressure below optimal range — consider increasing target ads per session.' });
        }
      }
      
      return warnings;
    }

    sim.onSecond = ({ derived, ts }) => {
      // Metrics
      const revenuePerMin = derived.time > 0 ? (derived.revenue_total / derived.time) * 60 : 0;
      const impressionsPerMin = derived.time > 0 ? (derived.impressions_total / derived.time) * 60 : 0;
      const avgCPM = derived.impressions_total > 0 ? (derived.revenue_total / derived.impressions_total) * 1000 : 0;
      // Ad rate: impressions per user per minute
      const adRate = derived.users_active > 0 && derived.time > 0 ? (impressionsPerMin / derived.users_active) : 0;
      
      // Update right panel metrics
      setText(elements.mRevenue, fmtUSD(revenuePerMin));
      setText(elements.mImpressions, Math.round(impressionsPerMin));
      setText(elements.mCPM, fmtUSD(avgCPM));
      setText(elements.mFatigue, fmt2(derived.fatigue));
      setText(elements.mActiveUsers, Math.round(derived.users_active));
      setText(elements.mAdRate, fmt2(adRate));
      const ctrClamped = Math.max(0, Math.min(1, derived.ctr));
      setText(elements.mCTR, fmtPct(ctrClamped, 2));
      const earlyExitClamped = Math.max(0, Math.min(1, derived.early_exit_rate));
      setText(elements.mEarlyExit, fmtPct(earlyExitClamped, 1));

      // Footer
      if (elements.simTime) elements.simTime.textContent = U.fmtSeconds(derived.time);
      if (elements.activeUsers) elements.activeUsers.textContent = String(Math.round(derived.users_active));

      // Time series data
      const revenueArray = ts.revenue_per_min.toArray();
      const impressionsArray = ts.impressions_per_min.toArray();
      const fatigueArray = ts.fatigue.toArray();
      const ctrArray = ts.ctr.toArray().map(c => c * 100);
      const pressureArray = ts.ad_pressure.toArray().map(p => p * 60);
      
      // System State (Primary Focus)
      const systemState = generateSystemState(derived, adRate, ts);
      if (systemStateStatus) {
        systemStateStatus.textContent = systemState.state;
        systemStateStatus.className = `system-state-card__status ${systemState.stateClass}`;
      }
      if (systemStateExplanation) {
        systemStateExplanation.textContent = systemState.explanation;
      }
      
      // Pressure Scale
      updatePressureScale(adRate, derived.time);
      
      // Card 1: Pressure
      if (cardPressure) {
        const p = sim.params;
        const capReachedPct = adRate > 0 ? Math.min(100, (adRate / (p.cap_ads_per_session / p.mean_session_length_sec * 60)) * 100) : 0;
        const body = cardPressure.querySelector('.driver-card__body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(createMetricItem('Ads per user', fmt2(adRate), pressureArray, 'rgba(96,165,250,0.8)'));
          body.appendChild(createMetricItem('Target ads per session', String(p.target_ads_per_session), null, null));
          body.appendChild(createMetricItem('% users hitting cap', `${Math.round(capReachedPct)}%`, null, null));
        }
      }
      
      // Card 2: Fatigue
      if (cardFatigue) {
        const fatigueZone = getFatigueZone(derived.fatigue);
        cardFatigue.className = `driver-card driver-card--fatigue ${fatigueZone.class}`;
        const body = cardFatigue.querySelector('.driver-card__body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(createMetricItem('Avg fatigue', fmt2(derived.fatigue), fatigueArray, 'rgba(251,191,36,0.8)'));
          const zoneItem = el('div', { class: 'metric-item' });
          zoneItem.appendChild(el('div', { class: 'metric-item__label', text: 'Fatigue zone' }));
          zoneItem.appendChild(el('div', { class: 'metric-item__value', text: fatigueZone.zone }));
          body.appendChild(zoneItem);
        }
      }
      
      // Card 3: Behavior
      if (cardBehavior) {
        const body = cardBehavior.querySelector('.driver-card__body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(createMetricItem('Effective CTR', fmtPct(ctrClamped, 2), ctrArray, 'rgba(96,165,250,0.8)'));
          body.appendChild(createMetricItem('Early exit %', fmtPct(earlyExitClamped, 1), null, null));
        }
      }
      
      // Outcome Card 1: Revenue
      if (cardRevenue) {
        const body = cardRevenue.querySelector('.outcome-card__body');
        if (body) {
          body.innerHTML = '';
          const valueEl = el('div', { class: 'metric-item__value', style: 'font-size: 18px;', text: fmtUSD(revenuePerMin) });
          body.appendChild(valueEl);
          body.appendChild(createSmallSparkline('spark_revenue', revenueArray, 'rgba(96,165,250,0.8)'));
        }
      }
      
      // Outcome Card 2: Impressions
      if (cardImpressions) {
        const body = cardImpressions.querySelector('.outcome-card__body');
        if (body) {
          body.innerHTML = '';
          const valueEl = el('div', { class: 'metric-item__value', style: 'font-size: 18px;', text: String(Math.round(impressionsPerMin)) });
          body.appendChild(valueEl);
          body.appendChild(createSmallSparkline('spark_impressions', impressionsArray, 'rgba(52,211,153,0.8)'));
        }
      }
      
      // Contextual Warnings
      const warnings = generateWarnings(derived, adRate, ts, {
        fatigueZone: prevFatigueZone,
        ctr: prevCTR,
        revenue: prevRevenue
      });
      if (contextualWarnings) {
        contextualWarnings.innerHTML = '';
        warnings.forEach(w => {
          const warningEl = el('div', { class: `contextual-warning warning-${w.type}`, text: w.text });
          contextualWarnings.appendChild(warningEl);
        });
      }
      
      // Update previous state
      prevFatigueZone = getFatigueZone(derived.fatigue).class;
      prevCTR = ctrClamped;
      prevRevenue = revenuePerMin;
    };

    return { state };
  }

  window.UI = { createUI };
})();
