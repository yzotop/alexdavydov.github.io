import type {
  BaselineMethod,
  ClientSegment,
  GeneratedDataset,
  PeriodPnl,
  Periodicity,
  ScenarioId,
  ScenarioPlanningInputs,
  ScenarioPlanningOutput,
  ScenarioResult,
  ScenarioTotals,
  Segment,
  SegmentDims,
  SegmentLevel,
  SegmentSeries,
} from "./types";

// Deterministic RNG (mulberry32 + xmur3 hash), aligned with other simulators in this repo.
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  private next: () => number;
  private spare: number | null = null;
  constructor(seed: number | string) {
    const s = typeof seed === "number" ? String(seed) : seed;
    const seedGen = xmur3(s);
    this.next = mulberry32(seedGen());
  }
  random(): number {
    return this.next();
  }
  int(min: number, max: number): number {
    const u = this.random();
    return Math.floor(u * (max - min + 1)) + min;
  }
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.random();
    while (v === 0) v = this.random();
    const r = Math.sqrt(-2 * Math.log(u));
    const theta = 2 * Math.PI * v;
    const z0 = r * Math.cos(theta);
    const z1 = r * Math.sin(theta);
    this.spare = z1;
    return z0;
  }
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const a = [...xs].sort((p, q) => p - q);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 0) return 0.5 * (a[mid - 1] + a[mid]);
  return a[mid];
}

function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function seasonLength(periodicity: Periodicity): number {
  return periodicity === "weekly" ? 52 : 12;
}

function formatPeriodLabel(periodicity: Periodicity, idx0: number): string {
  // idx0 is zero-based since dataset start; we keep labels stable and offline.
  if (periodicity === "weekly") return `W${idx0 + 1}`;
  return `M${idx0 + 1}`;
}

function makeEntities(rng: RNG) {
  const nCat = rng.int(8, 12);
  const nCtry = rng.int(8, 12);
  const categories = Array.from({ length: nCat }, (_, i) => `Category ${String(i + 1).padStart(2, "0")}`);
  const countries = Array.from({ length: nCtry }, (_, i) => `Country ${String(i + 1).padStart(2, "0")}`);
  const client_segments: ClientSegment[] = ["retail_chain", "marketplace", "other"];
  return { categories, countries, client_segments };
}

function segmentKeyFor(level: SegmentLevel, dims: { category: string; country: string; client_segment: ClientSegment }): string {
  if (level === "category") return dims.category;
  if (level === "category_country") return `${dims.category} · ${dims.country}`;
  return `${dims.category} · ${dims.country} · ${dims.client_segment}`;
}

function segmentDimsFor(level: SegmentLevel, dims: { category: string; country: string; client_segment: ClientSegment }): SegmentDims {
  if (level === "category") return { category: dims.category };
  if (level === "category_country") return { category: dims.category, country: dims.country };
  return { category: dims.category, country: dims.country, client_segment: dims.client_segment };
}

function aggregateSegments(level: SegmentLevel, raw: SegmentSeries[]): SegmentSeries[] {
  if (level === "category_country_client") return raw;

  const byKey = new Map<string, { segment: Segment; units_hist: number[]; price_rev_hist: number[]; revenue_hist: number[] }>();
  for (const s of raw) {
    const d = s.segment.dims as { category: string; country?: string; client_segment?: ClientSegment };
    const baseDims = {
      category: d.category,
      country: d.country ?? "—",
      client_segment: (d.client_segment ?? "other") as ClientSegment,
    };
    // raw is always full dims; we map to aggregation keys using stored key encoding
    // We rely on raw generation to fill country/client in dims.
    const rawDims = {
      category: d.category,
      country: (d.country as string) ?? "—",
      client_segment: (d.client_segment as ClientSegment) ?? "other",
    };
    const key = segmentKeyFor(level, rawDims);
    const dimsAgg = segmentDimsFor(level, rawDims);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        segment: { key, dims: dimsAgg },
        units_hist: s.units_hist.slice(),
        price_rev_hist: new Array(s.units_hist.length).fill(0),
        revenue_hist: s.units_hist.map((u, i) => u * s.price_hist[i]),
      });
      // store price via revenue-weighted average later
      for (let i = 0; i < s.units_hist.length; i++) {
        byKey.get(key)!.price_rev_hist[i] = s.units_hist[i]; // units weight
      }
      continue;
    }
    for (let i = 0; i < existing.units_hist.length; i++) {
      existing.units_hist[i] += s.units_hist[i];
      existing.revenue_hist[i] += s.units_hist[i] * s.price_hist[i];
      existing.price_rev_hist[i] += s.units_hist[i];
    }
  }

  const out: SegmentSeries[] = [];
  for (const v of byKey.values()) {
    const price_hist = v.revenue_hist.map((rev, i) => {
      const w = v.price_rev_hist[i];
      return w > 0 ? rev / w : 0;
    });
    out.push({ segment: v.segment, units_hist: v.units_hist, price_hist });
  }
  return out;
}

export function defaultScenarioPlanningInputs(): ScenarioPlanningInputs {
  const baseShocks = { demand_pct: 0, price_pct: 0, fx_pct: 0, freight_pct: 0, lead_time_days_delta: 0 };
  return {
    seed: 1,
    periodicity: "weekly",
    horizon: 26,
    history_length: 104,
    segment_level: "category_country",
    baseline_method: "seasonal_naive",
    price_median_k: 8,
    unit_cost_pct_of_price: 0.7,
    freight_pct_of_cogs: 0.06,
    opex_fixed: 0,
    opex_pct_of_revenue: 0.04,
    inventory_constraint: false,
    safety_stock_pct: 0.1,
    scenarios: {
      base: { id: "base", title: "Base", locked: true, shocks: baseShocks },
      optimistic: {
        id: "optimistic",
        title: "Optimistic",
        locked: false,
        shocks: { demand_pct: 10, price_pct: 2, fx_pct: -3, freight_pct: -5, lead_time_days_delta: -2 },
      },
      pessimistic: {
        id: "pessimistic",
        title: "Pessimistic",
        locked: false,
        shocks: { demand_pct: -10, price_pct: -2, fx_pct: 8, freight_pct: 10, lead_time_days_delta: 5 },
      },
    },
  };
}

export function generateSampleDataset(inputs: Pick<ScenarioPlanningInputs, "seed" | "periodicity" | "history_length" | "segment_level">): GeneratedDataset {
  const rng = new RNG(inputs.seed);
  const { categories, countries, client_segments } = makeEntities(rng);
  const season_len = seasonLength(inputs.periodicity);

  // Per-dimension effects
  const catEff = new Map<string, number>();
  const ctryEff = new Map<string, number>();
  const segEff = new Map<ClientSegment, number>([
    ["retail_chain", 1.15],
    ["marketplace", 0.95],
    ["other", 1.0],
  ]);
  for (const c of categories) catEff.set(c, 0.85 + 0.6 * rng.random());
  for (const c of countries) ctryEff.set(c, 0.85 + 0.6 * rng.random());

  const rawSegments: SegmentSeries[] = [];

  for (const category of categories) {
    for (const country of countries) {
      for (const client_segment of client_segments) {
        const base = (catEff.get(category) ?? 1) * (ctryEff.get(country) ?? 1) * (segEff.get(client_segment) ?? 1);

        // Base levels chosen to look enterprise-ish but remain lightweight.
        const unitsLevel = 60 + 220 * base; // per period
        const priceLevel = 12 + 28 * (0.6 * (catEff.get(category) ?? 1) + 0.4 * (ctryEff.get(country) ?? 1));

        const trendUnits = (rng.random() - 0.5) * 0.004; // ~ +/-0.2% per period
        const trendPrice = (rng.random() - 0.5) * 0.003;

        const seasonPhase = 2 * Math.PI * rng.random();
        const seasonAmpUnits = 0.08 + 0.16 * rng.random();
        const seasonAmpPrice = 0.02 + 0.05 * rng.random();

        const noiseUnits = 0.10 + 0.10 * rng.random();
        const noisePrice = 0.03 + 0.05 * rng.random();

        const units_hist: number[] = [];
        const price_hist: number[] = [];

        for (let t = 0; t < inputs.history_length; t++) {
          const season = Math.sin((2 * Math.PI * t) / season_len + seasonPhase);
          const u = unitsLevel * (1 + seasonAmpUnits * season) * (1 + trendUnits * t) * (1 + noiseUnits * rng.normal());
          const p = priceLevel * (1 + seasonAmpPrice * season) * (1 + trendPrice * t) * (1 + noisePrice * rng.normal());
          units_hist.push(Math.max(0, Math.round(u)));
          price_hist.push(Math.max(0.5, p));
        }

        rawSegments.push({
          segment: {
            key: segmentKeyFor("category_country_client", { category, country, client_segment }),
            dims: { category, country, client_segment },
          },
          units_hist,
          price_hist,
        });
      }
    }
  }

  const segments = aggregateSegments(inputs.segment_level, rawSegments);

  // Preview rows are always from the full granularity (more informative).
  const preview_rows: GeneratedDataset["preview_rows"] = [];
  for (let i = 0; i < Math.min(10, inputs.history_length); i++) {
    const pick = rawSegments[i % rawSegments.length];
    const d = pick.segment.dims as { category: string; country: string; client_segment: ClientSegment };
    const units = pick.units_hist[i];
    const price = pick.price_hist[i];
    preview_rows.push({
      period_idx: i,
      category: d.category,
      country: d.country,
      client_segment: d.client_segment,
      units,
      price,
      revenue: units * price,
    });
  }

  return {
    meta: { categories, countries, client_segments, season_length: season_len, history_length: inputs.history_length },
    segments,
    preview_rows,
  };
}

function baselineUnitsAt(
  method: BaselineMethod,
  units_hist: number[],
  t: number, // absolute index where t == history_length..history_length+horizon-1
  season_len: number,
  k: number
): number {
  if (method === "seasonal_naive") {
    const idx = t - season_len;
    if (idx >= 0 && idx < units_hist.length) return units_hist[idx];
  }
  // moving average fallback (or chosen method)
  const end = Math.min(t, units_hist.length);
  const start = Math.max(0, end - k);
  const window = units_hist.slice(start, end);
  return mean(window);
}

function baselinePrice(units_hist: number[], price_hist: number[], k: number): number {
  const end = price_hist.length;
  const start = Math.max(0, end - k);
  const m = median(price_hist.slice(start, end));
  if (Number.isFinite(m) && m > 0) return m;
  // last resort: revenue-weighted avg price
  let rev = 0;
  let u = 0;
  for (let i = start; i < end; i++) {
    rev += units_hist[i] * price_hist[i];
    u += units_hist[i];
  }
  return u > 0 ? rev / u : 1;
}

function sumTotals(per_period: PeriodPnl[]): ScenarioTotals {
  let revenue_total = 0;
  let cogs_total = 0;
  let freight_total = 0;
  let opex_total = 0;
  let ebitda_total = 0;
  let units_total = 0;
  for (const r of per_period) {
    revenue_total += r.revenue;
    cogs_total += r.cogs;
    freight_total += r.freight;
    opex_total += r.opex;
    ebitda_total += r.ebitda;
    units_total += r.units;
  }
  return { revenue_total, cogs_total, freight_total, opex_total, ebitda_total, units_total };
}

function computeScenario(
  scenario: ScenarioId,
  dataset: GeneratedDataset,
  inputs: ScenarioPlanningInputs,
  fx_extra_pct = 0
): ScenarioResult {
  const season_len = dataset.meta.season_length;
  const k = clamp(Math.round(inputs.price_median_k), 2, 26);

  const shocks = inputs.scenarios[scenario].shocks;
  const demand = shocks.demand_pct / 100;
  const priceShock = shocks.price_pct / 100;
  const fx = (shocks.fx_pct + fx_extra_pct) / 100;
  const freightShock = shocks.freight_pct / 100;

  const per_period: PeriodPnl[] = [];

  for (let p = 0; p < inputs.horizon; p++) {
    const tAbs = inputs.history_length + p;
    let unitsTotal = 0;
    let revenue = 0;
    let cogs = 0;
    let freight = 0;
    let opex = 0;

    for (const seg of dataset.segments) {
      const u_hat = baselineUnitsAt(inputs.baseline_method, seg.units_hist, tAbs, season_len, k);
      const p_hat = baselinePrice(seg.units_hist, seg.price_hist, k);

      const units_c = Math.max(0, u_hat * (1 + demand));
      const price_c = Math.max(0.01, p_hat * (1 + priceShock));
      const revenue_c = units_c * price_c;

      const unit_cost_c = price_c * inputs.unit_cost_pct_of_price * (1 + fx);
      const cogs_c = units_c * unit_cost_c;
      const freight_c = cogs_c * inputs.freight_pct_of_cogs * (1 + freightShock);
      const opex_c = inputs.opex_fixed / inputs.horizon + revenue_c * inputs.opex_pct_of_revenue;

      unitsTotal += units_c;
      revenue += revenue_c;
      cogs += cogs_c;
      freight += freight_c;
      opex += opex_c;
    }

    const ebitda = revenue - cogs - freight - opex;
    const recPurch =
      inputs.inventory_constraint ? unitsTotal * (1 + clamp(inputs.safety_stock_pct, 0, 2)) : undefined;

    per_period.push({
      period: p + 1,
      units: unitsTotal,
      revenue,
      cogs,
      freight,
      opex,
      ebitda,
      recommended_purchases_units: recPurch,
    });
  }

  return { scenario, per_period, totals: sumTotals(per_period) };
}

export function runScenarioPlanning(inputsRaw: ScenarioPlanningInputs): ScenarioPlanningOutput {
  const inputs: ScenarioPlanningInputs = {
    ...inputsRaw,
    seed: Math.trunc(inputsRaw.seed),
    horizon: clamp(Math.trunc(inputsRaw.horizon), 12, 52),
    history_length: clamp(Math.trunc(inputsRaw.history_length), 52, 156),
    price_median_k: clamp(Math.trunc(inputsRaw.price_median_k), 2, 26),
    unit_cost_pct_of_price: clamp(inputsRaw.unit_cost_pct_of_price, 0, 0.99),
    freight_pct_of_cogs: clamp(inputsRaw.freight_pct_of_cogs, 0, 0.5),
    opex_pct_of_revenue: clamp(inputsRaw.opex_pct_of_revenue, 0, 0.5),
    safety_stock_pct: clamp(inputsRaw.safety_stock_pct, 0, 2),
  };

  const dataset = generateSampleDataset({
    seed: inputs.seed,
    periodicity: inputs.periodicity,
    history_length: inputs.history_length,
    segment_level: inputs.segment_level,
  });

  const base = computeScenario("base", dataset, inputs, 0);
  const optimistic = computeScenario("optimistic", dataset, inputs, 0);
  const pessimistic = computeScenario("pessimistic", dataset, inputs, 0);

  const results: Record<ScenarioId, ScenarioResult> = { base, optimistic, pessimistic };
  const comparison = {
    optimistic: {
      scenario: "optimistic" as const,
      delta_vs_base: {
        revenue_total: optimistic.totals.revenue_total - base.totals.revenue_total,
        ebitda_total: optimistic.totals.ebitda_total - base.totals.ebitda_total,
        cogs_total: optimistic.totals.cogs_total - base.totals.cogs_total,
        freight_total: optimistic.totals.freight_total - base.totals.freight_total,
        opex_total: optimistic.totals.opex_total - base.totals.opex_total,
        units_total: optimistic.totals.units_total - base.totals.units_total,
      },
    },
    pessimistic: {
      scenario: "pessimistic" as const,
      delta_vs_base: {
        revenue_total: pessimistic.totals.revenue_total - base.totals.revenue_total,
        ebitda_total: pessimistic.totals.ebitda_total - base.totals.ebitda_total,
        cogs_total: pessimistic.totals.cogs_total - base.totals.cogs_total,
        freight_total: pessimistic.totals.freight_total - base.totals.freight_total,
        opex_total: pessimistic.totals.opex_total - base.totals.opex_total,
        units_total: pessimistic.totals.units_total - base.totals.units_total,
      },
    },
  };

  const chartsRevenue = Array.from({ length: inputs.horizon }, (_, i) => ({
    period: i + 1,
    base: base.per_period[i].revenue,
    optimistic: optimistic.per_period[i].revenue,
    pessimistic: pessimistic.per_period[i].revenue,
  }));
  const chartsEbitda = Array.from({ length: inputs.horizon }, (_, i) => ({
    period: i + 1,
    base: base.per_period[i].ebitda,
    optimistic: optimistic.per_period[i].ebitda,
    pessimistic: pessimistic.per_period[i].ebitda,
  }));

  function decisions_for_selected(selected: ScenarioId) {
    const sel = results[selected];
    const selFxPlus = computeScenario(selected, dataset, inputs, +5).totals.ebitda_total;
    const selFxMinus = computeScenario(selected, dataset, inputs, -5).totals.ebitda_total;

    const risk_flags: string[] = [];
    const lt = inputs.scenarios[selected].shocks.lead_time_days_delta;
    if (lt >= 5) risk_flags.push("Lead time risk: +5 days or more in scenario.");
    if (inputs.scenarios[selected].shocks.fx_pct >= 8) risk_flags.push("FX risk: cost-side FX shock is high.");
    if (Math.abs(inputs.scenarios[selected].shocks.demand_pct) >= 10) risk_flags.push("Demand risk: large demand shock vs baseline.");

    if (inputs.inventory_constraint) {
      const per = sel.per_period.map((p) => ({
        period: p.period,
        units: p.recommended_purchases_units ?? 0,
      }));
      const total = per.reduce((acc, x) => acc + x.units, 0);
      return {
        recommended_purchases_total_units: total,
        recommended_purchases_per_period: per,
        fx_sensitivity: {
          ebitda_delta_fx_plus_5pct: selFxPlus - sel.totals.ebitda_total,
          ebitda_delta_fx_minus_5pct: selFxMinus - sel.totals.ebitda_total,
        },
        risk_flags,
      };
    }

    return {
      fx_sensitivity: {
        ebitda_delta_fx_plus_5pct: selFxPlus - sel.totals.ebitda_total,
        ebitda_delta_fx_minus_5pct: selFxMinus - sel.totals.ebitda_total,
      },
      risk_flags,
    };
  }

  return {
    inputs,
    dataset,
    results,
    comparison,
    charts: {
      revenue: chartsRevenue,
      ebitda: chartsEbitda,
      totals_ebitda: [
        { scenario: "base", ebitda_total: base.totals.ebitda_total },
        { scenario: "optimistic", ebitda_total: optimistic.totals.ebitda_total },
        { scenario: "pessimistic", ebitda_total: pessimistic.totals.ebitda_total },
      ],
    },
    decisions_for_selected,
  };
}

export function formatMoney(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return "—";
  const s = x.toFixed(digits);
  // simple thousands separator
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatPct(x: number, digits = 1): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function formatInt(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return Math.round(x).toString();
}

export function makeExportMarkdown(params: {
  todayISO: string;
  output: ScenarioPlanningOutput;
  selected: ScenarioId;
}): string {
  const { todayISO, output, selected } = params;
  const inputs = output.inputs;
  const res = output.results;
  const sel = res[selected];
  const dec = output.decisions_for_selected(selected);

  const scenarioTotalsTable = [
    ["Scenario", "Revenue (total)", "EBITDA (total)", "Δ EBITDA vs Base"],
    ["Base", formatMoney(res.base.totals.revenue_total), formatMoney(res.base.totals.ebitda_total), "—"],
    [
      "Optimistic",
      formatMoney(res.optimistic.totals.revenue_total),
      formatMoney(res.optimistic.totals.ebitda_total),
      formatMoney(res.optimistic.totals.ebitda_total - res.base.totals.ebitda_total),
    ],
    [
      "Pessimistic",
      formatMoney(res.pessimistic.totals.revenue_total),
      formatMoney(res.pessimistic.totals.ebitda_total),
      formatMoney(res.pessimistic.totals.ebitda_total - res.base.totals.ebitda_total),
    ],
  ];

  const last8 = sel.per_period.slice(Math.max(0, sel.per_period.length - 8));
  const pnlTable = [
    ["Period", "Revenue", "COGS", "Freight", "Opex", "EBITDA"],
    ...last8.map((p) => [
      String(p.period),
      formatMoney(p.revenue),
      formatMoney(p.cogs),
      formatMoney(p.freight),
      formatMoney(p.opex),
      formatMoney(p.ebitda),
    ]),
  ];

  function mdTable(rows: string[][]): string {
    const header = rows[0];
    const sep = header.map(() => "---");
    const body = rows.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${sep.join(" | ")} |`,
      ...body.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");
  }

  const lines: string[] = [];
  lines.push(`# Scenario Planning & P&L Forecast`);
  lines.push(``);
  lines.push(`Date: ${todayISO}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(`- Selected scenario: **${selected}**`);
  lines.push(`- Total revenue (selected): **${formatMoney(sel.totals.revenue_total)}**`);
  lines.push(`- Total EBITDA (selected): **${formatMoney(sel.totals.ebitda_total)}**`);
  lines.push(``);
  lines.push(`## Inputs`);
  lines.push(`- Seed: ${inputs.seed}`);
  lines.push(`- Periodicity: ${inputs.periodicity}`);
  lines.push(`- Horizon: ${inputs.horizon} periods`);
  lines.push(`- History length: ${inputs.history_length} periods`);
  lines.push(`- Segment level: ${inputs.segment_level}`);
  lines.push(`- Baseline: ${inputs.baseline_method} (season length: ${output.dataset.meta.season_length})`);
  lines.push(`- Price estimator: median last K (K=${inputs.price_median_k})`);
  lines.push(`- Unit cost base: ${(inputs.unit_cost_pct_of_price * 100).toFixed(1)}% of price`);
  lines.push(`- Freight: ${(inputs.freight_pct_of_cogs * 100).toFixed(1)}% of COGS`);
  lines.push(`- Opex: fixed ${formatMoney(inputs.opex_fixed)} + ${(inputs.opex_pct_of_revenue * 100).toFixed(1)}% of revenue`);
  lines.push(`- Inventory constraint: ${inputs.inventory_constraint ? "ON" : "OFF"}${inputs.inventory_constraint ? ` (safety stock ${(inputs.safety_stock_pct * 100).toFixed(1)}%)` : ""}`);
  lines.push(``);
  lines.push(`## Scenario settings`);
  for (const id of ["base", "optimistic", "pessimistic"] as ScenarioId[]) {
    const s = inputs.scenarios[id];
    lines.push(
      `- ${s.title}: demand ${s.shocks.demand_pct}% · price ${s.shocks.price_pct}% · FX ${s.shocks.fx_pct}% · freight ${s.shocks.freight_pct}% · lead time ${s.shocks.lead_time_days_delta}d`
    );
  }
  lines.push(``);
  lines.push(`## Scenario totals`);
  lines.push(mdTable(scenarioTotalsTable));
  lines.push(``);
  lines.push(`## Selected scenario P&L (last 8 periods)`);
  lines.push(mdTable(pnlTable));
  lines.push(``);
  lines.push(`## Decisions`);
  if (inputs.inventory_constraint) {
    lines.push(`- Recommended purchases (total units): **${formatInt(dec.recommended_purchases_total_units ?? 0)}**`);
  } else {
    lines.push(`- Recommended purchases: inventory constraint is OFF`);
  }
  lines.push(
    `- FX sensitivity (EBITDA delta vs selected): +5% FX → ${formatMoney(dec.fx_sensitivity.ebitda_delta_fx_plus_5pct)}; -5% FX → ${formatMoney(dec.fx_sensitivity.ebitda_delta_fx_minus_5pct)}`
  );
  if (dec.risk_flags.length) {
    lines.push(`- Risk flags:`);
    for (const f of dec.risk_flags) lines.push(`  - ${f}`);
  } else {
    lines.push(`- Risk flags: none triggered`);
  }
  lines.push(``);
  lines.push(`## Assumptions`);
  lines.push(`- Offline demo dataset (seeded RNG), neutral “international distributor / importer” case.`);
  lines.push(`- Baseline: seasonal naive (fallback to moving average if insufficient history).`);
  lines.push(`- Unit cost is modeled as % of price and moved by FX shock (cost-side).`);
  lines.push(`- Freight modeled as % of COGS with a scenario shock multiplier.`);
  lines.push(`- Opex modeled as fixed + % of revenue (simplified).`);
  lines.push(``);

  return lines.join("\n");
}

// kept for potential UI labels; not used by math directly
export function getPeriodLabel(periodicity: Periodicity, periodIdx0: number): string {
  return formatPeriodLabel(periodicity, periodIdx0);
}

