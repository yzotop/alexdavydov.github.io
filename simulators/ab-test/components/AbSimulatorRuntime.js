import * as React from "https://esm.sh/react@18";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "https://esm.sh/recharts@2.12.7?deps=react@18,react-dom@18";

import { createEngine } from "../lib/engine.js";
import { CTR_AGG, METRICS, STAT_TEST, STOP_REASON, defaultConfig } from "../lib/types.js";

// UI refactor: verdict moved to top; sim logic untouched.
// UI refactor: fixed Control/Test colors + mistake markers; sim logic untouched.

const h = React.createElement;
const { useEffect, useMemo, useRef, useState } = React;

const PALETTE = {
  CONTROL_COLOR: "#2563EB",
  TEST_COLOR: "#F97316",
  NEUTRAL_GRID: "#E5E7EB",
  WARNING_BG: "#FEF3C7",
  WARNING_TEXT: "#92400E",
  DANGER_BG: "#FEE2E2",
  DANGER_TEXT: "#991B1B",
};

function fmtPct(x, digits = 2) {
  return `${(x * 100).toFixed(digits)}%`;
}
function fmtNum(x, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}
function fmtInt(x) {
  return Number.isFinite(x) ? Math.round(x).toString() : "—";
}
function fmtP(x) {
  if (!Number.isFinite(x)) return "—";
  if (x < 1e-4) return "< 0.0001";
  return x.toFixed(4);
}

function formatTime(s) {
  const sec = Math.max(0, Math.round(Number(s) || 0));
  if (sec <= 600) {
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  }
  if (sec <= 2 * 3600) {
    const m = Math.round(sec / 60);
    return `${m}m`;
  }
  const m5 = Math.round(sec / 300) * 5; // rounded to 5 min
  const h = Math.floor(m5 / 60);
  const m = m5 % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function makeTimeTicks(tMax) {
  const max = Math.max(0, Math.round(Number(tMax) || 0));
  let step = 3600;
  if (max <= 600) step = 60;
  else if (max <= 3600) step = 300;
  else if (max <= 21600) step = 900;
  else step = 3600;

  const tMaxRounded = Math.ceil(max / step) * step;
  const out = [];
  for (let t = 0; t <= tMaxRounded; t += step) out.push(t);
  if (out[out.length - 1] !== tMaxRounded) out.push(tMaxRounded);
  return out;
}

function dot(color) {
  return h("span", { className: "inline-block h-2 w-2 rounded-full", style: { background: color } });
}

function Pill({ text, tone = "bg-gray-100 text-gray-900 border-gray-200" }) {
  return h(
    "span",
    { className: `inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}` },
    text
  );
}

function Chip(text) {
  return h(
    "span",
    {
      className:
        "inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700",
    },
    text
  );
}

function Card({ title, value, sub }) {
  return h(
    "div",
    { className: "card p-4" },
    h("div", { className: "text-xs font-medium uppercase tracking-wide text-gray-500" }, title),
    h("div", { className: "mono mt-1 text-2xl font-semibold text-gray-900" }, value),
    sub ? h("div", { className: "mt-1 text-xs text-gray-500" }, sub) : null
  );
}

function Field({ label, hint, control }) {
  return h(
    "div",
    { className: "space-y-1" },
    h("div", { className: "text-sm font-medium text-gray-900" }, label),
    control,
    hint ? h("div", { className: "text-xs text-gray-500" }, hint) : null
  );
}

function Select({ value, onChange, options }) {
  return h(
    "select",
    {
      className:
        "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500",
      value,
      onChange: (e) => onChange(e.target.value),
    },
    options.map((o) => h("option", { key: o.value, value: o.value }, o.label))
  );
}

function Input({ value, onChange, type = "text", step, min, max }) {
  return h("input", {
    className:
      "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500",
    value,
    type,
    step,
    min,
    max,
    onChange: (e) => onChange(e.target.value),
  });
}

function Checkbox({ checked, onChange, label, hint }) {
  return h(
    "label",
    { className: "flex items-start gap-3" },
    h("input", { type: "checkbox", className: "mt-1", checked, onChange: (e) => onChange(e.target.checked) }),
    h(
      "div",
      { className: "space-y-1" },
      h("div", { className: "text-sm font-medium text-gray-900" }, label),
      hint ? h("div", { className: "text-xs text-gray-500" }, hint) : null
    )
  );
}

function AccordionSection({ title, right, open, onToggle, children, tone }) {
  const headerClass =
    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left";
  const hdrTone = tone ?? "border-gray-200 bg-white hover:bg-gray-50";
  return h(
    "div",
    { className: "space-y-2" },
    h(
      "button",
      { type: "button", className: `${headerClass} ${hdrTone}`, onClick: onToggle, "aria-expanded": open },
      h(
        "div",
        { className: "flex min-w-0 items-center gap-3" },
        h("span", { className: "text-sm font-semibold text-gray-900" }, title),
        right ? h("span", { className: "min-w-0" }, right) : null
      ),
      h("span", { className: "text-xs text-gray-500" }, open ? "Hide" : "Show")
    ),
    open ? h("div", { className: "rounded-xl border border-gray-200 bg-gray-50 p-4" }, children) : null
  );
}

function FlagChip({ label }) {
  return h("span", {
    className:
      "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-800",
    title: label,
  }, label);
}

function StatusBar({
  status,
  metricLabel,
  metricCT,
  upliftAbs,
  upliftRel,
  pText,
  alphaText,
  ciText,
  mistakeChips,
  onPlayPause,
  onStep,
  onReset,
  disabledControls,
  isRunning,
}) {
  const btnClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";

  return h(
    "div",
    {
      className:
        "sticky top-0 z-50 -mx-4 border-b border-gray-200 bg-white px-4 py-3 shadow-sm",
    },
    h(
      "div",
      { className: "mx-auto max-w-7xl space-y-2" },
      h(
        "div",
        { className: "flex flex-wrap items-center justify-between gap-3" },
        h(
          "div",
          { className: "flex min-w-0 flex-wrap items-center gap-2" },
          h(Pill, { text: status.label, tone: status.tone }),
          h("div", { className: "mono text-sm text-gray-900" }, `${metricLabel}: ${metricCT}`),
          h(
            "div",
            { className: "mono text-sm text-gray-700" },
            `Δ: ${upliftAbs} · uplift: ${upliftRel}`
          ),
          h("div", { className: "mono text-sm text-gray-700" }, `p: ${pText} (α=${alphaText})`),
          ciText && ciText !== "—" ? h("div", { className: "hidden text-xs text-gray-500 md:block" }, ciText) : null
        ),
        h(
          "div",
          { className: "flex items-center gap-2" },
          h(
            "button",
            { className: btnClass, onClick: onPlayPause, disabled: disabledControls },
            isRunning ? "Pause" : "Play"
          ),
          h("button", { className: btnClass, onClick: onStep, disabled: disabledControls }, "Step"),
          h("button", { className: btnClass, onClick: onReset }, "Reset")
        )
      ),
      h("div", { className: "flex flex-wrap items-center gap-2" }, mistakeChips && mistakeChips.length ? mistakeChips : null)
    )
  );
}

function VerdictSummary({ status, metricLabel, effectAbs, upliftRel, pText, ciText }) {
  return h(
    "div",
    { className: "rounded-xl border border-gray-200 bg-gray-50 p-5" },
    h("div", { className: "flex flex-wrap items-center gap-2" }, h(Pill, { text: status.label, tone: status.tone }), h("div", { className: "text-sm font-semibold text-gray-900" }, "Verdict summary")),
    h(
      "div",
      { className: "mt-2 text-sm text-gray-700" },
      h("span", { className: "font-medium text-gray-900" }, `${metricLabel} effect:`),
      " ",
      h("span", { className: "mono text-gray-900" }, effectAbs),
      " · uplift ",
      h("span", { className: "mono text-gray-900" }, upliftRel),
      " · p ",
      h("span", { className: "mono text-gray-900" }, pText)
    ),
    h(
      "div",
      { className: "mt-1 text-sm text-gray-700" },
      h("span", { className: "font-medium text-gray-900" }, "95% CI:"),
      " ",
      h("span", { className: "mono text-gray-900" }, ciText)
    )
  );
}

function ReasonsList({ reasons, detailsOpen, onToggleDetails }) {
  const shown = reasons.slice(0, 6);
  return h(
    "div",
    { className: "rounded-xl border border-gray-200 bg-gray-50 p-5" },
    h(
      "div",
      { className: "flex items-center justify-between gap-3" },
      h("div", { className: "text-sm font-semibold text-gray-900" }, "Reasons / flags"),
      h(
        "button",
        { type: "button", className: "text-sm font-medium text-blue-700 hover:underline", onClick: onToggleDetails },
        detailsOpen ? "Hide details" : "Show details"
      )
    ),
    shown.length
      ? h(
          "ul",
          { className: "mt-2 list-disc space-y-1 pl-5 text-sm text-gray-800" },
          shown.map((r, i) => h("li", { key: i }, r))
        )
      : h("div", { className: "mt-2 text-sm text-gray-600" }, "No active flags."),
    detailsOpen
      ? h(
          "div",
          { className: "mt-3 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600" },
          "Details: CTR per-event z-test treats impressions as independent trials (event-level approximation). Peeking without correction inflates false positives."
        )
      : null
  );
}

export function AbSimulatorRuntime() {
  const [cfg, setCfg] = useState(() => defaultConfig());
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createEngine(cfg);

  const [snap, setSnap] = useState(() => engineRef.current.getSnapshot());
  const [showCtrComparison, setShowCtrComparison] = useState(true);
  const [secondaryChart, setSecondaryChart] = useState("p");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uiEvents, setUiEvents] = useState(() => []);
  const [openSec, setOpenSec] = useState(() => ({
    speedSeed: true,
    arrivalsHorizon: false,
    outcome: false,
    mistakes: true,
    analysis: true,
  }));

  // rAF loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const eng = engineRef.current;
      if (eng.isRunning()) {
        eng.updateConfig(cfg);
        eng.step(cfg.speed);
        setSnap(eng.getSnapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg]);

  function patchCfg(patch) {
    const eng = engineRef.current;
    // UI-level mistake toggle event log (sim logic untouched).
    const now = {
      t: snap.tick,
      nC: snap.control.users,
      nT: snap.test.users,
    };
    const mistakeKeys = ["allocPreset", "spilloverPct", "peekingEnabled", "lookEveryUsers", "ctrAggregation", "statTest"];
    const nextEvents = [];
    for (const k of Object.keys(patch)) {
      if (!mistakeKeys.includes(k)) continue;
      const prevV = cfg[k];
      const nextV = patch[k];
      if (prevV === nextV) continue;
      nextEvents.push({ key: k, value: nextV, t: now.t, nC: now.nC, nT: now.nT });
    }
    if (nextEvents.length) {
      setUiEvents((ev) => [...ev, ...nextEvents].slice(-20));
    }
    eng.updateConfig(patch);
    setCfg((c) => ({ ...c, ...patch }));
    setSnap(eng.getSnapshot());
  }

  const metricLabel = cfg.metric === METRICS.CTR ? "CTR" : cfg.metric === METRICS.CR ? "CR" : "ARPU";
  const metricFormatter = (x) => (cfg.metric === METRICS.ARPU ? `$${fmtNum(x, 3)}` : fmtPct(x, 2));

  const activeFlags = useMemo(() => {
    const imbalance = cfg.allocPreset !== "50/50";
    const sutva = cfg.spilloverPct > 0;
    const peeking = cfg.peekingEnabled && snap.stopReason === STOP_REASON.PEEKING;
    const aggregationMismatch = cfg.metric === METRICS.CTR && cfg.ctrAggregation === CTR_AGG.PER_EVENT;
    const wrongTest =
      (cfg.metric === METRICS.ARPU && cfg.statTest !== STAT_TEST.AUTO && cfg.statTest !== STAT_TEST.WELCH) ||
      (cfg.metric === METRICS.CR && cfg.statTest === STAT_TEST.Z_EVENT) ||
      (cfg.metric === METRICS.CTR &&
        cfg.statTest !== STAT_TEST.AUTO &&
        ((cfg.ctrAggregation === CTR_AGG.PER_USER && cfg.statTest === STAT_TEST.Z_EVENT) ||
          (cfg.ctrAggregation === CTR_AGG.PER_EVENT && cfg.statTest === STAT_TEST.WELCH)));
    return { imbalance, sutva, peeking, aggregationMismatch, wrongTest };
  }, [cfg, snap.stopReason]);

  const status = useMemo(() => {
    if (snap.stopReason === STOP_REASON.NONE) return { label: "RUNNING", tone: "bg-gray-100 text-gray-900 border-gray-200" };
    if (snap.stopReason === STOP_REASON.HORIZON) {
      return snap.p < cfg.alpha
        ? { label: "SIGNIFICANT", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" }
        : { label: "NOT SIGNIFICANT", tone: "bg-gray-100 text-gray-900 border-gray-200" };
    }
    return { label: "STOPPED", tone: "bg-amber-50 text-amber-800 border-amber-200" };
  }, [snap.stopReason, snap.p, cfg.alpha]);

  const history = snap.history;
  const last = history.length ? history[history.length - 1] : null;
  const stopMarker = snap.stopReason === STOP_REASON.NONE || !last ? null : { x: last.t, p: last.p };

  const ciText = useMemo(() => {
    const ci = snap.ci;
    const diff = snap.metricT - snap.metricC;
    if (!ci || !Number.isFinite(ci.lo) || !Number.isFinite(ci.hi)) return "—";
    if (cfg.metric === METRICS.ARPU) return `${fmtNum(diff, 4)} (95% CI: ${fmtNum(ci.lo, 4)} … ${fmtNum(ci.hi, 4)})`;
    return `${fmtPct(diff, 3)} (95% CI: ${fmtPct(ci.lo, 3)} … ${fmtPct(ci.hi, 3)})`;
  }, [snap, cfg.metric]);

  const header = h(
    "div",
    { className: "space-y-1" },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-3" },
      h("h1", { className: "text-2xl font-semibold text-gray-900" }, "A/B Test Simulator (Live)"),
      Chip("Live"),
      Chip("Educational")
    ),
    h(
      "div",
      { className: "max-w-3xl text-sm text-gray-600" },
      "Users arrive over time. Watch metrics, uplift, and p-values evolve as sample accumulates."
    )
  );

  function eventLabel(ev) {
    if (ev.key === "spilloverPct") return `SUTVA ${Number(ev.value) > 0 ? "ON" : "OFF"}`;
    if (ev.key === "peekingEnabled") return `PEEKING ${ev.value ? "ON" : "OFF"}`;
    if (ev.key === "allocPreset") return `ALLOC ${ev.value}`;
    if (ev.key === "ctrAggregation") return `CTR ${ev.value === CTR_AGG.PER_EVENT ? "per-event" : "per-user"}`;
    if (ev.key === "statTest") return `TEST ${String(ev.value).toUpperCase()}`;
    if (ev.key === "lookEveryUsers") return `LOOK ${ev.value}`;
    return `${ev.key}=${String(ev.value)}`;
  }

  function isMistakeActiveByKey(key) {
    if (key === "spilloverPct") return cfg.spilloverPct > 0;
    if (key === "peekingEnabled") return !!cfg.peekingEnabled;
    if (key === "allocPreset") return cfg.allocPreset !== "50/50";
    if (key === "ctrAggregation") return cfg.metric === METRICS.CTR && cfg.ctrAggregation === CTR_AGG.PER_EVENT;
    if (key === "statTest") return activeFlags.wrongTest;
    return false;
  }

  function sinceInfoForKey(key) {
    for (let i = uiEvents.length - 1; i >= 0; i--) {
      const ev = uiEvents[i];
      if (ev.key !== key) continue;
      // "since" = last change that made it active
      if (key === "spilloverPct" && Number(ev.value) > 0) return ev;
      if (key === "peekingEnabled" && !!ev.value) return ev;
      if (key === "allocPreset" && String(ev.value) !== "50/50") return ev;
      if (key === "ctrAggregation" && ev.value === CTR_AGG.PER_EVENT) return ev;
      if (key === "statTest") return ev;
    }
    return null;
  }

  const mistakeChips = useMemo(() => {
    const chips = [];
    const defs = [
      {
        key: "allocPreset",
        label: "Imbalance",
        tip: "Expected bias: power ↓ (wider CI), slower detection.",
      },
      {
        key: "spilloverPct",
        label: "SUTVA",
        tip: "Expected bias: contamination dilutes/biases the estimated effect.",
      },
      {
        key: "peekingEnabled",
        label: "Peeking",
        tip: "Expected bias: ↑ false positives due to repeated looks.",
      },
      {
        key: "ctrAggregation",
        label: "Aggregation mismatch",
        tip: "Expected bias: unit-of-analysis mismatch can flip conclusions.",
      },
      {
        key: "statTest",
        label: "Wrong test",
        tip: "Expected bias: p/CI not aligned with metric unit.",
      },
    ];
    for (const d of defs) {
      const active = isMistakeActiveByKey(d.key);
      const since = sinceInfoForKey(d.key);
      const sinceTxt = since ? `since t=${since.t}s · n≈${since.nC + since.nT}` : "since t=?";
      chips.push(
        h(
          "span",
          {
            key: d.key,
            className: active
              ? "inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-900"
              : "inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[12px] font-medium text-gray-500",
            title: `${d.label}\n${d.tip}`,
          },
          d.label,
          h("span", { className: "mono text-[11px] opacity-80" }, sinceTxt)
        )
      );
    }
    const anyActive = defs.some((d) => isMistakeActiveByKey(d.key));
    if (!anyActive) {
      chips.unshift(
        h(
          "span",
          {
            key: "none",
            className:
              "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-800",
            title: "No mistakes active.\nExpected bias: none (baseline).",
          },
          "No mistakes"
        )
      );
    }
    return chips;
  }, [cfg, activeFlags, uiEvents]);

  function renderEventMarkers() {
    return uiEvents.map((ev, idx) =>
      h(ReferenceLine, {
        key: `${ev.key}-${ev.t}-${idx}`,
        x: ev.t,
        stroke: PALETTE.WARNING_TEXT,
        strokeOpacity: 0.6,
        strokeDasharray: "3 3",
        label: { value: eventLabel(ev), position: "top", fill: PALETTE.WARNING_TEXT, fontSize: 10 },
      })
    );
  }

  const axisTicks = useMemo(() => makeTimeTicks(last?.t ?? 0), [last?.t]);
  const tMaxAxis = axisTicks.length ? axisTicks[axisTicks.length - 1] : 0;

  const activeSinceMarkers = useMemo(() => {
    /** @type {Map<number, string[]>} */
    const byT = new Map();
    const add = (label, since) => {
      if (!since) return;
      const t = since.t;
      const arr = byT.get(t) ?? [];
      if (!arr.includes(label)) arr.push(label);
      byT.set(t, arr);
    };
    if (isMistakeActiveByKey("peekingEnabled")) add("Peeking", sinceInfoForKey("peekingEnabled"));
    if (isMistakeActiveByKey("spilloverPct")) add("SUTVA", sinceInfoForKey("spilloverPct"));
    if (isMistakeActiveByKey("allocPreset")) add("Imbalance", sinceInfoForKey("allocPreset"));
    if (isMistakeActiveByKey("ctrAggregation")) add("Agg mismatch", sinceInfoForKey("ctrAggregation"));
    if (isMistakeActiveByKey("statTest")) add("Wrong test", sinceInfoForKey("statTest"));
    return [...byT.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, labels]) => ({ t, label: labels.join(" / ") }));
  }, [cfg, activeFlags, uiEvents]);

  function renderActiveSinceLines() {
    return activeSinceMarkers.map((m, idx) =>
      h(ReferenceLine, {
        key: `since-${m.t}-${idx}`,
        x: m.t,
        stroke: PALETTE.WARNING_TEXT,
        strokeOpacity: 0.55,
        strokeDasharray: "4 4",
        label: {
          value: m.label,
          position: "top",
          fill: PALETTE.WARNING_TEXT,
          fontSize: 10,
          dy: 10 + (idx % 3) * 12,
        },
      })
    );
  }

  const kpis = h(
    "div",
    { className: "grid grid-cols-1 gap-3 md:grid-cols-4" },
    h(Card, {
      title: "Users (C/T)",
      value: h(
        "span",
        { className: "inline-flex items-center gap-2" },
        h("span", { style: { color: PALETTE.CONTROL_COLOR } }, fmtInt(snap.control.users)),
        h("span", { className: "text-gray-400" }, "/"),
        h("span", { style: { color: PALETTE.TEST_COLOR } }, fmtInt(snap.test.users))
      ),
      sub: `Total: ${fmtInt(snap.totalUsers)} · t=${fmtInt(snap.tick)}s`,
    }),
    h(Card, {
      title: `Current ${metricLabel} (C/T)`,
      value: h(
        "span",
        { className: "inline-flex items-center gap-2" },
        h("span", { className: "inline-flex items-center gap-1", style: { color: PALETTE.CONTROL_COLOR } }, dot(PALETTE.CONTROL_COLOR), metricFormatter(snap.metricC)),
        h("span", { className: "text-gray-400" }, "/"),
        h("span", { className: "inline-flex items-center gap-1", style: { color: PALETTE.TEST_COLOR } }, dot(PALETTE.TEST_COLOR), metricFormatter(snap.metricT))
      ),
      sub: `Δ=${cfg.metric === METRICS.ARPU ? `$${fmtNum(snap.metricT - snap.metricC, 4)}` : fmtPct(snap.metricT - snap.metricC, 3)} · uplift=${fmtPct(snap.uplift, 2)}`,
    }),
    h(Card, { title: "Current p-value", value: fmtP(snap.p), sub: `α = ${fmtP(cfg.alpha)} · ${snap.stopReason === STOP_REASON.HORIZON ? "fixed horizon" : snap.stopReason === STOP_REASON.PEEKING ? "stopped early" : "live"}` }),
    h(Card, { title: "Flags", value: `${Object.values(activeFlags).filter(Boolean).length}`, sub: Object.values(activeFlags).some(Boolean) ? "See chips in verdict bar" : "No active flags" })
  );

  const mistakesBadges = [
    cfg.peekingEnabled ? h(Pill, { text: "↑ false positives", tone: "bg-amber-50 text-amber-800 border-amber-200" }) : null,
    cfg.spilloverPct > 0 ? h(Pill, { text: "bias risk", tone: "bg-amber-50 text-amber-800 border-amber-200" }) : null,
    cfg.allocPreset !== "50/50" ? h(Pill, { text: "power ↓", tone: "bg-amber-50 text-amber-800 border-amber-200" }) : null,
    cfg.metric === METRICS.CTR && cfg.ctrAggregation === CTR_AGG.PER_EVENT
      ? h(Pill, { text: "metric mismatch", tone: "bg-amber-50 text-amber-800 border-amber-200" })
      : null,
  ].filter(Boolean);

  const controls = h(
    "div",
    { className: "space-y-3" },
    h(
      AccordionSection,
      {
        title: "Mistakes toggles",
        right: mistakesBadges.length ? h("span", { className: "flex flex-wrap gap-2" }, mistakesBadges) : null,
        open: openSec.mistakes,
        onToggle: () => setOpenSec((s) => ({ ...s, mistakes: !s.mistakes })),
        tone: "border-amber-200 bg-amber-50 hover:bg-amber-50",
      },
      h(
        "div",
        { className: "space-y-4" },
        h(Field, {
          label: "Allocation preset",
          hint: "Imbalance → lower power and wider variance.",
          control: h(Select, {
            value: cfg.allocPreset,
            onChange: (v) => patchCfg({ allocPreset: v }),
            options: [
              { value: "50/50", label: "50/50" },
              { value: "60/40", label: "60/40" },
              { value: "70/30", label: "70/30" },
            ],
          }),
        }),
        h(Field, {
          label: "Spillover % (SUTVA)",
          hint: "Interference contaminates control → effect dilution / bias.",
          control: h(Select, {
            value: String(cfg.spilloverPct),
            onChange: (v) => patchCfg({ spilloverPct: Number(v) }),
            options: [
              { value: "0", label: "0%" },
              { value: "0.1", label: "10%" },
              { value: "0.3", label: "30%" },
              { value: "0.6", label: "60%" },
            ],
          }),
        }),
        h(Checkbox, {
          checked: cfg.peekingEnabled,
          onChange: (v) => patchCfg({ peekingEnabled: v }),
          label: "Peeking (stop when p < α)",
          hint: "Early stopping without correction inflates false positives.",
        }),
        cfg.peekingEnabled
          ? h(Field, { label: "lookEveryUsers", hint: "More looks → more chances to stop early.", control: h(Input, { type: "number", min: 50, step: 50, value: cfg.lookEveryUsers, onChange: (v) => patchCfg({ lookEveryUsers: Number(v) }) }) })
          : null
      )
    ),
    h(
      AccordionSection,
      {
        title: "Speed & Seed",
        open: openSec.speedSeed,
        onToggle: () => setOpenSec((s) => ({ ...s, speedSeed: !s.speedSeed })),
      },
      h(
        "div",
        { className: "space-y-4" },
        h(Field, {
          label: "Speed",
          hint: "How many simulated seconds per animation frame.",
          control: h(Select, {
            value: String(cfg.speed),
            onChange: (v) => patchCfg({ speed: Number(v) }),
            options: [
              { value: "1", label: "1×" },
              { value: "2", label: "2×" },
              { value: "4", label: "4×" },
              { value: "8", label: "8×" },
            ],
          }),
        }),
        h(Field, { label: "Seed", hint: "Same seed + same settings → same curves after Reset.", control: h(Input, { value: cfg.seed, onChange: (v) => patchCfg({ seed: v }) }) })
      )
    ),
    h(
      AccordionSection,
      {
        title: "Arrivals & Horizon",
        open: openSec.arrivalsHorizon,
        onToggle: () => setOpenSec((s) => ({ ...s, arrivalsHorizon: !s.arrivalsHorizon })),
      },
      h(
        "div",
        { className: "space-y-4" },
        h(Field, { label: "Arrivals per minute", hint: "Poisson arrivals; each tick is 1 simulated second.", control: h(Input, { type: "number", min: 10, step: 5, value: cfg.arrivalsPerMin, onChange: (v) => patchCfg({ arrivalsPerMin: Number(v) }) }) }),
        h(Field, { label: "Horizon users", hint: "Fixed horizon mode stops at this total users.", control: h(Input, { type: "number", min: 200, step: 50, value: cfg.horizonUsers, onChange: (v) => patchCfg({ horizonUsers: Number(v) }) }) })
      )
    ),
    h(
      AccordionSection,
      {
        title: "Outcome model",
        open: openSec.outcome,
        onToggle: () => setOpenSec((s) => ({ ...s, outcome: !s.outcome })),
      },
      h(
        "div",
        { className: "space-y-4" },
        h(Field, { label: "baseCTR", hint: "Control CTR baseline.", control: h(Input, { type: "number", step: 0.001, min: 0.001, max: 0.3, value: cfg.baseCTR, onChange: (v) => patchCfg({ baseCTR: Number(v) }) }) }),
        h(Field, { label: "upliftCTR", hint: "Relative lift for Test CTR (e.g. 0.05 = +5%).", control: h(Input, { type: "number", step: 0.01, min: -0.5, max: 0.5, value: cfg.upliftCTR, onChange: (v) => patchCfg({ upliftCTR: Number(v) }) }) }),
        h(Field, { label: "imprRate", hint: "Per-user impressions ~ Poisson(imprRate).", control: h(Input, { type: "number", step: 1, min: 0, max: 30, value: cfg.imprRate, onChange: (v) => patchCfg({ imprRate: Number(v) }) }) }),
        h(Field, { label: "buyProb", hint: "Per-user purchase probability.", control: h(Input, { type: "number", step: 0.01, min: 0, max: 1, value: cfg.buyProb, onChange: (v) => patchCfg({ buyProb: Number(v) }) }) }),
        h(Field, { label: "revMu", hint: "LogNormal mu.", control: h(Input, { type: "number", step: 0.1, value: cfg.revMu, onChange: (v) => patchCfg({ revMu: Number(v) }) }) }),
        h(Field, { label: "revSigma", hint: "LogNormal sigma.", control: h(Input, { type: "number", step: 0.1, min: 0.1, value: cfg.revSigma, onChange: (v) => patchCfg({ revSigma: Number(v) }) }) })
      )
    ),
    h(
      AccordionSection,
      {
        title: "Analysis",
        open: openSec.analysis,
        onToggle: () => setOpenSec((s) => ({ ...s, analysis: !s.analysis })),
      },
      h(
        "div",
        { className: "space-y-4" },
        h(Field, {
          label: "Metric",
          hint: "CTR / CR / ARPU.",
          control: h(Select, {
            value: cfg.metric,
            onChange: (v) => patchCfg({ metric: v }),
            options: [
              { value: METRICS.CTR, label: "CTR" },
              { value: METRICS.CR, label: "CR" },
              { value: METRICS.ARPU, label: "ARPU" },
            ],
          }),
        }),
        cfg.metric === METRICS.CTR
          ? h(
              React.Fragment,
              null,
              h(Field, {
                label: "CTR aggregation",
                hint: "Per-user vs per-event (unit-of-analysis).",
                control: h(Select, {
                  value: cfg.ctrAggregation,
                  onChange: (v) => patchCfg({ ctrAggregation: v }),
                  options: [
                    { value: CTR_AGG.PER_USER, label: "Per-user" },
                    { value: CTR_AGG.PER_EVENT, label: "Per-event" },
                  ],
                }),
              }),
              h(Checkbox, {
                checked: showCtrComparison,
                onChange: (v) => setShowCtrComparison(v),
                label: "Show CTR aggregation comparison",
                hint: "Compare per-event vs per-user CTR side by side.",
              })
            )
          : null,
        h(Field, {
          label: "Stat test",
          hint: "MVP tests; CTR per-event uses event-level z-test (approx).",
          control: h(Select, {
            value: cfg.statTest,
            onChange: (v) => patchCfg({ statTest: v }),
            options: [
              { value: STAT_TEST.AUTO, label: "Auto" },
              { value: STAT_TEST.Z_EVENT, label: "z-test (event-level)" },
              { value: STAT_TEST.Z_USER, label: "z-test (user-level)" },
              { value: STAT_TEST.WELCH, label: "Welch t-test" },
            ],
          }),
        }),
        h(Field, { label: "alpha", hint: "Used for p-value chart and peeking rule.", control: h(Input, { type: "number", step: 0.001, min: 0.001, max: 0.2, value: cfg.alpha, onChange: (v) => patchCfg({ alpha: Number(v) }) }) })
      )
    )
  );

  const chartMetric = h(
    "div",
    { className: "card p-5" },
    h(
      "div",
      { className: "mb-3 flex items-center justify-between gap-3" },
      h(
        "div",
        { className: "flex items-center gap-2 text-sm font-semibold text-gray-900" },
        dot(PALETTE.CONTROL_COLOR),
        h("span", null, "Control"),
        dot(PALETTE.TEST_COLOR),
        h("span", null, "Test"),
        h("span", { className: "ml-2" }, `${metricLabel} over time`)
      ),
      h("div", { className: "text-xs text-gray-500" }, "Control vs Test")
    ),
    h(
      "div",
      { className: "h-72" },
      h(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        h(
          LineChart,
          { data: history },
          h(CartesianGrid, { stroke: PALETTE.NEUTRAL_GRID, strokeOpacity: 0.6, strokeDasharray: "3 3" }),
          h(XAxis, {
            dataKey: "t",
            type: "number",
            domain: [0, tMaxAxis],
            ticks: axisTicks,
            tickFormatter: formatTime,
            allowDecimals: false,
            minTickGap: 20,
          }),
          h(YAxis, { domain: ["auto", "auto"] }),
          h(Tooltip, {
            formatter: (v, name) => (name === "metricC" || name === "metricT" ? metricFormatter(v) : v),
            labelFormatter: (l) => `t = ${formatTime(Number(l))}`,
          }),
          h(Legend, null),
          h(Line, { type: "monotone", dataKey: "metricC", name: "Control", dot: false, stroke: PALETTE.CONTROL_COLOR, strokeWidth: 2.5 }),
          h(Line, { type: "monotone", dataKey: "metricT", name: "Test", dot: false, stroke: PALETTE.TEST_COLOR, strokeWidth: 2.5 }),
          renderActiveSinceLines()
        )
      )
    ),
    cfg.metric === METRICS.CTR && showCtrComparison
      ? h(
          "div",
          { className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" },
          h(
            "div",
            { className: "rounded-lg border border-gray-200 bg-white p-3" },
            h("div", { className: "text-xs font-semibold text-gray-500" }, "Per-event CTR"),
            h(
              "div",
              { className: "mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-900 mono" },
              h("span", { className: "inline-flex items-center gap-2" }, dot(PALETTE.CONTROL_COLOR), `C: ${fmtPct(last?.ctrC_event ?? 0)}`),
              h("span", { className: "inline-flex items-center gap-2" }, dot(PALETTE.TEST_COLOR), `T: ${fmtPct(last?.ctrT_event ?? 0)}`)
            )
          ),
          h(
            "div",
            { className: "rounded-lg border border-gray-200 bg-white p-3" },
            h("div", { className: "text-xs font-semibold text-gray-500" }, "Per-user CTR"),
            h(
              "div",
              { className: "mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-900 mono" },
              h("span", { className: "inline-flex items-center gap-2" }, dot(PALETTE.CONTROL_COLOR), `C: ${fmtPct(last?.ctrC_user ?? 0)}`),
              h("span", { className: "inline-flex items-center gap-2" }, dot(PALETTE.TEST_COLOR), `T: ${fmtPct(last?.ctrT_user ?? 0)}`)
            )
          )
        )
      : null
  );

  const chartUplift = h(
    "div",
    { className: "card p-5" },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, h("div", { className: "text-sm font-semibold text-gray-900" }, "Uplift over time"), h("div", { className: "text-xs text-gray-500" }, "(Test − Control) / Control")),
    h(
      "div",
      { className: "h-56" },
      h(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        h(
          LineChart,
          { data: history },
          h(CartesianGrid, { stroke: PALETTE.NEUTRAL_GRID, strokeOpacity: 0.6, strokeDasharray: "3 3" }),
          h(XAxis, {
            dataKey: "t",
            type: "number",
            domain: [0, tMaxAxis],
            ticks: axisTicks,
            tickFormatter: formatTime,
            allowDecimals: false,
            minTickGap: 20,
          }),
          h(YAxis, { domain: ["auto", "auto"] }),
          h(Tooltip, { formatter: (v) => fmtPct(v, 2), labelFormatter: (l) => `t = ${formatTime(Number(l))}` }),
          h(Line, { type: "monotone", dataKey: "uplift", name: "Uplift", dot: false, stroke: PALETTE.TEST_COLOR, strokeWidth: 2.5 }),
          renderActiveSinceLines()
        )
      )
    )
  );

  const chartP = h(
    "div",
    { className: "card p-5" },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, h("div", { className: "text-sm font-semibold text-gray-900" }, "p-value over time"), h("div", { className: "text-xs text-gray-500" }, "α line + stop marker")),
    h(
      "div",
      { className: "h-56" },
      h(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        h(
          LineChart,
          { data: history },
          h(CartesianGrid, { stroke: PALETTE.NEUTRAL_GRID, strokeOpacity: 0.6, strokeDasharray: "3 3" }),
          h(XAxis, {
            dataKey: "t",
            type: "number",
            domain: [0, tMaxAxis],
            ticks: axisTicks,
            tickFormatter: formatTime,
            allowDecimals: false,
            minTickGap: 20,
          }),
          h(YAxis, { domain: [0, 1] }),
          h(Tooltip, { formatter: (v) => fmtP(v), labelFormatter: (l) => `t = ${formatTime(Number(l))}` }),
          h(Line, { type: "monotone", dataKey: "p", name: "p-value", dot: false, stroke: PALETTE.CONTROL_COLOR, strokeWidth: 2.5 }),
          h(ReferenceLine, { y: cfg.alpha, strokeDasharray: "4 4" }),
          stopMarker ? h(ReferenceDot, { x: stopMarker.x, y: stopMarker.p, r: 5 }) : null
          ,
          renderActiveSinceLines()
        )
      )
    )
  );

  const chartN = h(
    "div",
    { className: "card p-5" },
    h("div", { className: "mb-3 flex items-center justify-between gap-3" }, h("div", { className: "text-sm font-semibold text-gray-900" }, "Sample size over time"), h("div", { className: "text-xs text-gray-500" }, "Users in Control/Test")),
    h(
      "div",
      { className: "h-48" },
      h(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        h(
          LineChart,
          { data: history },
          h(CartesianGrid, { stroke: PALETTE.NEUTRAL_GRID, strokeOpacity: 0.6, strokeDasharray: "3 3" }),
          h(XAxis, {
            dataKey: "t",
            type: "number",
            domain: [0, tMaxAxis],
            ticks: axisTicks,
            tickFormatter: formatTime,
            allowDecimals: false,
            minTickGap: 20,
          }),
          h(YAxis, null),
          h(Tooltip, { labelFormatter: (l) => `t = ${formatTime(Number(l))}` }),
          h(Legend, null),
          h(Line, { type: "monotone", dataKey: "usersC", name: "Users (Control)", dot: false, stroke: PALETTE.CONTROL_COLOR, strokeWidth: 2.5 }),
          h(Line, { type: "monotone", dataKey: "usersT", name: "Users (Test)", dot: false, stroke: PALETTE.TEST_COLOR, strokeWidth: 2.5 }),
          renderActiveSinceLines()
        )
      )
    )
  );

  const secondarySelector = h(
    "div",
    { className: "mb-2 flex flex-wrap items-center justify-between gap-3" },
    h("div", { className: "text-sm font-semibold text-gray-900" }, "Secondary chart"),
    h(Select, {
      value: secondaryChart,
      onChange: (v) => setSecondaryChart(v),
      options: [
        { value: "p", label: "p-value" },
        { value: "uplift", label: "uplift" },
        { value: "n", label: "sample size" },
      ],
    })
  );

  const secondaryChartNode = secondaryChart === "uplift" ? chartUplift : secondaryChart === "n" ? chartN : chartP;

  const charts = h(
    "div",
    { className: "space-y-6" },
    chartMetric,
    h("div", { className: "space-y-2" }, secondarySelector, secondaryChartNode)
  );

  const flagChips = mistakeChips;

  const reasons = [
    activeFlags.peeking ? "Peeking → inflated false positives via repeated looks." : null,
    activeFlags.sutva ? "SUTVA violation → contamination dilutes/biases effect." : null,
    activeFlags.imbalance ? "Imbalance → power ↓ (harder to detect real effects)." : null,
    activeFlags.aggregationMismatch ? "Aggregation mismatch → metric unit-of-analysis drift." : null,
    activeFlags.wrongTest ? "Wrong test choice → p-values/CI not aligned with metric." : null,
  ].filter(Boolean);

  const activeMistakesSummary = h(
    "div",
    { className: "rounded-xl border border-gray-200 bg-gray-50 p-4" },
    h(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-3" },
      h("div", { className: "text-sm font-semibold text-gray-900" }, "Active mistakes"),
      h("div", { className: "text-xs text-gray-500" }, "Toggles → markers on charts")
    ),
    h("div", { className: "mt-2 flex flex-wrap items-center gap-2" }, mistakeChips)
  );

  return h(
    "div",
    { className: "min-h-screen px-4 py-8" },
    h(
      "div",
      { className: "mx-auto max-w-7xl space-y-6" },
      header,
      h(StatusBar, {
        status,
        metricLabel,
        metricCT: h(
          "span",
          { className: "inline-flex items-center gap-2" },
          h("span", { className: "inline-flex items-center gap-1", style: { color: PALETTE.CONTROL_COLOR } }, dot(PALETTE.CONTROL_COLOR), metricFormatter(snap.metricC)),
          h("span", { className: "text-gray-400" }, "/"),
          h("span", { className: "inline-flex items-center gap-1", style: { color: PALETTE.TEST_COLOR } }, dot(PALETTE.TEST_COLOR), metricFormatter(snap.metricT))
        ),
        upliftAbs: cfg.metric === METRICS.ARPU ? `$${fmtNum(snap.metricT - snap.metricC, 4)}` : fmtPct(snap.metricT - snap.metricC, 3),
        upliftRel: fmtPct(snap.uplift, 2),
        pText: fmtP(snap.p),
        alphaText: fmtP(cfg.alpha),
        ciText,
        mistakeChips: flagChips,
        disabledControls: snap.stopReason !== STOP_REASON.NONE,
        isRunning: engineRef.current.isRunning(),
        onPlayPause: () => {
          const eng = engineRef.current;
          if (snap.stopReason !== STOP_REASON.NONE) return;
          eng.setRunning(!eng.isRunning());
          setSnap(eng.getSnapshot());
        },
        onStep: () => {
          const eng = engineRef.current;
          if (snap.stopReason !== STOP_REASON.NONE) return;
          eng.setRunning(false);
          eng.step(1);
          setSnap(eng.getSnapshot());
        },
        onReset: () => {
          const eng = engineRef.current;
          eng.setRunning(false);
          eng.reset(cfg);
          setSnap(eng.getSnapshot());
        },
      }),
      kpis,
      h(
        "div",
        { className: "grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]" },
        h("div", { className: "space-y-4" }, activeMistakesSummary, controls),
        charts
      ),
      null
    )
  );
}

