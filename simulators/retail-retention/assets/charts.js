export function formatMoney(x) {
  const n = Number.isFinite(x) ? x : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  const to = (x) => x.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function lerpColor(c0, c1, t) {
  const [r0, g0, b0] = hexToRgb(c0);
  const [r1, g1, b1] = hexToRgb(c1);
  return rgbToHex(
    Math.round(lerp(r0, r1, t)),
    Math.round(lerp(g0, g1, t)),
    Math.round(lerp(b0, b1, t)),
  );
}

export function prepareHeatmap(canvas, matrix, opts) {
  const cell = opts?.cellSize ?? 9;
  const pad = opts?.padding ?? 10;
  const bg = opts?.bg ?? "#ffffff";
  const empty = opts?.empty ?? "#f3f4f6";
  const c0 = opts?.color0 ?? "#f8fafc";
  const c1 = opts?.color1 ?? "#2563eb";

  const rows = matrix?.cohorts?.length ?? 0;
  const cols = matrix?.offsets?.length ?? 0;

  const widthPx = pad * 2 + cols * cell;
  const heightPx = pad * 2 + rows * cell;

  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = widthPx * dpr;
  canvas.height = heightPx * dpr;
  canvas.style.width = `${widthPx}px`;
  canvas.style.height = `${heightPx}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, widthPx, heightPx);

  ctx.fillStyle = empty;
  ctx.fillRect(pad, pad, cols * cell, rows * cell);

  const vals = matrix?.values ?? [];
  for (let r = 0; r < rows; r++) {
    const row = vals[r] ?? [];
    for (let c = 0; c < cols; c++) {
      const v = Number(row[c]);
      if (!Number.isFinite(v)) continue;
      const t = clamp01(v / 100);
      ctx.fillStyle = lerpColor(c0, c1, t);
      ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell);
    }
  }

  // Grid lines (very light)
  ctx.strokeStyle = "rgba(17, 24, 39, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    const x = pad + c * cell;
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + rows * cell);
  }
  for (let r = 0; r <= rows; r++) {
    const y = pad + r * cell;
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + cols * cell, y);
  }
  ctx.stroke();

  return {
    cellSize: cell,
    padding: pad,
    rows,
    cols,
    widthPx,
    heightPx,
  };
}

export function pickHeatmapCell(pos, geom) {
  const { x, y } = pos;
  const { padding: pad, cellSize: cell, rows, cols } = geom;
  const gx = x - pad;
  const gy = y - pad;
  if (gx < 0 || gy < 0) return null;
  const c = Math.floor(gx / cell);
  const r = Math.floor(gy / cell);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
  return { r, c };
}

export function renderBarChart(canvas, items, opts) {
  const bars = Array.isArray(items) ? items : [];
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const w = canvas.clientWidth || 520;
  const h = canvas.clientHeight || 320;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = 12;
  const left = 130;
  const top = 10;
  const right = 10;
  const bottom = 12;
  const innerW = Math.max(1, w - pad - left - right);
  const innerH = Math.max(1, h - top - bottom);

  const maxV = Math.max(1, ...bars.map((b) => Number(b.value) || 0));
  const rowH = Math.max(18, Math.floor(innerH / Math.max(1, bars.length)));

  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  ctx.textBaseline = "middle";

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const y = top + i * rowH + rowH / 2;
    const v = Math.max(0, Number(b.value) || 0);
    const t = v / maxV;
    const bw = innerW * t;

    // label
    ctx.fillStyle = "#111827";
    ctx.textAlign = "left";
    ctx.fillText(String(b.label), pad, y);

    // bar
    ctx.fillStyle = "rgba(37, 99, 235, 0.14)";
    ctx.fillRect(left, y - 6, innerW, 12);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(left, y - 6, bw, 12);

    // value
    ctx.fillStyle = "#374151";
    ctx.textAlign = "right";
    ctx.fillText(formatMoney(v), w - right, y);
  }
}

