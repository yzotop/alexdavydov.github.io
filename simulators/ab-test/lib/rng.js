// Seeded RNG + common distributions (browser-friendly, deterministic).
// Mulberry32 PRNG + xmur3 string hashing.

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  /**
   * @param {string|number} seed
   */
  constructor(seed) {
    const s = typeof seed === "number" ? String(seed) : seed;
    const seedGen = xmur3(s);
    this._next = mulberry32(seedGen());
    this._spareNormal = null;
  }

  /** @returns {number} uniform in [0,1) */
  random() {
    return this._next();
  }

  /**
   * @param {number} min inclusive
   * @param {number} max inclusive
   */
  int(min, max) {
    const u = this.random();
    return Math.floor(u * (max - min + 1)) + min;
  }

  /** Standard normal using Box–Muller. */
  normal() {
    if (this._spareNormal !== null) {
      const v = this._spareNormal;
      this._spareNormal = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.random();
    while (v === 0) v = this.random();
    const r = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    const z0 = r * Math.cos(theta);
    const z1 = r * Math.sin(theta);
    this._spareNormal = z1;
    return z0;
  }

  /**
   * Poisson(lambda).
   * Knuth for small lambda; normal approximation for larger.
   * @param {number} lambda
   */
  poisson(lambda) {
    if (!(lambda > 0)) return 0;
    if (lambda < 30) {
      // Knuth
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.random();
      } while (p > L);
      return k - 1;
    }
    // Normal approximation
    const n = Math.round(lambda + Math.sqrt(lambda) * this.normal());
    return n < 0 ? 0 : n;
  }

  /**
   * Binomial(n,p) via direct Bernoulli trials (n is small in this sim).
   * @param {number} n
   * @param {number} p
   */
  binomial(n, p) {
    if (n <= 0) return 0;
    if (p <= 0) return 0;
    if (p >= 1) return n;
    let x = 0;
    for (let i = 0; i < n; i++) {
      if (this.random() < p) x++;
    }
    return x;
  }

  /**
   * LogNormal(mu,sigma): exp(mu + sigma*Z), Z~N(0,1)
   * @param {number} mu
   * @param {number} sigma
   */
  logNormal(mu, sigma) {
    return Math.exp(mu + sigma * this.normal());
  }
}

