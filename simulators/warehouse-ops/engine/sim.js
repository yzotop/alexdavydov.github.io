import { STAGES } from "./model.js";
import { RNG, clamp, samplePoisson, sampleUniformAround } from "./rng.js";
import { RollingRate, Series } from "./metrics.js";

function stageProcSample(stage, cfg, rng) {
  switch (stage) {
    case STAGES.INBOUND:
      return Math.max(1, Math.round(sampleUniformAround(cfg.proc.inboundMean, cfg.proc.inboundJitter, rng)));
    case STAGES.STORAGE:
      return Math.max(1, Math.round(sampleUniformAround(cfg.proc.storageMean, cfg.proc.storageJitter, rng)));
    case STAGES.PICK:
      return Math.max(1, Math.round(sampleUniformAround(cfg.proc.pickMean, cfg.proc.pickJitter, rng)));
    case STAGES.PACK:
      return Math.max(1, Math.round(sampleUniformAround(cfg.proc.packMean, cfg.proc.packJitter, rng)));
    case STAGES.OUTBOUND:
      return Math.max(1, Math.round(sampleUniformAround(cfg.proc.outboundMean, cfg.proc.outboundJitter, rng)));
    default:
      return 1;
  }
}

function shouldDepart(t, cfg) {
  const c = cfg.carrier;
  if (c.mode === "windows") {
    const m = t % 1440;
    const wins = c.windows || [];
    for (let i = 0; i < wins.length; i++) if ((wins[i] | 0) === m) return true;
    return false;
  }
  const interval = Math.max(1, c.intervalMin | 0);
  return t > 0 && (t % interval === 0);
}

export class WarehouseSim {
  constructor(cfg, seed = 1) {
    this.reset(cfg, seed);
  }

  reset(cfg, seed = 1) {
    this.cfg = cfg;
    this.t = 0;
    this.horizon = cfg.horizonMin | 0;
    this.rng = new RNG(seed);

    this.nextId = 1;
    this.orders = []; // dense array of order objects (only live + shipped for lead time stats)

    this.q = [[], [], [], [], []]; // per-stage queue of order indices
    this.svc = [[], [], [], [], []]; // per-stage in-service order indices

    this.created = 0;
    this.shipped = 0;
    this.shippedBreached = 0;
    this.sumLead = 0;
    this.sumLeadCount = 0;

    // Instrumentation (no behavior change): per-tick counters + move events (capped)
    this.tickStarted = new Int32Array(5);
    this.tickFinished = new Int32Array(5);
    this._moveCap = 80;
    this.tickMoveCount = 0;
    this.tickMoveId = new Int32Array(this._moveCap);
    this.tickMoveFrom = new Int8Array(this._moveCap);
    this.tickMoveTo = new Int8Array(this._moveCap);
    this.tickMoveSize = new Int8Array(this._moveCap);
    this.tickMoveLate = new Int8Array(this._moveCap);

    // Stable object to avoid allocations in hot loop
    this.lastTick = {
      arrivals: 0,
      shippedNow: 0,
      lateNow: 0,
      bottleneck: "—",
      carrierDeparted: false,
      started: this.tickStarted,
      finished: this.tickFinished,
      moveCount: 0,
      moveId: this.tickMoveId,
      moveFrom: this.tickMoveFrom,
      moveTo: this.tickMoveTo,
      moveSize: this.tickMoveSize,
      moveLate: this.tickMoveLate,
    };

    this.seriesThroughput = new Series(1200);
    this.seriesBacklog = new Series(1200);
    this.seriesRollingBreach = new Series(1200);
    this.seriesUtilPick = new Series(1200);
    this.seriesUtilPack = new Series(1200);
    this.rollingBreach = new RollingRate(180);

    return this;
  }

  _capacityForStage(stage) {
    const w = this.cfg.workers;
    if (stage === STAGES.INBOUND) return w.inbound | 0;
    if (stage === STAGES.STORAGE) return w.storage | 0;
    if (stage === STAGES.PICK) return w.pick | 0;
    if (stage === STAGES.PACK) return w.pack | 0;
    if (stage === STAGES.OUTBOUND) return w.outbound | 0;
    return 0;
  }

  _storageWipCount() {
    // storage stage is index 1
    return this.q[STAGES.STORAGE].length + this.svc[STAGES.STORAGE].length;
  }

  _makeOrder(now) {
    const size = 1 + (this.rng.nextU32() % 5); // 1..5
    const slaMin = Math.max(60, Math.round((Number(this.cfg.slaHours) || 24) * 60));
    const due = now + slaMin;
    const o = {
      id: this.nextId++,
      createdAt: now,
      dueAt: due,
      size,
      stage: STAGES.INBOUND,
      rem: 0,
      shippedAt: -1,
      breached: false,
    };
    return o;
  }

  _enqueue(stage, orderIdx) {
    this.q[stage].push(orderIdx);
  }

  _startService(stage, orderIdx) {
    const o = this.orders[orderIdx];
    o.stage = stage;
    // size affects work linearly but mildly
    const base = stageProcSample(stage, this.cfg, this.rng);
    o.rem = Math.max(1, Math.round(base * (0.7 + 0.15 * o.size)));
    o.work0 = o.rem; // for progress bar
    this.svc[stage].push(orderIdx);
  }

  _fillServers(stage) {
    const cap = this._capacityForStage(stage);
    if (cap <= 0) return;
    const svc = this.svc[stage];
    const q = this.q[stage];
    while (svc.length < cap && q.length > 0) {
      const idx = q.shift();
      this.tickStarted[stage] += 1;
      this._startService(stage, idx);
    }
  }

  _recordMove(orderIdx, fromStage, toStage) {
    const k = this.tickMoveCount | 0;
    if (k >= this._moveCap) return;
    const o = this.orders[orderIdx];
    this.tickMoveId[k] = o.id | 0;
    this.tickMoveFrom[k] = fromStage | 0;
    this.tickMoveTo[k] = toStage | 0;
    this.tickMoveSize[k] = o.size | 0;
    this.tickMoveLate[k] = (this.t > o.dueAt) ? 1 : 0;
    this.tickMoveCount = k + 1;
  }

  _processStage(stage) {
    const svc = this.svc[stage];
    if (svc.length === 0) return 0;
    let completed = 0;
    // tight loop: mutate in place by swap-pop
    for (let i = 0; i < svc.length; ) {
      const idx = svc[i];
      const o = this.orders[idx];
      o.rem -= 1;
      if (o.rem <= 0) {
        // remove from svc by swap-pop
        const last = svc[svc.length - 1];
        svc[i] = last;
        svc.pop();
        completed += 1;
        this.tickFinished[stage] += 1;

        // advance
        if (stage === STAGES.OUTBOUND) {
          this._enqueue(STAGES.OUTBOUND, idx);
        } else {
          const next = stage + 1;
          // storage WIP cap: block entry into STORAGE
          if (next === STAGES.STORAGE) {
            const cap = this.cfg.limits.storageWipCap | 0;
            if (cap > 0 && this._storageWipCount() >= cap) {
              // blocked: re-queue current stage
              this._enqueue(stage, idx);
            } else {
              this._enqueue(next, idx);
              this._recordMove(idx, stage, next);
            }
          } else {
            this._enqueue(next, idx);
            this._recordMove(idx, stage, next);
          }
        }
        continue;
      }
      i += 1;
    }
    return completed;
  }

  _carrierDepart(now) {
    const cap = Math.max(0, this.cfg.carrier.capacityPerDeparture | 0);
    if (cap <= 0) return 0;
    const qOut = this.q[STAGES.OUTBOUND];
    let loaded = 0;
    while (loaded < cap && qOut.length > 0) {
      const idx = qOut.shift();
      const o = this.orders[idx];
      o.stage = STAGES.SHIPPED;
      o.shippedAt = now;
      const lead = now - o.createdAt;
      this.sumLead += lead;
      this.sumLeadCount += 1;
      this.shipped += 1;
      const breached = now > o.dueAt;
      if (breached) {
        o.breached = true;
        this.shippedBreached += 1;
      }
      loaded += 1;
      this._recordMove(idx, STAGES.OUTBOUND, STAGES.SHIPPED);
    }
    return loaded;
  }

  _bottleneckStage() {
    let best = -1;
    let bestName = "—";
    const names = ["INB", "STO", "PICK", "PACK", "OUT"];
    for (let s = 0; s <= STAGES.OUTBOUND; s++) {
      const v = this.q[s].length + this.svc[s].length;
      if (v > best) {
        best = v;
        bestName = names[s] || "—";
      }
    }
    return bestName;
  }

  step() {
    if (this.t >= this.horizon) return false;

    const now = this.t;
    // reset per-tick instrumentation (in place)
    this.tickStarted.fill(0);
    this.tickFinished.fill(0);
    this.tickMoveCount = 0;

    const lambdaPerTick = (Number(this.cfg.arrivalRatePerHour) || 0) / 60.0;
    const arrivals = samplePoisson(lambdaPerTick, this.rng);

    for (let i = 0; i < arrivals; i++) {
      const o = this._makeOrder(now);
      const idx = this.orders.length;
      this.orders.push(o);
      this._enqueue(STAGES.INBOUND, idx);
      this.created += 1;
    }

    // Fill servers and process stages
    for (let s = 0; s <= STAGES.OUTBOUND; s++) this._fillServers(s);
    for (let s = 0; s <= STAGES.OUTBOUND; s++) this._processStage(s);
    for (let s = 0; s <= STAGES.OUTBOUND; s++) this._fillServers(s);

    let shippedNow = 0;
    let departed = false;
    if (shouldDepart(now, this.cfg)) {
      departed = true;
      shippedNow = this._carrierDepart(now);
    }

    // Late now: in-system orders past due
    let lateNow = 0;
    for (let s = 0; s <= STAGES.OUTBOUND; s++) {
      const q = this.q[s];
      for (let i = 0; i < q.length; i++) if (this.orders[q[i]].dueAt < now) lateNow += 1;
      const svc = this.svc[s];
      for (let i = 0; i < svc.length; i++) if (this.orders[svc[i]].dueAt < now) lateNow += 1;
    }

    const backlog = this.created - this.shipped;
    const breachRate = this.shipped > 0 ? this.shippedBreached / this.shipped : 0;
    const avgLead = this.sumLeadCount > 0 ? this.sumLead / this.sumLeadCount : 0;

    const utilPick = this._capacityForStage(STAGES.PICK) > 0 ? this.svc[STAGES.PICK].length / this._capacityForStage(STAGES.PICK) : 0;
    const utilPack = this._capacityForStage(STAGES.PACK) > 0 ? this.svc[STAGES.PACK].length / this._capacityForStage(STAGES.PACK) : 0;

    // rolling breach for shipped ticks (if no shipments, push 0)
    const breachTick = shippedNow > 0 ? (() => {
      let b = 0;
      // approximate: breaches among just shipped are those with breached=true and shippedAt==now
      // (scan last shippedNow orders from end is not safe); instead: breachTick ~ delta of cumulative
      // We'll compute using counters: compare before/after by tracking last shippedBreached in state.
      return b;
    })() : 0;

    // rolling breach: use shippedNow and breachedNow computed from delta counters
    // (avoid per-shipped scan) — compute delta by caching previous values.
    if (this._prevShippedBreached === undefined) this._prevShippedBreached = 0;
    if (this._prevShipped === undefined) this._prevShipped = 0;
    const dBreached = this.shippedBreached - this._prevShippedBreached;
    const dShipped = this.shipped - this._prevShipped;
    const tickBreachRate = dShipped > 0 ? dBreached / dShipped : 0;
    this._prevShippedBreached = this.shippedBreached;
    this._prevShipped = this.shipped;
    this.rollingBreach.push(tickBreachRate);

    this.seriesThroughput.push(now, shippedNow);
    this.seriesBacklog.push(now, backlog);
    this.seriesRollingBreach.push(now, this.rollingBreach.mean());
    this.seriesUtilPick.push(now, utilPick);
    this.seriesUtilPack.push(now, utilPack);

    this.lastTick.arrivals = arrivals;
    this.lastTick.shippedNow = shippedNow;
    this.lastTick.lateNow = lateNow;
    this.lastTick.bottleneck = this._bottleneckStage();
    this.lastTick.carrierDeparted = departed;
    this.lastTick.moveCount = this.tickMoveCount;

    this.t += 1;
    return true;
  }

  snapshot() {
    const backlog = this.created - this.shipped;
    return {
      t: this.t,
      horizon: this.horizon,
      created: this.created,
      shipped: this.shipped,
      backlog,
      shippedBreached: this.shippedBreached,
      breachRate: this.shipped > 0 ? this.shippedBreached / this.shipped : 0,
      avgLeadMin: this.sumLeadCount > 0 ? this.sumLead / this.sumLeadCount : 0,
      wip: {
        inbound: this.q[STAGES.INBOUND].length + this.svc[STAGES.INBOUND].length,
        storage: this.q[STAGES.STORAGE].length + this.svc[STAGES.STORAGE].length,
        pick: this.q[STAGES.PICK].length + this.svc[STAGES.PICK].length,
        pack: this.q[STAGES.PACK].length + this.svc[STAGES.PACK].length,
        outbound: this.q[STAGES.OUTBOUND].length + this.svc[STAGES.OUTBOUND].length,
      },
      util: {
        inbound: this._capacityForStage(STAGES.INBOUND) > 0 ? this.svc[STAGES.INBOUND].length / this._capacityForStage(STAGES.INBOUND) : 0,
        storage: this._capacityForStage(STAGES.STORAGE) > 0 ? this.svc[STAGES.STORAGE].length / this._capacityForStage(STAGES.STORAGE) : 0,
        pick: this._capacityForStage(STAGES.PICK) > 0 ? this.svc[STAGES.PICK].length / this._capacityForStage(STAGES.PICK) : 0,
        pack: this._capacityForStage(STAGES.PACK) > 0 ? this.svc[STAGES.PACK].length / this._capacityForStage(STAGES.PACK) : 0,
        outbound: this._capacityForStage(STAGES.OUTBOUND) > 0 ? this.svc[STAGES.OUTBOUND].length / this._capacityForStage(STAGES.OUTBOUND) : 0,
      },
      lastTick: this.lastTick,
      qlens: this.q.map((a) => a.length),
      svclens: this.svc.map((a) => a.length),
    };
  }

  // For arena rendering: sample up to N active order indices from queues+svc
  sampleActiveOrderIndices(maxN = 250) {
    const out = [];
    const want = maxN | 0;
    for (let s = 0; s <= STAGES.OUTBOUND; s++) {
      const q = this.q[s];
      for (let i = 0; i < q.length && out.length < want; i += Math.max(1, Math.floor(q.length / 50))) out.push(q[i]);
      const svc = this.svc[s];
      for (let i = 0; i < svc.length && out.length < want; i++) out.push(svc[i]);
      if (out.length >= want) break;
    }
    return out;
  }
}

