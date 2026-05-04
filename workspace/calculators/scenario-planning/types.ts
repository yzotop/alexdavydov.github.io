export type Periodicity = "weekly" | "monthly";
export type SegmentLevel = "category" | "category_country" | "category_country_client";
export type BaselineMethod = "seasonal_naive" | "moving_average";
export type ScenarioId = "base" | "optimistic" | "pessimistic";

export type ClientSegment = "retail_chain" | "marketplace" | "other";

export type ScenarioShocks = {
  /** e.g. +10 means +10% to units */
  demand_pct: number;
  /** e.g. +2 means +2% to price */
  price_pct: number;
  /** e.g. -3 means -3% FX (reduces unit cost) */
  fx_pct: number;
  /** e.g. -5 means -5% freight shock applied on top of freight_pct */
  freight_pct: number;
  /** lead time delta in days (MVP: used only for reporting / flags) */
  lead_time_days_delta: number;
};

export type ScenarioPreset = {
  id: ScenarioId;
  title: string;
  locked: boolean;
  shocks: ScenarioShocks;
};

export type ScenarioPlanningInputs = {
  seed: number;
  periodicity: Periodicity;
  horizon: number; // 12..52
  history_length: number; // 52..156
  segment_level: SegmentLevel;

  baseline_method: BaselineMethod;
  price_median_k: number; // default 8

  // cost/opex
  unit_cost_pct_of_price: number; // default 0.70
  freight_pct_of_cogs: number; // default 0.06
  opex_fixed: number; // default 0
  opex_pct_of_revenue: number; // default 0.04

  // inventory
  inventory_constraint: boolean;
  safety_stock_pct: number; // default 0.10

  // scenario presets (base is locked to 0 shocks)
  scenarios: Record<ScenarioId, ScenarioPreset>;
};

export type SegmentKey = string;

export type SegmentDims = {
  category: string;
  country?: string;
  client_segment?: ClientSegment;
};

export type Segment = {
  key: SegmentKey;
  dims: SegmentDims;
};

export type DatasetMeta = {
  categories: string[];
  countries: string[];
  client_segments: ClientSegment[];
  season_length: number;
  history_length: number;
};

export type SegmentSeries = {
  segment: Segment;
  /** length = history_length (history only) */
  units_hist: number[];
  /** length = history_length (history only) */
  price_hist: number[];
};

export type GeneratedDataset = {
  meta: DatasetMeta;
  segments: SegmentSeries[];
  /** first 10 rows of a flattened view (for UI preview) */
  preview_rows: Array<{
    period_idx: number; // 0..history_length-1
    category: string;
    country: string;
    client_segment: ClientSegment;
    units: number;
    price: number;
    revenue: number;
  }>;
};

export type PeriodPnl = {
  period: number; // 1..horizon
  revenue: number;
  cogs: number;
  freight: number;
  opex: number;
  ebitda: number;
  units: number;
  recommended_purchases_units?: number;
};

export type ScenarioTotals = {
  revenue_total: number;
  ebitda_total: number;
  cogs_total: number;
  freight_total: number;
  opex_total: number;
  units_total: number;
};

export type ScenarioResult = {
  scenario: ScenarioId;
  per_period: PeriodPnl[];
  totals: ScenarioTotals;
};

export type ScenarioComparison = {
  scenario: ScenarioId;
  delta_vs_base: {
    revenue_total: number;
    ebitda_total: number;
    cogs_total: number;
    freight_total: number;
    opex_total: number;
    units_total: number;
  };
};

export type FxSensitivity = {
  /** delta EBITDA total for +5% FX (cost up) vs selected scenario */
  ebitda_delta_fx_plus_5pct: number;
  /** delta EBITDA total for -5% FX (cost down) vs selected scenario */
  ebitda_delta_fx_minus_5pct: number;
};

export type DecisionsOutput = {
  recommended_purchases_total_units?: number;
  recommended_purchases_per_period?: Array<{ period: number; units: number }>;
  fx_sensitivity: FxSensitivity;
  risk_flags: string[];
};

export type ScenarioPlanningOutput = {
  inputs: ScenarioPlanningInputs;
  dataset: GeneratedDataset;
  results: Record<ScenarioId, ScenarioResult>;
  comparison: Record<Exclude<ScenarioId, "base">, ScenarioComparison>;
  charts: {
    revenue: Array<{ period: number; base: number; optimistic: number; pessimistic: number }>;
    ebitda: Array<{ period: number; base: number; optimistic: number; pessimistic: number }>;
    totals_ebitda: Array<{ scenario: ScenarioId; ebitda_total: number }>;
  };
  decisions_for_selected: (selected: ScenarioId) => DecisionsOutput;
};

