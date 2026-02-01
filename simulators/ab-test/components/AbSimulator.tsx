'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { createEngine } from "../lib/engine";
import { CTR_AGG, METRICS, STAT_TEST, STOP_REASON, defaultConfig, type AbConfig } from "../lib/types";

// UI refactor: guided scenarios; sim logic untouched.

function fmtPct(x: number, digits = 2) {
  return `${(x * 100).toFixed(digits)}%`;
}
function fmtNum(x: number, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : "—";
}
function fmtInt(x: number) {
  return Number.isFinite(x) ? Math.round(x).toString() : "—";
}
function fmtP(x: number) {
  if (!Number.isFinite(x)) return "—";
  if (x < 1e-4) return "< 0.0001";
  return x.toFixed(4);
}

type ScenarioId = "perfect" | "peeking" | "sutva";
type Scenario = {
  id: ScenarioId;
  title: string;
  description: string;
  apply: (current: AbConfig) => Partial<AbConfig>;
};

const SCENARIOS: Scenario[] = [
  {
    id: "perfect",
    title: "Perfect A/B",
    description: "Baseline: balanced split, no interference, no peeking.",
    apply: (current) => ({
      ...current,
      allocPreset: "50/50",
      spilloverPct: 0,
      peekingEnabled: false,
      alpha: 0.05,
      horizonUsers: 3000,
      arrivalsPerMin: 120,
      metric: METRICS.CTR,
      ctrAggregation: CTR_AGG.PER_USER,
      statTest: STAT_TEST.AUTO,
      seed: "scenario-perfect",
    }),
  },
  {
    id: "peeking",
    title: "Peeking trap",
    description: "Peeking ON: repeated looks can stop early and inflate false positives.",
    apply: (current) => ({
      ...current,
      allocPreset: "50/50",
      spilloverPct: 0,
      peekingEnabled: true,
      alpha: 0.05,
      lookEveryUsers: 100,
      horizonUsers: 5000,
      arrivalsPerMin: 120,
      statTest: STAT_TEST.AUTO,
      seed: "scenario-peeking",
    }),
  },
  {
    id: "sutva",
    title: "SUTVA dilution",
    description: "Spillover in Control dilutes/contaminates the effect (closest preset: 10%).",
    apply: (current) => ({
      ...current,
      allocPreset: "50/50",
      spilloverPct: 0.1,
      peekingEnabled: false,
      alpha: 0.05,
      horizonUsers: 3000,
      arrivalsPerMin: 120,
      statTest: STAT_TEST.AUTO,
      seed: "scenario-sutva",
    }),
  },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700">
      {children}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div>{children}</div>
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

export function AbSimulator() {
  const [cfg, setCfg] = useState<AbConfig>(() => defaultConfig());
  const [showCtrComparison, setShowCtrComparison] = useState(true);
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>("perfect");

  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  if (!engineRef.current) engineRef.current = createEngine(cfg);

  const [snap, setSnap] = useState(() => engineRef.current!.getSnapshot());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const eng = engineRef.current!;
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

  function patchCfg(patch: Partial<AbConfig>) {
    const eng = engineRef.current!;
    eng.updateConfig(patch);
    setCfg((c) => ({ ...c, ...patch }));
    setSnap(eng.getSnapshot());
  }

  function resetWith(nextCfg: AbConfig) {
    const eng = engineRef.current!;
    eng.setRunning(false);
    eng.reset(nextCfg);
    setCfg(nextCfg);
    setSnap(eng.getSnapshot());
  }

  function applyScenario(id: ScenarioId) {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    setActiveScenarioId(id);
    const nextCfg: AbConfig = { ...cfg, ...scenario.apply(cfg) };
    resetWith(nextCfg);
  }

  useEffect(() => {
    // Ensure deterministic initial scenario.
    applyScenario("perfect");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flags = useMemo(() => {
    const out: string[] = [];
    if (cfg.peekingEnabled && snap.stopReason === STOP_REASON.PEEKING) {
      out.push("Peeking stopping rule inflates false positives (stopped early).");
    }
    if (cfg.spilloverPct > 0) out.push("SUTVA violation: interference/spillover contaminates Control outcomes.");
    if (cfg.allocPreset !== "50/50") out.push("Group imbalance reduces power and can distort variance assumptions.");
    if (cfg.metric === METRICS.CTR && cfg.ctrAggregation === CTR_AGG.PER_EVENT) {
      out.push("Aggregation mismatch risk: CTR computed per-event instead of per-user.");
    }
    return out;
  }, [cfg, snap.stopReason]);

  const verdict = useMemo(() => {
    const ended = snap.stopReason !== STOP_REASON.NONE;
    if (!ended) return { label: "RUNNING", tone: "bg-gray-100 text-gray-900 border-gray-200" };
    if (flags.length > 0) return { label: "NOT RELIABLE", tone: "bg-red-50 text-red-800 border-red-200" };
    return { label: "RELIABLE", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }, [snap.stopReason, flags.length]);

  const metricLabel = cfg.metric === METRICS.CTR ? "CTR" : cfg.metric === METRICS.CR ? "CR" : "ARPU";
  const metricFormatter = (x: number) => (cfg.metric === METRICS.ARPU ? `$${fmtNum(x, 3)}` : fmtPct(x, 2));

  const history = snap.history;
  const last = history.length ? history[history.length - 1] : null;

  const stopMarker = useMemo(() => {
    if (snap.stopReason === STOP_REASON.NONE) return null;
    if (!last) return null;
    return { x: last.t, p: last.p };
  }, [snap.stopReason, last]);

  const ciText = useMemo(() => {
    const ci = snap.ci as { lo: number; hi: number } | undefined;
    const diff = snap.metricT - snap.metricC;
    if (!ci || !Number.isFinite(ci.lo) || !Number.isFinite(ci.hi)) return "—";
    if (cfg.metric === METRICS.ARPU) return `${fmtNum(diff, 4)} (95% CI: ${fmtNum(ci.lo, 4)} … ${fmtNum(ci.hi, 4)})`;
    return `${fmtPct(diff, 3)} (95% CI: ${fmtPct(ci.lo, 3)} … ${fmtPct(ci.hi, 3)})`;
  }, [snap, cfg.metric]);

  const btnBase =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";

  const activeScenario = SCENARIOS.find((s) => s.id === activeScenarioId);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">A/B Test Simulator (Live)</h1>
              <Chip>Live</Chip>
              <Chip>Educational</Chip>
            </div>
            <div className="max-w-3xl text-sm text-gray-600">
              Users arrive over time. Watch metrics, uplift, and p-values evolve—and see how peeking, spillover,
              imbalance, and aggregation choices can mislead you.
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {SCENARIOS.map((s) => {
                const isActive = s.id === activeScenarioId;
                return (
                  <button
                    key={s.id}
                    className={
                      isActive
                        ? "rounded-lg border border-gray-900 bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                        : btnBase
                    }
                    onClick={() => applyScenario(s.id)}
                  >
                    {s.title}
                  </button>
                );
              })}
            </div>

            {activeScenario ? (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <span className="font-semibold text-gray-900">Scenario:</span> {activeScenario.title} —{" "}
                <span className="text-gray-700">{activeScenario.description}</span>
                <div className="mt-1 text-xs text-gray-500">
                  Scenario presets controls; you can still toggle mistakes manually.
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={btnBase}
              onClick={() => {
                const eng = engineRef.current!;
                if (snap.stopReason !== STOP_REASON.NONE) return;
                eng.setRunning(!eng.isRunning());
                setSnap(eng.getSnapshot());
              }}
              disabled={snap.stopReason !== STOP_REASON.NONE}
            >
              {engineRef.current!.isRunning() ? "Pause" : "Play"}
            </button>
            <button
              className={btnBase}
              onClick={() => {
                const eng = engineRef.current!;
                if (snap.stopReason !== STOP_REASON.NONE) return;
                eng.setRunning(false);
                eng.step(1);
                setSnap(eng.getSnapshot());
              }}
              disabled={snap.stopReason !== STOP_REASON.NONE}
            >
              Step
            </button>
            <button
              className={btnBase}
              onClick={() => {
                const eng = engineRef.current!;
                eng.setRunning(false);
                eng.reset(cfg);
                setSnap(eng.getSnapshot());
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Users (C/T)</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
              {fmtInt(snap.control.users)} / {fmtInt(snap.test.users)}
            </div>
            <div className="mt-1 text-xs text-gray-500">Total: {fmtInt(snap.totalUsers)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Current {metricLabel} (C/T)</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
              {metricFormatter(snap.metricC)} / {metricFormatter(snap.metricT)}
            </div>
            <div className="mt-1 text-xs text-gray-500">Uplift: {fmtPct(snap.uplift, 2)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Current p-value</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{fmtP(snap.p)}</div>
            <div className="mt-1 text-xs text-gray-500">α = {fmtP(cfg.alpha)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Flags</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{flags.length}</div>
            <div className="mt-1 text-xs text-gray-500">{flags.length ? "See verdict reasons below" : "No flags triggered"}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Time elapsed</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">{fmtInt(snap.tick)}s</div>
            <div className="mt-1 text-xs text-gray-500">
              {snap.stopReason === STOP_REASON.PEEKING
                ? `Stopped early at ${fmtInt(snap.stoppedAtUsers ?? 0)} users`
                : snap.stopReason === STOP_REASON.HORIZON
                  ? "Reached fixed horizon"
                  : "Simulated seconds"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Controls</div>
              <div className="text-xs text-gray-500">Reset to apply seed deterministically</div>
            </div>

            <div className="space-y-4">
              <Field label="Speed" hint="How many simulated seconds per animation frame.">
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={String(cfg.speed)}
                  onChange={(e) => patchCfg({ speed: Number(e.target.value) })}
                >
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                  <option value="8">8×</option>
                </select>
              </Field>

              <Field label="Seed" hint="Same seed + same settings → same curves after Reset.">
                <input
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={cfg.seed}
                  onChange={(e) => patchCfg({ seed: e.target.value })}
                />
              </Field>

              <Field label="Arrivals per minute" hint="Poisson arrivals; each tick is 1 simulated second.">
                <input
                  className="w-full"
                  type="range"
                  min={10}
                  max={600}
                  step={5}
                  value={cfg.arrivalsPerMin}
                  onChange={(e) => patchCfg({ arrivalsPerMin: Number(e.target.value) })}
                />
                <div className="text-right text-sm text-gray-700 tabular-nums">{fmtInt(cfg.arrivalsPerMin)}</div>
              </Field>

              <Field label="Horizon users" hint="Fixed horizon mode stops when total users reaches this number.">
                <input
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  type="number"
                  min={200}
                  step={50}
                  value={cfg.horizonUsers}
                  onChange={(e) => patchCfg({ horizonUsers: Number(e.target.value) })}
                />
              </Field>

              <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">A/B “mistakes”</div>

              <Field label="Allocation preset" hint="Group imbalance changes power; test share is 50% / 40% / 30%.">
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={cfg.allocPreset}
                  onChange={(e) => patchCfg({ allocPreset: e.target.value as AbConfig["allocPreset"] })}
                >
                  <option value="50/50">50/50</option>
                  <option value="60/40">60/40</option>
                  <option value="70/30">70/30</option>
                </select>
              </Field>

              <Field label="Spillover (SUTVA violation)" hint="Some Control users behave like Test outcomes, but stay labeled Control.">
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={String(cfg.spilloverPct)}
                  onChange={(e) => patchCfg({ spilloverPct: Number(e.target.value) })}
                >
                  <option value="0">0%</option>
                  <option value="0.1">10%</option>
                  <option value="0.3">30%</option>
                  <option value="0.6">60%</option>
                </select>
              </Field>

              <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Analysis</div>

              <Field label="Metric" hint="Charts and tests follow this selection.">
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={cfg.metric}
                  onChange={(e) => patchCfg({ metric: e.target.value as AbConfig["metric"] })}
                >
                  <option value={METRICS.CTR}>CTR</option>
                  <option value={METRICS.CR}>CR</option>
                  <option value={METRICS.ARPU}>ARPU</option>
                </select>
              </Field>

              {cfg.metric === METRICS.CTR ? (
                <>
                  <Field label="CTR aggregation" hint="Per-event uses clicks/impressions; per-user averages each user’s CTR.">
                    <select
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={cfg.ctrAggregation}
                      onChange={(e) => patchCfg({ ctrAggregation: e.target.value as AbConfig["ctrAggregation"] })}
                    >
                      <option value={CTR_AGG.PER_EVENT}>Per-event (clicks / impressions)</option>
                      <option value={CTR_AGG.PER_USER}>Per-user (mean(clicks_i / impr_i))</option>
                    </select>
                  </Field>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={showCtrComparison}
                      onChange={(e) => setShowCtrComparison(e.target.checked)}
                    />
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">Show CTR aggregation comparison</div>
                      <div className="text-xs text-gray-500">Highlights how aggregation choice can change conclusions.</div>
                    </div>
                  </label>
                </>
              ) : null}

              <Field label="Stat test" hint="MVP-level tests. CTR per-event uses an event-level z-test (simplification).">
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  value={cfg.statTest}
                  onChange={(e) => patchCfg({ statTest: e.target.value as AbConfig["statTest"] })}
                >
                  <option value={STAT_TEST.AUTO}>Auto (recommended)</option>
                  <option value={STAT_TEST.Z_EVENT}>z-test (event-level)</option>
                  <option value={STAT_TEST.Z_USER}>z-test (user-level)</option>
                  <option value={STAT_TEST.WELCH}>Welch t-test (user-level)</option>
                </select>
              </Field>

              <Field label="alpha" hint="Significance threshold used for p-value chart and peeking rule.">
                <input
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  type="number"
                  step={0.001}
                  min={0.001}
                  max={0.2}
                  value={cfg.alpha}
                  onChange={(e) => patchCfg({ alpha: Number(e.target.value) })}
                />
              </Field>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={cfg.peekingEnabled}
                  onChange={(e) => patchCfg({ peekingEnabled: e.target.checked })}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-900">Peeking (stop early when p &lt; α)</div>
                  <div className="text-xs text-gray-500">Interim looks inflate false positives unless corrected.</div>
                </div>
              </label>

              {cfg.peekingEnabled ? (
                <Field label="Look every users" hint="At each look boundary we recompute p; if p < α we stop early.">
                  <input
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                    type="number"
                    min={50}
                    step={50}
                    value={cfg.lookEveryUsers}
                    onChange={(e) => patchCfg({ lookEveryUsers: Number(e.target.value) })}
                  />
                </Field>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">{metricLabel} over time</div>
                <div className="text-xs text-gray-500">Control vs Test</div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip formatter={(v) => metricFormatter(Number(v))} labelFormatter={(l) => `t = ${l}s`} />
                    <Legend />
                    <Line type="monotone" dataKey="metricC" name="Control" dot={false} />
                    <Line type="monotone" dataKey="metricT" name="Test" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {cfg.metric === METRICS.CTR && showCtrComparison ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500">Per-event CTR</div>
                    <div className="mt-1 text-sm text-gray-900 tabular-nums">
                      C: {fmtPct(last?.ctrC_event ?? 0, 2)} / T: {fmtPct(last?.ctrT_event ?? 0, 2)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500">Per-user CTR</div>
                    <div className="mt-1 text-sm text-gray-900 tabular-nums">
                      C: {fmtPct(last?.ctrC_user ?? 0, 2)} / T: {fmtPct(last?.ctrT_user ?? 0, 2)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Uplift over time</div>
                <div className="text-xs text-gray-500">(Test − Control) / Control</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip formatter={(v) => fmtPct(Number(v), 2)} labelFormatter={(l) => `t = ${l}s`} />
                    <Line type="monotone" dataKey="uplift" name="Uplift" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">p-value over time</div>
                <div className="text-xs text-gray-500">α line + stop marker (peeking)</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(v) => fmtP(Number(v))} labelFormatter={(l) => `t = ${l}s`} />
                    <Line type="monotone" dataKey="p" name="p-value" dot={false} />
                    <ReferenceLine y={cfg.alpha} strokeDasharray="4 4" />
                    {stopMarker ? <ReferenceDot x={stopMarker.x} y={stopMarker.p} r={5} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-gray-900">Final verdict</div>
                  <div className={`inline-flex items-center rounded-xl border px-3 py-2 text-base font-semibold ${verdict.tone}`}>
                    {verdict.label}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    Final effect (Test − Control):{" "}
                    <span className="tabular-nums text-gray-900">
                      {cfg.metric === METRICS.ARPU ? `$${fmtNum(snap.metricT - snap.metricC, 4)}` : fmtPct(snap.metricT - snap.metricC, 3)}
                    </span>{" "}
                    · Uplift: <span className="tabular-nums text-gray-900">{fmtPct(snap.uplift, 2)}</span> · p-value:{" "}
                    <span className="tabular-nums text-gray-900">{fmtP(snap.p)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    95% CI (diff): <span className="tabular-nums text-gray-900">{ciText}</span>
                  </div>
                </div>

                <div className="w-full max-w-xl">
                  <div className="text-sm font-semibold text-gray-900">Reasons / flags</div>
                  {flags.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-600">No reliability flags triggered by the selected toggles.</div>
                  ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                      {flags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                    Notes: CTR per-event z-test treats impressions as independent trials (event-level approximation). This simulator is for learning dynamics and failure modes.
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500">
                Tip: enable peeking (look-every=200) and keep seed fixed to see how early stopping can “discover” significance.
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Determinism: hit Reset after changing seed/controls to reproduce identical curves.
        </div>
      </div>
    </div>
  );
}

