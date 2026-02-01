import { RNG } from "./rng.js";
import { METRICS, CTR_AGG, STAT_TEST, STOP_REASON, allocTestFromPreset } from "./types.js";
import {
  zTestTwoProportions,
  welchTTest,
  ciDiffProportions95,
  ciDiffMeans95,
} from "./stats.js";

/**
 * @typedef {{impressions:number, clicks:number, purchased:boolean, revenue:number, userCtr?:number}} UserRow
 * @typedef {{users:number, impressions:number, clicks:number, purchases:number, revenue:number, userCtrSum:number, userCtrN:number, revenueArr:number[], userCtrArr:number[]}} GroupAgg
 * @typedef {{t:number, usersC:number, usersT:number, metricC:number, metricT:number, uplift:number, p:number, ctrC_event:number, ctrT_event:number, ctrC_user:number, ctrT_user:number, crC:number, crT:number, arpuC:number, arpuT:number}} HistoryPoint
 */

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function safeDiv(a, b) {
  return b > 0 ? a / b : 0;
}

function getMetricValue(metric, agg, group) {
  if (metric === METRICS.CTR) {
    if (agg === CTR_AGG.PER_USER) return group.userCtrN > 0 ? group.userCtrSum / group.userCtrN : 0;
    return safeDiv(group.clicks, group.impressions);
  }
  if (metric === METRICS.CR) return safeDiv(group.purchases, group.users);
  return safeDiv(group.revenue, group.users);
}

function computeUplift(test, control) {
  if (control === 0) return 0;
  return (test - control) / control;
}

/**
 * @param {import("./types.js").defaultConfig extends (...args:any)=>infer R ? R : any} cfg
 */
export function createEngine(cfg) {
  /** @type {GroupAgg} */
  const control = {
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
  /** @type {GroupAgg} */
  const test = {
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

  /** @type {HistoryPoint[]} */
  const history = [];

  let running = false;
  let tick = 0;
  let stopReason = STOP_REASON.NONE;
  let stoppedAtUsers = null;

  // Cache for p-value series marker
  let lastComputedP = 1;

  function reset(newCfg) {
    cfg = { ...cfg, ...newCfg };
    const r = new RNG(cfg.seed);
    rng._next = r._next;
    rng._spareNormal = null;

    control.users = 0;
    control.impressions = 0;
    control.clicks = 0;
    control.purchases = 0;
    control.revenue = 0;
    control.userCtrSum = 0;
    control.userCtrN = 0;
    control.revenueArr.length = 0;
    control.userCtrArr.length = 0;

    test.users = 0;
    test.impressions = 0;
    test.clicks = 0;
    test.purchases = 0;
    test.revenue = 0;
    test.userCtrSum = 0;
    test.userCtrN = 0;
    test.revenueArr.length = 0;
    test.userCtrArr.length = 0;

    history.length = 0;
    running = false;
    tick = 0;
    stopReason = STOP_REASON.NONE;
    stoppedAtUsers = null;
    lastComputedP = 1;

    pushHistoryPoint(true);
  }

  function totalUsers() {
    return control.users + test.users;
  }

  function shouldStopAtHorizon() {
    return totalUsers() >= cfg.horizonUsers;
  }

  function getAllocTest() {
    return allocTestFromPreset(cfg.allocPreset);
  }

  function getCtrParamsForUser(groupLabel) {
    const base = clamp01(cfg.baseCTR);
    const testCtr = clamp01(base * (1 + cfg.upliftCTR));

    if (groupLabel === "test") return { ctr: testCtr };

    // control: apply spillover to outcomes but keep label
    const spill = clamp01(cfg.spilloverPct);
    if (spill > 0 && rng.random() < spill) return { ctr: testCtr, spilled: true };
    return { ctr: base, spilled: false };
  }

  /**
   * @param {"control"|"test"} groupLabel
   */
  function simulateUser(groupLabel) {
    const impressions = rng.poisson(cfg.imprRate);
    const { ctr } = getCtrParamsForUser(groupLabel);
    const clicks = rng.binomial(impressions, ctr);
    const purchased = rng.random() < clamp01(cfg.buyProb);
    const revenue = purchased ? rng.logNormal(cfg.revMu, cfg.revSigma) : 0;
    const userCtr = impressions > 0 ? clicks / impressions : 0;
    return /** @type {UserRow} */ ({ impressions, clicks, purchased, revenue, userCtr });
  }

  /**
   * @param {GroupAgg} g
   * @param {UserRow} u
   */
  function addUserToGroup(g, u) {
    g.users += 1;
    g.impressions += u.impressions;
    g.clicks += u.clicks;
    g.purchases += u.purchased ? 1 : 0;
    g.revenue += u.revenue;
    g.revenueArr.push(u.revenue);
    if (u.impressions > 0) {
      g.userCtrSum += u.userCtr ?? 0;
      g.userCtrN += 1;
      g.userCtrArr.push(u.userCtr ?? 0);
    }
  }

  function computePValue() {
    const metric = cfg.metric;
    const agg = cfg.ctrAggregation;

    // Decide test (AUTO selects the canonical for that metric/aggregation)
    let testMode = cfg.statTest;
    if (testMode === STAT_TEST.AUTO) {
      if (metric === METRICS.ARPU) testMode = STAT_TEST.WELCH;
      else if (metric === METRICS.CR) testMode = STAT_TEST.Z_USER;
      else if (metric === METRICS.CTR) testMode = agg === CTR_AGG.PER_USER ? STAT_TEST.WELCH : STAT_TEST.Z_EVENT;
    }
    // Guardrails: ARPU is mean-based; default to Welch even if user picks otherwise.
    if (metric === METRICS.ARPU && testMode !== STAT_TEST.WELCH) testMode = STAT_TEST.WELCH;

    if (testMode === STAT_TEST.WELCH) {
      const s1 = metric === METRICS.CTR ? control.userCtrArr : control.revenueArr;
      const s2 = metric === METRICS.CTR ? test.userCtrArr : test.revenueArr;
      return welchTTest(s1, s2).pValue;
    }

    if (metric === METRICS.CTR) {
      // event-level z-test
      return zTestTwoProportions(control.clicks, control.impressions, test.clicks, test.impressions).pValue;
    }
    // CR: user-level z-test
    return zTestTwoProportions(control.purchases, control.users, test.purchases, test.users).pValue;
  }

  function computeCI95() {
    const metric = cfg.metric;
    const agg = cfg.ctrAggregation;
    let testMode = cfg.statTest;
    if (testMode === STAT_TEST.AUTO) {
      if (metric === METRICS.ARPU) testMode = STAT_TEST.WELCH;
      else if (metric === METRICS.CR) testMode = STAT_TEST.Z_USER;
      else if (metric === METRICS.CTR) testMode = agg === CTR_AGG.PER_USER ? STAT_TEST.WELCH : STAT_TEST.Z_EVENT;
    }
    if (metric === METRICS.ARPU && testMode !== STAT_TEST.WELCH) testMode = STAT_TEST.WELCH;

    if (testMode === STAT_TEST.WELCH) {
      const s1 = metric === METRICS.CTR ? control.userCtrArr : control.revenueArr;
      const s2 = metric === METRICS.CTR ? test.userCtrArr : test.revenueArr;
      return ciDiffMeans95(s1, s2);
    }

    if (metric === METRICS.CTR) {
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

    const metricC = getMetricValue(cfg.metric, cfg.ctrAggregation, control);
    const metricT = getMetricValue(cfg.metric, cfg.ctrAggregation, test);
    const uplift = computeUplift(metricT, metricC);

    const p = computePValue();
    lastComputedP = p;

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
    const allocTest = getAllocTest();

    for (let i = 0; i < arrivals; i++) {
      const isTest = rng.random() < allocTest;
      const u = simulateUser(isTest ? "test" : "control");
      addUserToGroup(isTest ? test : control, u);

      if (shouldStopAtHorizon()) {
        stopReason = STOP_REASON.HORIZON;
        stoppedAtUsers = totalUsers();
        break;
      }

      // Peeking check at exact boundaries (users-based)
      if (cfg.peekingEnabled && cfg.lookEveryUsers > 0) {
        const users = totalUsers();
        if (users % cfg.lookEveryUsers === 0) {
          const p = computePValue();
          lastComputedP = p;
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

  function step(nTicks) {
    const n = Math.max(1, Math.floor(nTicks));
    for (let i = 0; i < n; i++) {
      stepOneTick();
      if (stopReason !== STOP_REASON.NONE) break;
    }
  }

  function getSnapshot() {
    const metricC = getMetricValue(cfg.metric, cfg.ctrAggregation, control);
    const metricT = getMetricValue(cfg.metric, cfg.ctrAggregation, test);
    const uplift = computeUplift(metricT, metricC);
    const p = computePValue();
    lastComputedP = p;
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

  // initial point
  pushHistoryPoint(true);

  return {
    getSnapshot,
    setRunning: (v) => {
      running = !!v;
    },
    isRunning: () => running,
    step,
    reset,
    updateConfig: (patch) => {
      cfg = { ...cfg, ...patch };
    },
  };
}

