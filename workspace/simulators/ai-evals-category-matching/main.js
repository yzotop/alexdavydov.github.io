// Оркестратор.

(function() {

  const distCanvas = document.getElementById('distribution-chart');
  const precisionCanvas = document.getElementById('precision-chart');

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function recompute() {
    const params = UI.readParams();
    const result = Sim.calc(params);

    UI.updateValueDisplays(params, result);
    UI.updateResults(result);

    Charts.drawDistribution(distCanvas, result.per_segment);
    Charts.drawPrecision(precisionCanvas, result.per_segment);
  }

  function init() {
    fitCanvas(distCanvas);
    fitCanvas(precisionCanvas);

    UI.bindEvents(recompute);
    recompute();

    window.addEventListener('resize', () => {
      fitCanvas(distCanvas);
      fitCanvas(precisionCanvas);
      recompute();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
