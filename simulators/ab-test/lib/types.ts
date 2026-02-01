export const METRICS = {
  CTR: "ctr",
  CR: "cr",
  ARPU: "arpu",
} as const;
export type MetricKey = (typeof METRICS)[keyof typeof METRICS];

export const CTR_AGG = {
  PER_EVENT: "per_event",
  PER_USER: "per_user",
} as const;
export type CtrAggregation = (typeof CTR_AGG)[keyof typeof CTR_AGG];

export const STAT_TEST = {
  AUTO: "auto",
  Z_EVENT: "z_event",
  Z_USER: "z_user",
  WELCH: "welch",
} as const;
export type StatTestMode = (typeof STAT_TEST)[keyof typeof STAT_TEST];

export const STOP_REASON = {
  HORIZON: "horizon",
  PEEKING: "peeking",
  NONE: "none",
} as const;
export type StopReason = (typeof STOP_REASON)[keyof typeof STOP_REASON];

export type AbConfig = {
  seed: string;
  arrivalsPerMin: number;
  speed: number;
  horizonUsers: number;

  allocPreset: "50/50" | "60/40" | "70/30";
  spilloverPct: number; // 0..1

  baseCTR: number;
  upliftCTR: number;
  imprRate: number;
  buyProb: number;
  revMu: number;
  revSigma: number;

  metric: MetricKey;
  ctrAggregation: CtrAggregation;
  statTest: StatTestMode;
  alpha: number;
  sampleEveryUsers: number;

  peekingEnabled: boolean;
  lookEveryUsers: number;
};

export function defaultConfig(): AbConfig {
  return {
    seed: "ab-live",
    arrivalsPerMin: 120,
    speed: 2,
    horizonUsers: 3000,

    allocPreset: "50/50",
    spilloverPct: 0,

    baseCTR: 0.06,
    upliftCTR: 0.05,
    imprRate: 6,
    buyProb: 0.08,
    revMu: 2.6,
    revSigma: 1.0,

    metric: METRICS.CTR,
    ctrAggregation: CTR_AGG.PER_EVENT,
    statTest: STAT_TEST.AUTO,
    alpha: 0.05,
    sampleEveryUsers: 50,

    peekingEnabled: false,
    lookEveryUsers: 200,
  };
}

export function allocTestFromPreset(preset: AbConfig["allocPreset"]): number {
  if (preset === "60/40") return 0.4;
  if (preset === "70/30") return 0.3;
  return 0.5;
}

