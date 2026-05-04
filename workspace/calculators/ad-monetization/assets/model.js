// Simple seeded PRNG (LCG)
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  nextGaussian() {
    // Box-Muller transform approximation using uniform sum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += this.next();
    }
    return sum - 6;
  }
}

// Seasonality multipliers
const CPM_SEASON = [0.95, 0.92, 0.98, 1.00, 1.02, 1.03, 1.00, 0.99, 1.01, 1.04, 1.08, 1.20];
const ENGAGEMENT_SEASON = [1.02, 1.01, 1.00, 0.99, 0.98, 0.97, 0.96, 0.96, 0.98, 1.00, 1.02, 1.05];

// Map week (0-51) to month (0-11)
function weekToMonth(week) {
  return Math.floor((week * 12) / 52);
}

function simulate(params, noiseData = null) {
  const rng = noiseData ? null : new SeededRandom(params.seed);
  const weeks = 52;
  
  // Initialize arrays
  const result = {
    week: [],
    dau: [],
    pv_user: [],
    ads_user_day: [],
    impressions_possible: [],
    impressions: [],
    cpm: [],
    fill: [],
    revenue_gross: [],
    revenue_net: [],
    rpm: [],
    minutes_user_proxy: []
  };
  
  // Initialize noise storage
  if (!noiseData) {
    result.noiseData = { demand: [], cpm: [] };
  } else {
    result.noiseData = noiseData;
  }

  // Initial values
  let dau = params.dau0;
  let cumulative_net = 0;

  for (let w = 0; w < weeks; w++) {
    const month = weekToMonth(w);
    
    // DAU growth (logistic)
    dau = dau + params.growth_rate * dau * (1 - dau / params.carrying_capacity);
    
    // Demand index with noise
    let demand_noise, demand_t;
    if (noiseData && noiseData.demand && noiseData.demand[w] !== undefined) {
      demand_t = noiseData.demand[w];
    } else {
      demand_noise = params.demand_multiplier * (1 + params.demand_volatility * rng.nextGaussian());
      demand_t = Math.max(0.5, demand_noise);
      result.noiseData.demand.push(demand_t);
    }
    
    // PV per user (with engagement seasonality and pressure penalty)
    // First compute base PV before ads pressure
    const pv_user_base = params.pv_per_user * ENGAGEMENT_SEASON[month];
    // We'll compute ads_user_day first to use in PV calculation
    // But PV affects ads, so we need iterative approach or use previous week
    let ads_user_week_raw;
    let pv_user;
    let ads_user_day;
    
    if (w === 0) {
      // Week 0: initial state
      ads_user_week_raw = pv_user_base * params.slots_per_pv;
      ads_user_day = Math.min(params.cap_ads_day, ads_user_week_raw / 7);
      pv_user = Math.max(5, pv_user_base * Math.exp(-params.alpha_engagement * ads_user_day));
    } else {
      // Use previous week's PV for ads calculation, then update PV
      ads_user_week_raw = result.pv_user[w - 1] * params.slots_per_pv;
      ads_user_day = Math.min(params.cap_ads_day, ads_user_week_raw / 7);
      pv_user = Math.max(5, pv_user_base * Math.exp(-params.alpha_engagement * ads_user_day));
    }
    
    // CPM (with seasonality, demand, overload penalty, noise)
    const overload = Math.max(0, ads_user_day - params.saturation_sweetspot);
    const cpm_base = params.cpm0 * CPM_SEASON[month] * demand_t;
    let cpm_noise;
    if (noiseData && noiseData.cpm && noiseData.cpm[w] !== undefined) {
      cpm_noise = noiseData.cpm[w];
    } else {
      cpm_noise = 1 + params.cpm_volatility * rng.nextGaussian();
      result.noiseData.cpm.push(cpm_noise);
    }
    let cpm = cpm_base * (1 - params.beta_cpm * overload) * cpm_noise;
    cpm = Math.max(10, cpm);
    
    // Fill rate (with demand and overload penalty)
    let fill = params.fill_rate_base * demand_t * (1 - params.gamma_fill * overload);
    fill = Math.max(0, Math.min(1, fill));
    
    // Impressions
    const impressions_possible_week = dau * pv_user * params.slots_per_pv;
    const impressions_week = impressions_possible_week * params.viewability * fill;
    
    // Revenue
    const revenue_gross_week = (impressions_week / 1000) * cpm;
    const revenue_net_week = revenue_gross_week * (1 - params.commission);
    
    // RPM
    const rpm_val = (revenue_net_week / (dau * pv_user)) * 1000;
    
    // Minutes proxy
    const minutes_user = 22 * pv_user / 70;
    
    // Store results
    result.week.push(w + 1);
    result.dau.push(dau);
    result.pv_user.push(pv_user);
    result.ads_user_day.push(ads_user_day);
    result.impressions_possible.push(impressions_possible_week);
    result.impressions.push(impressions_week);
    result.cpm.push(cpm);
    result.fill.push(fill);
    result.revenue_gross.push(revenue_gross_week);
    result.revenue_net.push(revenue_net_week);
    result.rpm.push(rpm_val);
    result.minutes_user_proxy.push(minutes_user);
    
    cumulative_net += revenue_net_week;
  }
  
  // Compute summary stats
  result.summary = {
    total_net_revenue: result.revenue_net.reduce((a, b) => a + b, 0),
    avg_cpm: result.cpm.reduce((a, b) => a + b, 0) / result.cpm.length,
    avg_fill: result.fill.reduce((a, b) => a + b, 0) / result.fill.length,
    avg_pv_user: result.pv_user.reduce((a, b) => a + b, 0) / result.pv_user.length,
    avg_ads_user_day: result.ads_user_day.reduce((a, b) => a + b, 0) / result.ads_user_day.length,
    end_dau: result.dau[result.dau.length - 1],
    avg_rpm: result.rpm.reduce((a, b) => a + b, 0) / result.rpm.length,
    best_week_revenue: Math.max(...result.revenue_net),
    worst_week_revenue: Math.min(...result.revenue_net),
    week1_net: result.revenue_net[0],
    week52_net: result.revenue_net[result.revenue_net.length - 1],
    change_vs_week1: ((result.revenue_net[result.revenue_net.length - 1] / result.revenue_net[0]) - 1) * 100
  };
  
  return result;
}
