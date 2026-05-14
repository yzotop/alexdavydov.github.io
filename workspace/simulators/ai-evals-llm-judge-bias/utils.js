// Вспомогательные функции: random, normal approximation.

const Utils = {

  // Seeded-random не нужен — просто Math.random() достаточно
  // для Monte Carlo с усреднением.

  // Нормальное распределение CDF (Abramowitz & Stegun 7.1.26)
  normalCDF: function(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const poly = t * (0.319381530
      + t * (-0.356563782
      + t * (1.781477937
      + t * (-1.821255978
      + t * 1.330274429))));
    const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    const cdf = 1 - pdf * poly;
    return x >= 0 ? cdf : 1 - cdf;
  },

  // Нормальное распределение PDF
  normalPDF: function(x, mu, sigma) {
    const z = (x - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
  },

  // Биномиальный 95% confidence interval (Wilson score interval)
  // p — sample proportion, n — sample size
  // Возвращает [lo, hi]
  wilsonCI: function(p, n, z) {
    if (z === undefined) z = 1.96; // 95%
    const center = (p + z * z / (2 * n)) / (1 + z * z / n);
    const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
                   / (1 + z * z / n);
    return [
      Math.max(0, center - margin),
      Math.min(1, center + margin)
    ];
  }
};
