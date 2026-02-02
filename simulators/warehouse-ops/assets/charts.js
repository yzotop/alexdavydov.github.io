// Minimal canvas charts for time series (stable, no deps).

function dpr() {
  return Math.max(1, Math.floor(window.devicePixelRatio || 1));
}

export function clearCanvas(canvas) {
  const w = canvas.clientWidth || 400;
  const h = canvas.clientHeight || 200;
  const r = dpr();
  canvas.width = Math.floor(w * r);
  canvas.height = Math.floor(h * r);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

export function drawLineChart(canvas, series, opts = {}) {
  const { ctx, w, h } = clearCanvas(canvas);
  const pad = 10;
  const left = 36;
  const top = 8;
  const right = 10;
  const bottom = 18;
  const iw = Math.max(1, w - left - right);
  const ih = Math.max(1, h - top - bottom);

  const color = opts.color || "#2563eb";
  const grid = opts.grid !== false;
  const yMin = Number.isFinite(opts.yMin) ? opts.yMin : null;
  const yMax = Number.isFinite(opts.yMax) ? opts.yMax : null;

  const tmpT = opts._tmpT || (opts._tmpT = []);
  const tmpV = opts._tmpV || (opts._tmpV = []);
  const n = series.toArrays(tmpT, tmpV);
  if (n <= 1) return;

  let vmin = yMin == null ? Infinity : yMin;
  let vmax = yMax == null ? -Infinity : yMax;
  for (let i = 0; i < n; i++) {
    const v = Number(tmpV[i]);
    if (!Number.isFinite(v)) continue;
    if (yMin == null) vmin = Math.min(vmin, v);
    if (yMax == null) vmax = Math.max(vmax, v);
  }
  if (!(vmax > vmin)) {
    vmax = vmin + 1;
  }

  if (grid) {
    ctx.strokeStyle = "rgba(17,24,39,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const y = top + (ih * k) / 4;
      ctx.moveTo(left, y);
      ctx.lineTo(left + iw, y);
    }
    ctx.stroke();
  }

  const t0 = tmpT[0];
  const t1 = tmpT[n - 1];
  const dt = Math.max(1, t1 - t0);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const t = tmpT[i];
    const v = tmpV[i];
    const x = left + iw * ((t - t0) / dt);
    const y = top + ih * (1 - (v - vmin) / (vmax - vmin));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // axes labels (light, stable)
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText(String(Math.round(vmax)), 4, top + 12);
  ctx.textBaseline = "top";
  ctx.fillText(String(Math.round(vmin)), 4, top + ih - 8);
}

