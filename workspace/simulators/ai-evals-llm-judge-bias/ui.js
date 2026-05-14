// DOM-events: слайдеры, radio-кнопки стратегии, обновление display.

const UI = {

  // Получить текущие значения всех контролов.
  readParams: function() {
    const strategy = document.querySelector('input[name="strategy"]:checked');
    return {
      trueWinRateB: parseFloat(document.getElementById('winrate-slider').value),
      biasStrength: parseFloat(document.getElementById('bias-slider').value),
      judgeAccuracy: parseFloat(document.getElementById('accuracy-slider').value),
      n: parseInt(document.getElementById('n-slider').value, 10),
      strategy: strategy ? strategy.value : 'always_A_first'
    };
  },

  // Обновить числовые отображения рядом со слайдерами.
  updateValueDisplays: function(params) {
    document.getElementById('winrate-value').textContent =
      params.trueWinRateB.toFixed(2);
    document.getElementById('bias-value').textContent =
      params.biasStrength.toFixed(2);
    document.getElementById('accuracy-value').textContent =
      params.judgeAccuracy.toFixed(2);
    document.getElementById('n-value').textContent =
      params.n.toString();
  },

  // Обновить блок winrate-display.
  updateResults: function(result, params) {
    // True win rate (зелёный, фиксирован)
    document.getElementById('true-winrate').textContent =
      (params.trueWinRateB * 100).toFixed(1) + '%';

    // Estimated win rate (синий, большой)
    document.getElementById('est-winrate').textContent =
      (result.winRateB * 100).toFixed(1) + '%';

    // Bias display
    const biasEl = document.getElementById('bias-display');
    const biasVal = result.biasInEstimate;
    const sign = biasVal >= 0 ? '+' : '';
    biasEl.textContent = sign + (biasVal * 100).toFixed(1) + ' п.п.';

    // Цвет bias: красный если |bias| > 5 п.п., зелёный если ок
    biasEl.classList.remove('is-biased', 'is-ok');
    if (Math.abs(biasVal) > 0.05) {
      biasEl.classList.add('is-biased');
    } else {
      biasEl.classList.add('is-ok');
    }

    // Tie rate (показываем всегда, прячем строку если не mirror)
    const tieRow = document.getElementById('tie-row');
    const tieEl = document.getElementById('tie-display');

    if (params.strategy === 'mirror_both') {
      tieRow.style.display = '';
      tieEl.textContent = (result.tieRate * 100).toFixed(1) + '%';
    } else {
      tieRow.style.display = 'none';
    }
  },

  // Привязать обработчики событий.
  bindEvents: function(onChange) {
    // Слайдеры
    ['winrate-slider', 'bias-slider', 'accuracy-slider', 'n-slider']
      .forEach(id => {
        document.getElementById(id).addEventListener('input', onChange);
      });

    // Radio-кнопки стратегии
    document.querySelectorAll('input[name="strategy"]')
      .forEach(el => {
        el.addEventListener('change', onChange);
      });
  }
};
