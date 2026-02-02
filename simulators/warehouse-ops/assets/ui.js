import { defaultConfig, normalizeScenarioConfig } from "../engine/model.js";
import { WarehouseSim } from "../engine/sim.js";
import { loadScenarios, windowsMinutesToString, windowsStringToMinutes } from "../engine/scenarios.js";
import { drawLineChart } from "./charts.js";
import { FlowMap } from "./flow_map.js";

const el = (id) => document.getElementById(id);

const speedMap = {
  "1": { ticksPerFrame: 1, renderEvery: 5 },
  "4": { ticksPerFrame: 8, renderEvery: 20 },
  "20": { ticksPerFrame: 40, renderEvery: 50 },
  "max": { ticksPerFrame: 250, renderEvery: 50 },
};

const ui = {
  status: el("status"),
  scenarioSelect: el("scenarioSelect"),
  scenarioDesc: el("scenarioDesc"),
  seedInput: el("seedInput"),
  horizonInput: el("horizonInput"),
  arrivalInput: el("arrivalInput"),
  slaInput: el("slaInput"),
  wInbound: el("wInbound"),
  wStorage: el("wStorage"),
  wPick: el("wPick"),
  wPack: el("wPack"),
  wOutbound: el("wOutbound"),
  tInbound: el("tInbound"),
  tStorage: el("tStorage"),
  tPick: el("tPick"),
  tPack: el("tPack"),
  tOutbound: el("tOutbound"),
  jitterInput: el("jitterInput"),
  storageCap: el("storageCap"),
  carrierMode: el("carrierMode"),
  carrierIntervalGroup: el("carrierIntervalGroup"),
  carrierWindowsGroup: el("carrierWindowsGroup"),
  carrierInterval: el("carrierInterval"),
  carrierWindows: el("carrierWindows"),
  carrierCap: el("carrierCap"),
  btnPlay: el("btnPlay"),
  btnPause: el("btnPause"),
  btnStep: el("btnStep"),
  btnReset: el("btnReset"),
  speedSelect: el("speedSelect"),
  flowMap: el("flowMap"),
  // KPIs
  kpiShipped: el("kpiShipped"),
  kpiBacklog: el("kpiBacklog"),
  kpiBreach: el("kpiBreach"),
  kpiLead: el("kpiLead"),
  kpiUtilPick: el("kpiUtilPick"),
  kpiUtilPack: el("kpiUtilPack"),
  clockT: el("clockT"),
  clockH: el("clockH"),
  clockB: el("clockB"),
  // now happening
  nowArr: el("nowArr"),
  nowStart: el("nowStart"),
  nowFin: el("nowFin"),
  nowShip: el("nowShip"),
  nowLateDelta: el("nowLateDelta"),
  nowB: el("nowB"),
  // charts
  chThroughput: el("chThroughput"),
  chBacklog: el("chBacklog"),
  chBreach: el("chBreach"),
  chUtil: el("chUtil"),
  // tape
  tapeBody: el("tapeBody"),
};

let scenarios = [];
let scenarioById = new Map();

let cfg = defaultConfig();
let sim = null;
let playing = false;
let rafId = null;
let renderTickCounter = 0;
let flowMap = null;

const batch = {
  arrivals: 0,
  shipped: 0,
  started: new Int32Array(5),
  finished: new Int32Array(5),
  move: [], // capped per render batch
  lastLateNow: 0,
  lateDelta: 0,
  bottleneck: "—",
};

// Event tape buffer
const tapeMax = 32;
const tape = new Array(tapeMax);
let tapeLen = 0;

function setStatus(msg) {
  if (!msg) {
    ui.status.classList.add("hidden");
    ui.status.textContent = "";
    return;
  }
  ui.status.textContent = msg;
  ui.status.classList.remove("hidden");
}

function fmtPct(x) {
  const v = Math.max(0, Math.min(1, Number(x) || 0));
  return `${(v * 100).toFixed(1)}%`;
}

function fmtInt(x) {
  return (Number(x) || 0).toLocaleString();
}

function fmtMin(x) {
  const v = Math.max(0, Math.round(Number(x) || 0));
  return `${v}m`;
}

function readConfigFromUI() {
  cfg.horizonMin = Number(ui.horizonInput.value) | 0;
  cfg.arrivalRatePerHour = Number(ui.arrivalInput.value);
  cfg.slaHours = Number(ui.slaInput.value);
  cfg.workers.inbound = Number(ui.wInbound.value) | 0;
  cfg.workers.storage = Number(ui.wStorage.value) | 0;
  cfg.workers.pick = Number(ui.wPick.value) | 0;
  cfg.workers.pack = Number(ui.wPack.value) | 0;
  cfg.workers.outbound = Number(ui.wOutbound.value) | 0;

  const jitter = Number(ui.jitterInput.value);
  cfg.proc.inboundMean = Number(ui.tInbound.value);
  cfg.proc.storageMean = Number(ui.tStorage.value);
  cfg.proc.pickMean = Number(ui.tPick.value);
  cfg.proc.packMean = Number(ui.tPack.value);
  cfg.proc.outboundMean = Number(ui.tOutbound.value);
  cfg.proc.inboundJitter = jitter;
  cfg.proc.storageJitter = jitter;
  cfg.proc.pickJitter = jitter;
  cfg.proc.packJitter = jitter;
  cfg.proc.outboundJitter = jitter;

  cfg.limits.storageWipCap = Number(ui.storageCap.value) | 0;

  cfg.carrier.mode = ui.carrierMode.value === "windows" ? "windows" : "interval";
  cfg.carrier.intervalMin = Number(ui.carrierInterval.value) | 0;
  cfg.carrier.capacityPerDeparture = Number(ui.carrierCap.value) | 0;
  cfg.carrier.windows = windowsStringToMinutes(ui.carrierWindows.value);

  cfg = normalizeScenarioConfig(cfg);
}

function applyConfigToUI() {
  ui.horizonInput.value = String(cfg.horizonMin);
  ui.arrivalInput.value = String(cfg.arrivalRatePerHour);
  ui.slaInput.value = String(cfg.slaHours);
  ui.wInbound.value = String(cfg.workers.inbound);
  ui.wStorage.value = String(cfg.workers.storage);
  ui.wPick.value = String(cfg.workers.pick);
  ui.wPack.value = String(cfg.workers.pack);
  ui.wOutbound.value = String(cfg.workers.outbound);
  ui.tInbound.value = String(cfg.proc.inboundMean);
  ui.tStorage.value = String(cfg.proc.storageMean);
  ui.tPick.value = String(cfg.proc.pickMean);
  ui.tPack.value = String(cfg.proc.packMean);
  ui.tOutbound.value = String(cfg.proc.outboundMean);
  ui.jitterInput.value = String(cfg.proc.pickJitter); // shared
  ui.storageCap.value = String(cfg.limits.storageWipCap);
  ui.carrierMode.value = cfg.carrier.mode === "windows" ? "windows" : "interval";
  ui.carrierInterval.value = String(cfg.carrier.intervalMin);
  ui.carrierCap.value = String(cfg.carrier.capacityPerDeparture);
  ui.carrierWindows.value = windowsMinutesToString(cfg.carrier.windows);
  updateCarrierModeUI();
}

function updateCarrierModeUI() {
  const isWindows = ui.carrierMode.value === "windows";
  ui.carrierIntervalGroup.classList.toggle("hidden", isWindows);
  ui.carrierWindowsGroup.classList.toggle("hidden", !isWindows);
}

function resetSim() {
  readConfigFromUI();
  const seed = Math.max(1, Number(ui.seedInput.value) | 0);
  sim = new WarehouseSim(cfg, seed);
  if (flowMap) flowMap.setConfig(cfg);
  tapeLen = 0;
  renderTickCounter = 0;
  ui.clockH.textContent = String(cfg.horizonMin);
  batch.arrivals = 0;
  batch.shipped = 0;
  batch.started.fill(0);
  batch.finished.fill(0);
  batch.move.length = 0;
  batch.lastLateNow = 0;
  batch.lateDelta = 0;
  batch.bottleneck = "—";
  drawAll(true);
}

function stepOnce() {
  if (!sim) return;
  sim.step();
  recordTape();
  drawAll(false);
}

function setPlaying(on) {
  playing = Boolean(on);
  ui.btnPlay.classList.toggle("hidden", playing);
  ui.btnPause.classList.toggle("hidden", !playing);
  ui.btnStep.disabled = playing;
  ui.btnReset.disabled = playing;
  ui.scenarioSelect.disabled = playing;
  if (playing) loop();
  else if (rafId) cancelAnimationFrame(rafId);
}

function recordTape() {
  const snap = sim.snapshot();
  const t = snap.t;
  const e = snap.lastTick;
  const row = {
    t,
    arrivals: e.arrivals,
    shippedNow: e.shippedNow,
    backlog: snap.backlog,
    lateNow: e.lateNow,
    bottleneck: e.bottleneck,
  };
  tape[tapeLen % tapeMax] = row;
  tapeLen += 1;

  // batch aggregation for "Now happening"
  batch.arrivals += e.arrivals | 0;
  batch.shipped += e.shippedNow | 0;
  for (let s = 0; s < 5; s++) {
    batch.started[s] += e.started[s] | 0;
    batch.finished[s] += e.finished[s] | 0;
  }
  batch.bottleneck = e.bottleneck || "—";
  // late delta relative to last rendered lateNow (store last seen each tick)
  batch._lateNow = e.lateNow | 0;

  // collect move events (cap to keep render stable)
  const mc = e.moveCount | 0;
  if (mc > 0 && batch.move.length < 90) {
    const take = Math.min(mc, 90 - batch.move.length);
    for (let i = 0; i < take; i++) {
      batch.move.push({
        id: e.moveId[i] | 0,
        from: e.moveFrom[i] | 0,
        to: e.moveTo[i] | 0,
        size: e.moveSize[i] | 0,
        late: (e.moveLate[i] | 0) === 1,
      });
    }
  }
}

function renderTape() {
  if (!ui.tapeBody) return;
  // fixed rows: 24
  const rows = 24;
  if (!ui._tapeInited) {
    ui.tapeBody.innerHTML = "";
    for (let i = 0; i < rows; i++) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono"></td>
        <td class="right mono"></td>
        <td class="right mono"></td>
        <td class="right mono"></td>
        <td class="right mono"></td>
        <td class="mono"></td>`;
      ui.tapeBody.appendChild(tr);
    }
    ui._tapeInited = true;
  }
  const trs = ui.tapeBody.children;
  const n = Math.min(rows, Math.min(tapeLen, tapeMax));
  const start = Math.max(0, tapeLen - n);
  for (let i = 0; i < rows; i++) {
    const tr = trs[i];
    if (i < n) {
      const idx = (start + (n - 1 - i)) % tapeMax;
      const r = tape[idx];
      tr.children[0].textContent = String(r.t);
      tr.children[1].textContent = String(r.arrivals);
      tr.children[2].textContent = String(r.shippedNow);
      tr.children[3].textContent = String(r.backlog);
      tr.children[4].textContent = String(r.lateNow);
      tr.children[5].textContent = String(r.bottleneck);
    } else {
      for (let c = 0; c < tr.children.length; c++) tr.children[c].textContent = "";
    }
  }
}

function drawAll(force) {
  if (!sim) return;
  const snap = sim.snapshot();
  ui.clockT.textContent = String(snap.t);
  ui.clockB.textContent = String(snap.lastTick.bottleneck);
  ui.kpiShipped.textContent = fmtInt(snap.shipped);
  ui.kpiBacklog.textContent = fmtInt(snap.backlog);
  ui.kpiBreach.textContent = fmtPct(snap.breachRate);
  ui.kpiLead.textContent = fmtMin(snap.avgLeadMin);
  ui.kpiUtilPick.textContent = fmtPct(snap.util.pick);
  ui.kpiUtilPack.textContent = fmtPct(snap.util.pack);

  if (flowMap) {
    const nowMs = performance.now();
    flowMap.syncFromSim(sim, nowMs);
    flowMap.renderFrame(nowMs);
  }

  if (ui.chThroughput) drawLineChart(ui.chThroughput, sim.seriesThroughput, { color: "#2563eb" });
  if (ui.chBacklog) drawLineChart(ui.chBacklog, sim.seriesBacklog, { color: "#111827" });
  if (ui.chBreach) drawLineChart(ui.chBreach, sim.seriesRollingBreach, { color: "#dc2626", yMin: 0, yMax: 1 });

  // Utilization chart: simple alternating render to keep cost low.
  // Draw pick most of the time; every 2nd render draw pack instead.
  if (ui.chUtil) {
    if (!ui._utilFlip) ui._utilFlip = 0;
    ui._utilFlip ^= 1;
    if (ui._utilFlip) drawLineChart(ui.chUtil, sim.seriesUtilPick, { color: "#f59e0b", yMin: 0, yMax: 1 });
    else drawLineChart(ui.chUtil, sim.seriesUtilPack, { color: "#10b981", yMin: 0, yMax: 1 });
  }

  renderTape();

  // "Now happening" (updated only on render batches)
  const lateNow = batch._lateNow | 0;
  batch.lateDelta = (lateNow - (batch.lastLateNow | 0)) | 0;
  batch.lastLateNow = lateNow;
  if (ui.nowArr) ui.nowArr.textContent = String(batch.arrivals | 0);
  if (ui.nowShip) ui.nowShip.textContent = String(batch.shipped | 0);
  if (ui.nowLateDelta) ui.nowLateDelta.textContent = String(batch.lateDelta | 0);
  if (ui.nowB) ui.nowB.textContent = String(batch.bottleneck || "—");
  if (ui.nowStart) ui.nowStart.textContent = `${batch.started[0]}/${batch.started[1]}/${batch.started[2]}/${batch.started[3]}/${batch.started[4]}`;
  if (ui.nowFin) ui.nowFin.textContent = `${batch.finished[0]}/${batch.finished[1]}/${batch.finished[2]}/${batch.finished[3]}/${batch.finished[4]}`;

  // Flow map visuals updated above (sync + frame render)

  // reset batch accumulators after publish
  batch.arrivals = 0;
  batch.shipped = 0;
  batch.started.fill(0);
  batch.finished.fill(0);
  batch.move.length = 0;
}

function loop() {
  if (!playing) return;
  const sp = speedMap[ui.speedSelect.value] || speedMap["1"];
  const ticksPerFrame = sp.ticksPerFrame;
  const renderEvery = sp.renderEvery;

  let ran = 0;
  while (ran < ticksPerFrame) {
    if (!sim.step()) {
      setPlaying(false);
      break;
    }
    recordTape();
    ran += 1;
    renderTickCounter += 1;
  }

  if (renderTickCounter >= renderEvery) {
    renderTickCounter = 0;
    drawAll(false);
  }

  // flow animation frames (cheap): keep movement smooth
  if (flowMap) flowMap.renderFrame(performance.now());

  rafId = requestAnimationFrame(loop);
}

function onScenarioChange() {
  const id = ui.scenarioSelect.value;
  const s = scenarioById.get(id);
  if (!s) return;
  cfg = normalizeScenarioConfig(s.config);
  applyConfigToUI();
  ui.scenarioDesc.textContent = s.description || "";
  resetSim();
}

function wire() {
  ui.carrierMode.addEventListener("change", () => {
    updateCarrierModeUI();
    if (!playing) resetSim();
  });

  const restartOnChange = [
    ui.seedInput, ui.horizonInput, ui.arrivalInput, ui.slaInput,
    ui.wInbound, ui.wStorage, ui.wPick, ui.wPack, ui.wOutbound,
    ui.tInbound, ui.tStorage, ui.tPick, ui.tPack, ui.tOutbound,
    ui.jitterInput, ui.storageCap, ui.carrierInterval, ui.carrierWindows, ui.carrierCap,
  ];
  for (const input of restartOnChange) {
    input.addEventListener("change", () => { if (!playing) resetSim(); });
  }

  ui.btnPlay.addEventListener("click", () => setPlaying(true));
  ui.btnPause.addEventListener("click", () => setPlaying(false));
  ui.btnStep.addEventListener("click", () => stepOnce());
  ui.btnReset.addEventListener("click", () => resetSim());
  ui.speedSelect.addEventListener("change", () => { renderTickCounter = 0; });
  ui.scenarioSelect.addEventListener("change", onScenarioChange);
}

async function init() {
  try {
    scenarios = await loadScenarios();
    scenarioById = new Map(scenarios.map((s) => [s.id, s]));
    ui.scenarioSelect.innerHTML = "";
    for (const s of scenarios) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.title;
      ui.scenarioSelect.appendChild(opt);
    }
    // pick baseline
    ui.scenarioSelect.value = scenarioById.has("baseline_stable") ? "baseline_stable" : scenarios[0]?.id;
    flowMap = new FlowMap(ui.flowMap);
    onScenarioChange();
    wire();
    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus("Failed to load scenarios. Check console.");
  }
}

init();

