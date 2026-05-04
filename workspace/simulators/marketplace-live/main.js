/* main.js — bootstrap, fixed-step sim loop + RAF render loop */

(() => {
  'use strict';

  const U = window.Utils;
  const Marketplace = window.Marketplace;
  const Render = window.Render;
  const UI = window.UI;
  const Charts = window.Charts;
  if (!U || !Marketplace || !Render || !UI || !Charts) throw new Error('Dependencies missing: utils/marketplace/render/ui/charts');

  const FIXED_DT = 0.1; // 10Hz simulation

  function init() {
    const els = {
      // topbar
      statusBadge: document.getElementById('statusBadge'),
      seedInput: document.getElementById('seedInput'),
      randomizeSeedBtn: document.getElementById('randomizeSeedBtn'),
      startPauseBtn: document.getElementById('startPauseBtn'),
      resetBtn: document.getElementById('resetBtn'),

      // center
      mainCanvas: document.getElementById('mainCanvas'),
      capBadge: document.getElementById('capBadge'),
      simTime: document.getElementById('simTime'),
      activeBuyers: document.getElementById('activeBuyers'),
      queueLen: document.getElementById('queueLen'),
      fps: document.getElementById('fps'),
      simHz: document.getElementById('simHz'),
    };

    // Basic DOM guards
    const required = ['mainCanvas', 'seedInput', 'startPauseBtn', 'resetBtn', 'statusBadge'];
    for (const k of required) {
      if (!els[k]) throw new Error(`Missing required element: ${k}`);
    }

    // Create core instances
    const seed = Math.max(1, Math.min(999999999, Math.trunc(Number(els.seedInput.value) || 42)));
    const sim = Marketplace.createMarketplace(seed);
    const renderer = Render.createRenderer({ mainCanvas: els.mainCanvas });
    const ui = UI.createUI({ sim, renderer, elements: els });
    
    // Set initial view mode
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect && renderer.setViewMode) {
      renderer.setViewMode(viewModeSelect.value || 'learn');
    }

    Charts.initCharts();

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

    els.seedInput.addEventListener('change', () => {
      const s = Math.max(1, Math.min(999999999, Math.trunc(Number(els.seedInput.value) || 42)));
      els.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
      acc = 0;
    });

    els.randomizeSeedBtn.addEventListener('click', () => {
      const s = Math.floor(Math.random() * 999999999) + 1;
      els.seedInput.value = String(s);
      sim.setSeed(s);
      sim.reset();
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
      els.fps.textContent = Number.isFinite(fpsEma) ? fpsEma.toFixed(0) : '—';

      if (running) {
        acc += dtFrame;
        // cap accumulator to avoid spiral of death
        acc = Math.min(acc, 0.6);
        while (acc >= FIXED_DT) {
          sim.step(FIXED_DT);
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

      // Update charts
      Charts.updateCharts(sim.ts);

      // Update footer
      els.simTime.textContent = U.formatSeconds(sim.time);
      els.activeBuyers.textContent = String(sim.buyers.length);
      els.queueLen.textContent = String(sim.delivery_queue.length);

      requestAnimationFrame(frame);
    }

    frame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
