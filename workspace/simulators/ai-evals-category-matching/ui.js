// DOM events + presets.

const UI = {

  presets: {
    'balanced': {
      golden_electronics: 0.30, golden_fashion: 0.35,
      golden_long_tail: 0.20,
      precision_electronics: 0.94, precision_fashion: 0.76,
      precision_long_tail: 0.52,
      prod_electronics: 0.30, prod_fashion: 0.35,
      prod_long_tail: 0.20
    },
    'typical': {
      golden_electronics: 0.45, golden_fashion: 0.30,
      golden_long_tail: 0.05,
      precision_electronics: 0.94, precision_fashion: 0.76,
      precision_long_tail: 0.52,
      prod_electronics: 0.30, prod_fashion: 0.35,
      prod_long_tail: 0.20
    },
    'severe': {
      golden_electronics: 0.65, golden_fashion: 0.20,
      golden_long_tail: 0.05,
      precision_electronics: 0.94, precision_fashion: 0.76,
      precision_long_tail: 0.52,
      prod_electronics: 0.25, prod_fashion: 0.40,
      prod_long_tail: 0.20
    }
  },

  readParams: function() {
    return {
      golden_electronics: parseFloat(document.getElementById('golden-electronics-slider').value),
      golden_fashion: parseFloat(document.getElementById('golden-fashion-slider').value),
      golden_long_tail: parseFloat(document.getElementById('golden-long-tail-slider').value),
      precision_electronics: parseFloat(document.getElementById('precision-electronics-slider').value),
      precision_fashion: parseFloat(document.getElementById('precision-fashion-slider').value),
      precision_long_tail: parseFloat(document.getElementById('precision-long-tail-slider').value),
      prod_electronics: parseFloat(document.getElementById('prod-electronics-slider').value),
      prod_fashion: parseFloat(document.getElementById('prod-fashion-slider').value),
      prod_long_tail: parseFloat(document.getElementById('prod-long-tail-slider').value)
    };
  },

  updateValueDisplays: function(params, result) {
    document.getElementById('golden-electronics-value').textContent = params.golden_electronics.toFixed(2);
    document.getElementById('golden-fashion-value').textContent = params.golden_fashion.toFixed(2);
    document.getElementById('golden-long-tail-value').textContent = params.golden_long_tail.toFixed(2);
    document.getElementById('precision-electronics-value').textContent = params.precision_electronics.toFixed(2);
    document.getElementById('precision-fashion-value').textContent = params.precision_fashion.toFixed(2);
    document.getElementById('precision-long-tail-value').textContent = params.precision_long_tail.toFixed(2);
    document.getElementById('prod-electronics-value').textContent = params.prod_electronics.toFixed(2);
    document.getElementById('prod-fashion-value').textContent = params.prod_fashion.toFixed(2);
    document.getElementById('prod-long-tail-value').textContent = params.prod_long_tail.toFixed(2);

    // Food remainder displays
    document.getElementById('golden-food-display').textContent =
      Math.max(0, result.golden_food).toFixed(2);
    document.getElementById('prod-food-display').textContent =
      Math.max(0, result.prod_food).toFixed(2);
  },

  updateResults: function(result) {
    document.getElementById('naive-overall').textContent = Utils.fmtPct(result.naive_overall);
    document.getElementById('production-weighted').textContent = Utils.fmtPct(result.production_weighted);
    document.getElementById('gap-value').textContent = Utils.fmtPP(-result.gap);
  },

  applyPreset: function(name) {
    const preset = UI.presets[name];
    if (!preset) return;
    Object.keys(preset).forEach(key => {
      const slider = document.getElementById(key.replace(/_/g, '-') + '-slider');
      if (slider) slider.value = preset[key];
    });
  },

  bindEvents: function(onChange) {
    const sliders = [
      'golden-electronics-slider', 'golden-fashion-slider', 'golden-long-tail-slider',
      'precision-electronics-slider', 'precision-fashion-slider', 'precision-long-tail-slider',
      'prod-electronics-slider', 'prod-fashion-slider', 'prod-long-tail-slider'
    ];
    sliders.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', onChange);
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.applyPreset(btn.dataset.preset);
        onChange();
      });
    });
  }
};
