// Оркестратор.

(function() {

  const powerCanvas = document.getElementById('power-curve');
  const distCanvas = document.getElementById('distributions');

  // Подстраиваем canvas под device pixel ratio для чёткости.
  // Важно: выставляем физический размер через width/height,
  // а CSS-размер через style — потом сбрасываем width/height
  // обратно в логические пиксели (Canvas работает в логических).
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Устанавливаем физический размер буфера
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    // Масштабируем context на dpr
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    // Возвращаем canvas-атрибуты в логические пиксели
    // чтобы drawPowerCurve/drawDistributions работали в CSS-px
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }

  function recompute() {
    const params = UI.readParams();
    UI.updateValueDisplays(params);

    const result = Sim.calcN(params);
    UI.updateResults(result);

    // Power curve: разумный диапазон до 1.5× N_corrected
    const nMax = Math.max(result.N_corrected * 1.5, 500);
    const points = Sim.getPowerCurve(params, nMax);
    Charts.drawPowerCurve(powerCanvas, points,
                          result.N_corrected, params.power);

    // Распределения
    const distData = Sim.getDistributions(params);
    Charts.drawDistributions(distCanvas, distData);
  }

  function init() {
    fitCanvas(powerCanvas);
    fitCanvas(distCanvas);

    UI.bindEvents(recompute);
    recompute();

    // Перерисовка при изменении размера окна
    window.addEventListener('resize', () => {
      fitCanvas(powerCanvas);
      fitCanvas(distCanvas);
      recompute();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
