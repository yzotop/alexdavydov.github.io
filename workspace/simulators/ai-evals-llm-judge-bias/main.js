// Оркестратор.

(function() {

  const barCanvas      = document.getElementById('bar-chart');
  const stratCanvas    = document.getElementById('strategy-chart');

  // Подстраиваем canvas под device pixel ratio.
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }

  function recompute() {
    const params = UI.readParams();
    UI.updateValueDisplays(params);

    // Текущая стратегия
    const result = Sim.simulate(params);
    UI.updateResults(result, params);

    // Bar chart
    Charts.drawBarChart(barCanvas, result, params);

    // Strategy comparison (все 4 стратегии)
    const allResults = Sim.simulateAllStrategies(params);
    Charts.drawStrategyChart(stratCanvas, allResults, params.trueWinRateB);
  }

  function init() {
    fitCanvas(barCanvas);
    fitCanvas(stratCanvas);

    UI.bindEvents(recompute);
    recompute();

    window.addEventListener('resize', () => {
      fitCanvas(barCanvas);
      fitCanvas(stratCanvas);
      recompute();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
