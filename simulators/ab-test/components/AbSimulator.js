import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18";
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

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-blue-700">
      {children}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-900">{label}</div>
      </div>
      <div>{children}</div>
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Input({ value, onChange, type = "text", step, min, max }) {
  return (
    <input
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
      value={value}
      type={type}
      step={step}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Slider({ value, onChange, min, max, step }) {
  return (
    <input
      className="w-full"
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function KpiCard({ title, value, sub }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mono mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

export function AbSimulator() {
  const [cfg, setCfg] = useState(() => defaultConfig());
  const [showCtrComparison, setShowCtrComparison] = useState(true);

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createEngine(cfg);

  const [snap, setSnap] = useState(() => engineRef.current.getSnapshot());

  // rAF loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const eng = engineRef.current;
      if (eng.isRunning()) {
        eng.updateConfig(cfg); // allow live knob-turning (except seed determinism lesson)
        eng.step(cfg.speed);
        setSnap(eng.getSnapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg]);

  const usersTotal = snap.totalUsers;
  const flags = useMemo(() => {
    /** @type {string[]} */
    const out = [];
    if (cfg.peekingEnabled && snap.stopReason === STOP_REASON.PEEKING) {
      out.push("Peeking stopping rule inflates false positives (stopped early).");
    }
    if (cfg.spilloverPct > 0) {
      out.push("SUTVA violation: interference/spillover contaminates Control outcomes.");
    }
    if (cfg.allocPreset !== "50/50") {
      out.push("Group imbalance reduces power and can distort variance assumptions.");
    }
    if (cfg.metric === METRICS.CTR && cfg.ctrAggregation === CTR_AGG.PER_EVENT) {
      out.push("Aggregation mismatch risk: CTR computed per-event instead of per-user.");
    }
    return out;
  }, [cfg, snap.stopReason]);

  const verdict = useMemo(() => {
    const ended = snap.stopReason !== STOP_REASON.NONE;
    if (!ended) {
      return { label: "RUNNING", tone: "bg-gray-100 text-gray-900 border-gray-200" };
    }
    if (flags.length > 0) {
      return { label: "NOT RELIABLE", tone: "bg-red-50 text-red-800 border-red-200" };
    }
    return { label: "RELIABLE", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }, [snap.stopReason, flags.length]);

  const metricLabel = cfg.metric === METRICS.CTR ? "CTR" : cfg.metric === METRICS.CR ? "CR" : "ARPU";
  const metricUnit = cfg.metric === METRICS.ARPU ? "$" : "%";
  const metricFormatter = (x) => {
    if (!Number.isFinite(x)) return "—";
    if (cfg.metric === METRICS.ARPU) return `$${fmtNum(x, 3)}`;
    return fmtPct(x, 2);
  };

  const ciText = useMemo(() => {
    const ci = snap.ci;
    const diff = snap.metricT - snap.metricC;
    if (!ci || !Number.isFinite(ci.lo) || !Number.isFinite(ci.hi)) return "—";
    if (cfg.metric === METRICS.ARPU) {
      return `${fmtNum(diff, 4)}  (95% CI: ${fmtNum(ci.lo, 4)} … ${fmtNum(ci.hi, 4)})`;
    }
    return `${fmtPct(diff, 3)}  (95% CI: ${fmtPct(ci.lo, 3)} … ${fmtPct(ci.hi, 3)})`;
  }, [snap, cfg.metric]);

  const history = snap.history;
  const last = history.length ? history[history.length - 1] : null;

  const stopMarker = useMemo(() => {
    if (snap.stopReason === STOP_REASON.NONE) return null;
    if (!last) return null;
    return { x: last.t, p: last.p };
  }, [snap.stopReason, last]);

  function patchCfg(patch) {
    const eng = engineRef.current;
    eng.updateConfig(patch);
    setCfg((c) => ({ ...c, ...patch }));
    setSnap(eng.getSnapshot());
  }

  function onPlayPause() {
    const eng = engineRef.current;
    if (snap.stopReason !== STOP_REASON.NONE) return;
    eng.setRunning(!eng.isRunning());
    setSnap(eng.getSnapshot());
  }

  function onStep() {
    const eng = engineRef.current;
    if (snap.stopReason !== STOP_REASON.NONE) return;
    eng.setRunning(false);
    eng.updateConfig(cfg);
    eng.step(1);
    setSnap(eng.getSnapshot());
  }

  function onReset() {
    const eng = engineRef.current;
    eng.setRunning(false);
    eng.reset(cfg); // re-seeds deterministically
    setSnap(eng.getSnapshot());
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-sm text-gray-500">
              <a className="text-blue-600 hover:underline" href="/">
                Home
              </a>{" "}
              <span className="mx-1">→</span>
              <a className="text-blue-600 hover:underline" href="/simulators/">
                Simulators
              </a>{" "}
              <span className="mx-1">→</span>
              <span className="text-gray-700">A/B Test Simulator (Live)</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-gray-900">A/B Test Simulator (Live)</h1>
              <Chip>Live</Chip>
              <Chip>Educational</Chip>
              {cfg.metric === METRICS.CTR ? <Chip>CTR pitfalls</Chip> : null}
            </div>
            <div className="max-w-3xl text-sm text-gray-600">
              Users arrive over time. Watch metrics, uplift, and p-values evolve as sample accumulates—and see how
              peeking, spillover, imbalance, and aggregation choices can mislead you.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={onPlayPause}
              disabled={snap.stopReason !== STOP_REASON.NONE}
            >
              {engineRef.current.isRunning() ? "Pause" : "Play"}
            </button>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              onClick={onStep}
              disabled={snap.stopReason !== STOP_REASON.NONE}
            >
              Step
            </button>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
              onClick={onReset}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <KpiCard title="Users (C/T)" value={`${fmtInt(snap.control.users)} / ${fmtInt(snap.test.users)}`} sub={`Total: ${fmtInt(usersTotal)}`} />
          <KpiCard title={`Current ${metricLabel} (C/T)`} value={`${metricFormatter(snap.metricC)} / ${metricFormatter(snap.metricT)}`} sub={`Uplift: ${fmtPct(snap.uplift, 2)}`} />
          <KpiCard title="Current p-value" value={fmtP(snap.p)} sub={`α = ${fmtP(cfg.alpha)}`} />
          <KpiCard title="Flags" value={`${flags.length}`} sub={flags.length ? "See verdict reasons below" : "No reliability flags triggered"} />
          <KpiCard title="Time elapsed" value={`${fmtInt(snap.tick)}s`} sub={snap.stopReason === STOP_REASON.PEEKING ? `Stopped early at ${fmtInt(snap.stoppedAtUsers ?? 0)} users` : snap.stopReason === STOP_REASON.HORIZON ? "Reached fixed horizon" : "Simulated seconds"} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Controls */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">Controls</div>
              <div className="text-xs text-gray-500">Reset to apply seed deterministically</div>
            </div>

            <div className="space-y-4">
              <Field label="Speed" hint="How many simulated seconds per animation frame.">
                <Select
                  value={String(cfg.speed)}
                  onChange={(v) => patchCfg({ speed: Number(v) })}
                  options={[
                    { value: "1", label: "1×" },
                    { value: "2", label: "2×" },
                    { value: "4", label: "4×" },
                    { value: "8", label: "8×" },
                  ]}
                />
              </Field>

              <Field label="Seed" hint="Same seed + same settings → same curves after Reset.">
                <Input value={cfg.seed} onChange={(v) => patchCfg({ seed: v })} />
              </Field>

              <Field label="Arrivals per minute" hint="Poisson arrivals; each tick is 1 simulated second.">
                <div className="flex items-center gap-3">
                  <div className="w-28 text-right text-sm text-gray-700 mono">{fmtInt(cfg.arrivalsPerMin)}</div>
                  <Slider value={cfg.arrivalsPerMin} onChange={(v) => patchCfg({ arrivalsPerMin: Number(v) })} min={10} max={600} step={5} />
                </div>
              </Field>

              <Field label="Horizon users" hint="Fixed horizon mode stops when total users reaches this number.">
                <Input
                  type="number"
                  min={200}
                  step={50}
                  value={cfg.horizonUsers}
                  onChange={(v) => patchCfg({ horizonUsers: Number(v) })}
                />
              </Field>

              <div className="pt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outcome model</div>
              </div>

              <Field label="baseCTR" hint="Control CTR baseline. Test CTR = baseCTR × (1 + upliftCTR).">
                <Input
                  type="number"
                  step={0.001}
                  min={0.001}
                  max={0.3}
                  value={cfg.baseCTR}
                  onChange={(v) => patchCfg({ baseCTR: Number(v) })}
                />
              </Field>

              <Field label="upliftCTR" hint="Relative lift for Test CTR (e.g. 0.05 = +5%).">
                <Input
                  type="number"
                  step={0.01}
                  min={-0.5}
                  max={0.5}
                  value={cfg.upliftCTR}
                  onChange={(v) => patchCfg({ upliftCTR: Number(v) })}
                />
              </Field>

              <Field label="imprRate" hint="Per-user impressions ~ Poisson(imprRate).">
                <Input
                  type="number"
                  step={1}
                  min={0}
                  max={30}
                  value={cfg.imprRate}
                  onChange={(v) => patchCfg({ imprRate: Number(v) })}
                />
              </Field>

              <Field label="buyProb" hint="Per-user purchase probability (for CR / ARPU).">
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={cfg.buyProb}
                  onChange={(v) => patchCfg({ buyProb: Number(v) })}
                />
              </Field>

              <Field label="Revenue LogNormal (mu, sigma)" hint="If purchased, revenue ~ LogNormal(mu, sigma), else 0.">
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" step={0.1} value={cfg.revMu} onChange={(v) => patchCfg({ revMu: Number(v) })} />
                  <Input type="number" step={0.1} min={0.1} value={cfg.revSigma} onChange={(v) => patchCfg({ revSigma: Number(v) })} />
                </div>
              </Field>

              <div className="pt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">A/B “mistakes” toggles</div>
              </div>

              <Field label="Allocation preset" hint="Group imbalance changes power; here test share is 50% / 40% / 30%.">
                <Select
                  value={cfg.allocPreset}
                  onChange={(v) => patchCfg({ allocPreset: v })}
                  options={[
                    { value: "50/50", label: "50/50" },
                    { value: "60/40", label: "60/40" },
                    { value: "70/30", label: "70/30" },
                  ]}
                />
              </Field>

              <Field label="Spillover (SUTVA violation)" hint="A fraction of Control users behave like Test outcomes, but stay labeled Control.">
                <Select
                  value={String(cfg.spilloverPct)}
                  onChange={(v) => patchCfg({ spilloverPct: Number(v) })}
                  options={[
                    { value: "0", label: "0%" },
                    { value: "0.1", label: "10%" },
                    { value: "0.3", label: "30%" },
                    { value: "0.6", label: "60%" },
                  ]}
                />
              </Field>

              <div className="pt-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Analysis</div>
              </div>

              <Field label="Metric" hint="Pick what you’re optimizing; charts and tests follow this selection.">
                <Select
                  value={cfg.metric}
                  onChange={(v) => patchCfg({ metric: v })}
                  options={[
                    { value: METRICS.CTR, label: "CTR" },
                    { value: METRICS.CR, label: "CR" },
                    { value: METRICS.ARPU, label: "ARPU" },
                  ]}
                />
              </Field>

              {cfg.metric === METRICS.CTR ? (
                <>
                  <Field label="CTR aggregation" hint="Per-event uses clicks/impressions; per-user averages each user’s CTR.">
                    <Select
                      value={cfg.ctrAggregation}
                      onChange={(v) => patchCfg({ ctrAggregation: v })}
                      options={[
                        { value: CTR_AGG.PER_EVENT, label: "Per-event (clicks / impressions)" },
                        { value: CTR_AGG.PER_USER, label: "Per-user (mean(clicks_i / impr_i))" },
                      ]}
                    />
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
                <Select
                  value={cfg.statTest}
                  onChange={(v) => patchCfg({ statTest: v })}
                  options={[
                    { value: STAT_TEST.AUTO, label: "Auto (recommended)" },
                    { value: STAT_TEST.Z_EVENT, label: "z-test (event-level)" },
                    { value: STAT_TEST.Z_USER, label: "z-test (user-level)" },
                    { value: STAT_TEST.WELCH, label: "Welch t-test (user-level)" },
                  ]}
                />
              </Field>

              <Field label="alpha" hint="Significance threshold used for the p-value chart and peeking stop rule.">
                <Input type="number" step={0.001} min={0.001} max={0.2} value={cfg.alpha} onChange={(v) => patchCfg({ alpha: Number(v) })} />
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
                  <Input
                    type="number"
                    min={50}
                    step={50}
                    value={cfg.lookEveryUsers}
                    onChange={(v) => patchCfg({ lookEveryUsers: Number(v) })}
                  />
                </Field>
              ) : null}
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-6">
            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">{metricLabel} over time</div>
                <div className="text-xs text-gray-500">Control vs Test as sample accumulates</div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis
                      tickFormatter={(v) => (cfg.metric === METRICS.ARPU ? fmtNum(v, 2) : `${Math.round(v * 100)}%`)}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "metricC" || name === "metricT") return metricFormatter(value);
                        return value;
                      }}
                      labelFormatter={(l) => `t = ${l}s`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="metricC" name="Control" dot={false} />
                    <Line type="monotone" dataKey="metricT" name="Test" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {cfg.metric === METRICS.CTR && showCtrComparison ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500">Per-event CTR (clicks / impressions)</div>
                    <div className="mt-1 text-sm text-gray-900 mono">
                      C: {fmtPct(last?.ctrC_event ?? 0, 2)} / T: {fmtPct(last?.ctrT_event ?? 0, 2)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="text-xs font-semibold text-gray-500">Per-user CTR (mean(clicks_i / impr_i))</div>
                    <div className="mt-1 text-sm text-gray-900 mono">
                      C: {fmtPct(last?.ctrC_user ?? 0, 2)} / T: {fmtPct(last?.ctrT_user ?? 0, 2)}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Uplift over time</div>
                <div className="text-xs text-gray-500">(Test − Control) / Control</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis tickFormatter={(v) => fmtPct(v, 0)} domain={["auto", "auto"]} />
                    <Tooltip formatter={(v) => fmtPct(v, 2)} labelFormatter={(l) => `t = ${l}s`} />
                    <Line type="monotone" dataKey="uplift" name="Uplift" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">p-value over time</div>
                <div className="text-xs text-gray-500">Watch how peeking can “find” significance</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis domain={[0, 1]} />
                    <Tooltip formatter={(v) => fmtP(v)} labelFormatter={(l) => `t = ${l}s`} />
                    <Line type="monotone" dataKey="p" name="p-value" dot={false} />
                    <ReferenceLine y={cfg.alpha} strokeDasharray="4 4" />
                    {stopMarker ? <ReferenceDot x={stopMarker.x} y={stopMarker.p} r={5} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900">Sample size over time</div>
                <div className="text-xs text-gray-500">Control/Test users accumulating</div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                    <YAxis />
                    <Tooltip labelFormatter={(l) => `t = ${l}s`} />
                    <Legend />
                    <Line type="monotone" dataKey="usersC" name="Users (Control)" dot={false} />
                    <Line type="monotone" dataKey="usersT" name="Users (Test)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-900">Final verdict</div>
              <div className={`inline-flex items-center rounded-xl border px-3 py-2 text-base font-semibold ${verdict.tone}`}>
                {verdict.label}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Final effect (Test − Control):{" "}
                <span className="mono text-gray-900">
                  {cfg.metric === METRICS.ARPU ? `$${fmtNum(snap.metricT - snap.metricC, 4)}` : fmtPct(snap.metricT - snap.metricC, 3)}
                </span>{" "}
                · Uplift: <span className="mono text-gray-900">{fmtPct(snap.uplift, 2)}</span> · p-value:{" "}
                <span className="mono text-gray-900">{fmtP(snap.p)}</span>
              </div>
              <div className="text-sm text-gray-600">
                95% CI (diff): <span className="mono text-gray-900">{ciText}</span>
              </div>
            </div>

            <div className="w-full max-w-xl">
              <div className="text-sm font-semibold text-gray-900">Reasons / flags</div>
              {flags.length === 0 ? (
                <div className="mt-2 text-sm text-gray-600">No reliability flags triggered by the selected “mistake” toggles.</div>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {flags.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
                Notes: CTR per-event z-test treats impressions as independent trials (event-level approximation). Use this simulator to learn dynamics and failure modes, not as a replacement for production experimentation tooling.
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Tip: try enabling peeking with look-every=200, then increase spillover or imbalance and see how the same seed produces a different “story.”
        </div>
      </div>
    </div>
  );
}

