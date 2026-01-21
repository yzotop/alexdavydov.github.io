/* main.js
   Bootstrap + main loop glue:
   - Creates sim, renderer, UI
   - Runs requestAnimationFrame render loop
   - Runs fixed-step sim at ~10–20Hz (configurable constant)
*/

(() => {
  'use strict';

  const U = window.Utils;
  const Sim = window.Sim;
  const Render = window.Render;
  const UI = window.UI;
  if (!U || !Sim || !Render || !UI) throw new Error('Missing modules: utils/sim/render/ui must be loaded before main');

  const FIXED_DT = 0.1; // seconds (10Hz). Render is 60fps.
  const MAX_STEPS_PER_FRAME = 6; // avoid spiral of death

  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element: #${id}`);
    return el;
  }

  function init() {
    const cityCanvas = byId('cityCanvas');
    const canvases = {
      cityCanvas,
      charts: {
        revenue: byId('chartRevenue'),
        p90eta: byId('chartP90Eta'),
        cancel: byId('chartCancel'),
        util: byId('chartUtil'),
      },
    };

    const elements = {
      // controls containers
      controlsDemandSupply: byId('controlsDemandSupply'),
      controlsPricingBehavior: byId('controlsPricingBehavior'),
      controlsCityZones: byId('controlsCityZones'),
      controlsPolicy: byId('controlsPolicy'),

      // top bar
      seedInput: byId('seedInput'),
      randomizeSeedBtn: byId('randomizeSeedBtn'),
      startPauseBtn: byId('startPauseBtn'),
      resetBtn: byId('resetBtn'),

      // badges
      simStatusBadge: byId('simStatusBadge'),
      ordersCapBadge: byId('ordersCapBadge'),

      // footer stats
      simTime: byId('simTime'),
      activeOrders: byId('activeOrders'),
      activeDrivers: byId('activeDrivers'),
      fps: byId('fps'),
      simHz: byId('simHz'),

      // metrics
      mTripsPerMin: byId('mTripsPerMin'),
      mAvgEta: byId('mAvgEta'),
      mP90Eta: byId('mP90Eta'),
      mCancelRate: byId('mCancelRate'),
      mUtil: byId('mUtil'),
      mGMVPerMin: byId('mGMVPerMin'),
      mPlatRevPerMin: byId('mPlatRevPerMin'),
      mDriverEarnPerMin: byId('mDriverEarnPerMin'),
      mAvgSurge: byId('mAvgSurge'),

      // chart now labels
      cRevenueNow: byId('cRevenueNow'),
      cP90EtaNow: byId('cP90EtaNow'),
      cCancelNow: byId('cCancelNow'),
      cUtilNow: byId('cUtilNow'),
    };

    const seed = Math.max(1, Math.min(999999999, Math.trunc(Number(elements.seedInput.value) || 42)));
    const sim = Sim.createSim({ seed });
    const renderer = Render.createRenderer(canvases);
    const ui = UI.createUI({ sim, renderer, elements });

    // Ensure canvases are sized once
    renderer.resizeCityToContainer();
    renderer.resizeChartsToContainer();

    // Trigger an initial metrics/charts paint with the current seed/config.
    // (reset is deterministic due to re-seeding RNG inside sim.reset()).
    sim.reset();

    // Simulation loop control
    let running = false;
    let acc = 0;
    let lastT = U.nowPerf();

    // rolling sim Hz estimate
    let simStepsAcc = 0;
    let simHz = 0;
    let simHzTimer = 0;

    function setStatus(ok, text) {
      elements.simStatusBadge.classList.toggle('badge--ok', ok);
      elements.simStatusBadge.classList.toggle('badge--danger', !ok);
      elements.simStatusBadge.textContent = text;
    }

    function setRunning(next) {
      running = !!next;
      elements.startPauseBtn.textContent = running ? 'Pause' : 'Start';
      setStatus(true, running ? 'Running' : 'Paused');
    }

    elements.startPauseBtn.addEventListener('click', () => setRunning(!running));
    elements.resetBtn.addEventListener('click', () => {
      sim.reset();
      setStatus(true, running ? 'Running' : 'Paused');
    });

    // pause when tab hidden (keeps determinism reasonable and avoids huge dt jumps)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) setRunning(false);
    });

    function frame() {
      const t = U.nowPerf();
      let dtFrameSec = (t - lastT) / 1000;
      lastT = t;
      dtFrameSec = Math.max(0, Math.min(0.25, dtFrameSec));

      // Resize on layout changes (cheap checks)
      if (frame._resizeCountdown == null) frame._resizeCountdown = 0;
      frame._resizeCountdown += dtFrameSec;
      if (frame._resizeCountdown >= 0.5) {
        frame._resizeCountdown = 0;
        renderer.resizeCityToContainer();
        renderer.resizeChartsToContainer();
      }

      if (running) {
        acc += dtFrameSec;
        let steps = 0;
        while (acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
          sim.tick(FIXED_DT);
          acc -= FIXED_DT;
          steps++;
          simStepsAcc++;
          simHzTimer += FIXED_DT;
        }
        if (simHzTimer >= 1.0) {
          simHz = U.ema(simHz, simStepsAcc / simHzTimer, 0.35);
          simStepsAcc = 0;
          simHzTimer = 0;
        }
      }

      // Draw city at render FPS
      const fps = renderer.drawCity(sim, {
        showZoneBorders: sim.cfg.showZoneBorders,
        showDemandHeat: sim.cfg.showDemandHeat,
        showSurgeHeat: sim.cfg.showSurgeHeat,
      }, dtFrameSec);

      elements.fps.textContent = Number.isFinite(fps) ? fps.toFixed(0) : '—';
      elements.simHz.textContent = Number.isFinite(simHz) ? `${simHz.toFixed(1)}Hz` : '—';

      requestAnimationFrame(frame);
    }

    setRunning(false);
    requestAnimationFrame(frame);

    // Initial UI refresh is driven by sim.onSecond flush; force one flush on startup
    // (sim.reset already flushed once).
    setStatus(true, 'Ready');
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      init();
    } catch (err) {
      // Hard failure: render minimal error in DOM.
      const msg = (err && err.stack) ? String(err.stack) : String(err);
      document.body.innerHTML = `<pre style="padding:16px; white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color:#111; background:#fff;">${msg}</pre>`;
    }
  });
})();

