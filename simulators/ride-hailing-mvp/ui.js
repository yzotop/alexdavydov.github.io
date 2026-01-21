/* ui.js
   UI layer:
   - Builds controls (sliders, toggles, dropdowns, radios)
   - Binds them to sim config live
   - Updates metric readouts + chart "now" labels
*/

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
    if (children) {
      for (const c of children) e.appendChild(c);
    }
    return e;
  }

  function formatValueByType(v, type) {
    if (type === 'int') return `${Math.round(v)}`;
    if (type === 'sec') return `${Math.round(v)}s`;
    if (type === 'pct') return `${Math.round(v)}%`;
    if (type === 'pct1') return `${(v).toFixed(1)}%`;
    if (type === 'float1') return `${Number(v).toFixed(1)}`;
    if (type === 'float2') return `${Number(v).toFixed(2)}`;
    return `${v}`;
  }

  function createSlider(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('div', { class: 'field__row' });
    const label = el('div', { class: 'field__label', text: spec.label });
    const value = el('div', { class: 'field__value', text: '' });
    row.appendChild(label);
    row.appendChild(value);

    const input = el('input', {
      type: 'range',
      min: spec.min,
      max: spec.max,
      step: spec.step,
      value: state[spec.key],
    });

    const updateValue = () => {
      const raw = Number(input.value);
      const shown = (spec.valueFmt) ? spec.valueFmt(raw) : formatValueByType(raw, spec.valueType);
      value.textContent = shown;
    };

    input.addEventListener('input', () => {
      const raw = Number(input.value);
      state[spec.key] = raw;
      updateValue();
      onChange({ [spec.key]: (spec.transformOut ? spec.transformOut(raw) : raw) });
    });

    updateValue();
    wrap.appendChild(row);
    wrap.appendChild(input);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));

    return { wrap, input, value, updateValue, setValue(v) { input.value = v; updateValue(); } };
  }

  function createSelect(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('div', { class: 'field__row' });
    row.appendChild(el('div', { class: 'field__label', text: spec.label }));
    row.appendChild(el('div', { class: 'field__value', text: '' }));

    const select = el('select');
    for (const opt of spec.options) {
      select.appendChild(el('option', { value: opt.value, text: opt.label }));
    }
    select.value = state[spec.key];
    select.addEventListener('change', () => {
      const v = select.value;
      state[spec.key] = v;
      onChange({ [spec.key]: v });
    });

    wrap.appendChild(row);
    wrap.appendChild(select);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap, select, setValue(v) { select.value = v; } };
  }

  function createToggle(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('label', { class: 'toggle-row' });
    const lab = el('div', { class: 'toggle-row__label', text: spec.label });
    const input = el('input', { type: 'checkbox' });
    input.checked = !!state[spec.key];
    input.addEventListener('change', () => {
      state[spec.key] = input.checked;
      onChange({ [spec.key]: input.checked });
    });
    row.appendChild(lab);
    row.appendChild(input);
    wrap.appendChild(row);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap, input, setValue(v) { input.checked = !!v; } };
  }

  function createRadio(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const group = el('div', { class: 'radio' });
    const name = `radio_${spec.key}`;
    for (const opt of spec.options) {
      const item = el('label', { class: 'radio__item' });
      const input = el('input', { type: 'radio', name, value: opt.value });
      input.checked = (state[spec.key] === opt.value);
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

  function createUI({ sim, renderer, elements }) {
    const topSummaryEl = document.getElementById('topSummary');
    const state = {
      // Mirrors sim.cfg keys + some UI-only values
      demandRatePerMin: sim.cfg.demandRatePerMin,
      driversCount: sim.cfg.driversCount,
      driverSpeed: sim.cfg.driverSpeed,
      matchInterval: sim.cfg.matchInterval,

      surgeStrength: sim.cfg.surgeStrength,
      surgeCap: sim.cfg.surgeCap,
      cancelSensitivity: sim.cfg.cancelSensitivity,
      eta0: sim.cfg.eta0,
      takeRatePct: Math.round(sim.cfg.takeRate * 100),

      zonesPreset: sim.cfg.zonesPreset,
      demandPattern: sim.cfg.demandPattern,
      showZoneBorders: sim.cfg.showZoneBorders,
      showDemandHeat: sim.cfg.showDemandHeat,
      showSurgeHeat: sim.cfg.showSurgeHeat,

      matchingPolicy: sim.cfg.matchingPolicy,
      kCandidates: sim.cfg.kCandidates,
    };

    function applyConfig(patch) {
      // special transforms
      const p = { ...patch };
      if (Object.prototype.hasOwnProperty.call(p, 'takeRatePct')) {
        p.takeRate = U.clamp(p.takeRatePct / 100, 0, 0.4);
        delete p.takeRatePct;
      }
      sim.setConfig(p);
    }

    // Build controls
    const demandSupplySpecs = [
      { key: 'demandRatePerMin', label: 'Demand rate λ (orders/min)', min: 10, max: 240, step: 2, valueType: 'int' },
      { key: 'driversCount', label: 'Drivers count N', min: 50, max: 800, step: 10, valueType: 'int' },
      { key: 'driverSpeed', label: 'Driver speed (px/sec)', min: 40, max: 200, step: 5, valueType: 'int', hint: 'Higher speed reduces pickup ETA and cancels.' },
      { key: 'matchInterval', label: 'Matching batch interval (sec)', min: 0.5, max: 5, step: 0.1, valueType: 'float1' },
    ];

    const pricingBehaviorSpecs = [
      { key: 'surgeStrength', label: 'Surge strength', min: 0, max: 3, step: 0.05, valueType: 'float2' },
      { key: 'surgeCap', label: 'Surge cap', min: 0, max: 3, step: 0.05, valueType: 'float2' },
      { key: 'cancelSensitivity', label: 'Cancel sensitivity', min: 0, max: 2, step: 0.05, valueType: 'float2', hint: 'Hazard ∝ sensitivity × (ETA/ETA0), capped at 0.5/sec.' },
      { key: 'eta0', label: 'ETA reference ETA0 (sec)', min: 30, max: 300, step: 5, valueType: 'sec' },
      { key: 'takeRatePct', label: 'Platform take rate (%)', min: 0, max: 40, step: 1, valueType: 'pct' },
    ];

    const cityZonesSpecs = [
      {
        key: 'zonesPreset',
        label: 'Zones grid',
        options: [
          { value: '3x2', label: '3x2' },
          { value: '4x3', label: '4x3' },
          { value: '5x4', label: '5x4' },
        ],
      },
      {
        key: 'demandPattern',
        label: 'Demand pattern',
        options: [
          { value: 'uniform', label: 'Uniform' },
          { value: 'center', label: 'Center-heavy' },
          { value: 'hotspots', label: 'Two-hotspots' },
        ],
      },
      { key: 'showZoneBorders', label: 'Show overlays: zone borders' },
      { key: 'showDemandHeat', label: 'Show overlays: demand heat' },
      { key: 'showSurgeHeat', label: 'Show overlays: surge heat' },
    ];

    const policySpecs = [
      {
        kind: 'radio',
        key: 'matchingPolicy',
        label: 'Matching policy',
        options: [
          { value: 'eta', label: 'Nearest ETA' },
          { value: 'score', label: 'Score(ETA, Price)' },
        ],
        hint: 'Score = 1/ETA + 0.002*price (tuned so both matter).',
      },
      { key: 'kCandidates', label: 'K candidates (nearest drivers checked)', min: 5, max: 30, step: 1, valueType: 'int' },
    ];

    function mountControls(container, specs) {
      container.innerHTML = '';
      for (const spec of specs) {
        if (spec.kind === 'radio') {
          const r = createRadio(spec, state, applyConfig);
          container.appendChild(r.wrap);
          continue;
        }
        if (spec.options) {
          const s = createSelect(spec, state, applyConfig);
          container.appendChild(s.wrap);
          continue;
        }
        if (spec.min != null) {
          const sl = createSlider(spec, state, applyConfig);
          container.appendChild(sl.wrap);
          continue;
        }
        // toggle
        const t = createToggle(spec, state, applyConfig);
        container.appendChild(t.wrap);
      }
    }

    mountControls(elements.controlsDemandSupply, demandSupplySpecs);
    mountControls(elements.controlsPricingBehavior, pricingBehaviorSpecs);
    mountControls(elements.controlsCityZones, cityZonesSpecs);
    mountControls(elements.controlsPolicy, policySpecs);

    // ---- Top bar ----
    const seedInput = elements.seedInput;
    seedInput.value = String(sim.seed);
    seedInput.addEventListener('change', () => {
      const s = Math.max(1, Math.min(999999999, Math.trunc(Number(seedInput.value) || 1)));
      seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
    });

    elements.randomizeSeedBtn.addEventListener('click', () => {
      const s = Math.floor(Math.random() * 999999999) + 1;
      seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
    });

    // ---- Derived metrics UI ----
    function setText(idEl, text) {
      idEl.textContent = text;
    }

    function updateMetrics(derived) {
      setText(elements.mTripsPerMin, String(Math.round(derived.tripsPerMin)));
      setText(elements.mAvgEta, U.formatSeconds(derived.avgPickupETA));
      setText(elements.mP90Eta, U.formatSeconds(derived.p90PickupETA));
      setText(elements.mCancelRate, U.formatPercent01(derived.cancelRate, 1));
      setText(elements.mUtil, U.formatPercent01(derived.utilization, 0));
      setText(elements.mGMVPerMin, U.formatMoneyRub(derived.gmvPerMin));
      setText(elements.mPlatRevPerMin, U.formatMoneyRub(derived.platformRevPerMin));
      setText(elements.mDriverEarnPerMin, U.formatMoneyRub(derived.driverEarnPerMin));
      setText(elements.mAvgSurge, `${U.formatFloat(derived.avgSurge, 2)}×`);

      setText(elements.simTime, `${Math.floor(derived.time)}s`);
      setText(elements.activeOrders, String(derived.activeOrders));
      setText(elements.activeDrivers, String(derived.drivers));

      // badge
      elements.ordersCapBadge.classList.toggle('is-hidden', !sim.warningOrderCap);
    }

    function updateChartsNowLabels(derived) {
      elements.cRevenueNow.textContent = U.formatMoneyRub(derived.platformRevPerMin);
      elements.cP90EtaNow.textContent = U.formatSeconds(derived.p90PickupETA);
      elements.cCancelNow.textContent = U.formatPercent01(derived.cancelRate, 1);
      elements.cUtilNow.textContent = U.formatPercent01(derived.utilization, 0);
    }

    function updateMiniCharts(ts) {
      const seriesMap = {
        revenue: ts.platformRevenue.toArray(),
        p90eta: ts.p90PickupETA.toArray(),
        cancelRate: (() => {
          const canc = ts.cancels.toArray();
          const created = ts.ordersCreated.toArray();
          const out = new Array(Math.min(canc.length, created.length));
          for (let i = 0; i < out.length; i++) out[i] = created[i] > 0 ? (canc[i] / created[i]) : 0;
          return out;
        })(),
        util: ts.utilization.toArray(),
      };
      renderer.drawCharts(seriesMap);
    }

    function renderTopSummary(derived) {
      if (!topSummaryEl) return;

      const cfg = sim.cfg;
      const demand = cfg.demandRatePerMin;
      const drivers = derived.drivers;
      const activeOrders = derived.activeOrders;
      const util = U.clamp(derived.utilization, 0, 1);
      const idlePct = U.clamp(1 - util, 0, 1);

      const avgEta = derived.avgPickupETA;
      const p90Eta = derived.p90PickupETA;
      const cancelRate = U.clamp(derived.cancelRate, 0, 1);

      const gmv = derived.gmvPerMin;
      const plat = derived.platformRevPerMin;
      const drv = derived.driverEarnPerMin;
      const avgSurge = derived.avgSurge;

      // --- Limiter heuristics (use existing sim state only) ---
      // zone ratio max (pending / idle supply)
      let ratioMax = 0;
      const pend = sim.zonePending;
      const idle = sim.zoneIdleSupply;
      if (pend && idle && pend.length === idle.length) {
        for (let i = 0; i < pend.length; i++) {
          const r = pend[i] / Math.max(1, idle[i]);
          if (Number.isFinite(r) && r > ratioMax) ratioMax = r;
        }
      }

      // cap binding share: share of zones where target surge hits cap (current, not rolling)
      let capBindShare = 0;
      const cap = Number(cfg.surgeCap);
      const target = sim._surgeTarget;
      if (cap > 0 && target && target.length) {
        let hit = 0;
        for (let i = 0; i < target.length; i++) {
          if (target[i] >= cap * 0.98) hit++;
        }
        capBindShare = hit / target.length;
      }

      const eta0 = Math.max(1e-6, Number(cfg.eta0));

      const supplyScore =
        U.clamp((0.18 - idlePct) / 0.18, 0, 1.5) +
        U.clamp((p90Eta - eta0) / eta0, 0, 1.5);

      const activeRef = Math.max(1, Math.floor(drivers * 0.08));
      const demandScore =
        U.clamp((0.35 - util) / 0.35, 0, 1.5) +
        U.clamp((activeRef - activeOrders) / activeRef, 0, 1.5);

      const pricingScore =
        U.clamp((ratioMax - 1.4) / 1.4, 0, 1.5) * 0.8 +
        U.clamp((0.6 - Number(cfg.surgeStrength)) / 0.6, 0, 1.5) * 0.5 +
        U.clamp(capBindShare / 0.5, 0, 1.5) * 0.7;

      let limiter = 'Supply-limited';
      let hint = `idle ${U.formatPercent01(idlePct, 0)}, p90 ${U.formatSeconds(p90Eta)}`;
      let best = supplyScore;
      if (demandScore > best) {
        best = demandScore;
        limiter = 'Demand-limited';
        hint = `util ${U.formatPercent01(util, 0)}, active ${activeOrders}`;
      }
      if (pricingScore > best) {
        best = pricingScore;
        limiter = 'Pricing-limited';
        const capPct = `${Math.round(capBindShare * 100)}%`;
        hint = `cap bind ${capPct}, max ratio ${Number.isFinite(ratioMax) ? ratioMax.toFixed(1) : '—'}`;
      }

      const pills = [];
      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'Now:' }),
        el('span', { text: `demand λ ${Math.round(demand)}/min` }),
        el('span', { text: '|' }),
        el('span', { text: `drivers ${drivers}` }),
        el('span', { text: '|' }),
        el('span', { text: `active ${activeOrders}` }),
        el('span', { text: '|' }),
        el('span', { text: `idle ${U.formatPercent01(idlePct, 0)}` }),
      ]));

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'SLA:' }),
        el('span', { text: `avg ETA ${U.formatSeconds(avgEta)}` }),
        el('span', { text: '|' }),
        el('span', { text: `p90 ${U.formatSeconds(p90Eta)}` }),
        el('span', { text: '|' }),
        el('span', { text: `cancel ${U.formatPercent01(cancelRate, 1)}` }),
      ]));

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'Economics:' }),
        el('span', { text: `GMV/min ${U.formatMoneyRub(gmv)}` }),
        el('span', { text: '|' }),
        el('span', { text: `plat/min ${U.formatMoneyRub(plat)}` }),
        el('span', { text: '|' }),
        el('span', { text: `driver/min ${U.formatMoneyRub(drv)}` }),
        el('span', { text: '|' }),
        el('span', { text: `surge ${U.formatFloat(avgSurge, 2)}×` }),
      ]));

      pills.push(el('div', { class: 'pill pill--limiter' }, [
        el('span', { text: 'Limiter:' }),
        el('b', { text: `${limiter}` }),
        el('span', { text: `(${hint})` }),
      ]));

      topSummaryEl.replaceChildren(...pills);
    }

    // Hook into sim per-second flush.
    sim.onSecond = ({ derived, ts }) => {
      updateMetrics(derived);
      updateChartsNowLabels(derived);
      updateMiniCharts(ts);
      renderTopSummary(derived);
    };

    // ---- Simulation control buttons are wired from main.js (start/pause loop)
    return {
      state,
      updateMetrics,
    };
  }

  window.UI = { createUI };
})();

