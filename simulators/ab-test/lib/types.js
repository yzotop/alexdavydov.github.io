export const METRICS = /** @type {const} */ ({
  CTR: "ctr",
  CR: "cr",
  ARPU: "arpu",
});

export const CTR_AGG = /** @type {const} */ ({
  PER_EVENT: "per_event",
  PER_USER: "per_user",
});

export const STAT_TEST = /** @type {const} */ ({
  AUTO: "auto",
  Z_EVENT: "z_event",
  Z_USER: "z_user",
  WELCH: "welch",
});

export const STOP_REASON = /** @type {const} */ ({
  HORIZON: "horizon",
  PEEKING: "peeking",
  NONE: "none",
});

export function defaultConfig() {
  return {
    seed: "ab-live",
    // time + arrivals
    arrivalsPerMin: 120, // -> 2/sec
    speed: 2, // ticks per animation frame
    horizonUsers: 3000,

    // assignment + mistakes
    allocPreset: "50/50", // control/test: 50/50, 60/40, 70/30 (test share 0.5/0.4/0.3)
    spilloverPct: 0, // 0..0.6

    // outcome model
    baseCTR: 0.06,
    upliftCTR: 0.05, // +5% relative
    imprRate: 6,
    buyProb: 0.08,
    revMu: 2.6,
    revSigma: 1.0,

    // analysis
    metric: METRICS.CTR,
    ctrAggregation: CTR_AGG.PER_EVENT,
    statTest: STAT_TEST.AUTO,
    alpha: 0.05,
    sampleEveryUsers: 50,

    // peeking
    peekingEnabled: false,
    lookEveryUsers: 200,
  };
}

export function allocTestFromPreset(preset) {
  if (preset === "60/40") return 0.4;
  if (preset === "70/30") return 0.3;
  return 0.5;
}

