// Seeded RNG + common distributions (deterministic).
// Mulberry32 PRNG + xmur3 string hashing.

function xmur3(str: string) {
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

function mulberry32(seed: number) {
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
  private _next: () => number;
  private _spareNormal: number | null = null;

  constructor(seed: string | number) {
    const s = typeof seed === "number" ? String(seed) : seed;
    const seedGen = xmur3(s);
    this._next = mulberry32(seedGen());
  }

  random(): number {
    return this._next();
  }

  int(min: number, max: number): number {
    const u = this.random();
    return Math.floor(u * (max - min + 1)) + min;
  }

  normal(): number {
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

  poisson(lambda: number): number {
    if (!(lambda > 0)) return 0;
    if (lambda < 30) {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.random();
      } while (p > L);
      return k - 1;
    }
    const n = Math.round(lambda + Math.sqrt(lambda) * this.normal());
    return n < 0 ? 0 : n;
  }

  binomial(n: number, p: number): number {
    if (n <= 0) return 0;
    if (p <= 0) return 0;
    if (p >= 1) return n;
    let x = 0;
    for (let i = 0; i < n; i++) {
      if (this.random() < p) x++;
    }
    return x;
  }

  logNormal(mu: number, sigma: number): number {
    return Math.exp(mu + sigma * this.normal());
  }

  // For convenience in resetting without recreating the engine.
  _replaceWith(other: RNG) {
    this._next = other._next;
    this._spareNormal = null;
  }
}

