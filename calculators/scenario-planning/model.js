// Scenario Planning & P&L Forecast — pure model (browser ESM build).
// Monthly-only FP&A view. Offline, deterministic (seeded RNG).
// Neutral case: international distributor/importer.

// Deterministic RNG (mulberry32 + xmur3 hash), aligned with other simulators in this repo.
function xmur3(str) {
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

function mulberry32(seed) {
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
  constructor(seed) {
    const s = typeof seed === "number" ? String(seed) : seed;
    const seedGen = xmur3(s);
    this.next = mulberry32(seedGen());
    this.spare = null;
  }
  random() {
    return this.next();
  }
  int(min, max) {
    const u = this.random();
    return Math.floor(u * (max - min + 1)) + min;
  }
  normal() {
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

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function median(xs) {
  if (!xs.length) return NaN;
  const a = [...xs].sort((p, q) => p - q);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 0) return 0.5 * (a[mid - 1] + a[mid]);
  return a[mid];
}

function mean(xs) {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function seasonLength() {
  return 12; // monthly only
}

function formatPeriodLabel(idx0) {
  return `M${idx0 + 1}`;
}

function makeEntitiesFixed({ categories, countries }) {
  const nCat = clamp(Math.trunc(categories), 1, 200);
  const nCtry = clamp(Math.trunc(countries), 1, 200);
  const cats = Array.from({ length: nCat }, (_, i) => `Category ${String(i + 1).padStart(2, "0")}`);
  const ctrs = Array.from({ length: nCtry }, (_, i) => `Country ${String(i + 1).padStart(2, "0")}`);
  return { categories: cats, countries: ctrs };
}

function segmentKeyFor(dims) {
  return `${dims.category} · ${dims.country}`;
}

export function defaultScenarioPlanningInputs() {
  const baseShocks = { demand_pct: 0, price_pct: 0, fx_pct: 0, freight_pct: 0, lead_time_days_delta: 0 };
  return {
    // Global (monthly-only FP&A)
    seed: 1,
    horizon: 24, // 12 / 24 / 36 months
    history_length: 36,

    // Scale assumptions (rarely changed)
    // Default preset for executive storytelling.
    scale: {
      categories: 10,
      countries: 10,
      active_sku: 8000,
      avg_monthly_revenue_per_category_country: 180_000_000,
    },

    preset: "large_fmcg_distributor", // "custom" | "large_fmcg_distributor"

    // Baseline (kept simple; stable)
    baseline_method: "seasonal_naive",
    price_median_k: 8,

    // Cost / Opex
    unit_cost_pct_of_price: 0.7,
    freight_pct_of_cogs: 0.06,
    opex_fixed: 0,
    opex_pct_of_revenue: 0.04,

    // Below-EBITDA split
    financing_pct_of_revenue: 0.01,
    tax_pct: 0.2, // applied to positive pre-tax profit

    // Inventory (optional)
    inventory_constraint: false,
    safety_stock_pct: 0.1,

    // Scenarios (performance assumptions)
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

function applyPreset(inputsRaw) {
  const preset = inputsRaw.preset ?? "custom";
  if (preset !== "large_fmcg_distributor") return { ...inputsRaw, preset };

  // Targets:
  // - Annual revenue ~200–220B (via scale)
  // - Net margin ~3–4% (via cost/opex/financing/tax)
  return {
    ...inputsRaw,
    preset,
    scale: {
      categories: 10,
      countries: 10,
      active_sku: 8000,
      avg_monthly_revenue_per_category_country: 180_000_000, // ~216B annual with 10x10
    },
    unit_cost_pct_of_price: 0.75,
    freight_pct_of_cogs: 0.06,
    opex_fixed: 0,
    opex_pct_of_revenue: 0.155, // ~5% EBITDA margin pre-financing
    financing_pct_of_revenue: 0.01,
    tax_pct: 0.2,
  };
}

export function generateSampleDataset(inputs) {
  const rng = new RNG(inputs.seed);
  const season_len = seasonLength();

  const scale = inputs.scale ?? {
    categories: 10,
    countries: 10,
    active_sku: 3000,
    avg_monthly_revenue_per_category_country: 2_500_000,
  };

  const { categories, countries } = makeEntitiesFixed(scale);

  // Annual revenue implied by scale assumptions.
  const avgPerCC = Math.max(0, Number(scale.avg_monthly_revenue_per_category_country) || 0);
  const targetMonthlyTotal = categories.length * countries.length * avgPerCC;

  // Allocate monthly revenue across category×country with deterministic weights (normalized).
  const nSeg = categories.length * countries.length;
  const weights = Array.from({ length: nSeg }, () => 0.7 + 0.6 * rng.random());
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;

  const segments = [];
  let idx = 0;
  for (const category of categories) {
    for (const country of countries) {
      const w = weights[idx++] / wSum;
      const segMonthlyRevBase = targetMonthlyTotal * w;

      // Derive price & units from a revenue series (keeps Revenue ≥ 0 by construction).
      const priceLevel = 40 + 160 * (0.5 + 0.5 * rng.random()); // stable positive price
      const priceTrend = (rng.random() - 0.5) * 0.002; // ~ +/-0.1% per month
      const revTrend = (rng.random() - 0.5) * 0.003;
      const seasonPhase = 2 * Math.PI * rng.random();
      const revSeasonAmp = 0.03 + 0.06 * rng.random();
      const priceSeasonAmp = 0.01 + 0.03 * rng.random();
      const revNoise = 0.03 + 0.05 * rng.random();
      const priceNoise = 0.01 + 0.03 * rng.random();

      const units_hist = [];
      const price_hist = [];
      for (let t = 0; t < inputs.history_length; t++) {
        const season = Math.sin((2 * Math.PI * t) / season_len + seasonPhase);
        const rev = Math.max(
          0,
          segMonthlyRevBase * (1 + revSeasonAmp * season) * (1 + revTrend * t) * (1 + revNoise * rng.normal())
        );
        const price = Math.max(
          0.01,
          priceLevel * (1 + priceSeasonAmp * season) * (1 + priceTrend * t) * (1 + priceNoise * rng.normal())
        );
        const units = Math.max(0, rev / price);
        units_hist.push(units);
        price_hist.push(price);
      }

      segments.push({
        segment: { key: segmentKeyFor({ category, country }), dims: { category, country } },
        units_hist,
        price_hist,
      });
    }
  }

  const preview_rows = [];
  for (let i = 0; i < Math.min(10, inputs.history_length); i++) {
    const pick = segments[i % segments.length];
    const d = pick.segment.dims;
    const units = pick.units_hist[i];
    const price = pick.price_hist[i];
    preview_rows.push({
      period_idx: i,
      category: d.category,
      country: d.country,
      client_segment: "other",
      units,
      price,
      revenue: Math.max(0, units * price),
    });
  }

  return {
    meta: {
      categories,
      countries,
      client_segments: ["retail_chain", "marketplace", "other"], // kept for UI compatibility
      season_length: season_len,
      history_length: inputs.history_length,
    },
    segments,
    preview_rows,
  };
}

function baselineUnitsAt(method, units_hist, t, season_len, k) {
  if (method === "seasonal_naive") {
    const idx = t - season_len;
    if (idx >= 0 && idx < units_hist.length) return units_hist[idx];
  }
  const end = Math.min(t, units_hist.length);
  const start = Math.max(0, end - k);
  return mean(units_hist.slice(start, end));
}

function baselinePrice(units_hist, price_hist, k) {
  const end = price_hist.length;
  const start = Math.max(0, end - k);
  const m = median(price_hist.slice(start, end));
  if (Number.isFinite(m) && m > 0) return m;
  let rev = 0;
  let u = 0;
  for (let i = start; i < end; i++) {
    rev += units_hist[i] * price_hist[i];
    u += units_hist[i];
  }
  return u > 0 ? rev / u : 1;
}

function sumTotals(per_period) {
  let revenue_total = 0;
  let cogs_total = 0;
  let freight_total = 0;
  let opex_total = 0;
  let ebitda_total = 0;
  let financing_total = 0;
  let tax_total = 0;
  let net_profit_total = 0;
  let units_total = 0;
  for (const r of per_period) {
    revenue_total += r.revenue;
    cogs_total += r.cogs;
    freight_total += r.freight;
    opex_total += r.opex;
    ebitda_total += r.ebitda;
    financing_total += r.financing;
    tax_total += r.tax;
    net_profit_total += r.net_profit;
    units_total += r.units;
  }
  return {
    revenue_total,
    cogs_total,
    freight_total,
    opex_total,
    ebitda_total,
    financing_total,
    tax_total,
    net_profit_total,
    units_total,
  };
}

function computeScenario(scenario, dataset, inputs, fx_extra_pct = 0) {
  const season_len = dataset.meta.season_length;
  const k = clamp(Math.round(inputs.price_median_k), 2, 26);

  const shocks = inputs.scenarios[scenario].shocks;
  const demand = (shocks.demand_pct ?? 0) / 100;
  const priceShock = (shocks.price_pct ?? 0) / 100;
  const fx = ((shocks.fx_pct ?? 0) + fx_extra_pct) / 100;
  const freightShock = (shocks.freight_pct ?? 0) / 100;

  const per_period = [];
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

      // BUGFIX: Revenue is units * price and cannot be negative.
      const revenue_c = Math.max(0, units_c * price_c);

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
    const financing = Math.max(0, revenue) * clamp(inputs.financing_pct_of_revenue ?? 0, 0, 0.5);
    const pretax = ebitda - financing;
    const tax = Math.max(0, pretax) * clamp(inputs.tax_pct ?? 0.2, 0, 0.6);
    const net_profit = pretax - tax;

    const recPurch = inputs.inventory_constraint ? unitsTotal * (1 + clamp(inputs.safety_stock_pct, 0, 2)) : undefined;

    per_period.push({
      period: p + 1,
      units: unitsTotal,
      revenue,
      cogs,
      freight,
      opex,
      ebitda,
      financing,
      tax,
      net_profit,
      recommended_purchases_units: recPurch,
    });
  }

  return { scenario, per_period, totals: sumTotals(per_period) };
}

export function runScenarioPlanning(inputsRaw) {
  const withPreset = applyPreset(inputsRaw);

  const inputs = {
    ...withPreset,
    seed: Math.trunc(withPreset.seed),
    horizon: [12, 24, 36].includes(Math.trunc(withPreset.horizon)) ? Math.trunc(withPreset.horizon) : 12,
    history_length: clamp(Math.trunc(withPreset.history_length), 24, 60),
    price_median_k: clamp(Math.trunc(withPreset.price_median_k), 2, 26),
    unit_cost_pct_of_price: clamp(withPreset.unit_cost_pct_of_price, 0, 0.99),
    freight_pct_of_cogs: clamp(withPreset.freight_pct_of_cogs, 0, 0.5),
    opex_pct_of_revenue: clamp(withPreset.opex_pct_of_revenue, 0, 0.5),
    safety_stock_pct: clamp(withPreset.safety_stock_pct, 0, 2),
    financing_pct_of_revenue: clamp(withPreset.financing_pct_of_revenue ?? 0.01, 0, 0.5),
    tax_pct: clamp(withPreset.tax_pct ?? 0.2, 0, 0.6),
    scale: {
      categories: clamp(Math.trunc(withPreset.scale?.categories ?? 10), 1, 200),
      countries: clamp(Math.trunc(withPreset.scale?.countries ?? 10), 1, 200),
      active_sku: clamp(Math.trunc(withPreset.scale?.active_sku ?? 3000), 1, 500_000),
      avg_monthly_revenue_per_category_country: Math.max(0, Number(withPreset.scale?.avg_monthly_revenue_per_category_country ?? 0)),
    },
  };

  const dataset = generateSampleDataset({
    seed: inputs.seed,
    history_length: inputs.history_length,
    scale: inputs.scale,
  });

  const base = computeScenario("base", dataset, inputs, 0);
  const optimistic = computeScenario("optimistic", dataset, inputs, 0);
  const pessimistic = computeScenario("pessimistic", dataset, inputs, 0);

  const results = { base, optimistic, pessimistic };

  const comparison = {
    optimistic: {
      scenario: "optimistic",
      delta_vs_base: {
        revenue_total: optimistic.totals.revenue_total - base.totals.revenue_total,
        ebitda_total: optimistic.totals.ebitda_total - base.totals.ebitda_total,
        net_profit_total: optimistic.totals.net_profit_total - base.totals.net_profit_total,
        cogs_total: optimistic.totals.cogs_total - base.totals.cogs_total,
        freight_total: optimistic.totals.freight_total - base.totals.freight_total,
        opex_total: optimistic.totals.opex_total - base.totals.opex_total,
      },
    },
    pessimistic: {
      scenario: "pessimistic",
      delta_vs_base: {
        revenue_total: pessimistic.totals.revenue_total - base.totals.revenue_total,
        ebitda_total: pessimistic.totals.ebitda_total - base.totals.ebitda_total,
        net_profit_total: pessimistic.totals.net_profit_total - base.totals.net_profit_total,
        cogs_total: pessimistic.totals.cogs_total - base.totals.cogs_total,
        freight_total: pessimistic.totals.freight_total - base.totals.freight_total,
        opex_total: pessimistic.totals.opex_total - base.totals.opex_total,
      },
    },
  };

  const chartsRevenue = Array.from({ length: inputs.horizon }, (_, i) => ({
    period: i + 1,
    base: Math.max(0, base.per_period[i].revenue),
    optimistic: Math.max(0, optimistic.per_period[i].revenue),
    pessimistic: Math.max(0, pessimistic.per_period[i].revenue),
  }));
  const chartsEbitda = Array.from({ length: inputs.horizon }, (_, i) => ({
    period: i + 1,
    base: base.per_period[i].ebitda,
    optimistic: optimistic.per_period[i].ebitda,
    pessimistic: pessimistic.per_period[i].ebitda,
  }));
  const chartsNetProfit = Array.from({ length: inputs.horizon }, (_, i) => ({
    period: i + 1,
    base: base.per_period[i].net_profit,
    optimistic: optimistic.per_period[i].net_profit,
    pessimistic: pessimistic.per_period[i].net_profit,
  }));

  function decisions_for_selected(selected) {
    const sel = results[selected];

    const risk_flags = [];
    const lt = inputs.scenarios[selected].shocks.lead_time_days_delta;
    if (lt >= 5) risk_flags.push("Lead time risk: +5 days or more in scenario.");
    if (inputs.scenarios[selected].shocks.fx_pct >= 8) risk_flags.push("FX risk: cost-side FX shock is high.");
    if (Math.abs(inputs.scenarios[selected].shocks.demand_pct) >= 10) risk_flags.push("Demand risk: large demand shock vs baseline.");

    // Keep compatibility for existing UI blocks (FX-only numbers).
    const selFxPlus = computeScenario(selected, dataset, inputs, +5).totals.ebitda_total;
    const selFxMinus = computeScenario(selected, dataset, inputs, -5).totals.ebitda_total;

    if (inputs.inventory_constraint) {
      const per = sel.per_period.map((p) => ({ period: p.period, units: p.recommended_purchases_units ?? 0 }));
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

  // Derived “baseline annual revenue” implied by scale assumptions (for UI).
  const implied_annual_revenue =
    (inputs.scale.categories * inputs.scale.countries * inputs.scale.avg_monthly_revenue_per_category_country) * 12;

  return {
    inputs: { ...inputs, implied_annual_revenue },
    dataset,
    results,
    comparison,
    charts: {
      revenue: chartsRevenue,
      ebitda: chartsEbitda,
      net_profit: chartsNetProfit,
    },
    decisions_for_selected,
  };
}

export function formatMoney(x, digits = 0) {
  if (!Number.isFinite(x)) return "—";
  const s = x.toFixed(digits);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatPct(x, digits = 1) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function formatInt(x) {
  if (!Number.isFinite(x)) return "—";
  return Math.round(x).toString();
}

export function makeExportMarkdown({ todayISO, output, selected }) {
  const inputs = output.inputs;
  const res = output.results;
  const sel = res[selected];
  const dec = output.decisions_for_selected(selected);

  const annualize = (x) => x * (12 / inputs.horizon);

  const scenarioTotalsTable = [
    ["Scenario", "Revenue (annual)", "EBITDA (annual)", "Net Profit (annual)", "Δ EBITDA vs Base"],
    [
      "Base",
      formatMoney(Math.max(0, annualize(res.base.totals.revenue_total))),
      formatMoney(annualize(res.base.totals.ebitda_total)),
      formatMoney(annualize(res.base.totals.net_profit_total)),
      "—",
    ],
    [
      "Optimistic",
      formatMoney(Math.max(0, annualize(res.optimistic.totals.revenue_total))),
      formatMoney(annualize(res.optimistic.totals.ebitda_total)),
      formatMoney(annualize(res.optimistic.totals.net_profit_total)),
      formatMoney(res.optimistic.totals.ebitda_total - res.base.totals.ebitda_total),
    ],
    [
      "Pessimistic",
      formatMoney(Math.max(0, annualize(res.pessimistic.totals.revenue_total))),
      formatMoney(annualize(res.pessimistic.totals.ebitda_total)),
      formatMoney(annualize(res.pessimistic.totals.net_profit_total)),
      formatMoney(res.pessimistic.totals.ebitda_total - res.base.totals.ebitda_total),
    ],
  ];

  const last8 = sel.per_period.slice(Math.max(0, sel.per_period.length - 8));
  const pnlTable = [
    ["Month", "Revenue", "COGS", "Freight", "Opex", "EBITDA", "Financing", "Tax", "Net Profit"],
    ...last8.map((p) => [
      String(p.period),
      formatMoney(Math.max(0, p.revenue)),
      formatMoney(p.cogs),
      formatMoney(p.freight),
      formatMoney(p.opex),
      formatMoney(p.ebitda),
      formatMoney(p.financing),
      formatMoney(p.tax),
      formatMoney(p.net_profit),
    ]),
  ];

  function mdTable(rows) {
    const header = rows[0];
    const sep = header.map(() => "---");
    const body = rows.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${sep.join(" | ")} |`,
      ...body.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");
  }

  const lines = [];
  lines.push(`# Scenario Planning & P&L Forecast (Monthly FP&A)`);
  lines.push(``);
  lines.push(`Date: ${todayISO}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(`- Selected scenario: **${selected}**`);
  lines.push(`- Annual revenue (selected): **${formatMoney(Math.max(0, annualize(sel.totals.revenue_total)))}**`);
  lines.push(`- Annual EBITDA (selected): **${formatMoney(annualize(sel.totals.ebitda_total))}**`);
  lines.push(`- Annual Net Profit (selected): **${formatMoney(annualize(sel.totals.net_profit_total))}**`);
  lines.push(``);
  lines.push(`## Inputs`);
  lines.push(`- Seed: ${inputs.seed}`);
  lines.push(`- Periodicity: monthly (fixed)`);
  lines.push(`- Horizon: ${inputs.horizon} months`);
  lines.push(`- History length: ${inputs.history_length} months`);
  lines.push(`- Baseline: ${inputs.baseline_method} (season length: 12)`);
  lines.push(`- Price estimator: median last K (K=${inputs.price_median_k})`);
  lines.push(``);
  lines.push(`### Business scale assumptions`);
  lines.push(`- Categories: ${inputs.scale?.categories ?? "—"}`);
  lines.push(`- Countries: ${inputs.scale?.countries ?? "—"}`);
  lines.push(`- Active SKU: ${inputs.scale?.active_sku ?? "—"}`);
  lines.push(`- Avg monthly revenue per category×country: ${formatMoney(inputs.scale?.avg_monthly_revenue_per_category_country ?? 0)}`);
  lines.push(`- Baseline annual revenue (implied): ${formatMoney(inputs.implied_annual_revenue ?? 0)}`);
  lines.push(``);
  lines.push(`### Performance assumptions`);
  lines.push(`- Unit cost base: ${(inputs.unit_cost_pct_of_price * 100).toFixed(1)}% of price`);
  lines.push(`- Freight: ${(inputs.freight_pct_of_cogs * 100).toFixed(1)}% of COGS`);
  lines.push(`- Opex: fixed ${formatMoney(inputs.opex_fixed)} + ${(inputs.opex_pct_of_revenue * 100).toFixed(1)}% of revenue`);
  lines.push(`- Financing cost: ${(inputs.financing_pct_of_revenue * 100).toFixed(2)}% of revenue`);
  lines.push(`- Tax: ${(inputs.tax_pct * 100).toFixed(1)}% of positive pre-tax profit`);
  lines.push(``);
  lines.push(`## Scenario settings`);
  for (const id of ["base", "optimistic", "pessimistic"]) {
    const s = inputs.scenarios[id];
    lines.push(
      `- ${s.title}: demand ${s.shocks.demand_pct}% · price ${s.shocks.price_pct}% · FX ${s.shocks.fx_pct}% · freight ${s.shocks.freight_pct}% · lead time ${s.shocks.lead_time_days_delta}d`
    );
  }
  lines.push(``);
  lines.push(`## Scenario totals`);
  lines.push(mdTable(scenarioTotalsTable));
  lines.push(``);
  lines.push(`## Selected scenario P&L (last 8 months)`);
  lines.push(mdTable(pnlTable));
  lines.push(``);
  lines.push(`## Decisions`);
  if (inputs.inventory_constraint) {
    lines.push(`- Recommended purchases (total units): **${formatInt(dec.recommended_purchases_total_units ?? 0)}**`);
  } else {
    lines.push(`- Recommended purchases: inventory constraint is OFF`);
  }
  lines.push(
    `- FX sensitivity (ΔEBITDA vs selected): +5% FX → ${formatMoney(dec.fx_sensitivity.ebitda_delta_fx_plus_5pct)}; -5% FX → ${formatMoney(dec.fx_sensitivity.ebitda_delta_fx_minus_5pct)}`
  );
  lines.push(``);
  lines.push(`## Assumptions`);
  lines.push(`- Monthly-only FP&A view (strategic scale, not micro-precision).`);
  lines.push(`- Offline demo dataset (seeded RNG), neutral “international distributor / importer” case.`);
  lines.push(`- Revenue is always non-negative by construction (Revenue = Units × Price).`);
  lines.push(``);
  return lines.join("\n");
}

// Backward-compatible signature; periodicity ignored (monthly-only).
export function getPeriodLabel(_periodicity, periodIdx0) {
  return formatPeriodLabel(periodIdx0);
}

