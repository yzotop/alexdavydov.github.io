// Power analysis для two-sample t-test
// с поправкой на stochasticity модели.

const Sim = {

  // Главный расчёт: N per arm.
  // params: { effect, variance, stochasticity, power, alpha }
  calcN: function(params) {
    const z_alpha = Utils.zAlpha(params.alpha);
    const z_beta = Utils.zBeta(params.power);

    // Базовая variance (между диалогами).
    const sigma2_base = params.variance;

    // Variance с поправкой на stochasticity.
    // stochasticity_share s ∈ [0, 1):
    //   total_var = base_var / (1 - s)
    // При s=0 — то же что naive. При s=0.5 — в 2× больше.
    const sigma2_total = sigma2_base / (1 - params.stochasticity);

    const factor = 2 * Math.pow(z_alpha + z_beta, 2);

    const N_naive = factor * sigma2_base / Math.pow(params.effect, 2);
    const N_corrected = factor * sigma2_total / Math.pow(params.effect, 2);

    return {
      N_naive: Math.ceil(N_naive),
      N_corrected: Math.ceil(N_corrected),
      multiplier: N_corrected / N_naive,
      sigma2_base: sigma2_base,
      sigma2_total: sigma2_total
    };
  },

  // Power curve: power as function of N.
  // Возвращает [{n, powerNaive, powerCorrected}, ...]
  getPowerCurve: function(params, nMax) {
    const z_alpha = Utils.zAlpha(params.alpha);
    const sigma2_base = params.variance;
    const sigma2_total = sigma2_base / (1 - params.stochasticity);

    const points = [];
    const numPoints = 60;
    const nStart = 50;

    for (let i = 0; i < numPoints; i++) {
      const n = nStart + ((nMax - nStart) * i) / (numPoints - 1);

      // Power = P(|Z| > z_alpha | H1 true)
      // = 1 - Φ(z_alpha - Δ/SE)   (для positive effect)
      // SE = sqrt(2 * sigma² / n)

      const se_naive = Math.sqrt(2 * sigma2_base / n);
      const se_corrected = Math.sqrt(2 * sigma2_total / n);

      const ncp_naive = params.effect / se_naive;
      const ncp_corrected = params.effect / se_corrected;

      const powerNaive = 1 - Utils.normalCDF(z_alpha - ncp_naive);
      const powerCorrected = 1 - Utils.normalCDF(z_alpha - ncp_corrected);

      points.push({
        n: Math.round(n),
        powerNaive: powerNaive,
        powerCorrected: powerCorrected
      });
    }

    return points;
  },

  // Distributions для визуализации CSAT.
  // Возвращает {xs, pdfA, pdfB} — два нормальных распределения.
  getDistributions: function(params) {
    const sigma2_total = params.variance / (1 - params.stochasticity);
    const sigma = Math.sqrt(sigma2_total);

    // Centered around CSAT = 4.0 (типичный baseline)
    const muA = 4.0;
    const muB = 4.0 - params.effect;

    // Range: [1, 5] — CSAT scale
    const xs = [];
    const pdfA = [];
    const pdfB = [];

    const numPoints = 100;
    const xMin = 1.0;
    const xMax = 5.0;

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + ((xMax - xMin) * i) / (numPoints - 1);
      xs.push(x);
      pdfA.push(Utils.normalPDF(x, muA, sigma));
      pdfB.push(Utils.normalPDF(x, muB, sigma));
    }

    return { xs, pdfA, pdfB, muA, muB, sigma };
  }
};
