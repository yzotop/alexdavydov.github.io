/* sim.js — core simulation (time-evolving, deterministic with seed)
   Model summary:
   - Sessions arrive via Poisson(users_per_sec)
   - Each session has planned length ~ Exponential(mean_session_length)
   - Opportunities occur at constant opp_rate per user-second
   - Policy controls show probability + constraints (freq cap, min gap)
   - Auction: bidders have base CPM ~ LogNormal(mean, sigma); bid scaled by user quality (CTR ratio)
   - Floor CPM can block delivery; second-price payment
   - Fatigue increases on impression, decays over time, reduces CTR, increases exit hazard
*/

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before sim.js');

  const DEFAULT_PARAMS = {
    // A) Traffic & Sessions
    users_per_sec: 4.0,              // 0.5–20
    mean_session_length: 45,         // sec (10–120)
    tolerance_mean: 0.55,            // 0.2–0.9
    tolerance_spread: 0.18,          // 0–0.4 (sd)

    // B) Pressure policy
    policy: 'adaptive',             // fixed | adaptive
    target_ad_rate: 0.18,            // ads per user-sec (0–0.5)
    freq_cap: 8,                     // ads per session (0–20)
    min_gap_sec: 6,                  // (0–30)

    // C) Auction & monetization
    bidders_count: 8,                // 2–20
    bid_cpm_mean: 6.0,               // $ (0.5–20)
    bid_cpm_sigma: 0.7,              // lognormal sigma (0–2.0)
    floor_cpm: 1.0,                  // $ (0–10)
    take_rate: 0.18,                 // 0–0.4

    // D) Fatigue & UX
    fatigue_per_impression: 0.14,    // 0–0.5
    fatigue_decay_per_sec: 0.04,     // 0–0.2
    exit_sensitivity: 1.4,           // 0–3
    ctr_base: 0.012,                 // 0–0.05 (fraction)
    ctr_fatigue_penalty: 1.4,        // 0–3

    // E) Display
    show_trails: true,
    show_ad_flashes: true,
    show_heat_strip: true,
  };

  const LIMITS = {
    max_active_sessions: 5000,
    opp_rate_per_sec: 1.0, // constant per user-second
  };

  function makeBidderBaseCpms(n, mean, sigma, rng) {
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = U.sampleLogNormalWithMean(mean, sigma, rng);
    }
    return out;
  }

  function computeCTR(params, fatigue) {
    const base = U.clamp(params.ctr_base, 0, 0.10);
    const pen = Math.max(0, params.ctr_fatigue_penalty);
    const ctr = base * Math.exp(-pen * Math.max(0, fatigue));
    return U.clamp(ctr, 0, 1);
  }

  function computeQuality(params, fatigue) {
    // quality in [0..1] based on CTR ratio
    const base = Math.max(1e-9, U.clamp(params.ctr_base, 0, 0.10));
    const ctr = computeCTR(params, fatigue);
    return U.clamp(ctr / base, 0, 1);
  }

  function showProb(params, fatigue, tolerance) {
    const base = U.clamp(params.target_ad_rate / LIMITS.opp_rate_per_sec, 0, 1);
    if (params.policy === 'fixed') return base;
    // adaptive: downweight when fatigue > tolerance
    const k = 6.0;
    const adj = U.sigmoid(-k * (fatigue - tolerance));
    return U.clamp(base * adj, 0, 1);
  }

  class CPMSampleRing {
    constructor(size) {
      this.size = size;
      this.t = new Float64Array(size);
      this.v = new Float64Array(size);
      this.index = 0;
      this.count = 0;
    }
    reset() {
      this.index = 0;
      this.count = 0;
    }
    push(timeSec, cpm) {
      this.t[this.index] = timeSec;
      this.v[this.index] = cpm;
      this.index = (this.index + 1) % this.size;
      this.count = Math.min(this.size, this.count + 1);
    }
    valuesSince(minTimeSec, outArr) {
      outArr.length = 0;
      const n = this.count;
      const start = (this.index - n + this.size) % this.size;
      for (let i = 0; i < n; i++) {
        const idx = (start + i) % this.size;
        if (this.t[idx] >= minTimeSec) outArr.push(this.v[idx]);
      }
      return outArr;
    }
  }

  function quantileSorted(sorted, q) {
    const n = sorted.length;
    if (n <= 0) return NaN;
    if (n === 1) return sorted[0];
    const p = U.clamp(q, 0, 1) * (n - 1);
    const i = Math.floor(p);
    const f = p - i;
    const a = sorted[i];
    const b = sorted[Math.min(n - 1, i + 1)];
    return a + (b - a) * f;
  }

  class Sim {
    constructor(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);

      this.params = { ...DEFAULT_PARAMS };

      // bidders are derived from seed+params
      this.biddersBase = makeBidderBaseCpms(this.params.bidders_count, this.params.bid_cpm_mean, this.params.bid_cpm_sigma, this.rng);

      this.time = 0;
      this._nextId = 1;

      this.sessions = []; // active only
      this.flashes = [];  // {x,y,t0,ttl}
      this.ghosts = [];   // ended sessions fading out
      this.oppMarks = []; // opportunity marks (short-lived)
      this.banners = [];  // banner impressions (short-lived)

      // per-second accumulators
      this._sec = this._newSecondAcc();
      this._secAcc = 0;

      // rolling series 120s
      this.ts = {
        active_users: new U.RingSeries(120),
        opportunities: new U.RingSeries(120),
        impressions: new U.RingSeries(120),
        blocked_policy: new U.RingSeries(120),
        blocked_floor: new U.RingSeries(120),
        blocked_freqcap: new U.RingSeries(120),
        blocked_mingap: new U.RingSeries(120),
        spend: new U.RingSeries(120),
        platform_rev: new U.RingSeries(120),
        publisher_rev: new U.RingSeries(120),
        avg_cpm: new U.RingSeries(120),
        avg_ctr: new U.RingSeries(120),
        avg_fatigue: new U.RingSeries(120),
        exits: new U.RingSeries(120),
        natural_ends: new U.RingSeries(120),
        early_exits: new U.RingSeries(120),
        ended_dur_sum: new U.RingSeries(120),
        ended_dur_count: new U.RingSeries(120),
        created: new U.RingSeries(120),
        user_seconds: new U.RingSeries(120),
        pressure: new U.RingSeries(120), // impressions per user-sec (per second)
      };

      this.pressure60 = new U.RingSeries(60); // for the heat strip

      // Deterministic CPM quantiles for coloring (computed from a deterministic sample).
      this._imprSeq = 0;
      this._cpmSample = new CPMSampleRing(4096);
      this._tmpCpm = [];
      this.cpmP25 = this.params.floor_cpm + 0.25 * this.params.bid_cpm_mean;
      this.cpmP75 = this.params.floor_cpm + 0.75 * this.params.bid_cpm_mean;
      this.stats = {
        cpmP25: this.cpmP25,
        cpmP75: this.cpmP75,
        cpmMean: this.params.bid_cpm_mean,
      };

      this.capReached = false;
      this.onSecond = null; // callback({derived, ts})
    }

    setSeed(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);
      this._rebuildBidders();
    }

    reset() {
      // deterministic reset for a given seed + params
      this.rng = new U.RNG(this.seed);
      this._rebuildBidders();

      this.time = 0;
      this._nextId = 1;
      this.sessions.length = 0;
      this.flashes.length = 0;
      this.ghosts.length = 0;
      this.oppMarks.length = 0;
      this.banners.length = 0;
      this.capReached = false;

      this._imprSeq = 0;
      this._cpmSample.reset();
      this._tmpCpm.length = 0;
      this.cpmP25 = this.params.floor_cpm + 0.25 * this.params.bid_cpm_mean;
      this.cpmP75 = this.params.floor_cpm + 0.75 * this.params.bid_cpm_mean;
      this.stats.cpmP25 = this.cpmP25;
      this.stats.cpmP75 = this.cpmP75;
      this.stats.cpmMean = this.params.bid_cpm_mean;

      this._sec = this._newSecondAcc();
      this._secAcc = 0;

      // reset series
      for (const k of Object.keys(this.ts)) this.ts[k] = new U.RingSeries(120);
      this.pressure60 = new U.RingSeries(60);
      this._flushSecond(); // seed charts/metrics with zeros
    }

    setParams(patch) {
      if (!patch) return;
      const prev = this.params;
      this.params = { ...this.params, ...patch };

      // Clamp key ranges for stability
      this.params.users_per_sec = U.clamp(this.params.users_per_sec, 0.5, 20);
      this.params.mean_session_length = U.clamp(this.params.mean_session_length, 10, 120);
      this.params.tolerance_mean = U.clamp(this.params.tolerance_mean, 0.2, 0.9);
      this.params.tolerance_spread = U.clamp(this.params.tolerance_spread, 0, 0.4);

      this.params.target_ad_rate = U.clamp(this.params.target_ad_rate, 0, 0.5);
      this.params.freq_cap = U.clamp(Math.round(this.params.freq_cap), 0, 20);
      this.params.min_gap_sec = U.clamp(this.params.min_gap_sec, 0, 30);

      this.params.bidders_count = U.clamp(Math.round(this.params.bidders_count), 2, 20);
      this.params.bid_cpm_mean = U.clamp(this.params.bid_cpm_mean, 0.5, 20);
      this.params.bid_cpm_sigma = U.clamp(this.params.bid_cpm_sigma, 0, 2.0);
      this.params.floor_cpm = U.clamp(this.params.floor_cpm, 0, 10);
      this.params.take_rate = U.clamp(this.params.take_rate, 0, 0.4);

      this.params.fatigue_per_impression = U.clamp(this.params.fatigue_per_impression, 0, 0.5);
      this.params.fatigue_decay_per_sec = U.clamp(this.params.fatigue_decay_per_sec, 0, 0.2);
      this.params.exit_sensitivity = U.clamp(this.params.exit_sensitivity, 0, 3);
      this.params.ctr_base = U.clamp(this.params.ctr_base, 0, 0.05);
      this.params.ctr_fatigue_penalty = U.clamp(this.params.ctr_fatigue_penalty, 0, 3);

      // If auction bidder params changed, rebuild (deterministically for current seed)
      const bidderChanged =
        prev.bidders_count !== this.params.bidders_count ||
        prev.bid_cpm_mean !== this.params.bid_cpm_mean ||
        prev.bid_cpm_sigma !== this.params.bid_cpm_sigma;
      if (bidderChanged) this._rebuildBidders();

      // keep stats updated for rendering fallbacks
      if (this.stats) this.stats.cpmMean = this.params.bid_cpm_mean;
    }

    _rebuildBidders() {
      // Keep reproducible: use a seed-derived sub-RNG so bidder bases are stable even if sim state advances.
      const subSeed = (this.seed ^ 0x9E3779B9) >>> 0;
      const rr = new U.RNG(subSeed);
      this.biddersBase = makeBidderBaseCpms(this.params.bidders_count, this.params.bid_cpm_mean, this.params.bid_cpm_sigma, rr);
    }

    _newSecondAcc() {
      return {
        ticks: 0,
        active_sum: 0,
        fatigue_sum: 0,
        user_seconds: 0,

        created: 0,
        exits: 0,
        natural_ends: 0,
        early_exits: 0,
        ended_dur_sum: 0,
        ended_dur_count: 0,

        opportunities: 0,
        impressions: 0,
        blocked_policy: 0,
        blocked_floor: 0,
        blocked_freqcap: 0,
        blocked_mingap: 0,
        spend: 0,
        platform_rev: 0,
        publisher_rev: 0,

        cpm_sum: 0,
        ctr_sum: 0,
      };
    }

    tick(dt) {
      dt = Math.max(1e-3, Math.min(0.2, dt));
      this.time += dt;

      // Arrivals
      this._spawnArrivals(dt);

      // Update sessions in-place (filter by write-index)
      const p = this.params;
      let w = 0;
      let fatigueSum = 0;
      for (let i = 0; i < this.sessions.length; i++) {
        const s = this.sessions[i];

        // store prev values for render interpolation
        s.t_alive_prev = s.t_alive;
        s.fatigue_prev = s.fatigue;
        s.ads_shown_prev = s.ads_shown;

        // advance
        s.t_alive += dt;
        // fatigue decay
        s.fatigue = Math.max(0, s.fatigue - p.fatigue_decay_per_sec * dt);

        // exits (early) + natural ends
        let endedType = null; // 'natural' | 'early'

        // natural
        if (s.t_alive >= s.t_target) {
          endedType = 'natural';
        } else {
          // early exit hazard (skip first 1s)
          if (s.t_alive > 1) {
            const baseHaz = 1 / Math.max(1e-6, s.t_target);
            const over = Math.max(0, s.fatigue - s.tolerance);
            const fatFactor = Math.exp(p.exit_sensitivity * over);
            const haz = baseHaz * fatFactor;
            const pExit = 1 - Math.exp(-Math.min(10, haz) * dt);
            if (this.rng.float() < pExit) endedType = 'early';
          }
        }

        if (!endedType) {
          // opportunities (Poisson per user)
          const kOpp = U.samplePoisson(LIMITS.opp_rate_per_sec * dt, this.rng);
          if (kOpp > 0) {
            for (let k = 0; k < kOpp; k++) {
              this._sec.opportunities += 1;
              this._handleOpportunity(s);
            }
          }

          // trails
          if (p.show_trails) {
            if (!s.trail) s.trail = [];
            const xNow = s.t_alive / Math.max(1e-6, s.t_target);
            s.trail.push({ t: this.time, prog: xNow });
            if (s.trail.length > 12) s.trail.shift();
          } else {
            s.trail = null;
          }

          fatigueSum += s.fatigue;
          this.sessions[w++] = s;
        } else {
          this._sec.exits += 1;
          if (endedType === 'natural') this._sec.natural_ends += 1;
          else this._sec.early_exits += 1;

          const dur = Math.max(0, s.t_alive);
          this._sec.ended_dur_sum += dur;
          this._sec.ended_dur_count += 1;

          // fade-out ghost at the exit point
          this.ghosts.push({
            t0: this.time,
            ttl: 0.65,
            prog: U.clamp(s.t_alive / Math.max(1e-6, s.t_target), 0, 1),
            y01: s.y01,
            jitter: s.jitter,
            fatigue: s.fatigue,
          });
        }
      }
      this.sessions.length = w;

      // expire flashes
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        const f = this.flashes[i];
        if (this.time - f.t0 > f.ttl) this.flashes.splice(i, 1);
      }
      // expire ghosts
      for (let i = this.ghosts.length - 1; i >= 0; i--) {
        const g = this.ghosts[i];
        if (this.time - g.t0 > g.ttl) this.ghosts.splice(i, 1);
      }
      // expire opportunity marks
      for (let i = this.oppMarks.length - 1; i >= 0; i--) {
        const m = this.oppMarks[i];
        if (this.time - m.t0 > m.ttl) this.oppMarks.splice(i, 1);
      }
      // expire banner impressions
      for (let i = this.banners.length - 1; i >= 0; i--) {
        const b = this.banners[i];
        if (this.time - b.t0 > b.ttl) this.banners.splice(i, 1);
      }

      // per-second aggregates
      const active = this.sessions.length;
      this._sec.ticks += 1;
      this._sec.active_sum += active;
      this._sec.fatigue_sum += fatigueSum;
      this._sec.user_seconds += active * dt;

      // flush each second
      this._secAcc += dt;
      if (this._secAcc >= 1.0) {
        this._secAcc %= 1.0;
        this._flushSecond();
      }
    }

    _spawnArrivals(dt) {
      const p = this.params;
      if (this.sessions.length >= LIMITS.max_active_sessions) {
        this.capReached = true;
        return;
      }
      this.capReached = false;

      const lambda = p.users_per_sec * dt;
      const k = U.samplePoisson(lambda, this.rng);
      if (k <= 0) return;

      const canCreate = Math.max(0, LIMITS.max_active_sessions - this.sessions.length);
      const n = Math.min(k, canCreate);
      for (let i = 0; i < n; i++) {
        const tTargetRaw = U.sampleExponential(p.mean_session_length, this.rng);
        const tTarget = U.clamp(6 + tTargetRaw, 8, p.mean_session_length * 6);
        const tol = U.sampleTruncNormal(p.tolerance_mean, p.tolerance_spread, 0, 1, this.rng);

        this.sessions.push({
          id: this._nextId++,
          lane: this.rng.int(0, 999999),
          y01: this.rng.float(), // stable [0..1] for mapping to lanes
          jitter: (this.rng.float() - 0.5),

          t_alive: 0,
          t_alive_prev: 0,
          t_target: tTarget,

          fatigue: 0,
          fatigue_prev: 0,
          tolerance: tol,

          ads_shown: 0,
          ads_shown_prev: 0,
          last_ad_t: -1e9,

          trail: null,
          last_imp_time: -1e9,
        });
        this._sec.created += 1;
      }
    }

    _handleOpportunity(s) {
      const p = this.params;

      // Opportunity visualization (only when ad flashes are enabled, per UX requirement)
      if (p.show_ad_flashes) {
        this.oppMarks.push({
          t0: this.time,
          ttl: 0.9,
          prog: U.clamp(s.t_alive / Math.max(1e-6, s.t_target), 0, 1),
          y01: s.y01,
          jitter: s.jitter,
        });
        if (this.oppMarks.length > 20000) this.oppMarks.splice(0, this.oppMarks.length - 20000);
      }

      // constraints
      if (s.ads_shown >= p.freq_cap) { this._sec.blocked_freqcap += 1; return; }
      if ((s.t_alive - s.last_ad_t) < p.min_gap_sec) { this._sec.blocked_mingap += 1; return; }

      const prob = showProb(p, s.fatigue, s.tolerance);
      if (this.rng.float() >= prob) { this._sec.blocked_policy += 1; return; }

      // run auction and deliver if clears floor
      const quality = computeQuality(p, s.fatigue);
      const { cleared, price_cpm } = this._runAuction(quality);
      if (!cleared) { this._sec.blocked_floor += 1; return; }

      // impression delivered
      this._sec.impressions += 1;
      s.ads_shown += 1;
      s.last_ad_t = s.t_alive;

      // fatigue bump
      s.fatigue += p.fatigue_per_impression;

      // economics (1 impression)
      const spend = price_cpm / 1000;
      const plat = spend * p.take_rate;
      const pub = spend - plat;
      this._sec.spend += spend;
      this._sec.platform_rev += plat;
      this._sec.publisher_rev += pub;

      // metrics components
      this._sec.cpm_sum += price_cpm;
      const ctr = computeCTR(p, s.fatigue); // after bump (slightly worse)
      this._sec.ctr_sum += ctr;

      // Banner impression visual (short-lived)
      this._imprSeq += 1;
      const h = (Math.imul(this._imprSeq, 2654435761) + (this.seed >>> 0)) >>> 0;
      if ((h & 15) === 0) this._cpmSample.push(this.time, price_cpm); // 1/16 deterministic sampling

      const showLabel = ((this._imprSeq + (this.seed >>> 0)) % 10) === 0;
      this.banners.push({
        t0: this.time,
        ttl: 1.05,
        prog: U.clamp(s.t_alive / Math.max(1e-6, s.t_target), 0, 1),
        y01: s.y01,
        jitter: s.jitter,
        cpm: price_cpm,
        label: showLabel ? `$${price_cpm.toFixed(2)}` : null,
      });
      if (this.banners.length > 20000) this.banners.splice(0, this.banners.length - 20000);

      // render flash
      if (p.show_ad_flashes) {
        this.flashes.push({
          sessionId: s.id,
          t0: this.time,
          ttl: 0.6,
        });
      }
    }

    _runAuction(quality) {
      const p = this.params;
      const floor = p.floor_cpm;
      const bids = this.biddersBase;
      let best = -Infinity, second = -Infinity;
      for (let i = 0; i < bids.length; i++) {
        const b = bids[i] * quality;
        if (b > best) { second = best; best = b; }
        else if (b > second) { second = b; }
      }
      if (!(best >= floor)) {
        return { cleared: false, price_cpm: 0 };
      }
      let price;
      if (bids.length >= 2 && Number.isFinite(second) && second > -Infinity) {
        price = Math.max(floor, second);
      } else {
        // one-bidder: pay floor (simplified reserve pricing)
        price = Math.max(floor, floor);
      }
      // safety: don't exceed winner bid too much (can happen if numeric weirdness)
      price = Math.min(price, best);
      return { cleared: true, price_cpm: price };
    }

    _flushSecond() {
      const a = this._sec;
      const ticks = Math.max(1, a.ticks);
      const activeAvg = a.active_sum / ticks;
      const fatAvg = (a.active_sum > 0) ? (a.fatigue_sum / Math.max(1, a.active_sum)) : 0;
      const ctrAvg = (a.impressions > 0) ? (a.ctr_sum / a.impressions) : 0;
      const cpmAvg = (a.impressions > 0) ? (a.cpm_sum / a.impressions) : 0;

      // pressure for the second: impressions per user-sec
      const pressure = (a.user_seconds > 1e-6) ? (a.impressions / a.user_seconds) : 0;

      this.ts.active_users.push(activeAvg);
      this.ts.opportunities.push(a.opportunities);
      this.ts.impressions.push(a.impressions);
      this.ts.blocked_policy.push(a.blocked_policy);
      this.ts.blocked_floor.push(a.blocked_floor);
      this.ts.blocked_freqcap.push(a.blocked_freqcap);
      this.ts.blocked_mingap.push(a.blocked_mingap);
      this.ts.spend.push(a.spend);
      this.ts.platform_rev.push(a.platform_rev);
      this.ts.publisher_rev.push(a.publisher_rev);
      this.ts.avg_cpm.push(cpmAvg);
      this.ts.avg_ctr.push(ctrAvg);
      this.ts.avg_fatigue.push(fatAvg);
      this.ts.exits.push(a.exits);
      this.ts.natural_ends.push(a.natural_ends);
      this.ts.early_exits.push(a.early_exits);
      this.ts.ended_dur_sum.push(a.ended_dur_sum);
      this.ts.ended_dur_count.push(a.ended_dur_count);
      this.ts.created.push(a.created);
      this.ts.user_seconds.push(a.user_seconds);
      this.ts.pressure.push(pressure);
      this.pressure60.push(pressure);

      // Update CPM quantiles once per second from a deterministic sample of last 60s.
      const nowT = this.time;
      const sample = this._cpmSample.valuesSince(nowT - 60, this._tmpCpm);
      if (sample.length >= 16) {
        sample.sort((x, y) => x - y);
        const p25 = quantileSorted(sample, 0.25);
        const p75 = quantileSorted(sample, 0.75);
        if (Number.isFinite(p25) && Number.isFinite(p75) && p25 <= p75) {
          this.cpmP25 = p25;
          this.cpmP75 = p75;
          if (this.stats) {
            this.stats.cpmP25 = p25;
            this.stats.cpmP75 = p75;
          }
        }
      }

      const derived = this.getDerived();

      // reset second accumulators
      this._sec = this._newSecondAcc();

      if (typeof this.onSecond === 'function') {
        try { this.onSecond({ derived, ts: this.ts }); } catch (_) { /* ignore */ }
      }
    }

    getDerived() {
      // rolling 60s values from the 1s time-series
      const impr60 = this.ts.impressions.sumLast(60);
      const opp60 = this.ts.opportunities.sumLast(60);
      const blockedPolicy60 = this.ts.blocked_policy.sumLast(60);
      const blockedFloor60 = this.ts.blocked_floor.sumLast(60);
      const blockedFreqCap60 = this.ts.blocked_freqcap.sumLast(60);
      const blockedMinGap60 = this.ts.blocked_mingap.sumLast(60);
      const spend60 = this.ts.spend.sumLast(60);
      const plat60 = this.ts.platform_rev.sumLast(60);
      const pub60 = this.ts.publisher_rev.sumLast(60);
      const exits60 = this.ts.exits.sumLast(60);
      const natural60 = this.ts.natural_ends.sumLast(60);
      const early60 = this.ts.early_exits.sumLast(60);
      const durSum60 = this.ts.ended_dur_sum.sumLast(60);
      const durCount60 = this.ts.ended_dur_count.sumLast(60);
      const created60 = this.ts.created.sumLast(60);
      const userSec60 = this.ts.user_seconds.sumLast(60);

      const fill = (opp60 > 0) ? (impr60 / opp60) : 0;
      const adRate = (userSec60 > 1e-6) ? (impr60 * 60 / userSec60) : 0; // impr per user-minute
      const cpm = (impr60 > 0) ? (spend60 / impr60) * 1000 : 0;
      const unfilled60 = Math.max(0, opp60 - impr60);
      const caps60 = blockedFreqCap60 + blockedMinGap60;

      const noImprPolicyPct = unfilled60 > 0 ? (blockedPolicy60 / unfilled60) : 0;
      const noImprFloorPct = unfilled60 > 0 ? (blockedFloor60 / unfilled60) : 0;
      const noImprCapsPct = unfilled60 > 0 ? (caps60 / unfilled60) : 0;

      // Weighted averages (avoid bias from low-impression/low-active seconds)
      const wAvgCTR = (() => {
        const impr = this.ts.impressions.toArray();
        const ctr = this.ts.avg_ctr.toArray();
        const n = Math.min(60, impr.length, ctr.length);
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
          const ii = impr[impr.length - 1 - i];
          const cc = ctr[ctr.length - 1 - i];
          if (ii > 0 && Number.isFinite(cc)) { num += cc * ii; den += ii; }
        }
        return den > 0 ? (num / den) : 0;
      })();

      const wAvgFatigue = (() => {
        const a = this.ts.active_users.toArray();
        const f = this.ts.avg_fatigue.toArray();
        const n = Math.min(60, a.length, f.length);
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
          const aa = a[a.length - 1 - i];
          const ff = f[f.length - 1 - i];
          if (aa > 0 && Number.isFinite(ff)) { num += ff * aa; den += aa; }
        }
        return den > 0 ? (num / den) : 0;
      })();

      return {
        time: this.time,
        activeUsers: this.sessions.length,
        capReached: this.capReached,

        imprPerMin: impr60,
        adRatePerUserMin: adRate,
        fillRate: fill,
        unfilledOpp60: unfilled60,
        noImprPolicyPct,
        noImprFloorPct,
        noImprCapsPct,

        avgCPM: cpm,
        spendPerMin: spend60,
        platformRevPerMin: plat60,
        publisherRevPerMin: pub60,

        avgCTR: wAvgCTR,
        avgFatigue: wAvgFatigue,
        endsPerMin: exits60,
        naturalEndsPerMin: natural60,
        earlyExitsPerMin: early60,
        earlyExitShare: exits60 > 0 ? (early60 / exits60) : 0,
        avgSessionTimeSec: durCount60 > 0 ? (durSum60 / durCount60) : 0,
        exitShare: created60 > 0 ? (early60 / created60) : 0,
      };
    }
  }

  function createSim(seed) {
    return new Sim(seed || 42);
  }

  window.Sim = { createSim, DEFAULT_PARAMS, LIMITS };
})();

