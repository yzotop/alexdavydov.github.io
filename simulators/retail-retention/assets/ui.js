import { formatMoney, prepareHeatmap, pickHeatmapCell, renderBarChart } from "./charts.js";

const el = (id) => document.getElementById(id);

const MODE = {
  EXPLORE: "explore",
  COMPARE: "compare",
};

const state = {
  mode: MODE.EXPLORE,
  granularity: "month",
  includeReturns: false,
  includeAnon: false,
  a: { granularity: "month", includeReturns: false, includeAnon: false },
  b: { granularity: "month", includeReturns: true, includeAnon: false },
};

const cache = new Map();

function variantFileName(preset) {
  const g = preset.granularity;
  const ret = preset.includeReturns ? 1 : 0;
  const anon = preset.includeAnon ? 1 : 0;
  return `variant_${g}_ret${ret}_anon${anon}.json`;
}

function variantUrl(preset) {
  return `./data/processed/${variantFileName(preset)}`;
}

function setStatus(message, type) {
  const box = el("status");
  if (!message) {
    box.classList.add("hidden");
    box.textContent = "";
    box.className = "status status--info hidden";
    return;
  }
  box.textContent = message;
  box.classList.remove("hidden");
  box.className = `status status--${type || "info"}`;
}

function showMissing(show) {
  el("missingData").classList.toggle("hidden", !show);
  el("exploreView").classList.toggle("hidden", show || state.mode !== MODE.EXPLORE);
  el("compareView").classList.toggle("hidden", show || state.mode !== MODE.COMPARE);
}

async function fetchJson(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  cache.set(url, data);
  return data;
}

function renderSanity(sanity) {
  const root = el("sanityList");
  root.innerHTML = "";
  const checks = sanity?.checks || [];
  for (const c of checks) {
    const item = document.createElement("div");
    item.className = "sanity-item";
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "8px";
    const dot = document.createElement("span");
    dot.className = c.ok ? "dot" : "dot dot--bad";
    const k = document.createElement("div");
    k.className = "sanity-item__k";
    k.textContent = c.label || c.key || "—";
    left.appendChild(dot);
    left.appendChild(k);

    const v = document.createElement("div");
    v.className = "sanity-item__v mono";
    v.textContent = c.value ?? "—";

    item.appendChild(left);
    item.appendChild(v);
    root.appendChild(item);
  }
}

function renderSegments(rows, bars) {
  const body = el("segmentBody");
  body.innerHTML = "";

  for (const r of rows || []) {
    const tr = document.createElement("tr");
    const tdSeg = document.createElement("td");
    tdSeg.textContent = r.segment ?? "—";
    const tdC = document.createElement("td");
    tdC.className = "right mono";
    tdC.textContent = Number(r.customers ?? 0).toLocaleString();
    const tdR = document.createElement("td");
    tdR.className = "right mono";
    tdR.textContent = formatMoney(Number(r.revenue ?? 0));
    const tdA = document.createElement("td");
    tdA.className = "right mono";
    tdA.textContent = formatMoney(Number(r.aov ?? 0));
    const tdRep = document.createElement("td");
    tdRep.className = "right mono";
    tdRep.textContent = `${Number(r.repeat_rate ?? 0).toFixed(1)}%`;
    tr.append(tdSeg, tdC, tdR, tdA, tdRep);
    body.appendChild(tr);
  }

  const canvas = el("barSegments");
  renderBarChart(canvas, bars || []);
}

function bindHeatmapTooltip(canvas, tipEl, matrix, geom, valueLabel) {
  const onMove = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const cell = pickHeatmapCell({ x, y }, geom);
    if (!cell) {
      tipEl.classList.add("hidden");
      return;
    }
    const r = cell.r;
    const c = cell.c;
    const cohort = matrix.cohorts?.[r] ?? "—";
    const offset = matrix.offsets?.[c] ?? c;
    const v = Number(matrix.values?.[r]?.[c]);
    const val = Number.isFinite(v) ? `${v.toFixed(1)}%` : "—";

    tipEl.innerHTML =
      `<div><strong>${valueLabel}</strong></div>` +
      `<div class="mono">Cohort: ${cohort}</div>` +
      `<div class="mono">Offset: +${offset}</div>` +
      `<div class="mono">Value: ${val}</div>`;

    const parent = tipEl.offsetParent || tipEl.parentElement;
    const pRect = parent.getBoundingClientRect();
    const baseX = evt.clientX - pRect.left;
    const baseY = evt.clientY - pRect.top;
    tipEl.style.left = `${baseX}px`;
    tipEl.style.top = `${baseY}px`;
    tipEl.classList.remove("hidden");
  };
  const onLeave = () => tipEl.classList.add("hidden");
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);
}

let heatGeomCustomers = null;
let heatGeomRevenue = null;

function renderExploreHeatmaps(cohortMatrix, revenueMatrix) {
  const cCanvas = el("heatCustomers");
  const rCanvas = el("heatRevenue");
  const tipC = el("tipCustomers");
  const tipR = el("tipRevenue");

  heatGeomCustomers = prepareHeatmap(cCanvas, cohortMatrix, {
    cellSize: 9,
    padding: 10,
    color0: "#f8fafc",
    color1: "#2563eb",
  });
  heatGeomRevenue = prepareHeatmap(rCanvas, revenueMatrix, {
    cellSize: 9,
    padding: 10,
    color0: "#f0fdf4",
    color1: "#16a34a",
  });

  // Tooltips
  bindHeatmapTooltip(cCanvas, tipC, cohortMatrix, heatGeomCustomers, "Customer retention");
  bindHeatmapTooltip(rCanvas, tipR, revenueMatrix, heatGeomRevenue, "Revenue retention");
}

function presetLabel(preset) {
  return `${preset.granularity} · ret=${preset.includeReturns ? "1" : "0"} · anon=${preset.includeAnon ? "1" : "0"}`;
}

function updateExploreMeta(meta) {
  const v = meta?.variant || {};
  const parts = [
    v.granularity ? `granularity=${v.granularity}` : null,
    `returns=${v.include_returns ? "on" : "off"}`,
    `anon=${v.include_anon ? "on" : "off"}`,
  ].filter(Boolean);
  el("metaLine").textContent = parts.length ? parts.join(" · ") : "—";
}

function avgAtOffset(matrix, offset) {
  const idx = (matrix?.offsets || []).indexOf(offset);
  if (idx < 0) return null;
  let s = 0;
  let n = 0;
  const vals = matrix?.values || [];
  for (const row of vals) {
    const v = Number(row?.[idx]);
    if (!Number.isFinite(v)) continue;
    s += v;
    n += 1;
  }
  return n ? s / n : null;
}

function totalRepeatersShare(segments) {
  const segs = segments || [];
  let customers = 0;
  let repeaters = 0;
  for (const s of segs) {
    customers += Number(s.customers || 0);
    repeaters += Number(s.repeaters || 0);
  }
  return customers > 0 ? repeaters / customers : null;
}

function topSegmentShare(segments) {
  const segs = segments || [];
  const total = segs.reduce((acc, s) => acc + Math.max(0, Number(s.revenue || 0)), 0);
  if (total <= 0 || segs.length === 0) return null;
  const top = [...segs].sort((a, b) => (Number(b.revenue || 0) - Number(a.revenue || 0)))[0];
  const share = Math.max(0, Number(top.revenue || 0)) / total;
  return { segment: top.segment || "—", share };
}

function fmtDeltaPct(x) {
  if (x == null || !Number.isFinite(x)) return "—";
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(2)} pp`;
}

function fmtPct(x) {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}

function renderDeltaGrid(items) {
  const root = el("deltaGrid");
  root.innerHTML = "";
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "delta-item";
    const k = document.createElement("div");
    k.className = "delta-item__k";
    k.textContent = it.label;
    const v = document.createElement("div");
    v.className = "delta-item__v mono";

    const badge = document.createElement("span");
    badge.className = "delta-badge";
    badge.textContent = it.valueText;
    if (it.deltaSign === "pos") badge.classList.add("delta-badge--pos");
    if (it.deltaSign === "neg") badge.classList.add("delta-badge--neg");
    v.appendChild(badge);

    row.appendChild(k);
    row.appendChild(v);
    root.appendChild(row);
  }
}

function deltaSignFromPp(pp) {
  if (pp == null || !Number.isFinite(pp) || Math.abs(pp) < 1e-9) return null;
  return pp > 0 ? "pos" : "neg";
}

function renderCompareHeatmaps(aData, bData) {
  const aCanvas = el("heatCustomersA");
  const bCanvas = el("heatCustomersB");
  const tipA = el("tipCustomersA");
  const tipB = el("tipCustomersB");

  const aGeom = prepareHeatmap(aCanvas, aData.cohort_matrix, { cellSize: 9, padding: 10, color0: "#f8fafc", color1: "#2563eb" });
  const bGeom = prepareHeatmap(bCanvas, bData.cohort_matrix, { cellSize: 9, padding: 10, color0: "#f8fafc", color1: "#2563eb" });

  bindHeatmapTooltip(aCanvas, tipA, aData.cohort_matrix, aGeom, "A retention");
  bindHeatmapTooltip(bCanvas, tipB, bData.cohort_matrix, bGeom, "B retention");
}

async function loadExplore() {
  const url = variantUrl(state);
  setStatus(`Loading ${variantFileName(state)}…`, "info");
  try {
    const data = await fetchJson(url);
    showMissing(false);
    updateExploreMeta(data.meta);
    renderSanity(data.sanity);
    renderExploreHeatmaps(data.cohort_matrix, data.revenue_matrix);
    renderSegments(data.segments, data.segment_bars);
    setStatus("", "info");
  } catch (e) {
    showMissing(true);
    el("metaLine").textContent = "—";
    setStatus("", "info");
    console.warn("Failed to load variant", url, e);
  }
}

async function loadCompare() {
  const aUrl = variantUrl(state.a);
  const bUrl = variantUrl(state.b);
  setStatus(`Loading A=${variantFileName(state.a)} and B=${variantFileName(state.b)}…`, "info");

  try {
    const [aData, bData] = await Promise.all([fetchJson(aUrl), fetchJson(bUrl)]);
    showMissing(false);

    el("compareMeta").textContent = `A: ${presetLabel(state.a)} · B: ${presetLabel(state.b)}`;
    el("aMeta").textContent = presetLabel(state.a);
    el("bMeta").textContent = presetLabel(state.b);

    renderCompareHeatmaps(aData, bData);

    const a1 = avgAtOffset(aData.cohort_matrix, 1);
    const a2 = avgAtOffset(aData.cohort_matrix, 2);
    const b1 = avgAtOffset(bData.cohort_matrix, 1);
    const b2 = avgAtOffset(bData.cohort_matrix, 2);

    const ar1 = avgAtOffset(aData.revenue_matrix, 1);
    const ar2 = avgAtOffset(aData.revenue_matrix, 2);
    const br1 = avgAtOffset(bData.revenue_matrix, 1);
    const br2 = avgAtOffset(bData.revenue_matrix, 2);

    const repA = totalRepeatersShare(aData.segments);
    const repB = totalRepeatersShare(bData.segments);

    const topB = topSegmentShare(bData.segments);
    let topDelta = null;
    if (topB) {
      const seg = topB.segment;
      const shareB = topB.share;
      const totalA = (aData.segments || []).reduce((acc, s) => acc + Math.max(0, Number(s.revenue || 0)), 0);
      const segA = (aData.segments || []).find((s) => s.segment === seg);
      const shareA = totalA > 0 ? Math.max(0, Number(segA?.revenue || 0)) / totalA : null;
      if (shareA != null) topDelta = { segment: seg, a: shareA, b: shareB };
    }

    const items = [
      {
        label: "Avg customer retention @ offset 1",
        valueText: fmtDeltaPct(((b1 ?? 0) - (a1 ?? 0))),
        deltaSign: deltaSignFromPp(((b1 ?? 0) - (a1 ?? 0))),
      },
      {
        label: "Avg customer retention @ offset 2",
        valueText: fmtDeltaPct(((b2 ?? 0) - (a2 ?? 0))),
        deltaSign: deltaSignFromPp(((b2 ?? 0) - (a2 ?? 0))),
      },
      {
        label: "Avg revenue retention @ offset 1",
        valueText: fmtDeltaPct(((br1 ?? 0) - (ar1 ?? 0))),
        deltaSign: deltaSignFromPp(((br1 ?? 0) - (ar1 ?? 0))),
      },
      {
        label: "Avg revenue retention @ offset 2",
        valueText: fmtDeltaPct(((br2 ?? 0) - (ar2 ?? 0))),
        deltaSign: deltaSignFromPp(((br2 ?? 0) - (ar2 ?? 0))),
      },
      {
        label: "Repeaters share (customers with ≥2 orders)",
        valueText: repA == null || repB == null ? "—" : fmtDeltaPct(((repB - repA) * 100)),
        deltaSign: repA == null || repB == null ? null : deltaSignFromPp(((repB - repA) * 100)),
      },
      {
        label: topDelta ? `Top segment revenue share: ${topDelta.segment}` : "Top segment revenue share",
        valueText: topDelta ? fmtDeltaPct(((topDelta.b - topDelta.a) * 100)) : "—",
        deltaSign: topDelta ? deltaSignFromPp(((topDelta.b - topDelta.a) * 100)) : null,
      },
    ];

    renderDeltaGrid(items);
    setStatus("", "info");
  } catch (e) {
    showMissing(true);
    el("compareMeta").textContent = "—";
    el("aMeta").textContent = "—";
    el("bMeta").textContent = "—";
    setStatus("", "info");
    console.warn("Failed to load compare variants", e);
  }
}

function setMode(mode) {
  state.mode = mode;
  const btnExplore = el("modeExplore");
  const btnCompare = el("modeCompare");
  btnExplore.classList.toggle("is-active", mode === MODE.EXPLORE);
  btnCompare.classList.toggle("is-active", mode === MODE.COMPARE);
  btnExplore.setAttribute("aria-selected", mode === MODE.EXPLORE ? "true" : "false");
  btnCompare.setAttribute("aria-selected", mode === MODE.COMPARE ? "true" : "false");

  el("exploreControls").classList.toggle("hidden", mode !== MODE.EXPLORE);
  el("compareControls").classList.toggle("hidden", mode !== MODE.COMPARE);

  el("exploreView").classList.toggle("hidden", mode !== MODE.EXPLORE);
  el("compareView").classList.toggle("hidden", mode !== MODE.COMPARE);
  el("missingData").classList.add("hidden");

  if (mode === MODE.EXPLORE) loadExplore();
  else loadCompare();
}

function initControls() {
  // Mode
  el("modeExplore").addEventListener("click", () => setMode(MODE.EXPLORE));
  el("modeCompare").addEventListener("click", () => setMode(MODE.COMPARE));

  // Explore controls
  const tRet = el("toggleReturns");
  const tAnon = el("toggleAnon");
  const gran = el("granularitySelect");

  tRet.checked = state.includeReturns;
  tAnon.checked = state.includeAnon;
  gran.value = state.granularity;

  tRet.addEventListener("change", () => {
    state.includeReturns = Boolean(tRet.checked);
    if (state.mode === MODE.EXPLORE) loadExplore();
  });
  tAnon.addEventListener("change", () => {
    state.includeAnon = Boolean(tAnon.checked);
    if (state.mode === MODE.EXPLORE) loadExplore();
  });
  gran.addEventListener("change", () => {
    state.granularity = gran.value === "week" ? "week" : "month";
    if (state.mode === MODE.EXPLORE) loadExplore();
  });

  // Compare controls
  const aGran = el("aGran");
  const aRet = el("aRet");
  const aAnon = el("aAnon");
  const bGran = el("bGran");
  const bRet = el("bRet");
  const bAnon = el("bAnon");

  aGran.value = state.a.granularity;
  aRet.checked = state.a.includeReturns;
  aAnon.checked = state.a.includeAnon;
  bGran.value = state.b.granularity;
  bRet.checked = state.b.includeReturns;
  bAnon.checked = state.b.includeAnon;

  const onCompareChange = () => {
    state.a.granularity = aGran.value === "week" ? "week" : "month";
    state.a.includeReturns = Boolean(aRet.checked);
    state.a.includeAnon = Boolean(aAnon.checked);
    state.b.granularity = bGran.value === "week" ? "week" : "month";
    state.b.includeReturns = Boolean(bRet.checked);
    state.b.includeAnon = Boolean(bAnon.checked);
    if (state.mode === MODE.COMPARE) loadCompare();
  };
  aGran.addEventListener("change", onCompareChange);
  aRet.addEventListener("change", onCompareChange);
  aAnon.addEventListener("change", onCompareChange);
  bGran.addEventListener("change", onCompareChange);
  bRet.addEventListener("change", onCompareChange);
  bAnon.addEventListener("change", onCompareChange);

  // Ensure charts re-render on resize for crispness
  window.addEventListener("resize", () => {
    if (!el("missingData").classList.contains("hidden")) return;
    if (state.mode === MODE.EXPLORE) loadExplore();
    else loadCompare();
  });
}

initControls();
setMode(MODE.EXPLORE);

