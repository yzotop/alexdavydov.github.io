/**
 * Live simulation playback with throttled rendering and stable Auction Arena
 */
(function() {
  'use strict';

  const { formatCurrency, formatPercent, formatNumber } = window.Formatters;
  const { updateLineChart, updateScatter } = window.Charts;

  // Controller object
  const controller = {
    state: 'idle', // idle, preparing, prepared, playing, paused, finished, error
    run: null, // { events, cum, horizon, i }
    configHash: null,
    animationFrame: null,
    lastFrameTime: 0,
    speed: 1,
    i: 0,
    lastRenderedI: 0,
    renderEvery: 50,
    tapeBuffer: new Array(30).fill(null),
    tapeWriteIndex: 0,
    ladderRows: [],
    tapeRows: [],
    spans: {}
  };

  // Slot names mapping
  const slotNames = {
    'slot_feed_inline': 'FEED_INLINE',
    'slot_feed_right': 'FEED_RIGHT',
    'slot_story_inline': 'STORY_VIDEO'
  };

  /**
   * Clamp index to valid range
   */
  function clampIndex(i, n) {
    if (n === 0) return 0;
    return Math.max(0, Math.min(i, n - 1));
  }

  /**
   * Get event safely
   */
  function getEventSafe(run, i) {
    if (!run || !run.events || run.events.length === 0) return null;
    const clamped = clampIndex(i, run.events.length);
    return run.events[clamped];
  }

  /**
   * Get render interval based on speed
   */
  function getRenderEvery(speed) {
    if (speed === 'max') return 200;
    const s = parseInt(speed);
    if (s === 1) return 10;
    if (s === 4) return 20;
    if (s === 20) return 50;
    return 50;
  }

  /**
   * Get config hash
   */
  function getConfigHash() {
    return JSON.stringify({
      scenario: document.getElementById('scenarioSelect').value,
      seed: document.getElementById('seedInput').value,
      horizon: document.getElementById('horizonEvents').value,
      pricing: document.getElementById('pricingType').value,
      hybridAlpha: document.getElementById('hybridAlpha').value,
      floorMultiplier: document.getElementById('floorMultiplier').value,
      fatigueStrength: document.getElementById('fatigueStrength').value,
      baselineNoise: document.getElementById('baselineNoise').value,
      viewabilityEnabled: document.getElementById('viewabilityEnabled').checked
    });
  }

  /**
   * Get current config
   */
  function getConfig() {
    const scenario = window.Scenarios.getScenario(document.getElementById('scenarioSelect').value);
    if (!scenario) {
      throw new Error('Invalid scenario selected');
    }
    
    return {
      seed: parseInt(document.getElementById('seedInput').value) || 1,
      horizon: parseInt(document.getElementById('horizonEvents').value) || 1000,
      policy: scenario.policy,
      auction: {
        pricing: document.getElementById('pricingType').value,
        floor_multiplier: parseFloat(document.getElementById('floorMultiplier').value) || 1.0,
        hybrid_alpha: parseFloat(document.getElementById('hybridAlpha').value) || 0.5
      },
      fatigue: {
        fatigue_strength: parseFloat(document.getElementById('fatigueStrength').value) || 0.5,
        baseline_noise: parseFloat(document.getElementById('baselineNoise').value) || 0.01,
        viewability_enabled: document.getElementById('viewabilityEnabled').checked
      }
    };
  }

  /**
   * Prepare simulation run
   */
  function prepareRun() {
    try {
      controller.state = 'preparing';
      updateUI();
      
      const config = getConfig();
      const events = window.Simulator.runSimulation(config);
      
      if (events.length !== config.horizon) {
        throw new Error(`Expected ${config.horizon} events, got ${events.length}`);
      }
      
      // Build cumulative arrays
      const cum = {
        revenue: [],
        impressions: [],
        clicks: [],
        fill_opened: [],
        fill_filled: []
      };
      
      let cumRevenue = 0;
      let cumImpressions = 0;
      let cumClicks = 0;
      let cumOpened = 0;
      let cumFilled = 0;
      
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        cumRevenue += event.revenue || 0;
        cumImpressions += event.impressions || 0;
        cumClicks += event.clicks || 0;
        cumOpened += event.opened_slots || 0;
        cumFilled += event.filled_slots || 0;
        
        cum.revenue[i] = cumRevenue;
        cum.impressions[i] = cumImpressions;
        cum.clicks[i] = cumClicks;
        cum.fill_opened[i] = cumOpened;
        cum.fill_filled[i] = cumFilled;
      }
      
      controller.run = {
        events: events,
        cum: cum,
        horizon: config.horizon,
        i: 0
      };
      
      controller.configHash = getConfigHash();
      controller.state = 'prepared';
      controller.i = 0;
      controller.lastRenderedI = 0;
      controller.tapeBuffer.fill(null);
      controller.tapeWriteIndex = 0;
      controller.renderEvery = getRenderEvery(controller.speed);
      
      updateUI();
      renderUI(0);
      
      return true;
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
      return false;
    }
  }

  /**
   * Play simulation
   */
  function play() {
    try {
      const configHash = getConfigHash();
      
      if (controller.state === 'idle' || 
          !controller.run || 
          controller.configHash !== configHash ||
          controller.run.events.length !== parseInt(document.getElementById('horizonEvents').value)) {
        if (!prepareRun()) {
          return;
        }
      }
      
      if (controller.state === 'finished') {
        controller.i = 0;
        controller.lastRenderedI = 0;
        controller.state = 'prepared';
      }
      
      if (controller.state !== 'prepared' && controller.state !== 'paused') {
        return;
      }
      
      controller.state = 'playing';
      controller.lastFrameTime = performance.now();
      updateUI();
      animate();
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
    }
  }

  /**
   * Pause simulation
   */
  function pause() {
    try {
      if (controller.animationFrame) {
        cancelAnimationFrame(controller.animationFrame);
        controller.animationFrame = null;
      }
      controller.state = 'paused';
      updateUI();
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
    }
  }

  /**
   * Step simulation
   */
  function step() {
    try {
      const configHash = getConfigHash();
      
      if (controller.state === 'idle' || 
          !controller.run || 
          controller.configHash !== configHash ||
          controller.run.events.length !== parseInt(document.getElementById('horizonEvents').value)) {
        if (!prepareRun()) {
          return;
        }
      }
      
      if (controller.state === 'finished') {
        return;
      }
      
      if (controller.i < controller.run.horizon) {
        controller.i++;
        
        // Add to tape buffer
        const event = getEventSafe(controller.run, controller.i - 1);
        if (event) {
          if (event.slot_results && event.slot_results.length > 0) {
            event.slot_results.forEach(sr => {
              controller.tapeBuffer[controller.tapeWriteIndex] = {
                t: event.t,
                place: sr.placement !== undefined ? sr.placement : 0,
                winner: sr.winner ? sr.winner.name : '—',
                pay_cpm: sr.pay_cpm || 0,
                click: sr.click ? 1 : 0,
                reason: sr.reason || '—'
              };
              controller.tapeWriteIndex = (controller.tapeWriteIndex + 1) % 30;
            });
          }
        }
        
        if (controller.i >= controller.run.horizon) {
          controller.state = 'finished';
        } else {
          controller.state = 'prepared';
        }
        renderUI(controller.i);
        updateUI();
      }
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
    }
  }

  /**
   * Reset simulation
   */
  function reset() {
    try {
      if (controller.animationFrame) {
        cancelAnimationFrame(controller.animationFrame);
        controller.animationFrame = null;
      }
      
      if (controller.run) {
        controller.i = 0;
        controller.lastRenderedI = 0;
        controller.state = 'prepared';
      } else {
        controller.state = 'idle';
      }
      
      controller.tapeBuffer.fill(null);
      controller.tapeWriteIndex = 0;
      updateUI();
      renderUI(0);
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
    }
  }

  /**
   * Seek to index
   */
  function seek(i) {
    try {
      if (!controller.run) return;
      
      const clamped = clampIndex(i, controller.run.horizon);
      controller.i = clamped;
      controller.lastRenderedI = clamped; // Force render on next frame
      
      // Clear tape when seeking (will rebuild during playback)
      controller.tapeBuffer.fill(null);
      controller.tapeWriteIndex = 0;
      
      if (controller.i >= controller.run.horizon) {
        controller.state = 'finished';
      } else if (controller.state === 'playing') {
        // Keep playing
      } else {
        controller.state = 'prepared';
      }
      
      renderUI(controller.i);
      updateUI();
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      updateUI();
    }
  }

  /**
   * Animation loop
   */
  function animate() {
    if (controller.state !== 'playing') {
      return;
    }
    
    try {
      const now = performance.now();
      const deltaTime = now - controller.lastFrameTime;
      controller.lastFrameTime = now;
      
      // Calculate ticks to advance
      let ticksPerFrame = 1;
      if (controller.speed === 'max') {
        ticksPerFrame = 200;
      } else {
        ticksPerFrame = controller.speed;
      }
      
      // Advance based on time (target 60fps)
      const targetAdvance = Math.floor((deltaTime / 1000) * ticksPerFrame * 60);
      
      for (let i = 0; i < targetAdvance && controller.i < controller.run.horizon; i++) {
        controller.i++;
        
        // Add to tape buffer (cyclic) - only for events with slot results
        const event = getEventSafe(controller.run, controller.i - 1);
        if (event) {
          if (event.slot_results && event.slot_results.length > 0) {
            event.slot_results.forEach(sr => {
              controller.tapeBuffer[controller.tapeWriteIndex] = {
                t: event.t,
                place: sr.placement !== undefined ? sr.placement : 0,
                winner: sr.winner ? sr.winner.name : '—',
                pay_cpm: sr.pay_cpm || 0,
                click: sr.click ? 1 : 0,
                reason: sr.reason || '—'
              };
              controller.tapeWriteIndex = (controller.tapeWriteIndex + 1) % 30;
            });
          } else if (event.opened_slots > 0) {
            // Event opened slots but no results (shouldn't happen, but handle gracefully)
            controller.tapeBuffer[controller.tapeWriteIndex] = {
              t: event.t,
              place: 0,
              winner: '—',
              pay_cpm: 0,
              click: 0,
              reason: event.reason || '—'
            };
            controller.tapeWriteIndex = (controller.tapeWriteIndex + 1) % 30;
          }
        }
      }
      
      if (controller.i >= controller.run.horizon) {
        controller.state = 'finished';
        pause();
      }
      
      // Throttled rendering
      if (controller.i - controller.lastRenderedI >= controller.renderEvery) {
        renderUI(controller.i);
        controller.lastRenderedI = controller.i;
      }
      
      updateUI();
      
      if (controller.state === 'playing') {
        controller.animationFrame = requestAnimationFrame(animate);
      }
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
      pause();
      updateUI();
    }
  }

  /**
   * Render all UI components (throttled entry point)
   */
  function renderUI(i) {
    try {
      const event = getEventSafe(controller.run, i - 1);
      const cumMetrics = controller.run && i > 0 ? {
        revenue: controller.run.cum.revenue[i - 1] || 0,
        impressions: controller.run.cum.impressions[i - 1] || 0,
        clicks: controller.run.cum.clicks[i - 1] || 0,
        opened: controller.run.cum.fill_opened[i - 1] || 0,
        filled: controller.run.cum.fill_filled[i - 1] || 0
      } : null;
      
      renderClock(i);
      renderArena(event, cumMetrics);
      renderLadder(event);
      renderTape();
      renderKPIs(cumMetrics);
      renderCharts(i);
    } catch (error) {
      controller.state = 'error';
      showErrorOverlay(error);
    }
  }

  /**
   * Render clock
   */
  function renderClock(i) {
    if (!controller.run) {
      controller.spans.clockTime.textContent = '0';
      controller.spans.clockHorizon.textContent = document.getElementById('horizonEvents').value || '1000';
      const slider = document.getElementById('progressSlider');
      slider.max = document.getElementById('horizonEvents').value || 1000;
      slider.value = 0;
      return;
    }
    
    const event = getEventSafe(controller.run, i - 1);
    const t = event ? event.t : 0;
    
    controller.spans.clockTime.textContent = t;
    controller.spans.clockHorizon.textContent = controller.run.horizon;
    
    const slider = document.getElementById('progressSlider');
    slider.max = controller.run.horizon;
    slider.value = i;
  }

  /**
   * Render Arena (Slot + Outcome)
   */
  function renderArena(event, cumMetrics) {
    if (!event) {
      controller.spans.slotPlacement.textContent = '—';
      controller.spans.slotFloor.textContent = '—';
      controller.spans.slotOpened.textContent = '0';
      controller.spans.slotFilled.textContent = '0';
      controller.spans.slotEligible.textContent = '0';
      controller.spans.slotReason.textContent = '—';
      controller.spans.outcomeWinner.textContent = '—';
      controller.spans.outcomePay.textContent = '—';
      controller.spans.outcomeImpression.textContent = '—';
      controller.spans.outcomeClick.textContent = '—';
      controller.spans.outcomeRevenue.textContent = '$0.00';
      controller.spans.outcomeCTR.textContent = '0.00%';
      controller.spans.outcomeECPM.textContent = '$0.00';
      return;
    }
    
    // Slot Card
    const slots = window.Scenarios.getSlots();
    const slotName = slots[0] ? slotNames[slots[0].id] || slots[0].name.toUpperCase() : '—';
    const floorMultiplier = parseFloat(document.getElementById('floorMultiplier').value) || 1.0;
    const floor = slots[0] ? (slots[0].floor_cpm * floorMultiplier) : 0;
    
    controller.spans.slotPlacement.textContent = slotName;
    controller.spans.slotFloor.textContent = '$' + floor.toFixed(2);
    controller.spans.slotOpened.textContent = event.opened_slots || 0;
    controller.spans.slotFilled.textContent = event.filled_slots || 0;
    controller.spans.slotEligible.textContent = event.eligible_cnt || 0;
    controller.spans.slotReason.textContent = event.reason || '—';
    
    // Outcome Card
    const firstSlot = event.slot_results && event.slot_results.length > 0 ? event.slot_results[0] : null;
    const winner = firstSlot && firstSlot.winner ? firstSlot.winner.name : '—';
    const payCpm = firstSlot && firstSlot.pay_cpm ? firstSlot.pay_cpm : null;
    const impression = firstSlot && firstSlot.impression ? 'Yes' : 'No';
    const click = firstSlot && firstSlot.click ? 'Yes' : 'No';
    
    controller.spans.outcomeWinner.textContent = winner;
    controller.spans.outcomePay.textContent = payCpm !== null ? '$' + payCpm.toFixed(2) : '—';
    controller.spans.outcomeImpression.textContent = impression;
    controller.spans.outcomeClick.textContent = click;
    
    // Cumulative metrics
    if (cumMetrics) {
      const ctr = cumMetrics.impressions > 0 ? cumMetrics.clicks / cumMetrics.impressions : 0;
      const ecpm = cumMetrics.impressions > 0 ? (cumMetrics.revenue * 1000) / cumMetrics.impressions : 0;
      
      controller.spans.outcomeRevenue.textContent = formatCurrency(cumMetrics.revenue);
      controller.spans.outcomeCTR.textContent = formatPercent(ctr);
      controller.spans.outcomeECPM.textContent = formatCurrency(ecpm);
    }
    
    // Blink click indicator
    const clickEl = document.getElementById('outcomeClick');
    if (firstSlot && firstSlot.click) {
      clickEl.classList.add('arena-outcome__value--click');
      setTimeout(() => clickEl.classList.remove('arena-outcome__value--click'), 500);
    }
  }

  /**
   * Render Bidder Ladder (8 fixed rows, in-place updates)
   */
  function renderLadder(event) {
    const candidates = event && event.explain_candidates ? event.explain_candidates : [];
    const winnerId = event && event.winner_id ? event.winner_id : null;
    
    // Find max score for normalization
    let maxScore = 0;
    if (candidates.length > 0) {
      maxScore = Math.max(...candidates.map(c => c.score || 0));
    }
    if (maxScore === 0) maxScore = 1; // Avoid division by zero
    
    // Update 8 rows
    for (let i = 0; i < 8; i++) {
      const row = controller.ladderRows[i];
      if (!row) continue;
      
      const candidate = candidates[i];
      const isWinner = candidate && candidate.advertiser_id === winnerId;
      const isSecond = i === 1 && candidates.length > 1;
      
      // Update classes
      row.className = 'arena-ladder__row';
      if (isWinner) {
        row.classList.add('arena-ladder__row--winner');
      } else if (isSecond) {
        row.classList.add('arena-ladder__row--second');
      }
      
      // Update content
      if (candidate) {
        row.children[0].textContent = i + 1; // Rank
        row.children[1].textContent = candidate.advertiser_name || candidate.advertiser_id || '—'; // Name
        row.children[2].textContent = '$' + candidate.bid_cpm.toFixed(2); // Bid
        row.children[3].textContent = (candidate.pctr * 100).toFixed(2) + '%'; // pCTR
        row.children[4].textContent = candidate.quality.toFixed(2); // Quality
        row.children[5].textContent = candidate.score.toFixed(2); // Score
        
        // Bar width
        const barPct = (candidate.score / maxScore) * 100;
        const barFill = row.querySelector('.arena-ladder__bar-fill');
        if (barFill) {
          barFill.style.width = barPct + '%';
        }
      } else {
        row.children[0].textContent = i + 1;
        row.children[1].textContent = '—';
        row.children[2].textContent = '—';
        row.children[3].textContent = '—';
        row.children[4].textContent = '—';
        row.children[5].textContent = '—';
        const barFill = row.querySelector('.arena-ladder__bar-fill');
        if (barFill) {
          barFill.style.width = '0%';
        }
      }
    }
  }

  /**
   * Render Tape (30 fixed rows, cyclic buffer)
   */
  function renderTape() {
    // Build display order (newest first)
    // Most recent entry is at (tapeWriteIndex - 1) mod 30
    const displayOrder = [];
    for (let i = 0; i < 30; i++) {
      const idx = (controller.tapeWriteIndex - 1 - i + 30) % 30;
      if (controller.tapeBuffer[idx] !== null) {
        displayOrder.push(controller.tapeBuffer[idx]);
      }
    }
    
    // Update 30 rows in-place
    for (let i = 0; i < 30; i++) {
      const row = controller.tapeRows[i];
      if (!row) continue;
      
      const item = displayOrder[i];
      if (item) {
        row.children[0].textContent = item.t;
        row.children[1].textContent = item.place;
        row.children[2].textContent = item.winner;
        row.children[3].textContent = item.pay_cpm > 0 ? '$' + item.pay_cpm.toFixed(2) : '—';
        row.children[4].textContent = item.click;
        row.children[5].textContent = item.reason;
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    }
  }

  /**
   * Render KPIs
   */
  function renderKPIs(cumMetrics) {
    if (!cumMetrics) {
      controller.spans.kpiRevenue.textContent = '—';
      controller.spans.kpiImpressions.textContent = '—';
      controller.spans.kpiClicks.textContent = '—';
      controller.spans.kpiCTR.textContent = '—';
      controller.spans.kpiECPM.textContent = '—';
      controller.spans.kpiFillRate.textContent = '—';
      controller.spans.kpiAdPressure.textContent = '—';
      return;
    }
    
    const ctr = cumMetrics.impressions > 0 ? cumMetrics.clicks / cumMetrics.impressions : 0;
    const ecpm = cumMetrics.impressions > 0 ? (cumMetrics.revenue * 1000) / cumMetrics.impressions : 0;
    const fillrate = cumMetrics.opened > 0 ? cumMetrics.filled / cumMetrics.opened : 0;
    const pressure = controller.i > 0 ? cumMetrics.impressions / controller.i : 0;
    
    controller.spans.kpiRevenue.textContent = formatCurrency(cumMetrics.revenue);
    controller.spans.kpiImpressions.textContent = formatNumber(cumMetrics.impressions);
    controller.spans.kpiClicks.textContent = formatNumber(cumMetrics.clicks);
    controller.spans.kpiCTR.textContent = formatPercent(ctr);
    controller.spans.kpiECPM.textContent = formatCurrency(ecpm);
    controller.spans.kpiFillRate.textContent = formatPercent(fillrate);
    controller.spans.kpiAdPressure.textContent = pressure.toFixed(3);
  }

  /**
   * Render charts (throttled)
   */
  function renderCharts(i) {
    if (!controller.run || i === 0) {
      clearCharts();
      return;
    }
    
    // Ensure canvas sizes are correct before drawing
    if (window.Charts && window.Charts.resizeAllCharts) {
      window.Charts.resizeAllCharts();
    }
    
    // Build rolling metrics up to current index
    const revenueData = [];
    const ctrData = [];
    const fillrateData = [];
    const scatterData = [];
    
    const binSize = 100;
    for (let j = 0; j < i; j += binSize) {
      const binEnd = Math.min(j + binSize, i);
      const binEvents = controller.run.events.slice(j, binEnd);
      const binRevenue = binEvents.reduce((sum, e) => sum + (e.revenue || 0), 0);
      revenueData.push({ t: binEnd, value: binRevenue });
    }
    
    for (let j = 9; j < i; j += 10) {
      const windowStart = Math.max(0, j - 99);
      const windowEvents = controller.run.events.slice(windowStart, j + 1);
      const windowImpr = windowEvents.reduce((sum, e) => sum + (e.impressions || 0), 0);
      const windowClicks = windowEvents.reduce((sum, e) => sum + (e.clicks || 0), 0);
      const ctr = windowImpr > 0 ? windowClicks / windowImpr : 0;
      ctrData.push({ t: j + 1, value: ctr });
      
      const windowOpened = windowEvents.reduce((sum, e) => sum + (e.opened_slots || 0), 0);
      const windowFilled = windowEvents.reduce((sum, e) => sum + (e.filled_slots || 0), 0);
      const fillrate = windowOpened > 0 ? windowFilled / windowOpened : 0;
      fillrateData.push({ t: j + 1, value: fillrate });
    }
    
    for (let j = 0; j < i; j += binSize) {
      const binEnd = Math.min(j + binSize, i);
      const binEvents = controller.run.events.slice(j, binEnd);
      const binRevenue = binEvents.reduce((sum, e) => sum + (e.revenue || 0), 0);
      const binImpressions = binEvents.reduce((sum, e) => sum + (e.impressions || 0), 0);
      const binT = binEvents.length;
      const binPressure = binT > 0 ? binImpressions / binT : 0;
      scatterData.push({ pressure: binPressure, revenue: binRevenue });
    }
    
    const revenueCanvas = document.getElementById('chartRevenue');
    if (revenueCanvas && revenueData.length > 0) {
      updateLineChart(revenueCanvas, revenueData, { color: '#2563eb', label: 'Revenue per 100 events' });
    }
    
    const ctrCanvas = document.getElementById('chartCTR');
    if (ctrCanvas && ctrData.length > 0) {
      updateLineChart(ctrCanvas, ctrData, { color: '#16a34a', label: 'CTR (rolling)' });
    }
    
    const fillrateCanvas = document.getElementById('chartFillRate');
    if (fillrateCanvas && fillrateData.length > 0) {
      updateLineChart(fillrateCanvas, fillrateData, { color: '#f59e0b', label: 'FillRate (rolling)' });
    }
    
    const scatterCanvas = document.getElementById('chartScatter');
    if (scatterCanvas && scatterData.length > 0) {
      updateScatter(scatterCanvas, scatterData, {
        color: '#2563eb',
        xLabel: 'AdPressure',
        yLabel: 'Revenue per 100 events'
      });
    }
  }

  /**
   * Clear charts
   */
  function clearCharts() {
    ['chartRevenue', 'chartCTR', 'chartFillRate', 'chartScatter'].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }

  /**
   * Initialize fixed DOM elements
   */
  function initFixedDOM() {
    // Resize charts after initial layout
    setTimeout(() => {
      if (window.Charts && window.Charts.resizeAllCharts) {
        window.Charts.resizeAllCharts();
      }
    }, 100);
    // Create 8 ladder rows
    const ladderContainer = document.getElementById('ladderRows');
    for (let i = 0; i < 8; i++) {
      const row = document.createElement('div');
      row.className = 'arena-ladder__row';
      row.innerHTML = `
        <div class="arena-ladder__col-rank">${i + 1}</div>
        <div class="arena-ladder__col-name">—</div>
        <div class="arena-ladder__col-bid mono">—</div>
        <div class="arena-ladder__col-pctr mono">—</div>
        <div class="arena-ladder__col-quality mono">—</div>
        <div class="arena-ladder__col-score mono">—</div>
        <div class="arena-ladder__col-bar">
          <div class="arena-ladder__bar-fill" style="width: 0%"></div>
        </div>
      `;
      ladderContainer.appendChild(row);
      controller.ladderRows.push(row);
    }
    
    // Create 30 tape rows
    const tapeBody = document.getElementById('auctionTapeBody');
    for (let i = 0; i < 30; i++) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="mono">0</td>
        <td class="mono">0</td>
        <td>—</td>
        <td class="mono">—</td>
        <td class="mono">0</td>
        <td>—</td>
      `;
      row.style.display = 'none';
      tapeBody.appendChild(row);
      controller.tapeRows.push(row);
    }
    
    // Store span references
    controller.spans = {
      clockTime: document.getElementById('clockTime'),
      clockHorizon: document.getElementById('clockHorizon'),
      slotPlacement: document.getElementById('slotPlacement'),
      slotFloor: document.getElementById('slotFloor'),
      slotOpened: document.getElementById('slotOpened'),
      slotFilled: document.getElementById('slotFilled'),
      slotEligible: document.getElementById('slotEligible'),
      slotReason: document.getElementById('slotReason'),
      outcomeWinner: document.getElementById('outcomeWinner'),
      outcomePay: document.getElementById('outcomePay'),
      outcomeImpression: document.getElementById('outcomeImpression'),
      outcomeClick: document.getElementById('outcomeClick'),
      outcomeRevenue: document.getElementById('outcomeRevenue'),
      outcomeCTR: document.getElementById('outcomeCTR'),
      outcomeECPM: document.getElementById('outcomeECPM'),
      kpiRevenue: document.getElementById('kpiRevenue'),
      kpiImpressions: document.getElementById('kpiImpressions'),
      kpiClicks: document.getElementById('kpiClicks'),
      kpiCTR: document.getElementById('kpiCTR'),
      kpiECPM: document.getElementById('kpiECPM'),
      kpiFillRate: document.getElementById('kpiFillRate'),
      kpiAdPressure: document.getElementById('kpiAdPressure')
    };
  }

  /**
   * Update UI controls based on state
   */
  function updateUI() {
    const state = controller.state;
    
    const statusText = {
      'idle': 'Idle',
      'preparing': 'Preparing...',
      'prepared': 'Ready',
      'playing': 'Playing',
      'paused': 'Paused',
      'finished': 'Finished',
      'error': 'Error'
    };
    document.getElementById('clockStatus').textContent = statusText[state] || 'Unknown';
    
    const playBtn = document.getElementById('btnPlay');
    const pauseBtn = document.getElementById('btnPause');
    
    if (state === 'playing') {
      playBtn.classList.add('hidden');
      pauseBtn.classList.remove('hidden');
    } else {
      playBtn.classList.remove('hidden');
      pauseBtn.classList.add('hidden');
    }
    
    const speedText = controller.speed === 'max' ? 'Max' : controller.speed + 'x';
    document.getElementById('clockSpeed').textContent = speedText;
  }

  /**
   * Show error overlay
   */
  function showErrorOverlay(error) {
    const overlay = document.getElementById('errorOverlay');
    const messageEl = document.getElementById('errorMessage');
    const stackEl = document.getElementById('errorStack');
    
    messageEl.textContent = error.message || 'Unknown error';
    stackEl.textContent = error.stack || 'No stack trace available';
    
    overlay.classList.remove('hidden');
  }

  /**
   * Hide error overlay
   */
  function hideErrorOverlay() {
    const overlay = document.getElementById('errorOverlay');
    overlay.classList.add('hidden');
    controller.state = 'idle';
    updateUI();
  }

  /**
   * Initialize UI
   */
  function init() {
    initFixedDOM();
    loadData();
    setupEventListeners();
    loadScenario('baseline');
    updateUI();
    renderUI(0);
  }

  /**
   * Load data files
   */
  async function loadData() {
    try {
      const [scenariosRes, advertisersRes, slotsRes] = await Promise.all([
        fetch('data/scenarios.json'),
        fetch('data/advertisers.json'),
        fetch('data/slots.json')
      ]);

      const scenarios = await scenariosRes.json();
      const advertisers = await advertisersRes.json();
      const slots = await slotsRes.json();

      window.Scenarios.loadScenarios(scenarios);
      window.Scenarios.loadAdvertisers(advertisers);
      window.Scenarios.loadSlots(slots);

      populateScenarioDropdown();
    } catch (error) {
      showErrorOverlay(error);
    }
  }

  /**
   * Populate scenario dropdown
   */
  function populateScenarioDropdown() {
    const select = document.getElementById('scenarioSelect');
    const keys = window.Scenarios.getScenarioKeys();
    
    select.innerHTML = '';
    keys.forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key.replace(/_/g, ' ');
      select.appendChild(option);
    });
  }

  /**
   * Load scenario into UI
   */
  function loadScenario(key) {
    const scenario = window.Scenarios.getScenario(key);
    if (!scenario) return;

    document.getElementById('scenarioSelect').value = key;
    document.getElementById('pricingType').value = scenario.auction.pricing;
    document.getElementById('floorMultiplier').value = scenario.auction.floor_multiplier || 1.0;
    if (scenario.auction.hybrid_alpha !== undefined) {
      document.getElementById('hybridAlpha').value = scenario.auction.hybrid_alpha;
    }
    document.getElementById('fatigueStrength').value = scenario.fatigue.fatigue_strength || 0.5;
    document.getElementById('baselineNoise').value = scenario.fatigue.baseline_noise || 0.01;
    document.getElementById('viewabilityEnabled').checked = scenario.fatigue.viewability_enabled !== false;

    updateAuctionVisibility();
    
    if (controller.run) {
      controller.configHash = null;
    }
  }

  /**
   * Update auction visibility
   */
  function updateAuctionVisibility() {
    const pricing = document.getElementById('pricingType').value;
    document.getElementById('hybridAlphaGroup').classList.toggle('hidden', pricing !== 'hybrid');
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    document.getElementById('scenarioSelect').addEventListener('change', (e) => {
      try {
        loadScenario(e.target.value);
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('pricingType').addEventListener('change', () => {
      try {
        updateAuctionVisibility();
        if (controller.run) {
          controller.configHash = null;
        }
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    ['seedInput', 'horizonEvents', 'hybridAlpha', 'floorMultiplier', 'fatigueStrength', 'baselineNoise', 'viewabilityEnabled'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          try {
            if (controller.run) {
              controller.configHash = null;
            }
          } catch (error) {
            showErrorOverlay(error);
          }
        });
      }
    });

    document.getElementById('btnPlay').addEventListener('click', () => {
      try {
        play();
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('btnPause').addEventListener('click', () => {
      try {
        pause();
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('btnStep').addEventListener('click', () => {
      try {
        step();
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      try {
        reset();
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('speedSelect').addEventListener('change', (e) => {
      try {
        controller.speed = e.target.value === 'max' ? 'max' : parseInt(e.target.value);
        controller.renderEvery = getRenderEvery(controller.speed);
        updateUI();
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('progressSlider').addEventListener('input', (e) => {
      try {
        const newIndex = parseInt(e.target.value);
        seek(newIndex);
      } catch (error) {
        showErrorOverlay(error);
      }
    });

    document.getElementById('errorClose').addEventListener('click', () => {
      hideErrorOverlay();
    });

    window.addEventListener('resize', () => {
      try {
        // Resize canvas backing stores to match new container sizes
        if (window.Charts && window.Charts.resizeAllCharts) {
          window.Charts.resizeAllCharts();
        }
        // Re-render charts after resize
        if (controller.run) {
          setTimeout(() => renderCharts(controller.i), 100);
        }
      } catch (error) {
        showErrorOverlay(error);
      }
    });
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.Controller = controller;
})();
