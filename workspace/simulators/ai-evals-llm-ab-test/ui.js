// DOM-events: слайдеры, пресеты.

const UI = {

  // Конфигурация пресетов.
  presets: {
    'min': {
      effect: 0.05, variance: 1.20, stochasticity: 0.30,
      power: 0.80, alpha: 0.05
    },
    'realistic': {
      effect: 0.15, variance: 1.20, stochasticity: 0.30,
      power: 0.80, alpha: 0.05
    },
    'large': {
      effect: 0.30, variance: 1.20, stochasticity: 0.30,
      power: 0.80, alpha: 0.05
    }
  },

  // Получить текущие значения слайдеров.
  readParams: function() {
    return {
      effect: parseFloat(document.getElementById('effect-slider').value),
      variance: parseFloat(document.getElementById('variance-slider').value),
      stochasticity: parseFloat(document.getElementById('stochasticity-slider').value),
      power: parseFloat(document.getElementById('power-slider').value),
      alpha: parseFloat(document.getElementById('alpha-slider').value)
    };
  },

  // Обновить отображаемые значения рядом со слайдерами.
  updateValueDisplays: function(params) {
    document.getElementById('effect-value').textContent =
      params.effect.toFixed(2);
    document.getElementById('variance-value').textContent =
      params.variance.toFixed(2);
    document.getElementById('stochasticity-value').textContent =
      params.stochasticity.toFixed(2);
    document.getElementById('power-value').textContent =
      params.power.toFixed(2);
    document.getElementById('alpha-value').textContent =
      params.alpha.toFixed(3);
  },

  // Обновить главную цифру и сравнение.
  updateResults: function(result) {
    document.getElementById('n-corrected').textContent =
      result.N_corrected.toLocaleString('ru-RU');
    document.getElementById('n-naive').textContent =
      result.N_naive.toLocaleString('ru-RU');
    document.getElementById('multiplier').textContent =
      '×' + result.multiplier.toFixed(2);
  },

  // Применить пресет.
  applyPreset: function(presetName) {
    const preset = UI.presets[presetName];
    if (!preset) return;

    document.getElementById('effect-slider').value = preset.effect;
    document.getElementById('variance-slider').value = preset.variance;
    document.getElementById('stochasticity-slider').value = preset.stochasticity;
    document.getElementById('power-slider').value = preset.power;
    document.getElementById('alpha-slider').value = preset.alpha;
  },

  // Привязать обработчики.
  bindEvents: function(onChange) {
    const sliders = [
      'effect-slider', 'variance-slider', 'stochasticity-slider',
      'power-slider', 'alpha-slider'
    ];
    sliders.forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', onChange);
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetName = btn.dataset.preset;
        UI.applyPreset(presetName);
        onChange();
      });
    });
  }
};
