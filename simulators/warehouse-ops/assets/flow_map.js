import { STAGES, STAGE_COLORS } from "../engine/model.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const LAYOUT = {
  w: 1000,
  h: 1140,
  zones: {
    // equal-size cards in vertical flow
    inbound: { x: 70, y: 40, w: 860, h: 200, label: "INBOUND" },
    storage: { x: 70, y: 260, w: 860, h: 200, label: "STORAGE" },
    pick: { x: 70, y: 480, w: 860, h: 200, label: "PICK" },
    pack: { x: 70, y: 700, w: 860, h: 200, label: "PACK" },
    outbound: { x: 70, y: 920, w: 860, h: 200, label: "OUTBOUND" },
  },
  // Dedicated queue pockets placed BEFORE zone entrance.
  pockets: {},
};

// pockets are relative to zones (body area)
{
  const px = 14;
  const pw = 860 - 28;
  for (const k in LAYOUT.zones) {
    const z = LAYOUT.zones[k];
    const py = z.y + 52;
    const ph = z.h - 68;
    LAYOUT.pockets[k] = { x: z.x + px, y: py, w: pw, h: ph };
  }
}

const ROUTES = {
  inbound_to_storage: [
    { x: 500, y: 240 },
    { x: 500, y: 260 },
  ],
  storage_to_pick: [
    { x: 500, y: 460 },
    { x: 500, y: 480 },
  ],
  pick_to_pack: [
    { x: 500, y: 680 },
    { x: 500, y: 700 },
  ],
  pack_to_outbound: [
    { x: 500, y: 900 },
    { x: 500, y: 920 },
  ],
};

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function pipeColor(cong) {
  const t = clamp01(cong / 2); // 0..2 -> 0..1
  const a = 0.14 + 0.22 * t;
  return `rgba(17,24,39,${a.toFixed(3)})`;
}
function pipeWidth(cong) {
  const t = clamp01(cong / 2);
  return 14 + 10 * t;
}

function nextDepartInMin(cfg, tNow) {
  const c = cfg?.carrier || {};
  const mode = String(c.mode || "interval");
  if (mode === "windows") {
    const wins = Array.isArray(c.windows) ? c.windows.map((x) => x | 0).filter((x) => x >= 0 && x < 1440).sort((a, b) => a - b) : [];
    if (wins.length === 0) return nextDepartInMin({ carrier: { mode: "interval", intervalMin: c.intervalMin } }, tNow);
    const m = (tNow | 0) % 1440;
    for (let i = 0; i < wins.length; i++) if (wins[i] === m) return 0;
    for (let i = 0; i < wins.length; i++) if (wins[i] > m) return wins[i] - m;
    return (1440 - m) + wins[0];
  }
  const interval = Math.max(1, (c.intervalMin | 0) || 60);
  const t = tNow | 0;
  if (t > 0 && (t % interval) === 0) return 0;
  const r = t % interval;
  return (r === 0) ? interval : (interval - r);
}

function el(name) {
  return document.createElementNS(SVG_NS, name);
}

function setAttrs(node, attrs) {
  for (const k in attrs) node.setAttribute(k, String(attrs[k]));
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

function capForStage(cfg, stage) {
  const w = cfg?.workers || {};
  if (stage === STAGES.INBOUND) return w.inbound | 0;
  if (stage === STAGES.STORAGE) return w.storage | 0;
  if (stage === STAGES.PICK) return w.pick | 0;
  if (stage === STAGES.PACK) return w.pack | 0;
  if (stage === STAGES.OUTBOUND) return w.outbound | 0;
  return 0;
}

function zoneForStage(stage) {
  switch (stage) {
    case STAGES.INBOUND: return "inbound";
    case STAGES.STORAGE: return "storage";
    case STAGES.PICK: return "pick";
    case STAGES.PACK: return "pack";
    case STAGES.OUTBOUND: return "outbound";
    default: return null;
  }
}

function orderBoxSize(sizeUnits) {
  const s = Number(sizeUnits) | 0;
  if (s >= 5) return 10; // L
  if (s >= 3) return 8;  // M
  return 6;              // S
}

function hashU32(x) {
  let v = (x >>> 0) + 0x9e3779b9;
  v ^= v >>> 16;
  v = Math.imul(v, 0x21f0aaad);
  v ^= v >>> 15;
  v = Math.imul(v, 0x735a2d97);
  v ^= v >>> 15;
  return v >>> 0;
}

function jitterXY(id, mag) {
  const h = hashU32(id);
  const a = ((h & 0xffff) / 65535 - 0.5) * 2;
  const b = (((h >>> 16) & 0xffff) / 65535 - 0.5) * 2;
  return { dx: a * mag, dy: b * mag };
}

function routePoint(route, t) {
  const pts = route;
  if (!pts || pts.length < 2) return { x: 0, y: 0 };
  const segs = pts.length - 1;
  const u = clamp01(t) * segs;
  const i = Math.min(segs - 1, Math.floor(u));
  const lt = u - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { x: a.x + (b.x - a.x) * lt, y: a.y + (b.y - a.y) * lt };
}

class GridAllocator {
  constructor(capacity) {
    this.cap = Math.max(0, capacity | 0);
    this.idToCell = new Map(); // orderId -> idx
    this.cellToId = new Array(this.cap).fill(0); // idx -> orderId
    this._lastCompactMs = 0;
  }
  getCell(id) {
    const v = this.idToCell.get(id | 0);
    return (v === undefined) ? -1 : (v | 0);
  }
  alloc(id) {
    const oid = id | 0;
    if (!oid) return -1;
    const ex = this.idToCell.get(oid);
    if (ex !== undefined) return ex | 0;
    for (let i = 0; i < this.cap; i++) {
      if ((this.cellToId[i] | 0) === 0) {
        this.cellToId[i] = oid;
        this.idToCell.set(oid, i);
        return i;
      }
    }
    return -1;
  }
  free(id) {
    const oid = id | 0;
    const idx = this.idToCell.get(oid);
    if (idx === undefined) return;
    const i = idx | 0;
    if (i >= 0 && i < this.cap) this.cellToId[i] = 0;
    this.idToCell.delete(oid);
  }
  sync(ids) {
    const mark = new Map();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] | 0;
      if (!id) continue;
      mark.set(id, 1);
      if (this.idToCell.get(id) === undefined) this.alloc(id);
    }
    for (const [id] of this.idToCell) {
      if (!mark.has(id)) this.free(id);
    }
  }
  compactIfHoley(nowMs) {
    const t = nowMs | 0;
    if (t - (this._lastCompactMs | 0) < 2500) return;
    let holes = 0;
    for (let i = 0; i < this.cap; i++) if ((this.cellToId[i] | 0) === 0) holes++;
    if (holes < Math.max(6, Math.floor(this.cap * 0.30))) return;
    const ids = [];
    for (let i = 0; i < this.cap; i++) {
      const id = this.cellToId[i] | 0;
      if (id) ids.push(id);
    }
    this.cellToId.fill(0);
    this.idToCell.clear();
    for (let i = 0; i < ids.length && i < this.cap; i++) {
      this.cellToId[i] = ids[i];
      this.idToCell.set(ids[i], i);
    }
    this._lastCompactMs = t;
  }
}

export class FlowMap {
  constructor(mountEl) {
    this.mount = mountEl;
    this.cfg = null;
    this._lastNowMs = 0;
    this._pulseUntil = 0;
    this._pulseStage = -1;

    // Rendering pools (fixed, no per-tick DOM rebuild)
    this._maxQueueBoxes = 120;
    this._maxSlots = 10;
    this._maxMovers = 60;
    this._queuePool = {};   // zoneKey -> [rect...]
    this._queueMore = {};   // zoneKey -> text
    this._slotOutline = {}; // zoneKey -> [rect...]
    this._slotFill = {};    // zoneKey -> [rect...]
    this._slotProg = {};    // zoneKey -> [rect...]
    this._slotMore = {};    // zoneKey -> text (capacity overflow)
    this._activeMore = {};  // zoneKey -> text (active overflow)
    this._pipes = {};       // name -> {base, sheen}
    this._pipeCong = { inb_sto: 0, sto_pick: 0, pick_pack: 0, pack_out: 0 };
    this._bnStage = -1;

    // "Lamoda-like" decor (built once, updated by attrs)
    this._dockDoors = [];
    this._trailers = [];
    this._trailersMore = null;
    this._storageRacks = [];
    this._storageCapHit = null;
    this._pickAisles = [];
    this._pickers = [];
    this._pickAisleQ = [];
    this._packStations = [];
    this._outRamps = [];
    this._outRampLabel = null;
    this._shipWave = null;
    this._shipWaveUntil = 0;
    this._flowDots = []; // { c, route, phase, pipe }

    this._moverRects = [];
    this._movers = [];      // {rect, id, x0,y0,x1,y1,t0,dur,bs}
    this._aggMove = { inbound: 0, storage: 0, pick: 0, pack: 0, outbound: 0 };
    this._aggMoveText = {}; // zoneKey -> text

    this._heroId = 0;
    this._heroPos = null;   // {x,y,stage,label}
    this._heroLabel = null;

    // per-zone UI bits (status strip + svc box)
    this._svcBox = {}; // zoneKey -> rect
    this._gridSvc = {}; // zoneKey -> { cells:[{cx,cy,rect}], alloc }
    this._gridQ = {};   // zoneKey -> { cells:[{cx,cy,rect}], alloc }

    this._build();
  }

  _build() {
    this.mount.innerHTML = "";
    const svg = el("svg");
    setAttrs(svg, { viewBox: `0 0 ${LAYOUT.w} ${LAYOUT.h}`, preserveAspectRatio: "none", role: "img" });
    this.svg = svg;

    // World group (all map content), auto-fitted to container via transform
    const gWorld = el("g");
    this.gWorld = gWorld;
    svg.appendChild(gWorld);

    // defs
    const defs = el("defs");

    // subtle bottleneck glow (no red borders)
    const glow = el("filter");
    setAttrs(glow, { id: "bnGlow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    const ds = el("feDropShadow");
    setAttrs(ds, { dx: 0, dy: 0, stdDeviation: 3, "flood-color": "rgba(245,158,11,0.55)", "flood-opacity": 1 });
    glow.appendChild(ds);
    defs.appendChild(glow);

    // per-zone clipping (prevent any squares spilling outside cards)
    const clipPad = 10;
    for (const k in LAYOUT.zones) {
      const z = LAYOUT.zones[k];
      const cp = el("clipPath");
      setAttrs(cp, { id: `clip_${k}` });
      const cr = el("rect");
      setAttrs(cr, { x: z.x + clipPad, y: z.y + clipPad, width: z.w - 2 * clipPad, height: z.h - 2 * clipPad, rx: 12, ry: 12 });
      cp.appendChild(cr);
      defs.appendChild(cp);
    }

    svg.appendChild(defs);

    // routes
    const gRoutes = el("g");
    setAttrs(gRoutes, { opacity: 1 });
    this.gRoutes = gRoutes;
    gWorld.appendChild(gRoutes);
    this._drawRoutes();

    // zones
    const gZones = el("g");
    this.gZones = gZones;
    gWorld.appendChild(gZones);
    this.zoneNodes = {};
    this._drawZones();

    // decor inside zones + flow dots on pipes
    const gDecor = el("g");
    this.gDecor = gDecor;
    gWorld.appendChild(gDecor);
    this._drawDecor();

    // workers
    const gWorkers = el("g");
    this.gWorkers = gWorkers;
    gWorld.appendChild(gWorkers);

    // queue pockets + service capacity slots (static structure + pooled boxes)
    const gPockets = el("g");
    this.gPockets = gPockets;
    gWorld.appendChild(gPockets);
    const gSlots = el("g");
    this.gSlots = gSlots;
    gWorld.appendChild(gSlots);

    const gFly = el("g");
    this.gFly = gFly;
    gWorld.appendChild(gFly);

    // movers + hero label
    const gMovers = el("g");
    this.gMovers = gMovers;
    gWorld.appendChild(gMovers);

    this._drawPocketsAndSlots();
    this._initMoversAndHero();

    this.mount.appendChild(svg);

    // Fit-to-container: compute bbox and apply transform; update on resize.
    if (this._ro) this._ro.disconnect();
    this._ro = new ResizeObserver(() => this._fitToContainer());
    this._ro.observe(this.mount);
    this._fitToContainer();
  }

  _worldBBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const zones = LAYOUT.zones;
    for (const k in zones) {
      const z = zones[k];
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.w);
      maxY = Math.max(maxY, z.y + z.h);
    }
    const pockets = LAYOUT.pockets;
    for (const k in pockets) {
      const p = pockets[k];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h);
    }
    const routes = Object.values(ROUTES);
    for (let r = 0; r < routes.length; r++) {
      const pts = routes[r];
      for (let i = 0; i < pts.length; i++) {
        minX = Math.min(minX, pts[i].x);
        minY = Math.min(minY, pts[i].y);
        maxX = Math.max(maxX, pts[i].x);
        maxY = Math.max(maxY, pts[i].y);
      }
    }

    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  }

  _fitToContainer() {
    if (!this.svg || !this.gWorld) return;
    const W = Math.max(1, this.mount.clientWidth | 0);
    const H = Math.max(1, this.mount.clientHeight | 0);
    // Make SVG viewport match container pixels, then fit world into it.
    this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const bb = this._worldBBox();
    const pad = 14;
    const s = Math.max(0.1, Math.min((W - 2 * pad) / bb.w, (H - 2 * pad) / bb.h));
    const tx = pad + (W - 2 * pad - bb.w * s) / 2 - bb.x * s;
    const ty = pad + (H - 2 * pad - bb.h * s) / 2 - bb.y * s;
    this.gWorld.setAttribute("transform", `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})`);
  }

  _drawRoutes() {
    const mk = (pts) => {
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
      return d;
    };
    // central flow axis (subtle, behind pipes)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const zones = LAYOUT.zones;
    for (const k in zones) {
      const z = zones[k];
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.w);
      maxY = Math.max(maxY, z.y + z.h);
    }
    const axisX = (minX + maxX) / 2;
    const axisY0 = minY;
    const axisY1 = maxY;
    const axis = el("path");
    setAttrs(axis, {
      d: `M ${axisX.toFixed(2)} ${axisY0.toFixed(2)} L ${axisX.toFixed(2)} ${axisY1.toFixed(2)}`,
      fill: "none",
      stroke: "rgba(17,24,39,0.10)",
      "stroke-width": 2,
      "stroke-dasharray": "3 7",
      "stroke-linecap": "round",
    });
    this.gRoutes.appendChild(axis);

    const add = (name, pts) => {
      const halo = el("path");
      setAttrs(halo, {
        d: mk(pts),
        fill: "none",
        stroke: "rgba(17,24,39,0.08)",
        "stroke-width": 22,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      this.gRoutes.appendChild(halo);
      const base = el("path");
      setAttrs(base, {
        d: mk(pts),
        fill: "none",
        stroke: "rgba(17,24,39,0.22)",
        "stroke-width": 14,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-dasharray": "18 14",
        "stroke-dashoffset": 0,
      });
      this.gRoutes.appendChild(base);
      const anim = el("animate");
      setAttrs(anim, { attributeName: "stroke-dashoffset", dur: "2.8s", values: "0;-64", repeatCount: "indefinite" });
      base.appendChild(anim);
      this._pipes[name] = { base, halo };
    };
    add("inb_sto", ROUTES.inbound_to_storage);
    add("sto_pick", ROUTES.storage_to_pick);
    add("pick_pack", ROUTES.pick_to_pack);
    add("pack_out", ROUTES.pack_to_outbound);
  }

  _drawZones() {
    const z = LAYOUT.zones;
    const entries = Object.entries(z);
    for (const [key, a] of entries) {
      const g = el("g");
      const rect = el("rect");
      setAttrs(rect, {
        x: a.x, y: a.y, width: a.w, height: a.h,
        rx: 14, ry: 14,
        fill: "#f9fafb",
        stroke: "rgba(17,24,39,0.16)",
        "stroke-width": 2,
      });
      g.appendChild(rect);
      const label = el("text");
      setAttrs(label, {
        x: a.x + 14, y: a.y + 26,
        fill: "#111827",
        "font-size": 14,
        "font-weight": 800,
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      });
      label.textContent = a.label;
      g.appendChild(label);

      // STATUS STRIP (under header): OK / PRESSURE / BOTTLENECK
      const statusRect = el("rect");
      setAttrs(statusRect, {
        x: a.x + 14, y: a.y + 30, width: a.w - 28, height: 10,
        rx: 6, ry: 6,
        fill: "rgba(17,24,39,0.06)",
        stroke: "rgba(17,24,39,0.10)",
        "stroke-width": 1,
      });
      g.appendChild(statusRect);
      const statusText = el("text");
      setAttrs(statusText, {
        x: a.x + 20, y: a.y + 38,
        fill: "#111827",
        "font-size": 10,
        "font-weight": 900,
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      });
      statusText.textContent = "OK";
      g.appendChild(statusText);

      // counters (numbers only)
      const inText = el("text");
      setAttrs(inText, {
        x: a.x + a.w - 150, y: a.y + 26,
        fill: "rgba(17,24,39,0.78)",
        "font-size": 12,
        "font-weight": 900,
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      });
      inText.textContent = "IN 0";
      g.appendChild(inText);
      const outText = el("text");
      setAttrs(outText, {
        x: a.x + a.w - 70, y: a.y + 26,
        fill: "rgba(17,24,39,0.78)",
        "font-size": 12,
        "font-weight": 900,
        "text-anchor": "end",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      });
      outText.textContent = "OUT 0";
      g.appendChild(outText);

      // zone card template separators: header + (no internal subzones)
      const headerY = a.y + 34;
      const bottomY = a.y + a.h - 28;
      const sepH = 1.5;
      const sep1 = el("rect");
      setAttrs(sep1, { x: a.x + 12, y: headerY, width: a.w - 24, height: sepH, fill: "rgba(17,24,39,0.10)" });
      g.appendChild(sep1);
      const sep2 = el("rect");
      setAttrs(sep2, { x: a.x + 12, y: bottomY, width: a.w - 24, height: sepH, fill: "rgba(17,24,39,0.10)", opacity: 0 });
      g.appendChild(sep2);
      const vdiv = el("rect");
      setAttrs(vdiv, { x: a.x + a.w / 2 - 0.75, y: bottomY, width: 1.5, height: a.y + a.h - bottomY - 8, fill: "rgba(17,24,39,0.10)", opacity: 0 });
      g.appendChild(vdiv);

      // subtle stage color bar
      const stage = (key === "inbound") ? STAGES.INBOUND :
        (key === "storage") ? STAGES.STORAGE :
        (key === "pick") ? STAGES.PICK :
        (key === "pack") ? STAGES.PACK :
        STAGES.OUTBOUND;
      const bar = el("rect");
      setAttrs(bar, {
        x: a.x + 14, y: a.y + 44, width: Math.min(120, a.w - 28), height: 4, rx: 3, ry: 3,
        fill: STAGE_COLORS[stage] || "#111827",
        opacity: 0,
      });
      g.appendChild(bar);

      this.gZones.appendChild(g);
      this.zoneNodes[key] = { g, rect, stage, statusRect, statusText, inText, outText };
    }
  }

  _drawDecor() {
    const zones = LAYOUT.zones;
    const pockets = LAYOUT.pockets;
    const zoneKeys = ["inbound", "storage", "pick", "pack", "outbound"];
    this.gDecor.innerHTML = "";
    this._gridSvc = {};
    this._gridQ = {};
    const gByZone = {};
    for (let i = 0; i < zoneKeys.length; i++) {
      const zk = zoneKeys[i];
      const g = el("g");
      setAttrs(g, { "clip-path": `url(#clip_${zk})` });
      this.gDecor.appendChild(g);
      gByZone[zk] = g;
    }

    const mkRect = (parent, x, y, w, h, rx, fill, stroke, sw, extra) => {
      const r = el("rect");
      setAttrs(r, { x, y, width: w, height: h, rx, ry: rx, fill, stroke, "stroke-width": sw, ...extra });
      parent.appendChild(r);
      return r;
    };
    const mkCell = (parent, cells, x, y, s) => {
      const rr = mkRect(parent, x, y, s, s, 4, "rgba(17,24,39,0.02)", "rgba(17,24,39,0.05)", 1);
      cells.push({ cx: x + s / 2, cy: y + s / 2, rect: rr });
    };

    for (let zi = 0; zi < zoneKeys.length; zi++) {
      const zk = zoneKeys[zi];
      const p = pockets[zk];
      const g = gByZone[zk] || this.gDecor;
      const pad = 10;
      const gap = 4;
      const cell = 12;
      const splitGap = 10;
      const svcH = Math.max(42, Math.floor(p.h * 0.32));
      const qH = Math.max(42, p.h - svcH - splitGap);

      // body container + two lanes
      mkRect(g, p.x - 2, p.y - 2, p.w + 4, p.h + 4, 12, "rgba(17,24,39,0.012)", "rgba(17,24,39,0.10)", 1.5);
      mkRect(g, p.x + 6, p.y + 6, p.w - 12, svcH - 6, 12, "rgba(17,24,39,0.010)", "rgba(17,24,39,0.06)", 1);
      mkRect(g, p.x + 6, p.y + svcH + splitGap, p.w - 12, qH - 6, 12, "rgba(17,24,39,0.010)", "rgba(17,24,39,0.06)", 1);

      const cols = Math.max(4, Math.floor((p.w - pad * 2 + gap) / (cell + gap)));
      const rowsSvc = Math.max(1, Math.floor((svcH - pad * 2 + gap) / (cell + gap)));
      const rowsQ = Math.max(1, Math.floor((qH - pad * 2 + gap) / (cell + gap)));

      const cellsSvc = [];
      const cellsQ = [];
      for (let r = 0; r < rowsSvc; r++) for (let c = 0; c < cols; c++) {
        const x = p.x + pad + c * (cell + gap);
        const y = p.y + pad + r * (cell + gap);
        if (x + cell <= p.x + p.w - pad && y + cell <= p.y + svcH - pad) mkCell(g, cellsSvc, x, y, cell);
      }
      for (let r = 0; r < rowsQ; r++) for (let c = 0; c < cols; c++) {
        const x = p.x + pad + c * (cell + gap);
        const y = p.y + svcH + splitGap + pad + r * (cell + gap);
        if (x + cell <= p.x + p.w - pad && y + cell <= p.y + p.h - pad) mkCell(g, cellsQ, x, y, cell);
      }

      this._gridSvc[zk] = { cells: cellsSvc, alloc: new GridAllocator(cellsSvc.length) };
      this._gridQ[zk] = { cells: cellsQ, alloc: new GridAllocator(cellsQ.length) };
    }

    if (false) {
      const zones = LAYOUT.zones;

    // INBOUND: dock doors + trailer queue
    {
      const z = zones.inbound;
      const doors = 3;
      const pad = 16;
      const gap = 12;
      const w = 14;
      const h = 22;
      const y = z.y + z.h - 92;
      for (let i = 0; i < doors; i++) {
        const r = el("rect");
        setAttrs(r, {
          x: z.x + pad + i * (w + gap),
          y,
          width: w,
          height: h,
          rx: 3,
          ry: 3,
          fill: "rgba(17,24,39,0.08)",
          stroke: "rgba(17,24,39,0.20)",
          "stroke-width": 1,
        });
        this.gDecor.appendChild(r);
        this._dockDoors.push(r);
      }

      // pallet stacks (inside)
      for (let s = 0; s < 2; s++) {
        const x0 = z.x + z.w - 120 - s * 56;
        const y0 = z.y + 54;
        for (let i = 0; i < 3; i++) {
          const p = el("rect");
          setAttrs(p, { x: x0, y: y0 + i * 16, width: 44, height: 10, rx: 3, ry: 3, fill: "rgba(37,99,235,0.12)", stroke: "rgba(17,24,39,0.10)", "stroke-width": 1 });
          this.gDecor.appendChild(p);
        }
      }

      // inbound queue lane (inside)
      const lane = el("rect");
      setAttrs(lane, { x: z.x + 18, y: z.y + 62, width: z.w - 160, height: 26, rx: 10, ry: 10, fill: "rgba(37,99,235,0.06)", stroke: "rgba(17,24,39,0.12)", "stroke-width": 1.5, "stroke-dasharray": "6 5" });
      this.gDecor.appendChild(lane);
    }

    // STORAGE: rack rows + cap-hit badge
    {
      const z = zones.storage;
      const racks = 9;
      const x0 = z.x + 18;
      const y0 = z.y + 54;
      const h = z.h - 122;
      const gap = 28;
      for (let i = 0; i < racks; i++) {
        const r = el("rect");
        setAttrs(r, { x: x0 + i * gap, y: y0, width: 16, height: h, rx: 4, ry: 4, fill: "rgba(124,58,237,0.08)" });
        this.gDecor.appendChild(r);
        this._storageRacks.push(r);
      }
      const buf = el("rect");
      setAttrs(buf, { x: z.x + 18, y: z.y + z.h - 98, width: z.w - 36, height: 30, rx: 10, ry: 10, fill: "rgba(124,58,237,0.05)", stroke: "rgba(17,24,39,0.12)", "stroke-width": 1.5, "stroke-dasharray": "6 5" });
      this.gDecor.appendChild(buf);
    }

    // PICK: parallel aisles + pickers
    {
      const z = zones.pick;
      const aisles = 4;
      const padX = 16;
      const padY = 54;
      const gap = 10;
      const aw = Math.floor((z.w - padX * 2 - gap * (aisles - 1)) / aisles);
      const ah = z.h - 122;
      for (let i = 0; i < aisles; i++) {
        const a = el("rect");
        setAttrs(a, { x: z.x + padX + i * (aw + gap), y: z.y + padY, width: aw, height: ah, rx: 10, ry: 10, fill: "rgba(245,158,11,0.08)", stroke: "rgba(17,24,39,0.18)", "stroke-width": 2 });
        this.gDecor.appendChild(a);
        this._pickAisles.push(a);
      }
      // pickers as "heads" inside aisles
      for (let i = 0; i < 4; i++) {
        const c = el("circle");
        setAttrs(c, { cx: -100, cy: -100, r: 6, fill: "rgba(17,24,39,0.30)" });
        this.gDecor.appendChild(c);
        this._pickers.push(c);
      }
      const pq = el("rect");
      setAttrs(pq, { x: z.x + 18, y: z.y + z.h - 98, width: z.w - 36, height: 30, rx: 10, ry: 10, fill: "rgba(245,158,11,0.06)", stroke: "rgba(17,24,39,0.12)", "stroke-width": 1.5, "stroke-dasharray": "6 5" });
      this.gDecor.appendChild(pq);
    }

    // PACK: stations (table blocks)
    {
      const z = zones.pack;
      const stations = 4;
      const cols = 2;
      const gap = 14;
      const w = 96;
      const h = 20;
      const x0 = z.x + 16;
      const y0 = z.y + 56;
      for (let i = 0; i < stations; i++) {
        const r = el("rect");
        const rr = Math.floor(i / cols);
        const cc = i % cols;
        setAttrs(r, { x: x0 + cc * (w + gap), y: y0 + rr * (h + gap), width: w, height: h, rx: 6, ry: 6, fill: "rgba(17,24,39,0.06)", stroke: "rgba(17,24,39,0.16)", "stroke-width": 1.5 });
        this.gDecor.appendChild(r);
        this._packStations.push(r);
      }
      const pq = el("rect");
      setAttrs(pq, { x: z.x + 18, y: z.y + z.h - 98, width: z.w - 36, height: 30, rx: 10, ry: 10, fill: "rgba(17,24,39,0.04)", stroke: "rgba(17,24,39,0.12)", "stroke-width": 1.5, "stroke-dasharray": "6 5" });
      this.gDecor.appendChild(pq);
    }

    // OUTBOUND: ramps + departure timer label + ship wave
    {
      const z = zones.outbound;
      const ramps = 3;
      for (let i = 0; i < ramps; i++) {
        const r = el("rect");
        setAttrs(r, { x: z.x + z.w - 40, y: z.y + 54 + i * 26, width: 30, height: 18, rx: 5, ry: 5, fill: "rgba(100,116,139,0.14)", stroke: "rgba(17,24,39,0.16)", "stroke-width": 1 });
        this.gDecor.appendChild(r);
        this._outRamps.push(r);
      }
      const lane = el("rect");
      setAttrs(lane, { x: z.x + 18, y: z.y + 62, width: z.w - 76, height: 28, rx: 10, ry: 10, fill: "rgba(37,99,235,0.06)", stroke: "rgba(37,99,235,0.10)", "stroke-width": 1.5 });
      this.gDecor.appendChild(lane);
      const truck = el("rect");
      setAttrs(truck, { x: z.x + 24, y: z.y + 118, width: 112, height: 42, rx: 8, ry: 8, fill: "rgba(17,24,39,0.06)", stroke: "rgba(17,24,39,0.16)", "stroke-width": 1.5 });
      this.gDecor.appendChild(truck);
      const cab = el("rect");
      setAttrs(cab, { x: z.x + 142, y: z.y + 128, width: 28, height: 32, rx: 6, ry: 6, fill: "rgba(17,24,39,0.08)", stroke: "rgba(17,24,39,0.16)", "stroke-width": 1.5 });
      this.gDecor.appendChild(cab);
      const t = el("text");
      setAttrs(t, { x: z.x + z.w - 156, y: z.y + 44, fill: "#111827", "font-size": 18, "font-weight": 900, "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" });
      t.textContent = "";
      this.gDecor.appendChild(t);
      this._outRampLabel = t;
    }

    // FLOWS: small moving dots along pipes (continuous motion)
    const addDots = (pipe, route, n) => {
      for (let i = 0; i < n; i++) {
        const c = el("circle");
        setAttrs(c, { cx: -100, cy: -100, r: 2.2, fill: "rgba(255,255,255,0.9)", opacity: 0.9 });
        this.gRoutes.appendChild(c);
        this._flowDots.push({ c, route, phase: (i / n), pipe });
      }
    };
    addDots("inb_sto", ROUTES.inbound_to_storage, 4);
    addDots("sto_pick", ROUTES.storage_to_pick, 4);
    addDots("pick_pack", ROUTES.pick_to_pack, 4);
    addDots("pack_out", ROUTES.pack_to_outbound, 4);
    }
  }

  _drawPocketsAndSlots() {
    const zones = LAYOUT.zones;
    const pockets = LAYOUT.pockets;
    const zoneKeys = ["inbound", "storage", "pick", "pack", "outbound"];

    for (const zk of zoneKeys) {
      const gZ = el("g");
      setAttrs(gZ, { "clip-path": `url(#clip_${zk})` });
      this.gPockets.appendChild(gZ);

      // pocket outline
      const p = pockets[zk];
      const isOut = zk === "outbound";
      const pr = el("rect");
      setAttrs(pr, {
        x: p.x, y: p.y, width: p.w, height: p.h,
        rx: 10, ry: 10,
        fill: "rgba(17,24,39,0.03)",
        stroke: "rgba(17,24,39,0.10)",
        "stroke-width": 1,
        "stroke-dasharray": "4 3",
        opacity: 0,
      });
      this.gPockets.appendChild(pr);

      // in-service footer box (solid) to the right of queue panel
      const z = zones[zk];
      const svcBox = el("rect");
      const svcX = z.x + z.w / 2 + 8;
      setAttrs(svcBox, {
        x: svcX, y: p.y, width: (z.x + z.w - 14) - svcX, height: p.h,
        rx: 10, ry: 10,
        fill: "rgba(17,24,39,0.02)",
        stroke: "rgba(17,24,39,0.12)",
        "stroke-width": 1,
        opacity: 0,
      });
      this.gSlots.appendChild(svcBox);
      this._svcBox[zk] = svcBox;

      // queue boxes pool
      const arr = [];
      for (let i = 0; i < this._maxQueueBoxes; i++) {
        const r = el("rect");
        setAttrs(r, { x: -100, y: -100, width: 6, height: 6, rx: 1.5, ry: 1.5, opacity: 1 });
        gZ.appendChild(r);
        arr.push(r);
      }
      this._queuePool[zk] = arr;

      const more = el("text");
      setAttrs(more, {
        x: p.x + p.w - 6,
        y: p.y + 14,
        fill: "#6b7280",
        "font-size": 12,
        "font-weight": 900,
        "text-anchor": "end",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        opacity: 1,
      });
      more.textContent = "";
      gZ.appendChild(more);
      this._queueMore[zk] = more;

      const agg = el("text");
      setAttrs(agg, {
        x: p.x + p.w - 6,
        y: p.y + 30,
        fill: "#111827",
        "font-size": 12,
        "font-weight": 900,
        "text-anchor": "end",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        opacity: 0,
      });
      agg.textContent = "";
      this.gPockets.appendChild(agg);
      this._aggMoveText[zk] = agg;

      // capacity slots inside footer right box
      const svcX0 = p.x + p.w + 10;
      const slotOut = [];
      const slotFill = [];
      const slotProg = [];
      for (let i = 0; i < this._maxSlots; i++) {
        const x = svcX0 + i * 22;
        const y = p.y + 18;
        const o = el("rect");
        setAttrs(o, {
          x, y, width: 18, height: 18,
          rx: 3, ry: 3,
          fill: "rgba(255,255,255,0)",
          stroke: "rgba(17,24,39,0.14)",
          "stroke-width": 1,
          opacity: 0,
        });
        this.gSlots.appendChild(o);
        slotOut.push(o);
        const f = el("rect");
        setAttrs(f, { x: -100, y: -100, width: 18, height: 18, rx: 3, ry: 3, opacity: 0 });
        this.gSlots.appendChild(f);
        slotFill.push(f);
        const pb = el("rect");
        setAttrs(pb, { x: -100, y: -100, width: 0, height: 2, rx: 1, ry: 1, fill: "rgba(17,24,39,0.55)", opacity: 0 });
        this.gSlots.appendChild(pb);
        slotProg.push(pb);
      }
      this._slotOutline[zk] = slotOut;
      this._slotFill[zk] = slotFill;
      this._slotProg[zk] = slotProg;

      const capMore = el("text");
      setAttrs(capMore, {
        x: svcX0 + this._maxSlots * 22 + 6,
        y: p.y + 18,
        fill: "#6b7280",
        "font-size": 12,
        "font-weight": 900,
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        opacity: 0,
      });
      capMore.textContent = "";
      this.gSlots.appendChild(capMore);
      this._slotMore[zk] = capMore;

      const actMore = el("text");
      setAttrs(actMore, {
        x: svcX0 + this._maxSlots * 22 + 6,
        y: p.y + 36,
        fill: "#111827",
        "font-size": 12,
        "font-weight": 900,
        "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        opacity: 0,
      });
      actMore.textContent = "";
      this.gSlots.appendChild(actMore);
      this._activeMore[zk] = actMore;
    }
  }

  _initMoversAndHero() {
    for (let i = 0; i < this._maxMovers; i++) {
      const r = el("rect");
      setAttrs(r, { x: -100, y: -100, width: 6, height: 6, rx: 1.5, ry: 1.5 });
      this.gFly.appendChild(r);
      this._moverRects.push(r);
    }
    const t = el("text");
    setAttrs(t, {
      x: -100,
      y: -100,
      fill: "#111827",
      "font-size": 12,
      "font-weight": 900,
      "font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    });
    t.textContent = "";
    this.gMovers.appendChild(t);
    this._heroLabel = t;
  }

  setConfig(cfg) {
    this.cfg = cfg;
    this._renderWorkers();
    this._updateSlotOutlines();
  }

  pulseBottleneck(bStr, nowMs) {
    this._pulseStage = stageFromBottleneck(bStr);
    this._pulseUntil = (nowMs || 0) + 300;
  }

  _renderWorkers() {
    // static worker icons near zones; update on config change only
    this.gWorkers.innerHTML = "";
    return;
    const cfg = this.cfg;
    if (!cfg) return;
    const zones = LAYOUT.zones;
    const add = (zoneKey, count, maxShow) => {
      const z = zones[zoneKey];
      const show = Math.max(0, Math.min(maxShow, count | 0));
      for (let i = 0; i < show; i++) {
        const x = z.x + 16 + i * 12;
        const y = z.y + z.h + 10;
        const ic = el("rect");
        setAttrs(ic, { x, y, width: 9, height: 9, rx: 2, ry: 2, fill: "rgba(17,24,39,0.22)" });
        this.gWorkers.appendChild(ic);
      }
    };
    add("inbound", cfg.workers.inbound, 10);
    add("storage", cfg.workers.storage, 10);
    add("pick", cfg.workers.pick, 10);
    add("pack", cfg.workers.pack, 10);
    add("outbound", cfg.workers.outbound, 10);
  }

  _updateSlotOutlines() {
    const cfg = this.cfg;
    if (!cfg) return;
    const map = {
      inbound: STAGES.INBOUND,
      storage: STAGES.STORAGE,
      pick: STAGES.PICK,
      pack: STAGES.PACK,
      outbound: STAGES.OUTBOUND,
    };
    for (const zk in map) {
      const cap = Math.max(0, capForStage(cfg, map[zk]));
      const show = Math.min(this._maxSlots, cap);
      const out = this._slotOutline[zk] || [];
      for (let i = 0; i < out.length; i++) out[i].setAttribute("opacity", i < show ? "1" : "0");
      const m = this._slotMore[zk];
      if (m) m.textContent = cap > this._maxSlots ? `+${cap - this._maxSlots}` : "";
    }
  }

  // Called from UI render batch (cheap): update pockets/slots/pipes, ingest move events, choose hero.
  syncFromSim(sim, nowMs) {
    const snap = sim.snapshot();
    this._bnStage = stageFromBottleneck(snap.lastTick.bottleneck);
    this.pulseBottleneck(snap.lastTick.bottleneck, nowMs);
    this._syncPulseStyles(nowMs);
    this._heroPos = null;
    this._updatePipes(sim);
    this._updateDecor(sim, snap, nowMs);
    this._updateZoneStatus(sim);
    this._chooseHero(sim);
    this._syncGrids(sim, nowMs);
    this._ingestMoves(sim, nowMs);
  }

  _updateZoneStatus(sim) {
    const cfg = this.cfg;
    if (!cfg) return;
    const bn = this._bnStage | 0;
    const map = [
      ["inbound", STAGES.INBOUND],
      ["storage", STAGES.STORAGE],
      ["pick", STAGES.PICK],
      ["pack", STAGES.PACK],
      ["outbound", STAGES.OUTBOUND],
    ];
    for (let i = 0; i < map.length; i++) {
      const zk = map[i][0];
      const stage = map[i][1];
      const node = this.zoneNodes?.[zk];
      if (!node) continue;
      const qLen = sim.q[stage]?.length || 0;
      const outLen = sim.svc[stage]?.length || 0;
      const cap = Math.max(0, capForStage(cfg, stage));
      const isBn = stage === bn;
      const isPressure = !isBn && cap > 0 && qLen > cap * 2;
      const label = isBn ? "BOTTLENECK" : (isPressure ? "PRESSURE" : "OK");
      const fill = isBn ? "rgba(245,158,11,0.85)" : (isPressure ? "rgba(245,158,11,0.22)" : "rgba(16,185,129,0.18)");
      const stroke = isBn ? "rgba(245,158,11,0.95)" : "rgba(17,24,39,0.10)";
      if (node.statusRect) {
        node.statusRect.setAttribute("fill", fill);
        node.statusRect.setAttribute("stroke", stroke);
      }
      if (node.statusText) {
        node.statusText.textContent = label;
        node.statusText.setAttribute("fill", isBn ? "#111827" : "rgba(17,24,39,0.78)");
      }
      // bottleneck emphasis on the whole card (visual only)
      node.rect.setAttribute("stroke-width", isBn ? "3" : "2");
      node.rect.setAttribute("filter", isBn ? "url(#bnGlow)" : "");
      if (node.inText) node.inText.textContent = `IN ${qLen | 0}`;
      if (node.outText) node.outText.textContent = `OUT ${outLen | 0}`;
    }
  }

  _updateDecor(sim, snap, nowMs) {
    const cfg = this.cfg;
    if (!cfg) return;
    return;

    // INBOUND trailer queue aggregation (use inbound queue length)
    const qInb = sim.q[STAGES.INBOUND]?.length || 0;
    const filled = Math.min(this._trailers.length, Math.ceil(qInb / 10));
    for (let i = 0; i < this._trailers.length; i++) {
      this._trailers[i].setAttribute("fill", i < filled ? "rgba(37,99,235,0.25)" : "rgba(17,24,39,0.08)");
    }
    if (this._trailersMore) {
      const over = qInb - filled * 10;
      this._trailersMore.textContent = over > 0 ? `+${over}` : "";
    }

    // STORAGE racks fill level + cap hit highlight
    const wSto = (sim.q[STAGES.STORAGE]?.length || 0) + (sim.svc[STAGES.STORAGE]?.length || 0);
    const cap = cfg.limits?.storageWipCap | 0;
    const frac = cap > 0 ? clamp01(wSto / cap) : clamp01(wSto / 200);
    for (let i = 0; i < this._storageRacks.length; i++) {
      const a = 0.08 + 0.55 * frac;
      this._storageRacks[i].setAttribute("fill", `rgba(124,58,237,${a.toFixed(3)})`);
    }
    const capHit = cap > 0 && wSto >= cap;
    if (this._storageCapHit) this._storageCapHit.textContent = capHit ? "CAP HIT" : "";
    if (this.zoneNodes?.storage?.rect) {
      this.zoneNodes.storage.rect.setAttribute("fill", capHit ? "rgba(254,242,242,0.9)" : "#f9fafb");
    }

    // PICK aisles: highlight a single "bottleneck aisle" when bottleneck is PICK
    const isPickBn = String(snap?.lastTick?.bottleneck || "") === "PICK";
    const bnIdx = this._heroId ? (this._heroId % Math.max(1, this._pickAisles.length)) : 0;
    for (let i = 0; i < this._pickAisles.length; i++) {
      const hot = isPickBn && i === bnIdx;
      this._pickAisles[i].setAttribute("stroke", hot ? "rgba(220,38,38,0.9)" : "rgba(17,24,39,0.18)");
      this._pickAisles[i].setAttribute("stroke-width", hot ? "3" : "1.5");
      this._pickAisles[i].setAttribute("fill", hot ? "rgba(254,243,199,0.7)" : "rgba(245,158,11,0.06)");
    }
    // pickers inside aisles (count from cfg; position relative to aisle rects)
    const aisles = Math.max(1, this._pickAisles.length);
    const nPick = Math.max(0, Math.min(this._pickers.length, cfg.workers?.pick | 0));
    for (let i = 0; i < this._pickers.length; i++) {
      const c = this._pickers[i];
      if (i >= nPick) { c.setAttribute("cx", "-100"); c.setAttribute("cy", "-100"); continue; }
      const a = i % aisles;
      const rr = Math.floor(i / aisles);
      const ar = this._pickAisles[a];
      const ax = Number(ar?.getAttribute("x")) || 0;
      const ay = Number(ar?.getAttribute("y")) || 0;
      const aw = Number(ar?.getAttribute("width")) || 40;
      const ah = Number(ar?.getAttribute("height")) || 40;
      const cx = ax + 8 + (rr % 2) * 6 + (i % 3) * 3;
      const cy = ay + 10 + (rr * 12) % Math.max(12, (ah - 16));
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
    }

    // small pick queue at aisle entries (use PICK queue length; cap 20; overflow implied elsewhere)
    const qPick = sim.q[STAGES.PICK]?.length || 0;
    const showQ = Math.min(this._pickAisleQ.length, qPick);
    for (let i = 0; i < this._pickAisleQ.length; i++) {
      const r = this._pickAisleQ[i];
      if (i >= showQ) { r.setAttribute("x", "-100"); r.setAttribute("y", "-100"); continue; }
      const a = i % aisles;
      const ar = this._pickAisles[a];
      const ax = Number(ar?.getAttribute("x")) || 0;
      const ay = Number(ar?.getAttribute("y")) || 0;
      const rr = Math.floor(i / aisles);
      r.setAttribute("x", (ax - 7 - (rr % 3) * 6).toFixed(2));
      r.setAttribute("y", (ay + 6 + rr * 7).toFixed(2));
    }

    // PACK stations: idle vs busy
    const busy = Math.min(this._packStations.length, sim.svc[STAGES.PACK]?.length || 0);
    for (let i = 0; i < this._packStations.length; i++) {
      this._packStations[i].setAttribute("fill", i < busy ? "rgba(16,185,129,0.30)" : "rgba(17,24,39,0.06)");
      this._packStations[i].setAttribute("stroke", i < busy ? "rgba(16,185,129,0.50)" : "rgba(17,24,39,0.16)");
    }

    // OUTBOUND: departure timer label + shipment wave on departure
    const tmin = nextDepartInMin(cfg, sim.t | 0);
    if (this._outRampLabel) this._outRampLabel.textContent = `T-${tmin}m`;
    if (snap?.lastTick?.carrierDeparted) {
      this._shipWaveUntil = (nowMs || 0) + 900;
    }
  }

  _syncGrids(sim, nowMs) {
    const map = [
      ["inbound", STAGES.INBOUND],
      ["storage", STAGES.STORAGE],
      ["pick", STAGES.PICK],
      ["pack", STAGES.PACK],
      ["outbound", STAGES.OUTBOUND],
    ];
    for (let m = 0; m < map.length; m++) {
      const zk = map[m][0];
      const st = map[m][1];
      const gS = this._gridSvc[zk];
      const gQ = this._gridQ[zk];
      if (!gS || !gQ) continue;

      const idsSvc = (sim.svc[st] || []).map((idx) => sim.orders[idx]?.id | 0).filter((x) => x > 0);
      const idsQ = (sim.q[st] || []).map((idx) => sim.orders[idx]?.id | 0).filter((x) => x > 0);

      gS.alloc.sync(idsSvc);
      gQ.alloc.sync(idsQ);
      gS.alloc.compactIfHoley(nowMs);
      gQ.alloc.compactIfHoley(nowMs);

      // reset all cells to empty
      for (let i = 0; i < gS.cells.length; i++) {
        const r = gS.cells[i].rect;
        r.setAttribute("fill", "rgba(17,24,39,0.02)");
        r.setAttribute("stroke", "rgba(17,24,39,0.05)");
      }
      for (let i = 0; i < gQ.cells.length; i++) {
        const r = gQ.cells[i].rect;
        r.setAttribute("fill", "rgba(17,24,39,0.02)");
        r.setAttribute("stroke", "rgba(17,24,39,0.05)");
      }

      // fill occupied
      for (let i = 0; i < gS.alloc.cellToId.length; i++) {
        if ((gS.alloc.cellToId[i] | 0) === 0) continue;
        const r = gS.cells[i]?.rect;
        if (r) { r.setAttribute("fill", "rgba(17,24,39,0.18)"); r.setAttribute("stroke", "rgba(17,24,39,0.10)"); }
      }
      for (let i = 0; i < gQ.alloc.cellToId.length; i++) {
        if ((gQ.alloc.cellToId[i] | 0) === 0) continue;
        const r = gQ.cells[i]?.rect;
        if (r) { r.setAttribute("fill", "rgba(17,24,39,0.18)"); r.setAttribute("stroke", "rgba(17,24,39,0.10)"); }
      }

      const over = Math.max(0, idsSvc.length - gS.cells.length) + Math.max(0, idsQ.length - gQ.cells.length);
      const more = this._queueMore?.[zk];
      if (more) more.textContent = over > 0 ? `+${over}` : "";
    }
  }

  _updatePipes(sim) {
    const cfg = this.cfg;
    if (!cfg) return;
    const qSto = sim.q[STAGES.STORAGE]?.length || 0;
    const qPick = sim.q[STAGES.PICK]?.length || 0;
    const qPack = sim.q[STAGES.PACK]?.length || 0;
    const qOut = sim.q[STAGES.OUTBOUND]?.length || 0;
    const cSto = Math.max(1, capForStage(cfg, STAGES.STORAGE));
    const cPick = Math.max(1, capForStage(cfg, STAGES.PICK));
    const cPack = Math.max(1, capForStage(cfg, STAGES.PACK));
    const cOut = Math.max(1, capForStage(cfg, STAGES.OUTBOUND));

    const set = (name, cong) => {
      const p = this._pipes[name];
      if (!p) return;
      p.base.setAttribute("stroke", pipeColor(cong));
      const baseW = pipeWidth(cong);
      // if destination zone is bottleneck, thicken upstream flow a bit (visual cue)
      const bn = this._bnStage | 0;
      const boost =
        (name === "inb_sto" && bn === STAGES.STORAGE) ||
        (name === "sto_pick" && bn === STAGES.PICK) ||
        (name === "pick_pack" && bn === STAGES.PACK) ||
        (name === "pack_out" && bn === STAGES.OUTBOUND);
      p.base.setAttribute("stroke-width", String(boost ? (baseW * 1.35).toFixed(2) : baseW));
    };
    set("inb_sto", qSto / cSto);
    set("sto_pick", qPick / cPick);
    set("pick_pack", qPack / cPack);
    set("pack_out", qOut / cOut);

    this._pipeCong.inb_sto = qSto / cSto;
    this._pipeCong.sto_pick = qPick / cPick;
    this._pipeCong.pick_pack = qPack / cPack;
    this._pipeCong.pack_out = qOut / cOut;
  }

  _renderQueues(sim) {
    const map = [
      ["inbound", STAGES.INBOUND],
      ["storage", STAGES.STORAGE],
      ["pick", STAGES.PICK],
      ["pack", STAGES.PACK],
      ["outbound", STAGES.OUTBOUND],
    ];
    for (let m = 0; m < map.length; m++) {
      const zk = map[m][0];
      const stage = map[m][1];
      const q = sim.q[stage] || [];
      const svc = sim.svc[stage] || [];
      const wip = q.concat(svc);
      const pocket = LAYOUT.pockets[zk];
      const pool = this._queuePool[zk] || [];
      const maxVis = this._maxQueueBoxes;

      // queued units grid (snaps to stage slots)
      const cells = this._qCells?.[zk] || [];
      const cell = (this._qCellSize?.[zk] | 0) || 12;
      const cap = Math.max(0, cells.length | 0);
      const vis = Math.min(cap, maxVis, wip.length);

      let heroForced = false;
      let heroIdx = -1;
      if (this._heroId) {
        for (let i = 0; i < wip.length && i < 200; i++) {
          if ((sim.orders[wip[i]]?.id | 0) === this._heroId) { heroIdx = i; break; }
        }
      }

      for (let i = 0; i < maxVis; i++) {
        const r = pool[i];
        if (!r) break;
        if (i >= vis) {
          r.setAttribute("x", "-100");
          r.setAttribute("y", "-100");
          continue;
        }
        let qi = i;
        if (!heroForced && heroIdx >= 0 && heroIdx >= vis && i === vis - 1) { qi = heroIdx; heroForced = true; }
        const o = sim.orders[wip[qi]];
        const bs = cell;
        const bh = cell;
        const late = sim.t > o.dueAt;
        const pos = cells[i] || { x: pocket.x, y: pocket.y };
        setAttrs(r, {
          x: pos.x.toFixed(2),
          y: pos.y.toFixed(2),
          width: bs,
          height: bh,
          rx: 4,
          ry: 4,
          fill: "rgba(17,24,39,0.22)",
          stroke: (o.id === this._heroId) ? "rgba(17,24,39,0.95)" : "rgba(0,0,0,0)",
          "stroke-width": (o.id === this._heroId) ? 2 : 0,
        });
        if ((o.id | 0) === (this._heroId | 0)) this._heroPos = { x: pos.x + bs / 2, y: pos.y + bh / 2, stage, label: `#${o.id} ${zk.toUpperCase()}` };
      }
      const hidden = Math.max(0, wip.length - vis);
      const more = this._queueMore[zk];
      if (more) more.textContent = hidden > 0 ? `+${hidden}` : "";
    }
  }

  _renderServiceSlots(sim) {
    const cfg = this.cfg;
    if (!cfg) return;
    return;
    const map = [
      ["inbound", STAGES.INBOUND],
      ["storage", STAGES.STORAGE],
      ["pick", STAGES.PICK],
      ["pack", STAGES.PACK],
      ["outbound", STAGES.OUTBOUND],
    ];
    for (let m = 0; m < map.length; m++) {
      const zk = map[m][0];
      const stage = map[m][1];
      const svc = sim.svc[stage] || [];
      const cap = Math.max(0, capForStage(cfg, stage));
      const slots = Math.min(this._maxSlots, cap);
      const fill = this._slotFill[zk] || [];
      const prog = this._slotProg[zk] || [];

      let heroForced = false;
      let heroIdx = -1;
      if (this._heroId) {
        for (let i = 0; i < svc.length; i++) {
          if ((sim.orders[svc[i]]?.id | 0) === this._heroId) { heroIdx = i; break; }
        }
      }

      for (let i = 0; i < this._maxSlots; i++) {
        if (fill[i]) { fill[i].setAttribute("x", "-100"); fill[i].setAttribute("y", "-100"); }
        if (prog[i]) { prog[i].setAttribute("x", "-100"); prog[i].setAttribute("y", "-100"); prog[i].setAttribute("width", "0"); }
      }

      const actVis = Math.min(slots, svc.length);
      for (let i = 0; i < actVis; i++) {
        let si = i;
        if (!heroForced && heroIdx >= 0 && heroIdx >= actVis && i === actVis - 1) { si = heroIdx; heroForced = true; }
        const o = sim.orders[svc[si]];
        const bs = orderBoxSize(o.size);
        const out = this._slotOutline[zk]?.[i];
        if (!out || !fill[i]) continue;
        const x = Number(out.getAttribute("x")) + 9;
        const y = Number(out.getAttribute("y")) + 9;
        const late = sim.t > o.dueAt;
        setAttrs(fill[i], {
          x: (x - bs / 2).toFixed(2),
          y: (y - bs / 2).toFixed(2),
          width: bs,
          height: bs,
          rx: 3,
          ry: 3,
          fill: STAGE_COLORS[stage] || "#111827",
          stroke: (o.id === this._heroId) ? "rgba(17,24,39,0.95)" : (late ? "rgba(220,38,38,0.95)" : "rgba(0,0,0,0)"),
          "stroke-width": (o.id === this._heroId || late) ? 2 : 0,
        });

        const w0 = o.work0 || 0;
        const p = w0 > 0 ? clamp01(1 - (o.rem / w0)) : 0;
        if (prog[i]) setAttrs(prog[i], { x: (x - 9).toFixed(2), y: (y + 12).toFixed(2), width: (18 * p).toFixed(2) });
        if ((o.id | 0) === (this._heroId | 0)) this._heroPos = { x, y, stage, label: `#${o.id} ${zk.toUpperCase()}` };
      }

      const am = this._activeMore[zk];
      if (am) am.textContent = svc.length > slots ? `+${svc.length - slots}` : "";
    }
  }

  _chooseHero(sim) {
    const keep = this._heroId | 0;
    if (keep) {
      for (let s = 0; s <= STAGES.OUTBOUND; s++) {
        const q = sim.q[s] || [];
        for (let i = 0; i < q.length && i < 80; i++) if ((sim.orders[q[i]]?.id | 0) === keep) return;
        const svc = sim.svc[s] || [];
        for (let i = 0; i < svc.length; i++) if ((sim.orders[svc[i]]?.id | 0) === keep) return;
      }
    }
    let best = 0;
    for (let s = 0; s <= STAGES.OUTBOUND; s++) {
      const q = sim.q[s] || [];
      for (let i = 0; i < q.length && i < 80; i++) {
        const id = sim.orders[q[i]]?.id | 0;
        if (!best || (id && id < best)) best = id;
      }
      const svc = sim.svc[s] || [];
      for (let i = 0; i < svc.length; i++) {
        const id = sim.orders[svc[i]]?.id | 0;
        if (!best || (id && id < best)) best = id;
      }
    }
    this._heroId = best | 0;
  }

  _ingestMoves(sim, nowMs) {
    for (let i = 0; i < this._maxMovers; i++) {
      const r = this._moverRects[i];
      if (r) { r.setAttribute("x", "-100"); r.setAttribute("y", "-100"); r.setAttribute("opacity", "1"); }
    }
    const e = sim.snapshot().lastTick || {};
    const mc = e.moveCount | 0;
    this._aggMove.inbound = 0; this._aggMove.storage = 0; this._aggMove.pick = 0; this._aggMove.pack = 0; this._aggMove.outbound = 0;
    for (let i = 0; i < this._maxMovers; i++) {
      const r = this._moverRects[i];
      if (r) { r.setAttribute("x", "-100"); r.setAttribute("y", "-100"); }
    }
    this._movers.length = 0;
    if (!mc) {
      for (const k in this._aggMoveText) this._aggMoveText[k].textContent = "";
      return;
    }

    let heroMoveIdx = -1;
    if (this._heroId) {
      for (let i = 0; i < mc; i++) if ((e.moveId?.[i] | 0) === this._heroId) { heroMoveIdx = i; break; }
    }

    let used = 0;
    const take = (i) => {
      if (used >= this._maxMovers) return false;
      const id = e.moveId[i] | 0;
      const to = e.moveTo[i] | 0;
      if (to === STAGES.SHIPPED) return true;
      const dstKey = zoneForStage(to);
      if (!dstKey) return true;

      const from = e.moveFrom[i] | 0;
      const srcPt = this._moveStart(from, id);
      const dstPt = this._moveEnd(to, id);
      const mid =
        (from === STAGES.INBOUND && to === STAGES.STORAGE) ? ROUTES.inbound_to_storage :
        (from === STAGES.STORAGE && to === STAGES.PICK) ? ROUTES.storage_to_pick :
        (from === STAGES.PICK && to === STAGES.PACK) ? ROUTES.pick_to_pack :
        (from === STAGES.PACK && to === STAGES.OUTBOUND) ? ROUTES.pack_to_outbound :
        null;
      const route = mid ? [{ x: srcPt.x, y: srcPt.y }, ...mid, { x: dstPt.x, y: dstPt.y }] : [{ x: srcPt.x, y: srcPt.y }, { x: dstPt.x, y: dstPt.y }];
      const size = e.moveSize[i] | 0;
      const late = (e.moveLate[i] | 0) === 1;
      const cong = this._congStage(sim, to);
      const dur = 350 + Math.min(200, Math.floor(120 * cong));
      const rect = this._moverRects[used];
      const bs = 10;
      setAttrs(rect, {
        width: bs,
        height: bs,
        rx: 3,
        ry: 3,
        fill: "rgba(17,24,39,0.22)",
        stroke: id === this._heroId ? "rgba(17,24,39,0.95)" : (late ? "rgba(17,24,39,0.55)" : "rgba(0,0,0,0)"),
        "stroke-width": (id === this._heroId || late) ? 2 : 0,
        opacity: 1,
      });
      this._movers.push({ rect, id, route, t0: nowMs, dur, bs });
      used += 1;
      return true;
    };

    if (heroMoveIdx >= 0) take(heroMoveIdx);
    for (let i = 0; i < mc; i++) {
      if (i === heroMoveIdx) continue;
      if (used < this._maxMovers) {
        take(i);
      } else {
        const to = e.moveTo[i] | 0;
        const k = zoneForStage(to);
        if (k && this._aggMove[k] !== undefined) this._aggMove[k] += 1;
      }
    }

    for (const k in this._aggMoveText) {
      const n = this._aggMove[k] | 0;
      this._aggMoveText[k].textContent = n > 0 ? `+${n} moving` : "";
    }
  }

  _congStage(sim, stage) {
    const cap = Math.max(1, capForStage(this.cfg, stage));
    const qLen = sim.q[stage]?.length || 0;
    return qLen / cap;
  }

  _moveStart(fromStage, orderId) {
    const zk = zoneForStage(fromStage) || "inbound";
    const id = orderId | 0;
    const gS = this._gridSvc[zk];
    const gQ = this._gridQ[zk];
    if (gS) {
      const ci = gS.alloc.getCell(id);
      if (ci >= 0) { const c = gS.cells[ci]; if (c) return { x: c.cx, y: c.cy }; }
    }
    if (gQ) {
      const ci = gQ.alloc.getCell(id);
      if (ci >= 0) { const c = gQ.cells[ci]; if (c) return { x: c.cx, y: c.cy }; }
    }
    const p = LAYOUT.pockets[zk] || LAYOUT.zones[zk];
    return { x: p.x + p.w * 0.5, y: p.y + p.h * 0.5 };
  }

  _moveEnd(toStage, orderId) {
    const zk = zoneForStage(toStage) || "outbound";
    const id = orderId | 0;
    const gS = this._gridSvc[zk];
    const gQ = this._gridQ[zk];
    if (gS) {
      const ci = gS.alloc.getCell(id);
      if (ci >= 0) { const c = gS.cells[ci]; if (c) return { x: c.cx, y: c.cy }; }
    }
    if (gQ) {
      const ci = gQ.alloc.getCell(id);
      if (ci >= 0) { const c = gQ.cells[ci]; if (c) return { x: c.cx, y: c.cy }; }
    }
    const p = LAYOUT.pockets[zk] || LAYOUT.zones[zk];
    return { x: p.x + p.w * 0.5, y: p.y + p.h * 0.5 };
  }

  _congestion(sim, stage) {
    const cap = Math.max(1, capForStage(this.cfg, stage));
    const qLen = sim.q[stage]?.length || 0;
    return qLen / cap;
  }

  _targetPos(sim, ns, all) {
    const zKey = zoneForStage(ns.stage);
    const z = LAYOUT.zones[zKey];
    const id = ns.id;
    const j = jitterXY(id, 8);
    // Queue positions are “before” the zone entrance along route direction
    if (ns.kind === "q") {
      // stack along a short queue lane at the entrance
      const lane = this._queueLaneForStage(ns.stage);
      const pos = this._queueSlot(sim, ns.stage, id, lane);
      return { x: pos.x + j.dx * 0.2, y: pos.y + j.dy * 0.2 };
    }
    if (ns.kind === "svc") {
      // parked inside zone
      return { x: z.x + z.w * 0.55 + j.dx, y: z.y + z.h * 0.62 + j.dy };
    }
    // fallback: center-ish
    return { x: z.x + z.w * 0.5 + j.dx, y: z.y + z.h * 0.55 + j.dy };
  }

  _queueLaneForStage(stage) {
    // A short lane just before the zone entrance (route end point)
    if (stage === STAGES.STORAGE) return { x: 232, y: 105, dx: -1, dy: 0 };
    if (stage === STAGES.PICK) return { x: 532, y: 105, dx: -1, dy: 0 };
    if (stage === STAGES.PACK) return { x: 744, y: 255, dx: 1, dy: 0 };
    if (stage === STAGES.OUTBOUND) return { x: 752, y: 255, dx: 1, dy: 0 };
    // inbound queue lane near dock
    return { x: 60, y: 120, dx: 0, dy: 1 };
  }

  _queueSlot(sim, stage, id, lane) {
    const q = sim.q[stage] || [];
    let idx = 0;
    // find approximate index within queue without heavy ops: scan up to 200
    for (let i = 0; i < q.length && i < 200; i++) {
      if ((sim.orders[q[i]]?.id | 0) === id) { idx = i; break; }
    }
    const cols = 10;
    const gap = 10;
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    return { x: lane.x + lane.dx * (c * gap), y: lane.y + lane.dy * (r * gap) + (lane.dx !== 0 ? (r * gap) : 0) };
  }

  _syncPulseStyles(nowMs) {
    const on = nowMs < this._pulseUntil;
    for (const k in this.zoneNodes) {
      const n = this.zoneNodes[k];
      const is = on && n.stage === this._pulseStage;
      // subtle glow/pulse (no red border)
      const ph = ((nowMs || 0) % 300) / 300;
      const pulse = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
      n.rect.setAttribute("stroke", "rgba(17,24,39,0.16)");
      n.rect.setAttribute("stroke-width", is ? (2 + 0.8 * pulse).toFixed(2) : n.rect.getAttribute("stroke-width") || "2");
      n.rect.setAttribute("filter", is ? "url(#bnGlow)" : (n.rect.getAttribute("filter") || ""));
      n.rect.setAttribute("opacity", is ? (0.98 - 0.08 * pulse).toFixed(3) : "1");
    }
  }

  // Called each animation frame (cheap): animate movers + keep hero label anchored.
  renderFrame(nowMs) {
    this._syncPulseStyles(nowMs);
    // flow dots: continuous motion (speed damped by congestion)
    for (let i = 0; i < this._flowDots.length; i++) {
      const d = this._flowDots[i];
      const cong = this._pipeCong[d.pipe] || 0;
      const speed = 0.00022 / (1 + cong); // lower = slower
      const t = (d.phase + nowMs * speed) % 1;
      const p = routePoint(d.route, t);
      d.c.setAttribute("cx", p.x.toFixed(2));
      d.c.setAttribute("cy", p.y.toFixed(2));
      d.c.setAttribute("opacity", String(0.35 + 0.55 * (1 - clamp01(cong / 2))));
    }

    for (let i = 0; i < this._movers.length; i++) {
      const m = this._movers[i];
      const u = clamp01((nowMs - m.t0) / Math.max(1, m.dur));
      const e = u < 0.5 ? (2 * u * u) : (1 - Math.pow(-2 * u + 2, 2) / 2);
      const p = routePoint(m.route, e);
      const x = p.x;
      const y = p.y;
      m.rect.setAttribute("x", (x - m.bs / 2).toFixed(2));
      m.rect.setAttribute("y", (y - m.bs / 2).toFixed(2));
      const a = u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.15);
      m.rect.setAttribute("opacity", a.toFixed(3));
      if ((m.id | 0) === (this._heroId | 0)) this._heroPos = { x, y, stage: -1, label: `#${m.id} MOVING` };
    }
    for (let i = this._movers.length - 1; i >= 0; i--) {
      const m = this._movers[i];
      const u = clamp01((nowMs - m.t0) / Math.max(1, m.dur));
      if (u >= 1) {
        m.rect.setAttribute("x", "-100");
        m.rect.setAttribute("y", "-100");
        this._movers.splice(i, 1);
      }
    }

    // outbound ship wave (on departure)
    if (this._shipWave) {
      if (nowMs < this._shipWaveUntil) {
        const u = clamp01(1 - (this._shipWaveUntil - nowMs) / 900);
        const r = 6 + 34 * u;
        const a = 0.55 * (1 - u);
        this._shipWave.setAttribute("r", r.toFixed(2));
        this._shipWave.setAttribute("opacity", a.toFixed(3));
      } else {
        this._shipWave.setAttribute("r", "0");
        this._shipWave.setAttribute("opacity", "0");
      }
    }

    if (this._heroLabel && this._heroPos && this._heroId) {
      this._heroLabel.textContent = this._heroPos.label || `#${this._heroId}`;
      this._heroLabel.setAttribute("x", (this._heroPos.x + 10).toFixed(2));
      this._heroLabel.setAttribute("y", (this._heroPos.y - 8).toFixed(2));
    } else if (this._heroLabel) {
      this._heroLabel.textContent = "";
      this._heroLabel.setAttribute("x", "-100");
      this._heroLabel.setAttribute("y", "-100");
    }
  }
}

