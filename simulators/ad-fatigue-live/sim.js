/* sim.js — core simulation: Ad Fatigue & Channel Saturation (Live)
   Model summary:
   - Users arrive via Poisson(users_per_sec)
   - Each user has a session with mean length
   - Opportunities occur at constant rate per user-second
   - Policy (fixed/adaptive) decides show probability
   - Fatigue accumulates on impressions, decays over time
   - Fatigue reduces CTR and increases early exit
   - Revenue = impressions * eCPM, but saturation occurs when fatigue → CTR collapse
*/

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before sim.js');

  const DEFAULT_PARAMS = {
    // A) Traffic & Sessions
    users_per_sec: 4.0,              // 1..30
    mean_session_length_sec: 45,     // 10..180
    base_ctr: 0.012,                 // 0.002..0.05 (fraction)
    base_opportunities_per_sec: 0.15, // 0.05..1.0

    // B) Ad Policy
    policy_mode: 'fixed',            // fixed | adaptive
    target_ads_per_session: 6,      // 0..10 (for fixed)
    min_gap_sec: 8,                  // 0..30
    cap_ads_per_session: 12,        // 0..20

    // C) Fatigue & UX
    fatigue_per_impression: 0.12,   // 0..0.5
    fatigue_decay_per_sec: 0.035,   // 0..0.2
    exit_sensitivity: 1.6,           // 0..5
    ctr_fatigue_penalty: 1.5,       // 0..5

    // D) Monetization
    ecpm_base: 6.0,                  // 0.5..20 $
    ecpm_noise: 0.15,                // 0..0.5
  };

  class Sim {
    constructor(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);
      this.params = { ...DEFAULT_PARAMS };
      this.time = 0;
      this._nextId = 1;

      // State
      this.fatigue = 0; // aggregate fatigue [0..1]
      this.users_active = 0; // approximate active users
      this.impressions_total = 0;
      this.revenue_total = 0;
      this.clicks_total = 0;
      this.early_exits_total = 0;
      this.sessions_completed = 0;

      // Per-second accumulators
      this._sec = {
        impressions: 0,
        revenue: 0,
        clicks: 0,
        early_exits: 0,
        sessions_ended: 0,
      };
      this._secAcc = 0;

      // Time series (rolling windows)
      this.ts = {
        revenue_per_min: new U.RingSeries(120),
        impressions_per_min: new U.RingSeries(120),
        fatigue: new U.RingSeries(120),
        ctr: new U.RingSeries(120),
        early_exit_rate: new U.RingSeries(120),
        ad_pressure: new U.RingSeries(120),
        users_active: new U.RingSeries(120),
      };

      // Callback
      this.onSecond = null;
    }

    setParams(patch) {
      for (const k of Object.keys(patch)) {
        if (k in this.params) {
          this.params[k] = patch[k];
        }
      }
    }

    reset() {
      this.time = 0;
      this._nextId = 1;
      this.fatigue = 0;
      this.users_active = 0;
      this.impressions_total = 0;
      this.revenue_total = 0;
      this.clicks_total = 0;
      this.early_exits_total = 0;
      this.sessions_completed = 0;
      this._sec = {
        impressions: 0,
        revenue: 0,
        clicks: 0,
        early_exits: 0,
        sessions_ended: 0,
      };
      this._secAcc = 0;
      for (const k of Object.keys(this.ts)) {
        this.ts[k] = new U.RingSeries(120);
      }
    }

    setSeed(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);
    }

    tick(dt) {
      this.time += dt;
      this._secAcc += dt;

      const p = this.params;

      // 1. Update active users (approximate via effective session length)
      const early_exit_rate = this._computeEarlyExitRate();
      const effective_session_length = p.mean_session_length_sec * (1 - 0.6 * early_exit_rate);
      this.users_active = p.users_per_sec * effective_session_length;

      // 2. Opportunities
      const opp_per_sec = this.users_active * p.base_opportunities_per_sec;
      const opp = opp_per_sec * dt;

      // 3. Policy decision: show probability
      const show_prob = this._computeShowProbability();
      const ads_allowed = Math.min(opp, this.users_active * p.cap_ads_per_session / effective_session_length * dt);
      const impressions_raw = ads_allowed * show_prob;

      // 4. Realize impressions (with noise)
      const impressions = Math.floor(impressions_raw + this.rng.float() * (impressions_raw % 1));

      // 5. Update fatigue
      if (this.users_active > 0) {
        const fatigue_delta = p.fatigue_per_impression * (impressions / Math.max(this.users_active, 1));
        this.fatigue += fatigue_delta * dt;
        this.fatigue -= p.fatigue_decay_per_sec * this.fatigue * dt;
        this.fatigue = U.clamp(this.fatigue, 0, 1);
      }

      // 6. Compute CTR (affected by fatigue)
      const ctr = this._computeCTR();

      // 7. Clicks (Bernoulli)
      const clicks = impressions * ctr;
      const clicks_realized = this.rng.bool(clicks / Math.max(impressions, 1)) ? Math.floor(clicks) : Math.floor(clicks);

      // 8. Revenue (eCPM with noise)
      const ecpm = p.ecpm_base * (1 + (this.rng.float() - 0.5) * 2 * p.ecpm_noise);
      const revenue = (impressions / 1000) * ecpm;

      // 9. Early exits (approximate: probability-based, not count-based)
      // early_exit_rate is already a probability [0..1], so we apply it to sessions ending
      const sessions_ending = p.users_per_sec * dt;
      const early_exits = sessions_ending * early_exit_rate;

      // 10. Update totals
      this.impressions_total += impressions;
      this.revenue_total += revenue;
      this.clicks_total += clicks_realized;
      this.early_exits_total += early_exits;
      this.sessions_completed += sessions_ending;

      // 11. Per-second accumulators
      this._sec.impressions += impressions;
      this._sec.revenue += revenue;
      this._sec.clicks += clicks_realized;
      this._sec.early_exits += early_exits;
      this._sec.sessions_ended += sessions_ending;

      // 12. Flush every second
      if (this._secAcc >= 1.0) {
        this._flushSecond();
      }
    }

    _computeCTR() {
      const p = this.params;
      const base = U.clamp(p.base_ctr, 0, 0.10);
      const penalty = Math.max(0, p.ctr_fatigue_penalty);
      const ctr = base * Math.exp(-penalty * this.fatigue);
      return U.clamp(ctr, 0, 1);
    }

    _computeEarlyExitRate() {
      const p = this.params;
      const threshold = 0.4; // fatigue threshold for early exit
      const rate = U.sigmoid(p.exit_sensitivity * (this.fatigue - threshold));
      return U.clamp(rate, 0, 1);
    }

    _computeShowProbability() {
      const p = this.params;
      if (p.policy_mode === 'fixed') {
        const target_rate = p.target_ads_per_session / p.mean_session_length_sec;
        return U.clamp(target_rate / p.base_opportunities_per_sec, 0, 1);
      } else {
        // adaptive: reduce when fatigue is high
        const tolerance = 0.5; // user tolerance threshold
        const k = 8.0;
        const adj = U.sigmoid(-k * (this.fatigue - tolerance));
        const base_rate = p.target_ads_per_session / p.mean_session_length_sec;
        return U.clamp((base_rate / p.base_opportunities_per_sec) * adj, 0, 1);
      }
    }

    _flushSecond() {
      const sec = Math.floor(this.time);

      // Push metrics
      this.ts.revenue_per_min.push(this._sec.revenue * 60);
      this.ts.impressions_per_min.push(this._sec.impressions * 60);
      this.ts.fatigue.push(this.fatigue);
      const ctr = this._sec.impressions > 0 ? this._sec.clicks / this._sec.impressions : 0;
      this.ts.ctr.push(U.clamp(ctr, 0, 1));
      // early_exit_rate is already a probability [0..1] from _computeEarlyExitRate()
      const early_exit_rate_sec = this._sec.sessions_ended > 0 ? Math.min(1, this._sec.early_exits / this._sec.sessions_ended) : 0;
      this.ts.early_exit_rate.push(U.clamp(early_exit_rate_sec, 0, 1));
      // Ad pressure: impressions per user per second (approximate)
      const ad_pressure = this.users_active > 0 && this.time > 0 ? this.impressions_total / this.users_active / this.time : 0;
      this.ts.ad_pressure.push(ad_pressure);
      this.ts.users_active.push(this.users_active);

      // Reset per-second accumulators
      this._sec = {
        impressions: 0,
        revenue: 0,
        clicks: 0,
        early_exits: 0,
        sessions_ended: 0,
      };
      this._secAcc = 0;

      // Callback
      if (typeof this.onSecond === 'function') {
        try {
          this.onSecond({ derived: this.getDerived(), ts: this.ts });
        } catch (e) {
          console.error('Error in onSecond:', e);
        }
      }
    }

    getDerived() {
      return {
        time: this.time,
        users_active: this.users_active,
        fatigue: this.fatigue,
        impressions_total: this.impressions_total,
        revenue_total: this.revenue_total,
        clicks_total: this.clicks_total,
        early_exits_total: this.early_exits_total,
        ad_pressure: this.users_active > 0 && this.time > 0 ? this.impressions_total / this.users_active / this.time : 0,
        ctr: this.impressions_total > 0 ? U.clamp(this.clicks_total / this.impressions_total, 0, 1) : 0,
        early_exit_rate: this.sessions_completed > 0 ? U.clamp(this.early_exits_total / this.sessions_completed, 0, 1) : 0,
      };
    }
  }

  window.Sim = { createSim: (seed) => new Sim(seed) };
})();
