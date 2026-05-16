// Math helpers для category matching simulator.

const Utils = {

  // Sample size for proportion estimate with given margin of error.
  // n = (z² × p × (1-p)) / margin²
  // По умолчанию z=1.96 (95% CI), margin=0.03 (±3%)
  sampleSizeForCI: function(p, margin, zScore) {
    margin = margin || 0.03;
    zScore = zScore || 1.96;
    return Math.ceil((zScore * zScore * p * (1 - p)) / (margin * margin));
  },

  // Clamp value to range
  clamp: function(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  // Format percentage with 1 decimal
  fmtPct: function(value) {
    return (value * 100).toFixed(1) + '%';
  },

  // Format pp (percentage points) with sign and 1 decimal
  fmtPP: function(value) {
    const pp = value * 100;
    const sign = pp >= 0 ? '+' : '−';
    return sign + Math.abs(pp).toFixed(1) + ' п.п.';
  },

  // Format integer with thousand separator (Russian)
  fmtInt: function(n) {
    return n.toLocaleString('ru-RU');
  }
};
