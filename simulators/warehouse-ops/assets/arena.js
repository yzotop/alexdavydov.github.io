import { STAGES, STAGE_COLORS } from "../engine/model.js";

function dpr() {
  return Math.max(1, Math.floor(window.devicePixelRatio || 1));
}

function hashU32(x) {
  // cheap integer hash
  let v = (x >>> 0) + 0x9e3779b9;
  v ^= v >>> 16;
  v = Math.imul(v, 0x21f0aaad);
  v ^= v >>> 15;
  v = Math.imul(v, 0x735a2d97);
  v ^= v >>> 15;
  return v >>> 0;
}

function posFromId(id, rect) {
  const h = hashU32(id);
  const hx = h & 0xffff;
  const hy = (h >>> 16) & 0xffff;
  const x = rect.x + 10 + ((rect.w - 20) * (hx / 65535));
  const y = rect.y + 18 + ((rect.h - 28) * (hy / 65535));
  return { x, y };
}

export function makeLayout(w, h) {
  const pad = 12;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const cols = 3;
  const rows = 2;
  const cellW = innerW / cols;
  const cellH = innerH / rows;

  // Visual pipeline: INB → STO → PICK (top row), PACK → OUT (bottom row), CARRIER at right edge
  const rects = {};
  rects[STAGES.INBOUND] = { x: pad + 0 * cellW, y: pad + 0 * cellH, w: cellW - 8, h: cellH - 8 };
  rects[STAGES.STORAGE] = { x: pad + 1 * cellW, y: pad + 0 * cellH, w: cellW - 8, h: cellH - 8 };
  rects[STAGES.PICK] = { x: pad + 2 * cellW, y: pad + 0 * cellH, w: cellW - 8, h: cellH - 8 };
  rects[STAGES.PACK] = { x: pad + 1 * cellW, y: pad + 1 * cellH, w: cellW - 8, h: cellH - 8 };
  rects[STAGES.OUTBOUND] = { x: pad + 2 * cellW, y: pad + 1 * cellH, w: cellW - 8, h: cellH - 8 };
  rects.carrier = { x: pad + 0 * cellW, y: pad + 1 * cellH, w: cellW - 8, h: cellH - 8 };

  return rects;
}

function sizeClass(sz) {
  const s = Number(sz) | 0;
  if (s >= 5) return "L";
  if (s >= 3) return "M";
  return "S";
}

function boxDims(cls) {
  if (cls === "L") return 9;
  if (cls === "M") return 7;
  return 5;
}

function stageFromBottleneck(b) {
  switch (String(b)) {
    case "INB": return STAGES.INBOUND;
    case "STO": return STAGES.STORAGE;
    case "PICK": return STAGES.PICK;
    case "PACK": return STAGES.PACK;
    case "OUT": return STAGES.OUTBOUND;
    default: return -1;
  }
}

export class ArenaRenderer {
  constructor() {
    this.movers = [];
    this.pulseStage = -1;
    this.pulseUntil = 0;
  }

  pulse(bottleneckStr, untilMs) {
    this.pulseStage = stageFromBottleneck(bottleneckStr);
    this.pulseUntil = untilMs || 0;
  }

  ingestMoves(sim, nowMs, batchMoves) {
    // batchMoves: array of {id, from, to, size, late}
    const rects = this._lastRects;
    if (!rects) return;
    const ms = Array.isArray(batchMoves) ? batchMoves : [];
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      const fromR = m.from === STAGES.SHIPPED ? rects.carrier : rects[m.from];
      const toR = m.to === STAGES.SHIPPED ? rects.carrier : rects[m.to];
      if (!fromR || !toR) continue;
      const from = { x: fromR.x + fromR.w * 0.55, y: fromR.y + fromR.h * 0.55 };
      const to = { x: toR.x + toR.w * 0.30, y: toR.y + toR.h * 0.60 };
      const cls = sizeClass(m.size);
      const dur = 300 + (hashU32(m.id) % 500); // 300..799
      this.movers.push({
        id: m.id | 0,
        fromX: from.x, fromY: from.y,
        toX: to.x, toY: to.y,
        t0: nowMs,
        dur,
        stage: m.to | 0,
        color: STAGE_COLORS[m.to] || "#111827",
        size: cls,
        late: !!m.late,
      });
    }
    // cap movers
    if (this.movers.length > 120) this.movers.splice(0, this.movers.length - 120);
  }

  needsFrame(nowMs) {
    if (this.movers.length > 0) return true;
    return nowMs < this.pulseUntil;
  }

  render(canvas, sim, cfg, nowMs) {
    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 360;
    const r = dpr();
    canvas.width = Math.floor(w * r);
    canvas.height = Math.floor(h * r);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rects = makeLayout(w, h);
    this._lastRects = rects;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const snap = sim.snapshot();
    const bottleneckStage = stageFromBottleneck(snap.lastTick.bottleneck);
    const pulseOn = nowMs < this.pulseUntil;

    const drawZone = (stage, label, extra) => {
      const rc = rects[stage];
      ctx.fillStyle = "#f9fafb";
      ctx.strokeStyle = "rgba(17,24,39,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(rc.x, rc.y, rc.w, rc.h, 10);
      ctx.fill();
      ctx.stroke();

      if (pulseOn && stage === bottleneckStage) {
        ctx.strokeStyle = "rgba(37,99,235,0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(rc.x + 1, rc.y + 1, rc.w - 2, rc.h - 2, 10);
        ctx.stroke();
      }

      ctx.fillStyle = "#111827";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      ctx.textBaseline = "top";
      ctx.fillText(label, rc.x + 10, rc.y + 8);

      if (extra) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
        ctx.fillText(extra, rc.x + 10, rc.y + 24);
      }

      ctx.fillStyle = STAGE_COLORS[stage] || "#111827";
      ctx.fillRect(rc.x + 10, rc.y + rc.h - 10, Math.min(70, rc.w - 20), 4);

      // Split areas: queue (left) and in-service (right)
      const splitX = rc.x + Math.floor(rc.w * 0.55);
      ctx.strokeStyle = "rgba(17,24,39,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(splitX, rc.y + 44);
      ctx.lineTo(splitX, rc.y + rc.h - 14);
      ctx.stroke();

      // Boxes: queue packed
      const q = sim.q[stage];
      const svc = sim.svc[stage];
      const qArea = { x: rc.x + 10, y: rc.y + 44, w: splitX - (rc.x + 14), h: rc.h - 60 };
      const sArea = { x: splitX + 10, y: rc.y + 44, w: rc.x + rc.w - 14 - (splitX + 10), h: rc.h - 60 };

      drawQueueBoxes(ctx, sim, q, stage, qArea);
      drawServiceBoxes(ctx, sim, svc, stage, sArea, this._capForStage(cfg, stage));
    };

    drawZone(STAGES.INBOUND, "INBOUND", `q+svc: ${snap.wip.inbound}`);
    drawZone(STAGES.STORAGE, "STORAGE", `q+svc: ${snap.wip.storage} / cap ${cfg.limits.storageWipCap || "—"}`);
    drawZone(STAGES.PICK, "PICK", `q+svc: ${snap.wip.pick}`);
    drawZone(STAGES.PACK, "PACK", `q+svc: ${snap.wip.pack}`);
    drawZone(STAGES.OUTBOUND, "OUTBOUND", `q+svc: ${snap.wip.outbound}`);

    // Carrier block (simple)
    {
      const rc = rects.carrier;
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "rgba(17,24,39,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(rc.x, rc.y, rc.w, rc.h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      ctx.textBaseline = "top";
      ctx.fillText("CARRIER", rc.x + 10, rc.y + 8);
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
      const mode = cfg.carrier.mode === "windows" ? "windows" : `every ${cfg.carrier.intervalMin}m`;
      ctx.fillText(`${mode} · cap ${cfg.carrier.capacityPerDeparture}`, rc.x + 10, rc.y + 24);
    }

    // Flow arrows
    ctx.strokeStyle = "rgba(37,99,235,0.18)";
    ctx.lineWidth = 2;
    const arrow = (a, b) => {
      const ax = a.x + a.w;
      const ay = a.y + a.h / 2;
      const bx = b.x;
      const by = b.y + b.h / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 8, by - 4);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx - 8, by + 4);
      ctx.stroke();
    };
    arrow(rects[STAGES.INBOUND], rects[STAGES.STORAGE]);
    arrow(rects[STAGES.STORAGE], rects[STAGES.PICK]);
    arrow(rects[STAGES.PICK], rects[STAGES.PACK]);
    arrow(rects[STAGES.PACK], rects[STAGES.OUTBOUND]);
    arrow(rects[STAGES.OUTBOUND], rects.carrier);

    // Movers (animated transitions)
    if (this.movers.length > 0) {
      const keep = [];
      for (let i = 0; i < this.movers.length; i++) {
        const m = this.movers[i];
        const age = nowMs - m.t0;
        const t = age / m.dur;
        if (t >= 1) continue;
        keep.push(m);
        const tt = t * (2 - t); // easeOutQuad
        const x = m.fromX + (m.toX - m.fromX) * tt;
        const y = m.fromY + (m.toY - m.fromY) * tt;
        const s = boxDims(m.size);
        ctx.fillStyle = m.color;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (m.late) {
          ctx.strokeStyle = "rgba(220,38,38,0.95)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
        }
      }
      this.movers = keep;
    }

    // Legend
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    ctx.textBaseline = "bottom";
    ctx.fillText("boxes = orders · red outline = late · left=queue, right=in-service", 12, h - 8);
  }

  _capForStage(cfg, stage) {
    const w = cfg.workers || {};
    if (stage === STAGES.INBOUND) return w.inbound | 0;
    if (stage === STAGES.STORAGE) return w.storage | 0;
    if (stage === STAGES.PICK) return w.pick | 0;
    if (stage === STAGES.PACK) return w.pack | 0;
    if (stage === STAGES.OUTBOUND) return w.outbound | 0;
    return 0;
  }
}

function drawQueueBoxes(ctx, sim, qIdxs, stage, area) {
  const n = qIdxs.length;
  if (n <= 0) return;
  // sample top part for stability
  const maxBoxes = 60;
  const step = n > maxBoxes ? Math.ceil(n / maxBoxes) : 1;

  // Use median size for packing grid
  const s = 6;
  const cols = Math.max(1, Math.floor(area.w / (s + 2)));
  const rows = Math.max(1, Math.floor(area.h / (s + 2)));
  const cap = cols * rows;

  let placed = 0;
  for (let i = 0; i < n && placed < cap; i += step) {
    const o = sim.orders[qIdxs[i]];
    const cls = sizeClass(o.size);
    const bs = boxDims(cls);
    const c = placed % cols;
    const r = Math.floor(placed / cols);
    const x = area.x + c * (s + 2) + 1;
    const y = area.y + area.h - (r + 1) * (s + 2) + 1;
    ctx.fillStyle = STAGE_COLORS[stage] || "#111827";
    ctx.fillRect(x, y - (bs - s), bs, bs);
    if (sim.t > o.dueAt) {
      ctx.strokeStyle = "rgba(220,38,38,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y - (bs - s) - 1, bs + 2, bs + 2);
    }
    placed += 1;
  }
}

function drawServiceBoxes(ctx, sim, svcIdxs, stage, area, cap) {
  const n = svcIdxs.length;
  if (cap <= 0 || n <= 0) return;
  const show = Math.min(n, cap, 24);
  const cols = show <= 6 ? show : 6;
  const rows = Math.ceil(show / cols);
  const cellW = area.w / Math.max(1, cols);
  const cellH = area.h / Math.max(1, rows);
  for (let i = 0; i < show; i++) {
    const idx = svcIdxs[i];
    const o = sim.orders[idx];
    const cls = sizeClass(o.size);
    const bs = boxDims(cls);
    const c = i % cols;
    const r = Math.floor(i / cols);
    const cx = area.x + c * cellW + cellW * 0.5;
    const cy = area.y + r * cellH + cellH * 0.5;
    const x = cx - bs / 2;
    const y = cy - bs / 2;
    ctx.fillStyle = STAGE_COLORS[stage] || "#111827";
    ctx.fillRect(x, y, bs, bs);
    if (sim.t > o.dueAt) {
      ctx.strokeStyle = "rgba(220,38,38,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y - 1, bs + 2, bs + 2);
    }
    // progress bar
    const w0 = o.work0 || 0;
    const p = w0 > 0 ? Math.max(0, Math.min(1, 1 - (o.rem / w0))) : 0;
    const bw = bs;
    const bh = 2;
    ctx.fillStyle = "rgba(17,24,39,0.15)";
    ctx.fillRect(x, y + bs + 2, bw, bh);
    ctx.fillStyle = "rgba(17,24,39,0.55)";
    ctx.fillRect(x, y + bs + 2, bw * p, bh);
  }
}

// Back-compat export (used by ui.js)
export function renderArena(canvas, sim, cfg, renderer, nowMs) {
  const r = renderer || (renderArena._singleton || (renderArena._singleton = new ArenaRenderer()));
  r.render(canvas, sim, cfg, nowMs == null ? performance.now() : nowMs);
  return r;
}
