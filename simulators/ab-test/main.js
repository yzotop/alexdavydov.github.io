/* main.js — bootstrap, fixed-step sim loop + RAF render loop */
(() => {
  'use strict';

  const U = window.Utils;
  const SimMod = window.Sim;
  const ChartsMod = window.Charts;
  const UIMod = window.UI;
  if (!U || !SimMod || !ChartsMod || !UIMod) throw new Error('deps missing');

  const TICK_DT = 0.05;          // sim-days per tick
  const BASE_SPEED = 0.5;        // sim-days per real-second at 1×
  const MAX_TICKS_PER_FRAME = 20;

  function init() {
    const $ = id => document.getElementById(id);
    const els = {
      statusBadge: $('statusBadge'),
      seedInput: $('seedInput'),
      randomizeSeedBtn: $('randomizeSeedBtn'),
      startPauseBtn: $('startPauseBtn'),
      stepBtn: $('stepBtn'),
      resetBtn: $('resetBtn'),
      // verdict
      vSignificance: $('vSignificance'),
      vDelta: $('vDelta'), vPValue: $('vPValue'), vCI: $('vCI'), vTime: $('vTime'),
      verdictHint: $('verdictHint'),
      // metrics
      mCtrlUsers: $('mCtrlUsers'), mTestUsers: $('mTestUsers'), mTotalUsers: $('mTotalUsers'),
      mCRCtrl: $('mCRCtrl'), mCRTest: $('mCRTest'),
      mDeltaAbs: $('mDeltaAbs'), mDeltaRel: $('mDeltaRel'),
      mPValue: $('mPValue'), mCIWidth: $('mCIWidth'), mZScore: $('mZScore'),
      riskCount: $('riskCount'),
      // charts
      chartMain: $('chartMain'), chartSecondary: $('chartSecondary'),
      secondarySelect: $('secondaryChartSelect'),
      // decision
      decisionZone: $('decisionZone'),
      btnShip: $('btnShip'), btnStop: $('btnStop'), btnWait: $('btnWait'),
      decisionOutcome: $('decisionOutcome'),
      decisionLabel: $('decisionLabel'), decisionTime: $('decisionTime'),
      decisionDetails: $('decisionDetails'),
      btnReveal: $('btnReveal'),
      revealPanel: $('revealPanel'), revealContent: $('revealContent'),
      // risks
      riskImbalance: $('riskImbalance'), riskSpillover: $('riskSpillover'),
      // explanation
      explanationToggle: $('explanationToggle'),
      explanationBody: $('explanationBody'), explanationContent: $('explanationContent'),
      // progress
      progressBar: $('progressBar'), progressText: $('progressText'),
    };

    /* ── Core instances ───────────────────────────────────── */
    const sim = SimMod.createSim('big_early', 42);
    const charts = ChartsMod.createCharts(els.chartMain, els.chartSecondary);
    const ui = UIMod.createUI(els, sim, charts);

    let running = false;
    let acc = 0;
    let speedMul = 0.5;    // default 0.5×
    let lastT = 0;

    function setRunning(r) {
      running = !!r;
      els.startPauseBtn.textContent = running ? '⏸ Pause' : '▶ Start';
      els.statusBadge.textContent = running ? 'Running' : 'Paused';
      els.statusBadge.className = 'badge ' + (running ? 'badge--running' : 'badge--paused');
      if (running) lastT = U.nowPerf();
    }

    function syncRiskToggles() {
      const r = sim.getRisks();
      els.riskImbalance.checked = r.imbalance;
      els.riskSpillover.checked = r.spillover;
    }

    function doReset(scenarioId) {
      const seed = parseInt(els.seedInput.value, 10) || 42;
      sim.reset(scenarioId || undefined, seed);
      acc = 0;
      setRunning(false);
      syncRiskToggles();
      ui.resetDecisionUI();
    }

    /* ── Controls ─────────────────────────────────────────── */
    els.startPauseBtn.addEventListener('click', () => {
      if (sim.getTime() >= sim.MAX_DAYS) return;
      setRunning(!running);
    });

    els.stepBtn.addEventListener('click', () => {
      if (sim.getTime() >= sim.MAX_DAYS) return;
      setRunning(false);
      const ticks = Math.round(1 / TICK_DT);
      for (let i = 0; i < ticks; i++) sim.tick(TICK_DT);
    });

    els.resetBtn.addEventListener('click', () => doReset());
    els.randomizeSeedBtn.addEventListener('click', () => {
      els.seedInput.value = Math.floor(Math.random() * 999999) + 1;
      doReset();
    });
    els.seedInput.addEventListener('change', () => doReset());

    // scenario switcher
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        doReset(btn.dataset.scenario);
      });
    });

    // secondary chart
    els.secondarySelect.addEventListener('change', () => charts.setSecondaryMode(els.secondarySelect.value));

    // decisions
    els.btnShip.addEventListener('click', () => ui.onDecision('ship'));
    els.btnStop.addEventListener('click', () => ui.onDecision('stop'));
    els.btnWait.addEventListener('click', () => ui.onDecision('wait'));
    els.btnReveal.addEventListener('click', () => ui.onReveal());

    // risk toggles
    els.riskImbalance.addEventListener('change', () => sim.setRisk('imbalance', els.riskImbalance.checked));
    els.riskSpillover.addEventListener('change', () => sim.setRisk('spillover', els.riskSpillover.checked));

    // explanation drawer
    els.explanationToggle.addEventListener('click', () => {
      const open = els.explanationBody.style.display !== 'none';
      els.explanationBody.style.display = open ? 'none' : '';
      els.explanationToggle.querySelector('.chevron').textContent = open ? '▸' : '▾';
    });

    // speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        speedMul = parseFloat(btn.dataset.speed);
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    /* ── RAF loop ─────────────────────────────────────────── */
    function frame() {
      const now = U.nowPerf();
      if (running) {
        const dtReal = Math.min((now - lastT) / 1000, 0.1);
        acc += dtReal * BASE_SPEED * speedMul;

        let ticks = 0;
        while (acc >= TICK_DT && ticks < MAX_TICKS_PER_FRAME) {
          sim.tick(TICK_DT);
          acc -= TICK_DT;
          ticks++;
        }
        if (ticks >= MAX_TICKS_PER_FRAME) acc = 0;

        if (sim.getTime() >= sim.MAX_DAYS) {
          setRunning(false);
          ui.showRevealButton();
          if (!sim.getDecision()) {
            sim.makeDecision('wait');
            ui.onDecision('wait');
            ui.showRevealButton();
          }
        }
      }
      lastT = now;

      const s = sim.stats();
      ui.updateVerdictBar(s);
      ui.updateMetrics(s);
      ui.updateDecisionZone(s);

      const decTime = sim.getDecision() ? sim.getDecision().time : null;
      charts.renderMain(sim.getSeries(), decTime);
      charts.renderSecondary(sim.getSeries(), decTime);

      const pct = Math.min(100, (sim.getTime() / sim.MAX_DAYS) * 100);
      els.progressBar.style.width = pct + '%';
      els.progressText.textContent = U.fmtDayHour(sim.getTime()) + ' / Day 30';

      requestAnimationFrame(frame);
    }

    doReset('big_early');
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
