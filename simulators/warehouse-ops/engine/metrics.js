export class Series {
  constructor(maxLen = 1200) {
    this.maxLen = maxLen | 0;
    this.t = new Array(this.maxLen);
    this.v = new Array(this.maxLen);
    this.len = 0;
    this.head = 0; // next write
  }

  push(t, v) {
    const i = this.head;
    this.t[i] = t | 0;
    this.v[i] = Number(v);
    this.head = (i + 1) % this.maxLen;
    this.len = Math.min(this.maxLen, this.len + 1);
  }

  // Iterate in chronological order into provided arrays (reused buffers)
  toArrays(outT, outV) {
    const n = this.len;
    outT.length = n;
    outV.length = n;
    const start = (this.head - n + this.maxLen) % this.maxLen;
    for (let k = 0; k < n; k++) {
      const idx = (start + k) % this.maxLen;
      outT[k] = this.t[idx];
      outV[k] = this.v[idx];
    }
    return n;
  }
}

export class RollingRate {
  constructor(window = 120) {
    this.window = window | 0;
    this.buf = new Array(this.window);
    this.sum = 0;
    this.i = 0;
    this.filled = 0;
  }

  push(x) {
    const v = Number(x) || 0;
    if (this.filled < this.window) {
      this.buf[this.i] = v;
      this.sum += v;
      this.i = (this.i + 1) % this.window;
      this.filled += 1;
    } else {
      const old = this.buf[this.i] || 0;
      this.buf[this.i] = v;
      this.sum += v - old;
      this.i = (this.i + 1) % this.window;
    }
  }

  mean() {
    const n = this.filled || 1;
    return this.sum / n;
  }
}

