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
    // keep consistent, readable for CPM and small $ values
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

  function createToggle(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('label', { class: 'toggle-row' });
    row.appendChild(el('div', { class: 'toggle-row__label', text: spec.label }));
    const input = el('input', { type: 'checkbox' });
    input.checked = !!state[spec.key];
    input.addEventListener('change', () => {
      state[spec.key] = input.checked;
      onChange({ [spec.key]: input.checked });
    });
    row.appendChild(input);
    wrap.appendChild(row);
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

  function createUI({ sim, renderer, elements }) {
    const topSummaryEl = document.getElementById('topSummary');
    const state = {
      // traffic & sessions
      users_per_sec: sim.params.users_per_sec,
      mean_session_length: sim.params.mean_session_length,
      tolerance_mean: sim.params.tolerance_mean,
      tolerance_spread: sim.params.tolerance_spread,

      // pressure
      policy: sim.params.policy,
      target_ad_rate: sim.params.target_ad_rate,
      freq_cap: sim.params.freq_cap,
      min_gap_sec: sim.params.min_gap_sec,

      // auction
      bidders_count: sim.params.bidders_count,
      bid_cpm_mean: sim.params.bid_cpm_mean,
      bid_cpm_sigma: sim.params.bid_cpm_sigma,
      floor_cpm: sim.params.floor_cpm,
      take_rate_pct: Math.round(sim.params.take_rate * 100),

      // fatigue
      fatigue_per_impression: sim.params.fatigue_per_impression,
      fatigue_decay_per_sec: sim.params.fatigue_decay_per_sec,
      exit_sensitivity: sim.params.exit_sensitivity,
      ctr_base_pct: sim.params.ctr_base * 100,
      ctr_fatigue_penalty: sim.params.ctr_fatigue_penalty,

      // display
      show_trails: sim.params.show_trails,
      show_ad_flashes: sim.params.show_ad_flashes,
      show_heat_strip: sim.params.show_heat_strip,
    };

    function applyParams(patch) {
      const p = { ...patch };
      if (Object.prototype.hasOwnProperty.call(p, 'take_rate_pct')) {
        p.take_rate = U.clamp(p.take_rate_pct / 100, 0, 0.4);
        delete p.take_rate_pct;
      }
      if (Object.prototype.hasOwnProperty.call(p, 'ctr_base_pct')) {
        p.ctr_base = U.clamp(p.ctr_base_pct / 100, 0, 0.05);
        delete p.ctr_base_pct;
      }
      sim.setParams(p);
    }

    // ---- Controls specs ----
    const trafficSpecs = [
      { key: 'users_per_sec', label: 'Users per second', min: 0.5, max: 20, step: 0.1, valueType: 'float1' },
      { key: 'mean_session_length', label: 'Mean session length (sec)', min: 10, max: 120, step: 1, valueType: 'sec' },
      { key: 'tolerance_mean', label: 'User tolerance mean (0–1)', min: 0.2, max: 0.9, step: 0.01, valueType: 'float2' },
      { key: 'tolerance_spread', label: 'User tolerance spread', min: 0, max: 0.4, step: 0.01, valueType: 'float2' },
    ];

    const pressureSpecs = [
      { kind: 'radio', key: 'policy', label: 'Policy', options: [{ value: 'fixed', label: 'Fixed' }, { value: 'adaptive', label: 'Adaptive' }], hint: 'Adaptive reduces shows when fatigue exceeds user tolerance.' },
      { key: 'target_ad_rate', label: 'Target ad rate (ads per user-sec)', min: 0, max: 0.5, step: 0.01, valueType: 'float2' },
      { key: 'freq_cap', label: 'Freq cap (ads per session)', min: 0, max: 20, step: 1, valueType: 'int' },
      { key: 'min_gap_sec', label: 'Min gap between ads (sec)', min: 0, max: 30, step: 1, valueType: 'sec' },
    ];

    const auctionSpecs = [
      { key: 'bidders_count', label: 'Bidders count', min: 2, max: 20, step: 1, valueType: 'int' },
      { key: 'bid_cpm_mean', label: 'Bid value mean (CPM, $)', min: 0.5, max: 20, step: 0.1, valueType: 'usd' },
      { key: 'bid_cpm_sigma', label: 'Bid value spread (lognormal σ)', min: 0, max: 2.0, step: 0.05, valueType: 'float2' },
      { key: 'floor_cpm', label: 'Floor CPM ($)', min: 0, max: 10, step: 0.1, valueType: 'usd' },
      { key: 'take_rate_pct', label: 'Take rate (%)', min: 0, max: 40, step: 1, valueType: 'pct' },
    ];

    const fatigueSpecs = [
      { key: 'fatigue_per_impression', label: 'Fatigue per impression', min: 0, max: 0.5, step: 0.01, valueType: 'float2' },
      { key: 'fatigue_decay_per_sec', label: 'Fatigue decay per second', min: 0, max: 0.2, step: 0.005, valueType: 'float2' },
      { key: 'exit_sensitivity', label: 'Exit sensitivity', min: 0, max: 3, step: 0.05, valueType: 'float2' },
      { key: 'ctr_base_pct', label: 'CTR base (%)', min: 0, max: 5, step: 0.1, valueType: 'pct1' },
      { key: 'ctr_fatigue_penalty', label: 'CTR fatigue penalty', min: 0, max: 3, step: 0.05, valueType: 'float2' },
    ];

    const displaySpecs = [
      { kind: 'toggle', key: 'show_trails', label: 'Show user trails' },
      { kind: 'toggle', key: 'show_ad_flashes', label: 'Show ad flashes' },
      { kind: 'toggle', key: 'show_heat_strip', label: 'Show heat strip (last 60s pressure)' },
    ];

    function mount(container, specs) {
      container.innerHTML = '';
      for (const spec of specs) {
        if (spec.kind === 'radio') {
          container.appendChild(createRadio(spec, state, applyParams).wrap);
        } else if (spec.kind === 'toggle') {
          container.appendChild(createToggle(spec, state, applyParams).wrap);
        } else {
          container.appendChild(createSlider(spec, state, applyParams).wrap);
        }
      }
    }

    mount(elements.controlsTraffic, trafficSpecs);
    mount(elements.controlsPressure, pressureSpecs);
    mount(elements.controlsAuction, auctionSpecs);
    mount(elements.controlsFatigue, fatigueSpecs);
    mount(elements.controlsDisplay, displaySpecs);

    // Seed input
    elements.seedInput.value = String(sim.seed);
    elements.seedInput.addEventListener('change', () => {
      const s = Math.max(1, Math.min(999999999, Math.trunc(Number(elements.seedInput.value) || 1)));
      elements.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
    });
    elements.randomizeSeedBtn.addEventListener('click', () => {
      const s = Math.floor(Math.random() * 999999999) + 1;
      elements.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
    });

    // Metrics + charts update from sim callback
    function setText(el, v) { el.textContent = String(v); }
    function fmtUSDsmall(x) { return `$${x.toFixed(2)}`; }

    function renderTopSummary({ derived, ts }) {
      if (!topSummaryEl) return;

      const p = sim.params;
      const oppRate = (window.Sim && window.Sim.LIMITS && Number(window.Sim.LIMITS.opp_rate_per_sec)) || 1.0;

      const activeAvg60 = ts && ts.active_users ? ts.active_users.meanLast(60) : derived.activeUsers;
      const fill = derived.fillRate;
      const avgCPM = derived.avgCPM;
      const avgFat = derived.avgFatigue;
      const earlyShare = derived.earlyExitShare;

      const unfilled = derived.unfilledOpp60;
      let pol = 0, floor = 0, caps = 0;
      if (unfilled > 0) {
        pol = U.clamp(derived.noImprPolicyPct, 0, 1);
        floor = U.clamp(derived.noImprFloorPct, 0, 1);
        caps = U.clamp(1 - pol - floor, 0, 1); // keep sum ~1
      }
      const polPct = Math.round(pol * 100);
      const floorPct = Math.round(floor * 100);
      const capsPct = Math.max(0, 100 - polPct - floorPct);

      const parts = [
        { k: 'Caps', v: capsPct },
        { k: 'Policy', v: polPct },
        { k: 'Floor', v: floorPct },
      ].sort((a, b) => b.v - a.v);

      const limiterText = unfilled > 0
        ? `${parts[0].k} (${parts[0].v}%) / ${parts[1].k} (${parts[1].v}%) / ${parts[2].k} (${parts[2].v}%)`
        : '—';

      const pills = [];

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'Now:' }),
        el('b', { text: `users ${fmt1(p.users_per_sec)}/s` }),
        el('span', { text: '|' }),
        el('span', { text: `active ${Math.round(activeAvg60)}` }),
        el('span', { text: '|' }),
        el('span', { text: `opp ~${fmt1(oppRate)}/s/user` }),
      ]));

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'Policy:' }),
        el('b', { text: (p.policy === 'adaptive') ? 'Adaptive' : 'Fixed' }),
        el('span', { text: '|' }),
        el('span', { text: `target ${fmt2(p.target_ad_rate)} ads/user-sec` }),
        el('span', { text: '|' }),
        el('span', { text: `minGap ${Math.round(p.min_gap_sec)}s` }),
        el('span', { text: '|' }),
        el('span', { text: `cap ${Math.round(p.freq_cap)}` }),
      ]));

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'Market:' }),
        el('span', { text: `bidders ${Math.round(p.bidders_count)}` }),
        el('span', { text: '|' }),
        el('span', { text: `floor ${fmtUSD(p.floor_cpm)}` }),
        el('span', { text: '|' }),
        el('span', { text: `avg CPM ${fmtUSD(avgCPM)}` }),
      ]));

      pills.push(el('div', { class: 'pill' }, [
        el('span', { text: 'UX:' }),
        el('span', { text: `fatigue ${fmt2(avgFat)}` }),
        el('span', { text: '|' }),
        el('span', { text: `early exit ${fmtPct(earlyShare, 0)}` }),
        el('span', { text: '|' }),
        el('span', { text: `fill ${fmtPct(fill, 1)}` }),
      ]));

      pills.push(el('div', { class: 'pill pill--limiter' }, [
        el('span', { text: 'Limiter:' }),
        el('b', { text: limiterText }),
      ]));

      topSummaryEl.replaceChildren(...pills);
    }

    sim.onSecond = ({ derived, ts }) => {
      setText(elements.capBadge, 'Cap reached');
      elements.capBadge.classList.toggle('is-hidden', !derived.capReached);

      setText(elements.mActiveUsers, Math.round(derived.activeUsers));
      setText(elements.mImprPerMin, Math.round(derived.imprPerMin));
      setText(elements.mAdRate, derived.adRatePerUserMin.toFixed(2));
      setText(elements.mFill, U.fmtPct(derived.fillRate, 1));

      // "Why no impression?" breakdown (rolling 60s, % of unfilled opportunities)
      if (derived.unfilledOpp60 > 0) {
        const pPol = Math.round(100 * U.clamp(derived.noImprPolicyPct, 0, 1));
        const pFloor = Math.round(100 * U.clamp(derived.noImprFloorPct, 0, 1));
        const pCaps = Math.max(0, 100 - pPol - pFloor); // keep sum ~100%
        setText(elements.mNoImprPolicy, `${pPol}%`);
        setText(elements.mNoImprFloor, `${pFloor}%`);
        setText(elements.mNoImprCaps, `${pCaps}%`);
      } else {
        setText(elements.mNoImprPolicy, '—');
        setText(elements.mNoImprFloor, '—');
        setText(elements.mNoImprCaps, '—');
      }

      setText(elements.mCPM, fmtUSDsmall(derived.avgCPM));
      setText(elements.mRevPub, fmtUSDsmall(derived.publisherRevPerMin));
      setText(elements.mRevPlat, fmtUSDsmall(derived.platformRevPerMin));
      setText(elements.mSpend, fmtUSDsmall(derived.spendPerMin));
      setText(elements.mCTR, U.fmtPct(derived.avgCTR, 2));
      setText(elements.mFatigue, derived.avgFatigue.toFixed(2));
      setText(elements.mEnds, `${Math.round(derived.endsPerMin)}`);
      setText(elements.mEarlyShare, U.fmtPct(derived.earlyExitShare, 0));
      setText(elements.mAvgSessionTime, `${Math.round(derived.avgSessionTimeSec)}`);

      // chart now labels
      elements.cRevNow.textContent = fmtUSDsmall(derived.publisherRevPerMin);
      elements.cImprNow.textContent = `${Math.round(derived.imprPerMin)}`;
      elements.cCPMNow.textContent = fmtUSDsmall(derived.avgCPM);
      elements.cFatNow.textContent = derived.avgFatigue.toFixed(2);

      // charts: use per-second series
      const series = {
        revenue: (() => {
          // convert publisher_rev per second → per minute by using rolling 60s? Here per-second series is fine but scale differs.
          // For chart, show per-minute-equivalent by using (publisher_rev_sec * 60).
          const a = ts.publisher_rev.toArray();
          return a.map(v => v * 60);
        })(),
        impr: (() => {
          const a = ts.impressions.toArray();
          return a.map(v => v); // per second count; chart label says per min but trend ok; scale is consistent via *60 below
        })().map(v => v * 60),
        cpm: ts.avg_cpm.toArray(),
        fatigue: ts.avg_fatigue.toArray(),
      };
      renderer.drawCharts(series);

      // footer
      elements.simTime.textContent = U.fmtSeconds(derived.time);
      elements.activeUsers.textContent = String(derived.activeUsers);

      // top summary (update at 1Hz via this callback)
      renderTopSummary({ derived, ts });
    };

    return { state };
  }

  window.UI = { createUI };
})();

