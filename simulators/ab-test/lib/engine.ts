import { RNG } from "./rng";
import { CTR_AGG, METRICS, STAT_TEST, STOP_REASON, type AbConfig, type StopReason } from "./types";
import { ciDiffMeans95, ciDiffProportions95, welchTTest, zTestTwoProportions } from "./stats";

export type UserRow = {
  impressions: number;
  clicks: number;
  purchased: boolean;
  revenue: number;
  userCtr: number;
};

export type GroupAgg = {
  users: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  userCtrSum: number;
  userCtrN: number;
  revenueArr: number[];
  userCtrArr: number[];
};

export type HistoryPoint = {
  t: number;
  usersC: number;
  usersT: number;
  metricC: number;
  metricT: number;
  uplift: number;
  p: number;
  ctrC_event: number;
  ctrT_event: number;
  ctrC_user: number;
  ctrT_user: number;
  crC: number;
  crT: number;
  arpuC: number;
  arpuT: number;
};

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

function allocTestFromPreset(preset: AbConfig["allocPreset"]): number {
  if (preset === "60/40") return 0.4;
  if (preset === "70/30") return 0.3;
  return 0.5;
}

function getMetricValue(cfg: AbConfig, g: GroupAgg): number {
  if (cfg.metric === METRICS.CTR) {
    if (cfg.ctrAggregation === CTR_AGG.PER_USER) return g.userCtrN > 0 ? g.userCtrSum / g.userCtrN : 0;
    return safeDiv(g.clicks, g.impressions);
  }
  if (cfg.metric === METRICS.CR) return safeDiv(g.purchases, g.users);
  return safeDiv(g.revenue, g.users);
}

function computeUplift(test: number, control: number): number {
  if (control === 0) return 0;
  return (test - control) / control;
}

export function createEngine(initialCfg: AbConfig) {
  let cfg: AbConfig = { ...initialCfg };

  const control: GroupAgg = {
    users: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    revenue: 0,
    userCtrSum: 0,
    userCtrN: 0,
    revenueArr: [],
    userCtrArr: [],
  };
  const test: GroupAgg = {
    users: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    revenue: 0,
    userCtrSum: 0,
    userCtrN: 0,
    revenueArr: [],
    userCtrArr: [],
  };

  const rng = new RNG(cfg.seed);
  const history: HistoryPoint[] = [];

  let running = false;
  let tick = 0;
  let stopReason: StopReason = STOP_REASON.NONE;
  let stoppedAtUsers: number | null = null;

  function totalUsers() {
    return control.users + test.users;
  }

  function shouldStopAtHorizon() {
    return totalUsers() >= cfg.horizonUsers;
  }

  function getCtrForUser(groupLabel: "control" | "test"): number {
    const base = clamp01(cfg.baseCTR);
    const testCtr = clamp01(base * (1 + cfg.upliftCTR));
    if (groupLabel === "test") return testCtr;

    const spill = clamp01(cfg.spilloverPct);
    if (spill > 0 && rng.random() < spill) return testCtr;
    return base;
  }

  function simulateUser(groupLabel: "control" | "test"): UserRow {
    const impressions = rng.poisson(cfg.imprRate);
    const ctr = getCtrForUser(groupLabel);
    const clicks = rng.binomial(impressions, ctr);
    const purchased = rng.random() < clamp01(cfg.buyProb);
    const revenue = purchased ? rng.logNormal(cfg.revMu, cfg.revSigma) : 0;
    const userCtr = impressions > 0 ? clicks / impressions : 0;
    return { impressions, clicks, purchased, revenue, userCtr };
  }

  function addUserToGroup(g: GroupAgg, u: UserRow) {
    g.users += 1;
    g.impressions += u.impressions;
    g.clicks += u.clicks;
    g.purchases += u.purchased ? 1 : 0;
    g.revenue += u.revenue;
    g.revenueArr.push(u.revenue);
    if (u.impressions > 0) {
      g.userCtrSum += u.userCtr;
      g.userCtrN += 1;
      g.userCtrArr.push(u.userCtr);
    }
  }

  function resolveTestMode(): AbConfig["statTest"] {
    let mode = cfg.statTest;
    if (mode === STAT_TEST.AUTO) {
      if (cfg.metric === METRICS.ARPU) mode = STAT_TEST.WELCH;
      else if (cfg.metric === METRICS.CR) mode = STAT_TEST.Z_USER;
      else mode = cfg.ctrAggregation === CTR_AGG.PER_USER ? STAT_TEST.WELCH : STAT_TEST.Z_EVENT;
    }
    if (cfg.metric === METRICS.ARPU && mode !== STAT_TEST.WELCH) mode = STAT_TEST.WELCH;
    return mode;
  }

  function computePValue(): number {
    const mode = resolveTestMode();
    if (mode === STAT_TEST.WELCH) {
      const s1 = cfg.metric === METRICS.CTR ? control.userCtrArr : control.revenueArr;
      const s2 = cfg.metric === METRICS.CTR ? test.userCtrArr : test.revenueArr;
      return welchTTest(s1, s2).pValue;
    }
    if (cfg.metric === METRICS.CTR) {
      return zTestTwoProportions(control.clicks, control.impressions, test.clicks, test.impressions).pValue;
    }
    return zTestTwoProportions(control.purchases, control.users, test.purchases, test.users).pValue;
  }

  function computeCI95() {
    const mode = resolveTestMode();
    if (mode === STAT_TEST.WELCH) {
      const s1 = cfg.metric === METRICS.CTR ? control.userCtrArr : control.revenueArr;
      const s2 = cfg.metric === METRICS.CTR ? test.userCtrArr : test.revenueArr;
      return ciDiffMeans95(s1, s2);
    }
    if (cfg.metric === METRICS.CTR) {
      return ciDiffProportions95(control.clicks, control.impressions, test.clicks, test.impressions);
    }
    return ciDiffProportions95(control.purchases, control.users, test.purchases, test.users);
  }

  function pushHistoryPoint(force = false) {
    const users = totalUsers();
    const shouldSample = force || (cfg.sampleEveryUsers > 0 && users % cfg.sampleEveryUsers === 0);
    if (!shouldSample) return;

    const ctrC_event = safeDiv(control.clicks, control.impressions);
    const ctrT_event = safeDiv(test.clicks, test.impressions);
    const ctrC_user = control.userCtrN > 0 ? control.userCtrSum / control.userCtrN : 0;
    const ctrT_user = test.userCtrN > 0 ? test.userCtrSum / test.userCtrN : 0;

    const crC = safeDiv(control.purchases, control.users);
    const crT = safeDiv(test.purchases, test.users);

    const arpuC = safeDiv(control.revenue, control.users);
    const arpuT = safeDiv(test.revenue, test.users);

    const metricC = getMetricValue(cfg, control);
    const metricT = getMetricValue(cfg, test);
    const uplift = computeUplift(metricT, metricC);
    const p = computePValue();

    history.push({
      t: tick,
      usersC: control.users,
      usersT: test.users,
      metricC,
      metricT,
      uplift,
      p,
      ctrC_event,
      ctrT_event,
      ctrC_user,
      ctrT_user,
      crC,
      crT,
      arpuC,
      arpuT,
    });
  }

  function stepOneTick() {
    if (stopReason !== STOP_REASON.NONE) return;
    tick += 1;
    const lambdaPerSec = Math.max(0, cfg.arrivalsPerMin / 60);
    const arrivals = rng.poisson(lambdaPerSec);
    const allocTest = allocTestFromPreset(cfg.allocPreset);

    for (let i = 0; i < arrivals; i++) {
      const isTest = rng.random() < allocTest;
      const u = simulateUser(isTest ? "test" : "control");
      addUserToGroup(isTest ? test : control, u);

      if (shouldStopAtHorizon()) {
        stopReason = STOP_REASON.HORIZON;
        stoppedAtUsers = totalUsers();
        break;
      }

      if (cfg.peekingEnabled && cfg.lookEveryUsers > 0) {
        const users = totalUsers();
        if (users % cfg.lookEveryUsers === 0) {
          const p = computePValue();
          if (p < cfg.alpha) {
            stopReason = STOP_REASON.PEEKING;
            stoppedAtUsers = users;
            break;
          }
        }
      }
    }

    pushHistoryPoint(false);
  }

  function step(nTicks: number) {
    const n = Math.max(1, Math.floor(nTicks));
    for (let i = 0; i < n; i++) {
      stepOneTick();
      if (stopReason !== STOP_REASON.NONE) break;
    }
  }

  function reset(nextCfg: AbConfig) {
    cfg = { ...nextCfg };
    rng._replaceWith(new RNG(cfg.seed));

    for (const g of [control, test]) {
      g.users = 0;
      g.impressions = 0;
      g.clicks = 0;
      g.purchases = 0;
      g.revenue = 0;
      g.userCtrSum = 0;
      g.userCtrN = 0;
      g.revenueArr.length = 0;
      g.userCtrArr.length = 0;
    }

    history.length = 0;
    running = false;
    tick = 0;
    stopReason = STOP_REASON.NONE;
    stoppedAtUsers = null;
    pushHistoryPoint(true);
  }

  function updateConfig(patch: Partial<AbConfig>) {
    cfg = { ...cfg, ...patch };
  }

  function getSnapshot() {
    const metricC = getMetricValue(cfg, control);
    const metricT = getMetricValue(cfg, test);
    const uplift = computeUplift(metricT, metricC);
    const p = computePValue();
    const ci = computeCI95();
    return {
      cfg,
      running,
      tick,
      stopReason,
      stoppedAtUsers,
      totalUsers: totalUsers(),
      control: { ...control },
      test: { ...test },
      metricC,
      metricT,
      uplift,
      p,
      ci,
      history: history.slice(),
    };
  }

  pushHistoryPoint(true);

  return {
    getSnapshot,
    isRunning: () => running,
    setRunning: (v: boolean) => {
      running = !!v;
    },
    step,
    reset,
    updateConfig,
  };
}

