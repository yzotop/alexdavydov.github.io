// Stats helpers: normal CDF, two-proportion z-test, Welch t-test, and simple CIs.
// All functions are deterministic and dependency-free.

const SQRT2 = Math.sqrt(2);
const Z_975 = 1.959963984540054; // ~invNorm(0.975)

/**
 * erf approximation (Abramowitz & Stegun 7.1.26).
 * @param {number} x
 */
export function erf(x) {
  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  // Coefficients
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * ax);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-ax * ax);

  return sign * y;
}

/**
 * Standard normal CDF.
 * @param {number} x
 */
export function normalCdf(x) {
  return 0.5 * (1 + erf(x / SQRT2));
}

/**
 * Two-sided p-value for z statistic.
 * @param {number} z
 */
export function pValueFromZTwoSided(z) {
  const az = Math.abs(z);
  return 2 * (1 - normalCdf(az));
}

/**
 * Two-proportion z-test with pooled variance.
 * @param {number} x1
 * @param {number} n1
 * @param {number} x2
 * @param {number} n2
 */
export function zTestTwoProportions(x1, n1, x2, n2) {
  if (!(n1 > 0) || !(n2 > 0)) return { z: 0, pValue: 1, p1: 0, p2: 0 };
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, pValue: 1, p1, p2 };
  const z = (p2 - p1) / se;
  return { z, pValue: pValueFromZTwoSided(z), p1, p2 };
}

/**
 * Difference-in-proportions CI: (p2 - p1) ± z * sqrt(p1(1-p1)/n1 + p2(1-p2)/n2)
 * @param {number} x1
 * @param {number} n1
 * @param {number} x2
 * @param {number} n2
 */
export function ciDiffProportions95(x1, n1, x2, n2) {
  if (!(n1 > 0) || !(n2 > 0)) return { lo: 0, hi: 0, diff: 0, se: 0 };
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const diff = p2 - p1;
  const se = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const lo = diff - Z_975 * se;
  const hi = diff + Z_975 * se;
  return { lo, hi, diff, se };
}

// ---- Student-t CDF via regularized incomplete beta ----

// Lanczos approximation for log-gamma.
const LANCZOS_COEFFS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];
const LOG_SQRT_2PI = 0.9189385332046727;

/**
 * @param {number} z
 */
export function logGamma(z) {
  if (z < 0.5) {
    // Reflection formula
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = LANCZOS_COEFFS[0];
  for (let i = 1; i < LANCZOS_COEFFS.length; i++) {
    x += LANCZOS_COEFFS[i] / (z + i);
  }
  const t = z + LANCZOS_COEFFS.length - 0.5;
  return LOG_SQRT_2PI + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Continued fraction for incomplete beta.
 * Numerical Recipes betacf.
 * @param {number} a
 * @param {number} b
 * @param {number} x
 */
function betacf(a, b, x) {
  const MAXIT = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;

  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/**
 * Regularized incomplete beta I_x(a,b).
 * @param {number} x
 * @param {number} a
 * @param {number} b
 */
export function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnBt =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const bt = Math.exp(lnBt);

  // Use symmetry to improve convergence
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/**
 * Student-t CDF for t with df degrees of freedom.
 * @param {number} t
 * @param {number} df
 */
export function studentTCdf(t, df) {
  if (!(df > 0)) return NaN;
  if (!isFinite(t)) return t < 0 ? 0 : 1;
  if (df > 30) {
    // Normal approximation is fine for MVP
    return normalCdf(t);
  }
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const ib = regularizedIncompleteBeta(x, a, b);
  if (t >= 0) return 1 - 0.5 * ib;
  return 0.5 * ib;
}

/**
 * Welch's t-test (two-sided).
 * @param {number[]} sample1
 * @param {number[]} sample2
 */
export function welchTTest(sample1, sample2) {
  const n1 = sample1.length;
  const n2 = sample2.length;
  if (n1 < 2 || n2 < 2) {
    return { t: 0, df: Math.max(1, n1 + n2 - 2), pValue: 1, mean1: 0, mean2: 0 };
  }

  let mean1 = 0;
  for (let i = 0; i < n1; i++) mean1 += sample1[i];
  mean1 /= n1;

  let mean2 = 0;
  for (let i = 0; i < n2; i++) mean2 += sample2[i];
  mean2 /= n2;

  let s1 = 0;
  for (let i = 0; i < n1; i++) {
    const d = sample1[i] - mean1;
    s1 += d * d;
  }
  s1 /= n1 - 1;

  let s2 = 0;
  for (let i = 0; i < n2; i++) {
    const d = sample2[i] - mean2;
    s2 += d * d;
  }
  s2 /= n2 - 1;

  const se = Math.sqrt(s1 / n1 + s2 / n2);
  if (se === 0) return { t: 0, df: n1 + n2 - 2, pValue: 1, mean1, mean2 };
  const t = (mean2 - mean1) / se;

  const v1 = s1 / n1;
  const v2 = s2 / n2;
  const df = (v1 + v2) * (v1 + v2) / ((v1 * v1) / (n1 - 1) + (v2 * v2) / (n2 - 1));

  const cdf = studentTCdf(Math.abs(t), df);
  const pValue = 2 * (1 - cdf);
  return { t, df, pValue, mean1, mean2, s1, s2, n1, n2 };
}

/**
 * 95% CI for difference in means using Welch SE and normal critical value.
 * @param {number[]} sample1
 * @param {number[]} sample2
 */
export function ciDiffMeans95(sample1, sample2) {
  const res = welchTTest(sample1, sample2);
  const n1 = sample1.length;
  const n2 = sample2.length;
  if (n1 < 2 || n2 < 2) return { lo: 0, hi: 0, diff: 0, se: 0 };
  const s1 = res.s1 ?? 0;
  const s2 = res.s2 ?? 0;
  const diff = (res.mean2 ?? 0) - (res.mean1 ?? 0);
  const se = Math.sqrt(s1 / n1 + s2 / n2);
  return { lo: diff - Z_975 * se, hi: diff + Z_975 * se, diff, se };
}

