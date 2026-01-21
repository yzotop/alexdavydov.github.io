/* main.js — bootstrap, fixed-step sim loop + RAF render loop */

(() => {
  'use strict';

  const U = window.Utils;
  const SimMod = window.Sim;
  const RenderMod = window.Render;
  const UIMod = window.UI;
  if (!U || !SimMod || !RenderMod || !UIMod) throw new Error('Dependencies missing: utils/sim/render/ui');

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
      controlsPressure: document.getElementById('controlsPressure'),
      controlsAuction: document.getElementById('controlsAuction'),
      controlsFatigue: document.getElementById('controlsFatigue'),
      controlsDisplay: document.getElementById('controlsDisplay'),

      // center
      mainCanvas: document.getElementById('mainCanvas'),
      capBadge: document.getElementById('capBadge'),
      simTime: document.getElementById('simTime'),
      activeUsers: document.getElementById('activeUsers'),
      fps: document.getElementById('fps'),
      simHz: document.getElementById('simHz'),

      // right metrics
      mActiveUsers: document.getElementById('mActiveUsers'),
      mImprPerMin: document.getElementById('mImprPerMin'),
      mAdRate: document.getElementById('mAdRate'),
      mFill: document.getElementById('mFill'),
      mNoImprPolicy: document.getElementById('mNoImprPolicy'),
      mNoImprFloor: document.getElementById('mNoImprFloor'),
      mNoImprCaps: document.getElementById('mNoImprCaps'),
      mCPM: document.getElementById('mCPM'),
      mRevPub: document.getElementById('mRevPub'),
      mRevPlat: document.getElementById('mRevPlat'),
      mSpend: document.getElementById('mSpend'),
      mCTR: document.getElementById('mCTR'),
      mFatigue: document.getElementById('mFatigue'),
      mEnds: document.getElementById('mEnds'),
      mEarlyShare: document.getElementById('mEarlyShare'),
      mAvgSessionTime: document.getElementById('mAvgSessionTime'),

      // chart "now" labels
      cRevNow: document.getElementById('cRevNow'),
      cImprNow: document.getElementById('cImprNow'),
      cCPMNow: document.getElementById('cCPMNow'),
      cFatNow: document.getElementById('cFatNow'),

      // chart canvases
      chartRevenue: document.getElementById('chartRevenue'),
      chartImpr: document.getElementById('chartImpr'),
      chartCPM: document.getElementById('chartCPM'),
      chartFatigue: document.getElementById('chartFatigue'),
    };

    // Basic DOM guards
    const required = ['mainCanvas', 'seedInput', 'startPauseBtn', 'resetBtn', 'statusBadge'];
    for (const k of required) {
      if (!els[k]) throw new Error(`Missing required element: ${k}`);
    }

    // Create core instances
    const sim = SimMod.createSim(42);
    const renderer = RenderMod.createRenderer({
      mainCanvas: els.mainCanvas,
      chartCanvases: {
        revenue: els.chartRevenue,
        impr: els.chartImpr,
        cpm: els.chartCPM,
        fatigue: els.chartFatigue,
      },
    });
    const ui = UIMod.createUI({ sim, renderer, elements: els });

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
      acc = 0;
    });

    // Start paused but render initial state and seed charts
    sim.reset();
    setRunning(false);

    function frame() {
      const now = U.nowPerf();
      const dtFrame = Math.min(0.05, Math.max(0, (now - lastFrameT) / 1000));
      lastFrameT = now;

      // fps
      const instFps = dtFrame > 1e-6 ? (1 / dtFrame) : 0;
      fpsEma = fpsEma ? U.ema(fpsEma, instFps, 0.08) : instFps;
      els.fps.textContent = Number.isFinite(fpsEma) ? fpsEma.toFixed(0) : '—';

      if (running) {
        acc += dtFrame;
        // cap accumulator to avoid spiral of death
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
        els.simHz.textContent = Number.isFinite(hz) ? `${hz.toFixed(0)} Hz` : '—';
        simSteps = 0;
        simMeasureAcc = 0;
      }

      // draw
      const alpha = U.clamp(acc / FIXED_DT, 0, 1);
      renderer.draw(sim, alpha, dtFrame);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      init();
    } catch (err) {
      // visible fallback for static hosting / file://
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

