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
    return { wrap, input };
  }

  function createSelect(spec, state, onChange) {
    const wrap = el('div', { class: 'field' });
    const row = el('div', { class: 'field__row' });
    const label = el('div', { class: 'field__label', text: spec.label });
    row.appendChild(label);

    const select = el('select', {});
    for (const opt of spec.options) {
      const option = el('option', { value: opt.value, text: opt.label });
      if (state[spec.key] === opt.value) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      state[spec.key] = select.value;
      onChange({ [spec.key]: select.value });
    });

    wrap.appendChild(row);
    wrap.appendChild(select);
    if (spec.hint) wrap.appendChild(el('div', { class: 'field__hint', text: spec.hint }));
    return { wrap, select };
  }

  const STORY_SCENARIOS = {
    'auction-overload': {
      buyers_per_sec: 4.0,
      buy_intent_share: 0.4,
      ranking_mode: 'revenue-first',
      promoted_share: 0.5,
      take_rate: 0.25,
      capacity_deliveries_per_min: 5.0,
      pressure_strength: 1.2,
    },
    'ops-upgrade': {
      capacity_deliveries_per_min: 15.0,
      congestion_factor: 0.1,
      ETA0: 120,
    },
    'quality-pivot': {
      ranking_mode: 'quality-first',
      promoted_share: 0.15,
      take_rate: 0.12,
      pressure_strength: 0.5,
      recovery_strength: 0.15,
    },
  };

  function createUI({ sim, renderer, elements }) {
    const topSummaryEl = document.getElementById('topSummary');
    const state = { ...sim.params };

    function applyParams(patch) {
      sim.setParams(patch);
    }

    // Highlight controls for story mode
    function highlightControls(scenario) {
      // Remove previous highlights
      document.querySelectorAll('.field input, .field select').forEach(el => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      });
      
      if (!scenario) return;
      
      const params = STORY_SCENARIOS[scenario];
      if (!params) return;
      
      // Highlight relevant controls
      Object.keys(params).forEach(key => {
        const input = document.querySelector(`input[data-key="${key}"], select[data-key="${key}"]`);
        if (input) {
          input.style.outline = '2px solid rgba(251,191,36,0.8)';
          input.style.outlineOffset = '2px';
        }
      });
    }

    // Story mode
    function applyStory(scenario) {
      const params = STORY_SCENARIOS[scenario];
      if (!params) return;
      
      applyParams(params);
      highlightControls(scenario);
      
      // Update UI state
      Object.assign(state, params);
      
      // Update controls
      Object.keys(params).forEach(key => {
        const input = document.querySelector(`input[data-key="${key}"], select[data-key="${key}"]`);
        if (input) {
          input.value = params[key];
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      // Close modal
      document.getElementById('storyModal').classList.add('is-hidden');
    }

    // Story modal handlers
    document.querySelectorAll('.story-scenario__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scenario = btn.closest('.story-scenario').dataset.scenario;
        applyStory(scenario);
      });
    });

    document.getElementById('storyModalClose').addEventListener('click', () => {
      document.getElementById('storyModal').classList.add('is-hidden');
      highlightControls(null);
    });

    document.getElementById('storyBtn').addEventListener('click', () => {
      document.getElementById('storyModal').classList.remove('is-hidden');
    });

    // ---- Controls specs ----
    const trafficSpecs = [
      { key: 'buyers_per_sec', label: 'Buyers per second', min: 0.5, max: 10, step: 0.1, valueType: 'float1' },
      { key: 'buy_intent_share', label: 'Buy intent share', min: 0.1, max: 0.8, step: 0.01, valueType: 'float2' },
      { key: 'price_sensitivity_mean', label: 'Price sensitivity mean', min: 0.2, max: 1.0, step: 0.01, valueType: 'float2' },
      { key: 'price_sensitivity_spread', label: 'Price sensitivity spread', min: 0, max: 0.4, step: 0.01, valueType: 'float2' },
      { key: 'patience_mean', label: 'Patience mean', min: 0.3, max: 1.0, step: 0.01, valueType: 'float2' },
      { key: 'patience_spread', label: 'Patience spread', min: 0, max: 0.3, step: 0.01, valueType: 'float2' },
    ];

    const policySpecs = [
      { kind: 'select', key: 'ranking_mode', label: 'Ranking mode', options: [
        { value: 'quality-first', label: 'Quality-first' },
        { value: 'revenue-first', label: 'Revenue-first (auction)' },
      ] },
      { key: 'take_rate', label: 'Take rate', min: 0.05, max: 0.4, step: 0.01, valueType: 'float2' },
      { key: 'promoted_share', label: 'Promoted share', min: 0, max: 0.6, step: 0.01, valueType: 'float2' },
      { key: 'price_level', label: 'Price level', min: 0.5, max: 2.0, step: 0.05, valueType: 'float2' },
    ];

    const supplySpecs = [
      { key: 'sellers_count', label: 'Sellers count', min: 5, max: 30, step: 1, valueType: 'int' },
      { key: 'quality_mean', label: 'Quality mean', min: 0.3, max: 0.9, step: 0.01, valueType: 'float2' },
      { key: 'quality_spread', label: 'Quality spread', min: 0, max: 0.3, step: 0.01, valueType: 'float2' },
      { key: 'bid_mean', label: 'Bid mean', min: 0.5, max: 10, step: 0.1, valueType: 'float1' },
      { key: 'bid_spread', label: 'Bid spread', min: 0.3, max: 3.0, step: 0.1, valueType: 'float1' },
    ];

    const deliverySpecs = [
      { key: 'capacity_deliveries_per_min', label: 'Capacity (deliveries/min)', min: 2, max: 20, step: 0.5, valueType: 'float1' },
      { key: 'congestion_factor', label: 'Congestion factor', min: 0.05, max: 0.5, step: 0.01, valueType: 'float2' },
      { key: 'ETA0', label: 'Base ETA (sec)', min: 60, max: 600, step: 10, valueType: 'sec' },
      { key: 'cancel_sensitivity', label: 'Cancel sensitivity', min: 0.5, max: 3.0, step: 0.1, valueType: 'float1' },
    ];

    const trustSpecs = [
      { key: 'pressure_strength', label: 'Pressure strength', min: 0.3, max: 2.0, step: 0.05, valueType: 'float2' },
      { key: 'recovery_strength', label: 'Recovery strength', min: 0.05, max: 0.3, step: 0.01, valueType: 'float2' },
      { key: 'trust_floor', label: 'Trust floor', min: 0.1, max: 0.6, step: 0.01, valueType: 'float2' },
    ];

    function mount(specs, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      
      for (const spec of specs) {
        let control;
        if (spec.kind === 'select') {
          control = createSelect(spec, state, applyParams);
        } else {
          control = createSlider(spec, state, applyParams);
        }
        
        // Add data-key for story highlighting
        if (control.input) control.input.setAttribute('data-key', spec.key);
        if (control.select) control.select.setAttribute('data-key', spec.key);
        
        container.appendChild(control.wrap);
      }
    }

    mount(trafficSpecs, 'controlsTraffic');
    mount(policySpecs, 'controlsPolicy');
    mount(supplySpecs, 'controlsSupply');
    mount(deliverySpecs, 'controlsDelivery');
    mount(trustSpecs, 'controlsTrust');

    // Update summary
    function updateSummary(derived) {
      if (!topSummaryEl) return;
      
      topSummaryEl.innerHTML = '';
      
      // Now row
      const nowRow = el('div', { class: 'panel-summary__row' });
      nowRow.appendChild(el('span', { class: 'pill', text: `buyers/s: ${(derived.buyers_per_sec || 0).toFixed(1)}` }));
      nowRow.appendChild(el('span', { class: 'pill', text: `active orders: ${derived.active_orders}` }));
      nowRow.appendChild(el('span', { class: 'pill', text: `queue: ${derived.queue_len}` }));
      nowRow.appendChild(el('span', { class: 'pill', text: `ETA p90: ${U.formatSeconds(derived.p90_eta)}` }));
      topSummaryEl.appendChild(nowRow);
      
      // Policy row
      const policyRow = el('div', { class: 'panel-summary__row' });
      policyRow.appendChild(el('span', { class: 'pill', text: `ranking: ${derived.ranking_mode}` }));
      policyRow.appendChild(el('span', { class: 'pill', text: `take: ${(derived.take_rate * 100).toFixed(0)}%` }));
      policyRow.appendChild(el('span', { class: 'pill', text: `promoted: ${(derived.promoted_share * 100).toFixed(0)}%` }));
      policyRow.appendChild(el('span', { class: 'pill', text: `price: ${derived.price_level.toFixed(2)}x` }));
      topSummaryEl.appendChild(policyRow);
      
      // Market row
      const marketRow = el('div', { class: 'panel-summary__row' });
      marketRow.appendChild(el('span', { class: 'pill', text: `sellers: ${derived.sellers_count}` }));
      marketRow.appendChild(el('span', { class: 'pill', text: `avg q: ${(derived.avg_quality || 0).toFixed(2)}` }));
      marketRow.appendChild(el('span', { class: 'pill', text: `avg bid: ${(derived.avg_bid || 0).toFixed(2)}` }));
      topSummaryEl.appendChild(marketRow);
      
      // UX row
      const uxRow = el('div', { class: 'panel-summary__row' });
      uxRow.appendChild(el('span', { class: 'pill', text: `trust: ${((derived.trust || 0) * 100).toFixed(0)}%` }));
      uxRow.appendChild(el('span', { class: 'pill', text: `cancels: ${((derived.cancel_rate || 0) * 100).toFixed(1)}%` }));
      uxRow.appendChild(el('span', { class: 'pill', text: `late: ${((derived.late_share || 0) * 100).toFixed(1)}%` }));
      topSummaryEl.appendChild(uxRow);
      
      // Limiter + Because
      const limiterRow = el('div', { class: 'panel-summary__row' });
      limiterRow.appendChild(el('span', { class: 'pill pill--limiter', text: `Limiter: ${derived.limiter}` }));
      topSummaryEl.appendChild(limiterRow);
    }
    
    // Update hero storyline
    function updateHeroStoryline(derived) {
      const heroStorylineEl = document.getElementById('heroStoryline');
      if (!heroStorylineEl) return;
      
      if (!derived.heroBuyerId || !derived.heroEvents || derived.heroEvents.length === 0) {
        heroStorylineEl.innerHTML = '<span class="hero-storyline__step">Hero: waiting...</span>';
        return;
      }
      
      // Build steps
      const steps = [
        { key: 'impression', label: 'IMPRESSION', active: false },
        { key: 'click', label: 'CLICK', active: false },
        { key: 'order', label: 'ORDER', active: false },
        { key: 'queue', label: 'QUEUE', active: false },
        { key: 'delivered', label: 'DELIVERED', active: false },
        { key: 'cancelled', label: 'CANCELLED', active: false },
      ];
      
      // Find current step (most recent event)
      let currentStep = null;
      const lastEvent = derived.heroEvents[derived.heroEvents.length - 1];
      if (lastEvent) {
        if (lastEvent.type === 'impression') {
          currentStep = 'impression';
        } else if (lastEvent.type === 'orderCreated') {
          currentStep = 'order';
        } else if (lastEvent.type === 'enqueued') {
          currentStep = 'queue';
        } else if (lastEvent.type === 'deliveryStart') {
          currentStep = 'queue';
        } else if (lastEvent.type === 'delivered') {
          currentStep = 'delivered';
        } else if (lastEvent.type === 'cancelled') {
          currentStep = 'cancelled';
        }
      }
      
      // Check what happened
      const hasImpression = derived.heroEvents.some(e => e.type === 'impression');
      const hasClick = derived.heroEvents.some(e => e.type === 'orderCreated');
      const hasOrder = hasClick;
      const hasEnqueued = derived.heroEvents.some(e => e.type === 'enqueued' || e.type === 'deliveryStart');
      const hasDelivered = derived.heroEvents.some(e => e.type === 'delivered');
      const hasCancelled = derived.heroEvents.some(e => e.type === 'cancelled');
      
      // Mark steps
      for (let step of steps) {
        if (step.key === currentStep) {
          step.active = true;
        } else {
          // Past steps
          if (step.key === 'impression' && hasImpression && currentStep !== 'impression') {
            step.past = true;
          } else if (step.key === 'click' && hasClick && currentStep !== 'click' && currentStep !== 'impression') {
            step.past = true;
          } else if (step.key === 'order' && hasOrder && currentStep !== 'order' && currentStep !== 'click' && currentStep !== 'impression') {
            step.past = true;
          } else if (step.key === 'queue' && hasEnqueued && currentStep !== 'queue' && currentStep !== 'order' && currentStep !== 'click' && currentStep !== 'impression') {
            step.past = true;
          } else if (step.key === 'delivered' && hasDelivered) {
            step.past = true;
          } else if (step.key === 'cancelled' && hasCancelled) {
            step.past = true;
          }
        }
      }
      
      // If order created, mark click as past
      if (hasOrder && currentStep !== 'impression') {
        const clickStep = steps.find(s => s.key === 'click');
        if (clickStep && !clickStep.active) {
          clickStep.past = true;
        }
      }
      
      // Render
      heroStorylineEl.innerHTML = '';
      heroStorylineEl.appendChild(el('span', { class: 'hero-storyline__label', text: 'Hero: ' }));
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepEl = el('span', {
          class: 'hero-storyline__step' + 
            (step.active ? ' hero-storyline__step--active' : '') +
            (step.past ? ' hero-storyline__step--past' : ''),
          text: step.label
        });
        heroStorylineEl.appendChild(stepEl);
        
        if (i < steps.length - 1) {
          heroStorylineEl.appendChild(el('span', { class: 'hero-storyline__arrow', text: ' → ' }));
        }
      }
    }
    
    // Update why reason
    function updateWhyReason(derived) {
      const whyReasonEl = document.getElementById('whyReason');
      if (!whyReasonEl) return;
      
      if (!derived.limiterReason) {
        whyReasonEl.textContent = '';
        return;
      }
      
      // Convert to human-readable
      let reason = derived.limiterReason;
      if (reason.includes('queue↑')) {
        reason = reason.replace(/queue↑ \(([^)]+)\) → ETA↑ \(([^)]+)\)/, 'delivery overloaded → queue grows → ETA $2');
      } else if (reason.includes('trust↓')) {
        reason = reason.replace(/trust↓ \(([^)]+)\) → CTR↓/, 'trust drops → CTR falls');
      } else if (reason.includes('buyers↓')) {
        reason = reason.replace(/buyers↓ \(([^)]+)\)/, 'not enough buyers');
      } else if (reason.includes('sellers↓')) {
        reason = reason.replace(/sellers↓ \(([^)]+)\) or fill↓ \(([^)]+)\)/, 'not enough sellers or low fill rate');
      }
      
      whyReasonEl.textContent = `Why: ${reason}`;
    }

    // Update metrics
    function updateMetrics(derived, ts) {
      const mRevenue = document.getElementById('mRevenue');
      const mOrders = document.getElementById('mOrders');
      const mP90ETA = document.getElementById('mP90ETA');
      const mTrust = document.getElementById('mTrust');
      const mConversionMain = document.getElementById('mConversionMain');
      const mLateRateMain = document.getElementById('mLateRateMain');

      if (mRevenue) mRevenue.textContent = U.formatMoney(ts.revenue_per_min.last() || 0);
      if (mOrders) mOrders.textContent = Math.round(ts.orders_per_min.last() || 0).toString();
      if (mP90ETA) mP90ETA.textContent = U.formatSeconds(ts.p90_eta.last() || 0);
      if (mTrust) mTrust.textContent = U.formatPercent01(ts.trust.last() || 0, 0);
      if (mConversionMain) mConversionMain.textContent = U.formatPercent01(ts.conversion_rate.last() || 0, 1);
      if (mLateRateMain) mLateRateMain.textContent = U.formatPercent01(ts.late_share.last() || 0, 1);

      // More metrics (collapsible)
      const mGMV = document.getElementById('mGMV');
      const mConversion = document.getElementById('mConversion');
      const mFillRate = document.getElementById('mFillRate');
      const mCancelRate = document.getElementById('mCancelRate');
      const mLateShare = document.getElementById('mLateShare');
      const mActiveOrders = document.getElementById('mActiveOrders');
      const mQueueLen = document.getElementById('mQueueLen');
      const mAvgPrice = document.getElementById('mAvgPrice');
      const mAvgQuality = document.getElementById('mAvgQuality');
      
      if (mGMV) mGMV.textContent = U.formatMoney(ts.gmv_per_min.last() || 0);
      if (mConversion) mConversion.textContent = U.formatPercent01(ts.conversion_rate.last() || 0, 1);
      if (mFillRate) mFillRate.textContent = U.formatPercent01(ts.fill_rate.last() || 0, 0);
      if (mCancelRate) mCancelRate.textContent = U.formatPercent01(ts.cancel_rate.last() || 0, 1);
      if (mLateShare) mLateShare.textContent = U.formatPercent01(ts.late_share.last() || 0, 1);
      if (mActiveOrders) mActiveOrders.textContent = String(derived.active_orders);
      if (mQueueLen) mQueueLen.textContent = String(derived.queue_len);
      if (mAvgPrice) mAvgPrice.textContent = U.formatMoney(ts.avg_price_shown.last() || 0);
      if (mAvgQuality) mAvgQuality.textContent = (ts.avg_quality_shown.last() || 0).toFixed(2);
    }

    // Rolling 60s buffer for flow strip
    const flowBuffer = { impressions: [], orders_created: [], orders_completed: [], orders_cancelled: [] };
    const FLOW_WINDOW = 60;

    // Selection highlight (feed → selected flash, ~200ms)
    let _lastHeroSlotIndex = -2;
    let _flashUntil = 0;

    function pushFlow(sec) {
      if (!sec) return;
      for (const k of Object.keys(flowBuffer)) {
        flowBuffer[k].push(sec[k] || 0);
        if (flowBuffer[k].length > FLOW_WINDOW) flowBuffer[k].shift();
      }
    }

    function flowSums() {
      const sum = (arr) => arr.reduce((a, b) => a + b, 0);
      return {
        impressions: sum(flowBuffer.impressions),
        orders_created: sum(flowBuffer.orders_created),
        orders_completed: sum(flowBuffer.orders_completed),
        orders_cancelled: sum(flowBuffer.orders_cancelled),
      };
    }

    function updateFlowStrip(derived, sec) {
      pushFlow(sec);
      const heroStorylineEl = document.getElementById('heroStoryline');
      if (!heroStorylineEl) return;
      const f = flowSums();
      const steps = [
        { key: 'impression', label: 'IMPRESSION', count: f.impressions },
        { key: 'click', label: 'CLICK', count: f.orders_created },
        { key: 'order', label: 'ORDER', count: f.orders_created },
        { key: 'queue', label: 'QUEUE', count: derived.queue_len },
        { key: 'delivered', label: 'DELIVERED', count: f.orders_completed },
        { key: 'cancelled', label: 'CANCELLED', count: f.orders_cancelled },
      ];
      const limiter = derived.limiter || 'Balanced';
      let activeKey = 'impression';
      if (limiter === 'Ops-limited') activeKey = 'queue';
      else if (limiter === 'Trust-limited') activeKey = 'delivered';
      else if (limiter === 'Demand-limited') activeKey = 'impression';
      else if (limiter === 'Supply-limited') activeKey = 'order';
      else activeKey = f.orders_completed > 0 ? 'delivered' : f.orders_created > 0 ? 'queue' : 'impression';

      heroStorylineEl.innerHTML = '';
      heroStorylineEl.appendChild(el('span', { class: 'hero-storyline__label', text: 'Flow (60s): ' }));
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const active = s.key === activeKey;
        const stepEl = el('span', {
          class: 'hero-storyline__step' + (active ? ' hero-storyline__step--active' : ''),
          text: `${s.label} ${typeof s.count === 'number' ? s.count : '-'}`
        });
        heroStorylineEl.appendChild(stepEl);
        if (i < steps.length - 1) heroStorylineEl.appendChild(el('span', { class: 'hero-storyline__arrow', text: ' → ' }));
      }
    }

    function updateWhyExplain(derived) {
      const whyEl = document.getElementById('whyExplain');
      if (!whyEl) return;
      const load = derived.delivery_load;
      let loadLabel = 'low';
      if (load >= 0.8) loadLabel = 'high';
      else if (load >= 0.5) loadLabel = 'medium';
      const rank = derived.ranking_mode || 'quality-first';
      const prom = ((derived.promoted_share || 0) * 100).toFixed(0);
      whyEl.textContent = `Why: ranking: ${rank}, promoted share: ${prom}%, delivery load: ${loadLabel}`;
    }

    function updatePipelineBuyers(sim) {
      const container = document.getElementById('pipelineBuyers');
      if (!container) return;
      const last = sim.buyers.slice(-5);
      container.innerHTML = '';
      for (const b of last) {
        const isHero = b.id === sim.heroBuyerId;
        const card = el('div', { class: 'pipeline-buyer' + (isHero ? ' pipeline-buyer--hero' : '') });
        card.appendChild(el('div', { class: 'pipeline-buyer__label', text: isHero ? `B${b.id} (Hero)` : `B${b.id}` }));
        const meta = el('div', { class: 'pipeline-buyer__meta' });
        meta.appendChild(el('span', { text: `price sens: ${(b.price_sensitivity || 0).toFixed(2)}` }));
        meta.appendChild(el('span', { text: `patience: ${(b.patience || 0).toFixed(2)}` }));
        meta.appendChild(el('span', { text: `intent: ${b.intent || 'browse'}` }));
        card.appendChild(meta);
        container.appendChild(card);
      }
      if (last.length === 0) {
        container.appendChild(el('div', { class: 'pipeline-buyer__meta', text: 'No buyers yet' }));
      }
    }

    function updatePipelineFeed(sim) {
      const container = document.getElementById('pipelineFeed');
      if (!container) return;
      const slots = sim.feed || [];
      const heroSlotIndex = (() => {
        for (const e of (sim.heroEvents || []).slice().reverse()) {
          if ((e.type === 'impression' || e.type === 'orderCreated') && e.data && e.data.slotIndex != null) return e.data.slotIndex;
        }
        return -1;
      })();
      const recentImpression = (i) => (sim.heroEvents || []).some(e => e.type === 'impression' && e.data && e.data.slotIndex === i && (sim.time - e.t) < 1.5);
      const now = Date.now();
      if (heroSlotIndex >= 0 && heroSlotIndex !== _lastHeroSlotIndex) {
        _lastHeroSlotIndex = heroSlotIndex;
        _flashUntil = now + 220;
      }
      if (now > _flashUntil) {
        _flashUntil = 0;
        const heroEl = document.getElementById('pipelineHero');
        if (heroEl) heroEl.classList.remove('pipeline-hero--flash');
      }
      const inFlash = now < _flashUntil;
      if (inFlash) {
        const heroEl = document.getElementById('pipelineHero');
        if (heroEl) heroEl.classList.add('pipeline-hero--flash');
      }
      container.innerHTML = '';
      const limit = Math.min(8, slots.length);
      for (let i = 0; i < limit; i++) {
        const slot = slots[i];
        const item = slot && slot.item;
        const promoted = !!(slot && slot.promoted);
        const highlighted = recentImpression(i);
        const selected = heroSlotIndex === i;
        const selectFlash = selected && inFlash;
        const card = el('div', {
          class: 'pipeline-feed-item' +
            (highlighted ? ' pipeline-feed-item--highlighted' : '') +
            (selected ? ' pipeline-feed-item--selected' : '') +
            (selectFlash ? ' pipeline-feed-item--select-flash' : '') +
            (promoted ? ' pipeline-feed-item--promoted' : '')
        });
        if (item) {
          card.appendChild(el('div', { class: 'pipeline-feed-item__price', text: `$${item.price.toFixed(0)}` }));
          card.appendChild(el('div', { class: 'pipeline-feed-item__quality', text: `quality: ${(item.quality || 0).toFixed(2)}` }));
          if (promoted) card.appendChild(el('span', { class: 'pipeline-feed-item__badge', text: 'PROMOTED' }));
        } else {
          card.appendChild(el('div', { class: 'pipeline-feed-item__price', text: '—' }));
        }
        container.appendChild(card);
      }
    }

    function updatePipelineHero(sim) {
      const container = document.getElementById('pipelineHero');
      const reasonEl = document.getElementById('pipelineHeroReason');
      if (!container) return;
      let heroItem = null;
      let heroSlotIndex = -1;
      const rankingMode = (sim.params && sim.params.ranking_mode) || 'quality-first';
      for (const e of (sim.heroEvents || []).slice().reverse()) {
        if ((e.type === 'impression' || e.type === 'orderCreated') && e.data && e.data.slotIndex != null && sim.feed[e.data.slotIndex]) {
          heroSlotIndex = e.data.slotIndex;
          heroItem = sim.feed[heroSlotIndex].item;
          break;
        }
      }
      if (!heroItem && sim.feed && sim.feed[0] && sim.feed[0].item) {
        heroItem = sim.feed[0].item;
        heroSlotIndex = 0;
      }
      container.innerHTML = '';
      if (!heroItem) {
        container.appendChild(el('div', { class: 'pipeline-hero__empty', text: 'No selection yet' }));
      } else {
        const slot = sim.feed[heroSlotIndex];
        const promoted = !!(slot && slot.promoted);
        container.appendChild(el('div', { class: 'pipeline-hero__price', text: `$${heroItem.price.toFixed(0)}` }));
        container.appendChild(el('div', { class: 'pipeline-hero__quality', text: `Quality: ${(heroItem.quality || 0).toFixed(2)}` }));
        if (promoted) container.appendChild(el('span', { class: 'pipeline-hero__badge', text: 'PROMOTED' }));
      }
      if (reasonEl) {
        reasonEl.textContent = `Selected because: ${rankingMode === 'revenue-first' ? 'revenue-first' : 'quality-first'}`;
      }
    }

    function updatePipelineQueue(sim) {
      const container = document.getElementById('pipelineQueue');
      if (!container) return;
      const q = sim.delivery_queue || [];
      container.innerHTML = '';
      const limit = Math.min(12, q.length);
      for (let i = 0; i < limit; i++) {
        const o = q[i];
        if (!o) continue;
        let status = 'ordered';
        if (o.cancelled) status = 'cancelled';
        else if (o.delivered) status = 'delivered';
        else if (o.delivery_progress > 0) status = 'delivering';
        else status = 'queued';
        const cls = 'pipeline-queue-item' +
          (o.late ? ' pipeline-queue-item--late' : '') +
          (status === 'delivering' ? ' pipeline-queue-item--delivering' : '');
        const card = el('div', { class: cls });
        card.appendChild(el('div', { class: 'pipeline-queue-item__status', text: status.toUpperCase() }));
        const eta = o.eta != null ? U.formatSeconds(o.eta) : '—';
        card.appendChild(el('div', { class: 'pipeline-queue-item__eta', text: `ETA: ${eta}` }));
        container.appendChild(card);
      }
    }

    function updatePipelineCapacity(sim) {
      const container = document.getElementById('pipelineCapacity');
      if (!container) return;
      const cap = (sim.params && sim.params.capacity_deliveries_per_min) || 0;
      const q = (sim.delivery_queue && sim.delivery_queue.length) || 0;
      const load = cap > 0 ? Math.min(1, q / cap) : 0;
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'pipeline-capacity__label', text: `Capacity: ${cap.toFixed(1)}/min | Load: ${(load * 100).toFixed(0)}%` }));
      const bar = el('div', { class: 'pipeline-capacity__bar' });
      const fill = el('div', {
        class: 'pipeline-capacity__fill' + (load > 0.8 ? ' pipeline-capacity__fill--danger' : load > 0.5 ? ' pipeline-capacity__fill--warn' : '')
      });
      fill.style.width = `${(load * 100).toFixed(0)}%`;
      bar.appendChild(fill);
      container.appendChild(bar);
    }

    function updatePipelineTrust(sim) {
      const fillEl = document.getElementById('pipelineTrustFill');
      const valueEl = document.getElementById('pipelineTrustValue');
      if (!fillEl || !valueEl) return;
      const t = Math.max(0, Math.min(1, sim.trust != null ? sim.trust : 0));
      fillEl.style.width = `${(t * 100).toFixed(0)}%`;
      valueEl.textContent = `${(t * 100).toFixed(0)}%`;
    }

    function updatePipelineDelivery(sim) {
      const container = document.getElementById('pipelineDelivery');
      if (!container) return;
      const q = sim.delivery_queue || [];
      const delivering = q.filter(o => !o.delivered && !o.cancelled && o.delivery_progress > 0);
      const p90 = sim.ts && sim.ts.p90_eta && sim.ts.p90_eta.last ? sim.ts.p90_eta.last() : null;
      container.innerHTML = '';
      container.appendChild(el('div', { text: `Delivering: ${delivering.length}` }));
      if (p90 != null) container.appendChild(el('div', { text: `ETA p90: ${U.formatSeconds(p90)}` }));
    }

    function updateTrustFeedVisual(sim) {
      const col = document.querySelector('.pipeline-col--feed');
      if (!col) return;
      const t = Math.max(0, Math.min(1, sim.trust != null ? sim.trust : 0));
      col.classList.remove('trust-low', 'trust-mid', 'trust-high');
      if (t < 0.4) col.classList.add('trust-low');
      else if (t > 0.7) col.classList.add('trust-high');
      else col.classList.add('trust-mid');
    }

    function updatePipeline(sim) {
      updatePipelineBuyers(sim);
      updatePipelineFeed(sim);
      updatePipelineHero(sim);
      updatePipelineQueue(sim);
      updatePipelineCapacity(sim);
      updatePipelineDelivery(sim);
      updatePipelineTrust(sim);
      updateTrustFeedVisual(sim);
    }

    sim.onSecond = ({ derived, ts, sec }) => {
      updateSummary(derived);
      updateMetrics(derived, ts);
      updateFlowStrip(derived, sec);
      updateWhyReason(derived);
      updateWhyExplain(derived);
      updatePipeline(sim);
    };

    sim.onReset = () => {
      _lastHeroSlotIndex = -2;
      _flashUntil = 0;
      updatePipeline(sim);
    };
    updatePipeline(sim);
    
    // View mode selector
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
      viewModeSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (renderer && renderer.setViewMode) {
          renderer.setViewMode(mode);
        }
        // Update metrics visibility
        const moreMetrics = document.getElementById('moreMetrics');
        if (moreMetrics) {
          if (mode === 'learn') {
            moreMetrics.open = false;
          } else {
            moreMetrics.open = true;
          }
        }
      });
    }

    return { state, applyStory, highlightControls };
  }

  window.UI = { createUI };
})();
