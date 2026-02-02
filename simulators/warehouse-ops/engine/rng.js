// Deterministic RNG (xorshift32) + helpers.

export class RNG {
  constructor(seed = 1) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    // Keep uint32 non-zero
    let s = (Number(seed) | 0) >>> 0;
    if (s === 0) s = 1;
    this._s = s >>> 0;
    return this;
  }

  nextU32() {
    // xorshift32
    let x = this._s >>> 0;
    x ^= (x << 13) >>> 0;
    x ^= (x >>> 17) >>> 0;
    x ^= (x << 5) >>> 0;
    this._s = x >>> 0;
    return this._s;
  }

  next01() {
    // [0,1)
    return (this.nextU32() >>> 0) / 4294967296;
  }

  int(min, max) {
    const a = min | 0;
    const b = max | 0;
    if (b <= a) return a;
    return a + ((this.nextU32() >>> 0) % (b - a + 1));
  }

  float(min, max) {
    const a = Number(min);
    const b = Number(max);
    return a + (b - a) * this.next01();
  }
}

export function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

export function sampleUniformAround(mean, jitterFrac, rng) {
  const m = Math.max(0, Number(mean) || 0);
  const j = clamp(Number(jitterFrac) || 0, 0, 0.95);
  const lo = m * (1 - j);
  const hi = m * (1 + j);
  return rng.float(lo, hi);
}

export function samplePoisson(lambda, rng) {
  const L = Number(lambda);
  if (!(L > 0)) return 0;
  // Knuth for small lambda, normal approx for larger
  if (L < 30) {
    const expNeg = Math.exp(-L);
    let k = 0;
    let p = 1.0;
    do {
      k += 1;
      p *= rng.next01();
    } while (p > expNeg);
    return k - 1;
  }
  // Normal approximation
  const u1 = Math.max(1e-12, rng.next01());
  const u2 = rng.next01();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const n = Math.round(L + Math.sqrt(L) * z);
  return n < 0 ? 0 : n;
}

