/* main.js — bootstrap, fixed-step sim loop + RAF render loop */

(() => {
  'use strict';

  const U = window.Utils;
  const SimMod = window.Sim;
  const ChartsMod = window.Charts;
  const UIMod = window.UI;
  if (!U || !SimMod || !ChartsMod || !UIMod) throw new Error('Dependencies missing: utils/sim/charts/ui');

  const FIXED_DT = 0.1; // 10Hz simulation

  function init() {
    const els = {
      // topbar
      statusBadge: document.getElementById('statusBadge'),
      seedInput: document.getElementById('seedInput'),
      randomizeSeedBtn: document.getElementById('randomizeSeedBtn'),
      startPauseBtn: document.getElementById('startPauseBtn'),
      resetBtn: document.getElementById('resetBtn'),

      // left controls containers
      controlsTraffic: document.getElementById('controlsTraffic'),
      controlsPolicy: document.getElementById('controlsPolicy'),
      controlsFatigue: document.getElementById('controlsFatigue'),
      controlsMonetization: document.getElementById('controlsMonetization'),

      // center
      topSummary: document.getElementById('topSummary'),
      simTime: document.getElementById('simTime'),
      activeUsers: document.getElementById('activeUsers'),
      fps: document.getElementById('fps'),
      simHz: document.getElementById('simHz'),

      // right metrics
      mRevenue: document.getElementById('mRevenue'),
      mImpressions: document.getElementById('mImpressions'),
      mCPM: document.getElementById('mCPM'),
      mFatigue: document.getElementById('mFatigue'),
      mActiveUsers: document.getElementById('mActiveUsers'),
      mAdRate: document.getElementById('mAdRate'),
      mCTR: document.getElementById('mCTR'),
      mEarlyExit: document.getElementById('mEarlyExit'),

      // chart canvases
      chartRevenue: document.getElementById('chartRevenue'),
      chartImpressions: document.getElementById('chartImpressions'),
      chartFatigue: document.getElementById('chartFatigue'),
      chartScatter: document.getElementById('chartScatter'),
    };

    // Basic DOM guards
    const required = ['seedInput', 'startPauseBtn', 'resetBtn', 'statusBadge'];
    for (const k of required) {
      if (!els[k]) throw new Error(`Missing required element: ${k}`);
    }

    // Create core instances
    const sim = SimMod.createSim(42);
    const charts = ChartsMod.createCharts({
      revenue: els.chartRevenue,
      impressions: els.chartImpressions,
      fatigue: els.chartFatigue,
      scatter: els.chartScatter,
    });
    const ui = UIMod.createUI({ sim, charts, elements: els });

    // runtime state
    let running = false;
    let acc = 0;

    // fps / simHz measurement
    let lastFrameT = U.nowPerf();
    let fpsEma = 0;
    let simSteps = 0;
    let simMeasureAcc = 0;

    function setRunning(next) {
      running = !!next;
      els.statusBadge.textContent = running ? 'Running' : 'Paused';
      els.statusBadge.className = running ? 'badge badge--ok' : 'badge badge--warn';
      els.startPauseBtn.textContent = running ? 'Pause' : 'Start';
    }

    els.startPauseBtn.addEventListener('click', () => setRunning(!running));
    els.resetBtn.addEventListener('click', () => {
      sim.reset();
      charts.reset(); // Reset saturation marker
      acc = 0;
    });

    // Start paused but render initial state
    sim.reset();
    setRunning(false);

    function frame() {
      const now = U.nowPerf();
      const dtFrame = Math.min(0.05, Math.max(0, (now - lastFrameT) / 1000));
      lastFrameT = now;

      // fps
      const instFps = dtFrame > 1e-6 ? (1 / dtFrame) : 0;
      fpsEma = fpsEma ? U.ema(fpsEma, instFps, 0.08) : instFps;
      if (els.fps) els.fps.textContent = Number.isFinite(fpsEma) ? fpsEma.toFixed(0) : '—';

      if (running) {
        acc += dtFrame;
        acc = Math.min(acc, 0.6);
        while (acc >= FIXED_DT) {
          sim.tick(FIXED_DT);
          acc -= FIXED_DT;
          simSteps++;
          simMeasureAcc += FIXED_DT;
        }
      }

      // sim Hz (measured)
      if (simMeasureAcc >= 1.0) {
        const hz = simSteps / simMeasureAcc;
        if (els.simHz) els.simHz.textContent = Number.isFinite(hz) ? `${hz.toFixed(0)} Hz` : '—';
        simSteps = 0;
        simMeasureAcc = 0;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      init();
    } catch (err) {
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.padding = '16px';
      pre.style.margin = '16px';
      pre.style.borderRadius = '12px';
      pre.style.border = '1px solid rgba(251,113,133,0.6)';
      pre.style.background = 'rgba(251,113,133,0.12)';
      pre.style.color = '#fee2e2';
      pre.textContent = String(err && err.stack ? err.stack : err);
      document.body.appendChild(pre);
      throw err;
    }
  });
})();
