/* sim.js
   Agent-based ride-hailing simulation:
   - Drivers move on 2D map, orders spawn (Poisson), matching uses spatial binning, surge per zone, cancellations by pickup ETA.
   Units:
   - Time: seconds
   - Distance: pixels
   - Speed: px/sec
*/

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before sim.js');

  // ---- Spatial index for idle drivers ----
  class SpatialGrid {
    constructor(width, height, cellSize) {
      this.cellSize = cellSize;
      this.resize(width, height);
    }
    resize(width, height) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.cols = Math.max(1, Math.ceil(this.width / this.cellSize));
      this.rows = Math.max(1, Math.ceil(this.height / this.cellSize));
      const n = this.cols * this.rows;
      this.buckets = new Array(n);
      for (let i = 0; i < n; i++) this.buckets[i] = [];
    }
    _idx(cx, cy) {
      return cy * this.cols + cx;
    }
    _cellOf(x, y) {
      const cx = U.clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
      const cy = U.clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
      return { cx, cy };
    }
    clear() {
      for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
    }
    buildFromDrivers(drivers) {
      this.clear();
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];
        if (d.state !== 'idle') continue;
        const { cx, cy } = this._cellOf(d.x, d.y);
        this.buckets[this._idx(cx, cy)].push(i);
      }
    }
    /** Collect candidate driver indices (into out array) by expanding rings of cells. */
    collectCandidates(x, y, k, maxRadiusCells, drivers, out) {
      out.length = 0;
      const { cx, cy } = this._cellOf(x, y);
      const maxR = Math.max(0, maxRadiusCells | 0);
      for (let r = 0; r <= maxR; r++) {
        // ring: cells at Chebyshev distance r
        const x0 = Math.max(0, cx - r);
        const x1 = Math.min(this.cols - 1, cx + r);
        const y0 = Math.max(0, cy - r);
        const y1 = Math.min(this.rows - 1, cy + r);
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (r > 0) {
              // only border of rectangle (ring)
              if (xx !== x0 && xx !== x1 && yy !== y0 && yy !== y1) continue;
            }
            const bucket = this.buckets[this._idx(xx, yy)];
            if (bucket.length === 0) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const di = bucket[bi];
              if (drivers[di].state !== 'idle') continue;
              out.push(di);
              if (out.length >= k) return;
            }
          }
        }
      }
    }
  }

  // ---- Core sim ----
  const DEFAULT_CONFIG = {
    demandRatePerMin: 90, // λ orders/min
    driversCount: 250, // N
    driverSpeed: 110, // px/sec
    matchInterval: 1.0, // sec

    surgeStrength: 1.2, // 0..3
    surgeCap: 2.0, // 0..3 (surge component; multiplier = 1 + surge)
    cancelSensitivity: 0.6, // 0..2
    eta0: 120, // sec
    takeRate: 0.22, // 0..0.4

    zonesPreset: '4x3', // dropdown
    demandPattern: 'center', // uniform | center | hotspots
    showZoneBorders: true,
    showDemandHeat: true,
    showSurgeHeat: false,

    matchingPolicy: 'eta', // eta | score
    kCandidates: 12, // 5..30

    // pricing constants (px-to-km scale is arbitrary but consistent)
    baseFare: 130, // ₽
    perKm: 25, // ₽/km
    pxPerKm: 45, // px per km (city scale)

    orderCap: 5000,
    maxEtaEstPerSecond: 600, // ETA cache updates for waiting orders (budget)
    etaCacheInterval: 1.0, // sec
    surgeUpdateInterval: 1.0, // sec
    metricsInterval: 1.0, // sec
    gcInterval: 2.0, // sec

    idleWanderSpeed: 12, // px/sec
    idleWanderTurnInterval: 2.8, // sec
    idleWanderJitter: 0.8, // rad
  };

  function parseZonesPreset(preset) {
    // "4x3" means cols x rows? UI says rows x cols, but preset options are "3x2,4x3,5x4".
    // We'll interpret as COLSxROWS for readability (wider cities), but keep consistent across code.
    const m = String(preset).match(/^(\d+)x(\d+)$/);
    if (!m) return { cols: 4, rows: 3 };
    const cols = U.clamp(parseInt(m[1], 10) || 4, 2, 10);
    const rows = U.clamp(parseInt(m[2], 10) || 3, 2, 10);
    return { cols, rows };
  }

  function zoneIdAt(x, y, world) {
    const cx = U.clamp(Math.floor(x / world.zoneW), 0, world.zoneCols - 1);
    const cy = U.clamp(Math.floor(y / world.zoneH), 0, world.zoneRows - 1);
    return cy * world.zoneCols + cx;
  }

  function zoneRect(zoneId, world) {
    const cx = zoneId % world.zoneCols;
    const cy = Math.floor(zoneId / world.zoneCols);
    const x0 = cx * world.zoneW;
    const y0 = cy * world.zoneH;
    return { x0, y0, x1: x0 + world.zoneW, y1: y0 + world.zoneH, cx, cy };
  }

  function buildDemandWeights(pattern, world, hotspots) {
    const z = world.zoneCount;
    const w = new Float64Array(z);
    if (pattern === 'uniform') {
      for (let i = 0; i < z; i++) w[i] = 1;
      return w;
    }
    if (pattern === 'center') {
      // center-heavy: zones near center get higher weights
      const cx0 = (world.zoneCols - 1) / 2;
      const cy0 = (world.zoneRows - 1) / 2;
      for (let i = 0; i < z; i++) {
        const cx = i % world.zoneCols;
        const cy = Math.floor(i / world.zoneCols);
        const dx = (cx - cx0) / Math.max(1, cx0);
        const dy = (cy - cy0) / Math.max(1, cy0);
        const d = Math.hypot(dx, dy);
        // 1 at center-ish, ~0.2 at corners
        w[i] = 0.2 + 0.9 * Math.exp(-2.2 * d * d);
      }
      return w;
    }
    // hotspots
    for (let i = 0; i < z; i++) w[i] = 0.5;
    if (hotspots && hotspots.length >= 2) {
      w[hotspots[0]] = 3.5;
      w[hotspots[1]] = 3.5;
    }
    return w;
  }

  function pickZoneByWeights(weights, rng) {
    // weights is Float64Array
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    if (!(total > 0)) return 0;
    let r = rng.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  function randomPointInRect(rect, rng) {
    return {
      x: rect.x0 + rng.float() * (rect.x1 - rect.x0),
      y: rect.y0 + rng.float() * (rect.y1 - rect.y0),
    };
  }

  function randomDestination(originX, originY, world, rng) {
    // Mild bias away from origin: sample direction and distance, then clamp into city.
    const angle = rng.float() * Math.PI * 2;
    const base = 0.35 * Math.min(world.width, world.height);
    const d = base * (0.25 + 0.75 * rng.float());
    const x = U.clamp(originX + Math.cos(angle) * d, 6, world.width - 6);
    const y = U.clamp(originY + Math.sin(angle) * d, 6, world.height - 6);
    return { x, y };
  }

  function makeDriver(id, world, rng) {
    const x = rng.float() * world.width;
    const y = rng.float() * world.height;
    const angle = rng.float() * Math.PI * 2;
    return {
      id,
      x, y,
      vx: 0, vy: 0,
      state: 'idle', // idle | to_pickup | to_dropoff
      targetX: x,
      targetY: y,
      assignedOrderId: -1,
      t_state: 0,
      earnings: 0,
      wanderAngle: angle,
      wanderUntil: 0,
    };
  }

  function makeOrder(id, x, y, destX, destY, createdAt, zoneId) {
    return {
      id,
      x, y,
      destX, destY,
      createdAt,
      state: 'waiting', // waiting | assigned | picked | done | canceled
      assignedDriverId: -1,
      assignedAt: -1,
      pickedAt: -1,
      doneAt: -1,
      canceledAt: -1,
      fare: 0,
      surgeMult: 1,
      zoneId,
      // cached ETA estimate for waiting cancellations
      etaEst: 999,
      etaEstUpdatedAt: -1,
    };
  }

  function computeBaseFare(order, cfg) {
    const tripDistPx = U.dist(order.x, order.y, order.destX, order.destY);
    const km = tripDistPx / Math.max(1e-6, cfg.pxPerKm);
    return cfg.baseFare + cfg.perKm * km;
  }

  class SimInstance {
    constructor(seed, config) {
      this.seed = (seed >>> 0) || 1;
      this.cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
      this.rng = new U.RNG(this.seed);
      this.time = 0;

      // World (size set by renderer via setWorldSize)
      this.world = {
        width: 900,
        height: 600,
        zoneRows: 3,
        zoneCols: 4,
        zoneW: 225,
        zoneH: 200,
        zoneCount: 12,
      };

      this._applyZonesPreset(this.cfg.zonesPreset);

      this.drivers = [];
      this.orders = [];
      this.flashes = [];
      this._nextDriverId = 1;
      this._nextOrderId = 1;

      // For "two hotspots" pattern
      this.hotspots = this._chooseHotspots();
      this.demandWeights = buildDemandWeights(this.cfg.demandPattern, this.world, this.hotspots);

      // Surge per zone (stored as surge component; multiplier = 1 + surge)
      this.surge = new Float64Array(this.world.zoneCount);
      this._surgeTarget = new Float64Array(this.world.zoneCount);
      this.zonePending = new Int32Array(this.world.zoneCount);
      this.zoneIdleSupply = new Int32Array(this.world.zoneCount);

      // Spatial index for idle drivers
      this._grid = new SpatialGrid(this.world.width, this.world.height, 60);
      this._candidateBuf = [];

      // Timers
      this._matchAcc = 0;
      this._surgeAcc = 0;
      this._metricsAcc = 0;
      this._gcAcc = 0;
      this._etaCacheAcc = 0;
      this._etaCacheCursor = 0;

      // Per-second accumulators (flushed each metricsInterval)
      this._secOrdersCreated = 0;
      this._secCancels = 0;
      this._secDropoffs = 0;
      this._secGMV = 0;
      this._secPlatRev = 0;
      this._secDriverEarn = 0;
      this._secPickupEtas = [];
      this._secNonIdleDriverSeconds = 0;
      this._secAvgSurgeSum = 0;
      this._secAvgSurgeCount = 0;

      // Rolling time-series (120s)
      this.ts = {
        completedTrips: new U.RingSeries(120),
        ordersCreated: new U.RingSeries(120),
        cancels: new U.RingSeries(120),
        gmv: new U.RingSeries(120),
        platformRevenue: new U.RingSeries(120),
        driverEarnings: new U.RingSeries(120),
        avgSurge: new U.RingSeries(120),
        avgPickupETA: new U.RingSeries(120),
        p90PickupETA: new U.RingSeries(120),
        utilization: new U.RingSeries(120), // 0..1 per second
      };

      this.warningOrderCap = false;

      this.onSecond = null; // callback({ derived, ts })

      this.reset();
    }

    setWorldSize(w, h) {
      const width = Math.max(300, Math.floor(w));
      const height = Math.max(240, Math.floor(h));
      if (width === this.world.width && height === this.world.height) return;
      this.world.width = width;
      this.world.height = height;
      this._applyZonesPreset(this.cfg.zonesPreset);
      this._grid.resize(this.world.width, this.world.height);
    }

    setConfig(partial) {
      if (!partial) return;
      const prevPreset = this.cfg.zonesPreset;
      const prevPattern = this.cfg.demandPattern;
      this.cfg = { ...this.cfg, ...partial };
      this.cfg.demandRatePerMin = U.clamp(this.cfg.demandRatePerMin, 10, 240);
      this.cfg.driversCount = U.clamp(this.cfg.driversCount, 50, 800);
      this.cfg.driverSpeed = U.clamp(this.cfg.driverSpeed, 40, 200);
      this.cfg.matchInterval = U.clamp(this.cfg.matchInterval, 0.5, 5);
      this.cfg.surgeStrength = U.clamp(this.cfg.surgeStrength, 0, 3);
      this.cfg.surgeCap = U.clamp(this.cfg.surgeCap, 0, 3);
      this.cfg.cancelSensitivity = U.clamp(this.cfg.cancelSensitivity, 0, 2);
      this.cfg.eta0 = U.clamp(this.cfg.eta0, 30, 300);
      this.cfg.takeRate = U.clamp(this.cfg.takeRate, 0, 0.4);
      this.cfg.kCandidates = U.clamp(this.cfg.kCandidates, 5, 30);

      if (prevPreset !== this.cfg.zonesPreset) {
        this._applyZonesPreset(this.cfg.zonesPreset);
        this._grid.resize(this.world.width, this.world.height);
        this.hotspots = this._chooseHotspots();
        this.demandWeights = buildDemandWeights(this.cfg.demandPattern, this.world, this.hotspots);
        // resize surge arrays
        this.surge = new Float64Array(this.world.zoneCount);
        this._surgeTarget = new Float64Array(this.world.zoneCount);
        this.zonePending = new Int32Array(this.world.zoneCount);
        this.zoneIdleSupply = new Int32Array(this.world.zoneCount);
      }

      if (prevPattern !== this.cfg.demandPattern) {
        if (this.cfg.demandPattern === 'hotspots') this.hotspots = this._chooseHotspots();
        this.demandWeights = buildDemandWeights(this.cfg.demandPattern, this.world, this.hotspots);
      }

      // Apply live driver count changes.
      this._ensureDriverCount();
    }

    setSeed(seed) {
      const s = (seed >>> 0) || 1;
      this.seed = s;
      this.rng = new U.RNG(this.seed);
      this.hotspots = this._chooseHotspots();
      this.demandWeights = buildDemandWeights(this.cfg.demandPattern, this.world, this.hotspots);
    }

    reset() {
      // Reset must be reproducible for a given seed/config:
      // re-seed RNG to the current seed on every reset.
      this.rng = new U.RNG(this.seed);
      this.time = 0;
      this.warningOrderCap = false;
      this._matchAcc = 0;
      this._surgeAcc = 0;
      this._metricsAcc = 0;
      this._gcAcc = 0;
      this._etaCacheAcc = 0;
      this._etaCacheCursor = 0;

      this._nextDriverId = 1;
      this._nextOrderId = 1;
      this.drivers.length = 0;
      this.orders.length = 0;
      this.flashes.length = 0;

      this.hotspots = this._chooseHotspots();
      this.demandWeights = buildDemandWeights(this.cfg.demandPattern, this.world, this.hotspots);
      this.surge.fill(0);
      this._surgeTarget.fill(0);
      this.zonePending.fill(0);
      this.zoneIdleSupply.fill(0);

      // reset timeseries
      for (const k of Object.keys(this.ts)) {
        this.ts[k] = new U.RingSeries(120);
      }

      this._secOrdersCreated = 0;
      this._secCancels = 0;
      this._secDropoffs = 0;
      this._secGMV = 0;
      this._secPlatRev = 0;
      this._secDriverEarn = 0;
      this._secPickupEtas = [];
      this._secNonIdleDriverSeconds = 0;
      this._secAvgSurgeSum = 0;
      this._secAvgSurgeCount = 0;

      this._ensureDriverCount();
      // Build initial spatial index
      this._grid.buildFromDrivers(this.drivers);
      // One initial surge update
      this._updateZoneCounts();
      this._updateSurge(1.0);
      // Seed initial timeseries value so charts are not empty
      this._flushSecond();
    }

    _applyZonesPreset(preset) {
      const { cols, rows } = parseZonesPreset(preset);
      this.world.zoneCols = cols;
      this.world.zoneRows = rows;
      this.world.zoneW = this.world.width / cols;
      this.world.zoneH = this.world.height / rows;
      this.world.zoneCount = cols * rows;
    }

    _chooseHotspots() {
      const z = this.world.zoneCount;
      if (z <= 1) return [0, 0];
      const a = this.rng.int(0, z - 1);
      let b = this.rng.int(0, z - 1);
      let tries = 0;
      while (b === a && tries++ < 8) b = this.rng.int(0, z - 1);
      return [a, b];
    }

    _ensureDriverCount() {
      const target = this.cfg.driversCount | 0;
      while (this.drivers.length < target) {
        this.drivers.push(makeDriver(this._nextDriverId++, this.world, this.rng));
      }
      while (this.drivers.length > target) {
        this.drivers.pop();
      }
    }

    // ---- Simulation tick ----
    tick(dt) {
      const cfg = this.cfg;
      const world = this.world;

      dt = Math.max(1e-3, Math.min(0.25, dt));
      this.time += dt;

      // demand generation (Poisson arrivals)
      this._spawnOrders(dt);

      // update movements + state transitions
      this._updateDriversAndOrders(dt);

      // cancellations (waiting + assigned before pickup)
      this._handleCancellations(dt);

      // matching batches
      this._matchAcc += dt;
      if (this._matchAcc >= cfg.matchInterval) {
        // keep some cadence even if dt is chunky
        this._matchAcc %= cfg.matchInterval;
        this._runMatchingBatch();
      }

      // surge updates
      this._surgeAcc += dt;
      if (this._surgeAcc >= cfg.surgeUpdateInterval) {
        this._surgeAcc %= cfg.surgeUpdateInterval;
        this._updateZoneCounts();
        this._updateSurge(cfg.surgeUpdateInterval);
      }

      // ETA cache updates for waiting orders (budgeted)
      this._etaCacheAcc += dt;
      if (this._etaCacheAcc >= cfg.etaCacheInterval) {
        this._etaCacheAcc %= cfg.etaCacheInterval;
        this._refreshWaitingEtaCache();
      }

      // metrics flush (1s series)
      this._metricsAcc += dt;
      if (this._metricsAcc >= cfg.metricsInterval) {
        this._metricsAcc %= cfg.metricsInterval;
        this._flushSecond();
      }

      // garbage collect done/canceled orders periodically
      this._gcAcc += dt;
      if (this._gcAcc >= cfg.gcInterval) {
        this._gcAcc %= cfg.gcInterval;
        this._garbageCollectOrders();
      }

      // expire flashes
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        if (this.time - this.flashes[i].t0 > this.flashes[i].ttl) this.flashes.splice(i, 1);
      }
    }

    _spawnOrders(dt) {
      const cfg = this.cfg;
      const world = this.world;

      // cap active orders (waiting/assigned/picked)
      const active = this._activeOrdersCount();
      if (active >= cfg.orderCap) {
        this.warningOrderCap = true;
        return;
      }
      this.warningOrderCap = false;

      const lambdaPerSec = cfg.demandRatePerMin / 60;
      const mean = lambdaPerSec * dt;
      const k = U.samplePoisson(mean, this.rng);
      if (k <= 0) return;

      const remainingCap = Math.max(0, cfg.orderCap - active);
      const createN = Math.min(k, remainingCap);

      for (let i = 0; i < createN; i++) {
        const z = pickZoneByWeights(this.demandWeights, this.rng);
        const zr = zoneRect(z, world);
        const p = randomPointInRect(zr, this.rng);
        const d = randomDestination(p.x, p.y, world, this.rng);
        const o = makeOrder(this._nextOrderId++, p.x, p.y, d.x, d.y, this.time, z);
        this.orders.push(o);
        this._secOrdersCreated++;
      }
    }

    _activeOrdersCount() {
      let c = 0;
      for (let i = 0; i < this.orders.length; i++) {
        const s = this.orders[i].state;
        if (s === 'waiting' || s === 'assigned' || s === 'picked') c++;
      }
      return c;
    }

    _updateDriversAndOrders(dt) {
      const cfg = this.cfg;
      const world = this.world;

      let nonIdle = 0;
      for (let i = 0; i < this.drivers.length; i++) {
        const d = this.drivers[i];
        if (d.state !== 'idle') nonIdle++;
        d.t_state += dt;

        if (d.state === 'idle') {
          // mild wandering drift
          if (this.time >= d.wanderUntil) {
            d.wanderUntil = this.time + cfg.idleWanderTurnInterval * (0.7 + 0.6 * this.rng.float());
            d.wanderAngle += (this.rng.float() - 0.5) * 2 * cfg.idleWanderJitter;
          }
          const sp = cfg.idleWanderSpeed;
          d.vx = Math.cos(d.wanderAngle) * sp;
          d.vy = Math.sin(d.wanderAngle) * sp;
          d.x += d.vx * dt;
          d.y += d.vy * dt;

          // bounce
          if (d.x < 3) { d.x = 3; d.wanderAngle = Math.PI - d.wanderAngle; }
          if (d.x > world.width - 3) { d.x = world.width - 3; d.wanderAngle = Math.PI - d.wanderAngle; }
          if (d.y < 3) { d.y = 3; d.wanderAngle = -d.wanderAngle; }
          if (d.y > world.height - 3) { d.y = world.height - 3; d.wanderAngle = -d.wanderAngle; }
          continue;
        }

        // move towards target
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.y;
        const dist = Math.hypot(dx, dy);
        const sp = cfg.driverSpeed;
        if (dist <= Math.max(1.5, sp * dt)) {
          d.x = d.targetX;
          d.y = d.targetY;
          d.vx = 0;
          d.vy = 0;
          this._onDriverArrive(d);
        } else {
          const inv = 1 / Math.max(1e-6, dist);
          d.vx = dx * inv * sp;
          d.vy = dy * inv * sp;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
        }
      }

      // utilization accumulator: non-idle time in driver-seconds
      this._secNonIdleDriverSeconds += nonIdle * dt;

      // average surge multiplier accumulator (simple mean over zones)
      if (this.surge && this.surge.length) {
        let sum = 0;
        for (let z = 0; z < this.surge.length; z++) sum += (1 + this.surge[z]);
        this._secAvgSurgeSum += sum / this.surge.length;
        this._secAvgSurgeCount += 1;
      }
    }

    _onDriverArrive(driver) {
      const oid = driver.assignedOrderId;
      if (oid < 0) {
        driver.state = 'idle';
        driver.t_state = 0;
        return;
      }
      const order = this._findOrderById(oid);
      if (!order) {
        driver.state = 'idle';
        driver.assignedOrderId = -1;
        driver.t_state = 0;
        return;
      }

      if (driver.state === 'to_pickup') {
        // pickup reached
        if (order.state === 'assigned') {
          order.state = 'picked';
          order.pickedAt = this.time;
          // record pickup ETA sample (actual)
          if (order.assignedAt >= 0) {
            const eta = Math.max(0, order.pickedAt - order.assignedAt);
            this._secPickupEtas.push(eta);
          }
          // go to dropoff
          driver.state = 'to_dropoff';
          driver.targetX = order.destX;
          driver.targetY = order.destY;
          driver.t_state = 0;
          return;
        }
        // order might have been canceled
        driver.state = 'idle';
        driver.assignedOrderId = -1;
        driver.t_state = 0;
        return;
      }

      if (driver.state === 'to_dropoff') {
        // dropoff reached
        if (order.state === 'picked') {
          order.state = 'done';
          order.doneAt = this.time;
          // economics on completion
          const fare = order.fare;
          const gmv = fare;
          const plat = fare * this.cfg.takeRate;
          const drv = fare - plat;
          this._secDropoffs += 1;
          this._secGMV += gmv;
          this._secPlatRev += plat;
          this._secDriverEarn += drv;
          driver.earnings += drv;
        }
        driver.state = 'idle';
        driver.assignedOrderId = -1;
        driver.t_state = 0;
        return;
      }
    }

    _findOrderById(orderId) {
      // Linear scan is OK because order cap is bounded; GC keeps it moderate.
      for (let i = 0; i < this.orders.length; i++) {
        if (this.orders[i].id === orderId) return this.orders[i];
      }
      return null;
    }

    _handleCancellations(dt) {
      const cfg = this.cfg;
      const eta0 = Math.max(1e-6, cfg.eta0);

      for (let i = 0; i < this.orders.length; i++) {
        const o = this.orders[i];
        if (o.state === 'waiting') {
          const etaEst = Number.isFinite(o.etaEst) ? o.etaEst : 999;
          const hazard = U.clamp(cfg.cancelSensitivity * (etaEst / eta0), 0, 0.5);
          if (hazard <= 0) continue;
          const p = 1 - Math.exp(-hazard * dt);
          if (this.rng.float() < p) {
            o.state = 'canceled';
            o.canceledAt = this.time;
            this._secCancels += 1;
          }
        } else if (o.state === 'assigned') {
          // cancel before pickup based on assigned driver's distance to pickup
          const d = this._findDriverById(o.assignedDriverId);
          let eta = 999;
          if (d && d.state === 'to_pickup') {
            eta = U.dist(d.x, d.y, o.x, o.y) / Math.max(1e-6, cfg.driverSpeed);
          }
          const hazard = U.clamp(cfg.cancelSensitivity * (eta / eta0), 0, 0.5);
          if (hazard <= 0) continue;
          const p = 1 - Math.exp(-hazard * dt);
          if (this.rng.float() < p) {
            o.state = 'canceled';
            o.canceledAt = this.time;
            this._secCancels += 1;
            // free driver back to idle if en route
            if (d && d.state === 'to_pickup' && d.assignedOrderId === o.id) {
              d.state = 'idle';
              d.assignedOrderId = -1;
              d.targetX = d.x;
              d.targetY = d.y;
              d.t_state = 0;
            }
          }
        }
      }
    }

    _findDriverById(driverId) {
      for (let i = 0; i < this.drivers.length; i++) {
        if (this.drivers[i].id === driverId) return this.drivers[i];
      }
      return null;
    }

    _runMatchingBatch() {
      const cfg = this.cfg;

      // Build idle driver grid for fast nearest search.
      this._grid.buildFromDrivers(this.drivers);

      // Collect waiting orders indices
      const waitingIdx = [];
      for (let i = 0; i < this.orders.length; i++) {
        if (this.orders[i].state === 'waiting') waitingIdx.push(i);
      }
      if (waitingIdx.length === 0) return;

      // Shuffle to avoid always serving same zones first
      this.rng.shuffle(waitingIdx);

      const maxR = 6; // cells
      const k = cfg.kCandidates | 0;
      const candidates = this._candidateBuf;

      for (let wi = 0; wi < waitingIdx.length; wi++) {
        const o = this.orders[waitingIdx[wi]];
        if (!o || o.state !== 'waiting') continue;

        // zone can change if grid preset changed or world resized; recompute from position
        o.zoneId = zoneIdAt(o.x, o.y, this.world);

        this._grid.collectCandidates(o.x, o.y, k, maxR, this.drivers, candidates);
        if (candidates.length === 0) continue;

        // choose best driver
        let bestDi = -1;
        let bestVal = -Infinity;
        for (let ci = 0; ci < candidates.length; ci++) {
          const di = candidates[ci];
          const d = this.drivers[di];
          if (!d || d.state !== 'idle') continue;
          const eta = U.dist(d.x, d.y, o.x, o.y) / Math.max(1e-6, cfg.driverSpeed);
          if (cfg.matchingPolicy === 'eta') {
            const val = -eta;
            if (val > bestVal) { bestVal = val; bestDi = di; }
          } else {
            // score policy: w1*(1/ETA) + w2*price
            const baseFare = computeBaseFare(o, cfg);
            const surgeMult = 1 + (this.surge[o.zoneId] || 0);
            const price = baseFare * surgeMult;
            const val = (1 / Math.max(1e-6, eta)) + 0.002 * price;
            if (val > bestVal) { bestVal = val; bestDi = di; }
          }
        }
        if (bestDi < 0) continue;

        const d = this.drivers[bestDi];
        if (!d || d.state !== 'idle') continue;

        // assign
        const baseFare = computeBaseFare(o, cfg);
        const surgeMult = 1 + (this.surge[o.zoneId] || 0);
        o.surgeMult = surgeMult;
        o.fare = baseFare * surgeMult;
        o.state = 'assigned';
        o.assignedDriverId = d.id;
        o.assignedAt = this.time;

        d.state = 'to_pickup';
        d.assignedOrderId = o.id;
        d.targetX = o.x;
        d.targetY = o.y;
        d.t_state = 0;

        // assignment flash
        this.flashes.push({
          x1: d.x, y1: d.y,
          x2: o.x, y2: o.y,
          t0: this.time,
          ttl: 0.8,
        });
      }
    }

    _refreshWaitingEtaCache() {
      const cfg = this.cfg;
      // Build grid once for all ETA estimations
      this._grid.buildFromDrivers(this.drivers);

      const waitingIndices = [];
      for (let i = 0; i < this.orders.length; i++) {
        if (this.orders[i].state === 'waiting') waitingIndices.push(i);
      }
      if (waitingIndices.length === 0) return;

      // Update a budgeted subset each second (round-robin)
      const budget = Math.max(50, cfg.maxEtaEstPerSecond | 0);
      const candidates = this._candidateBuf;
      const maxR = 6;
      const k = cfg.kCandidates | 0;
      const speed = Math.max(1e-6, cfg.driverSpeed);

      const n = waitingIndices.length;
      let updated = 0;
      // Map cursor over waitingIndices
      for (let step = 0; step < n && updated < budget; step++) {
        const idx = waitingIndices[(this._etaCacheCursor + step) % n];
        const o = this.orders[idx];
        if (!o || o.state !== 'waiting') continue;
        this._grid.collectCandidates(o.x, o.y, k, maxR, this.drivers, candidates);
        let bestEta = 999;
        for (let ci = 0; ci < candidates.length; ci++) {
          const d = this.drivers[candidates[ci]];
          if (!d || d.state !== 'idle') continue;
          const eta = U.dist(d.x, d.y, o.x, o.y) / speed;
          if (eta < bestEta) bestEta = eta;
        }
        o.etaEst = Number.isFinite(bestEta) ? bestEta : 999;
        o.etaEstUpdatedAt = this.time;
        updated++;
      }
      this._etaCacheCursor = (this._etaCacheCursor + updated) % n;
    }

    _updateZoneCounts() {
      const world = this.world;
      this.zonePending.fill(0);
      this.zoneIdleSupply.fill(0);

      for (let i = 0; i < this.orders.length; i++) {
        const o = this.orders[i];
        if (o.state === 'waiting' || o.state === 'assigned') {
          // pending demand attributed to pickup zone
          const z = zoneIdAt(o.x, o.y, world);
          o.zoneId = z;
          this.zonePending[z] += 1;
        }
      }

      for (let i = 0; i < this.drivers.length; i++) {
        const d = this.drivers[i];
        if (d.state !== 'idle') continue;
        const z = zoneIdAt(d.x, d.y, world);
        this.zoneIdleSupply[z] += 1;
      }
    }

    _updateSurge(dt) {
      const cfg = this.cfg;
      const alpha = 0.3;
      for (let z = 0; z < this.world.zoneCount; z++) {
        const demand = this.zonePending[z];
        const supply = this.zoneIdleSupply[z];
        const ratio = demand / Math.max(1, supply);
        const raw = cfg.surgeStrength * (ratio - 1);
        const target = U.clamp(raw, 0, cfg.surgeCap);
        this._surgeTarget[z] = target;
        this.surge[z] = U.ema(this.surge[z], target, alpha);
      }
    }

    _garbageCollectOrders() {
      // Keep only active (waiting/assigned/picked), plus very recent done/canceled (for short visuals).
      const keep = [];
      const t = this.time;
      for (let i = 0; i < this.orders.length; i++) {
        const o = this.orders[i];
        if (o.state === 'waiting' || o.state === 'assigned' || o.state === 'picked') {
          keep.push(o);
        } else {
          // keep for up to 8s after completion/cancel
          const ts = (o.state === 'done') ? o.doneAt : o.canceledAt;
          if (ts >= 0 && t - ts < 8) keep.push(o);
        }
      }
      this.orders = keep;
    }

    _flushSecond() {
      const cfg = this.cfg;
      const N = Math.max(1, this.drivers.length);

      const avgSurge = (this._secAvgSurgeCount > 0) ? (this._secAvgSurgeSum / this._secAvgSurgeCount) : 1;
      const util = U.clamp(this._secNonIdleDriverSeconds / (N * cfg.metricsInterval), 0, 1);
      const avgPickup = (this._secPickupEtas.length > 0)
        ? (this._secPickupEtas.reduce((a, b) => a + b, 0) / this._secPickupEtas.length)
        : 0;
      const p90Pickup = (this._secPickupEtas.length > 0) ? U.percentile(this._secPickupEtas, 0.9) : 0;

      this.ts.completedTrips.push(this._secDropoffs);
      this.ts.ordersCreated.push(this._secOrdersCreated);
      this.ts.cancels.push(this._secCancels);
      this.ts.gmv.push(this._secGMV);
      this.ts.platformRevenue.push(this._secPlatRev);
      this.ts.driverEarnings.push(this._secDriverEarn);
      this.ts.avgSurge.push(avgSurge);
      this.ts.utilization.push(util);
      this.ts.avgPickupETA.push(avgPickup);
      this.ts.p90PickupETA.push(p90Pickup);

      // compute derived rolling 60s metrics
      const trips60 = this.ts.completedTrips.sumLast(60);
      const cancels60 = this.ts.cancels.sumLast(60);
      const created60 = this.ts.ordersCreated.sumLast(60);
      const gmv60 = this.ts.gmv.sumLast(60);
      const plat60 = this.ts.platformRevenue.sumLast(60);
      const drv60 = this.ts.driverEarnings.sumLast(60);
      const util60 = this._meanLast(this.ts.utilization, 60);
      const avgSurge60 = this._meanLast(this.ts.avgSurge, 60);
      const avgEta60 = this._meanLast(this.ts.avgPickupETA, 60);
      const p90EtaNow = this.ts.p90PickupETA.last();
      const cancelRate60 = (created60 > 0) ? (cancels60 / created60) : 0;

      const derived = {
        tripsPerMin: trips60,
        avgPickupETA: avgEta60,
        p90PickupETA: p90EtaNow,
        cancelRate: cancelRate60,
        utilization: util60,
        gmvPerMin: gmv60, // 60s sum == per minute
        platformRevPerMin: plat60,
        driverEarnPerMin: drv60,
        avgSurge: avgSurge60,
        activeOrders: this._activeOrdersCount(),
        drivers: this.drivers.length,
        time: this.time,
      };

      // reset second accumulators
      this._secOrdersCreated = 0;
      this._secCancels = 0;
      this._secDropoffs = 0;
      this._secGMV = 0;
      this._secPlatRev = 0;
      this._secDriverEarn = 0;
      this._secPickupEtas = [];
      this._secNonIdleDriverSeconds = 0;
      this._secAvgSurgeSum = 0;
      this._secAvgSurgeCount = 0;

      if (typeof this.onSecond === 'function') {
        try { this.onSecond({ derived, ts: this.ts }); } catch (_) { /* ignore UI errors */ }
      }
    }

    _meanLast(series, n) {
      const k = Math.min(series.count, n);
      if (k <= 0) return 0;
      let s = 0;
      for (let i = 0; i < k; i++) {
        const idx = (series.index - 1 - i + series.size) % series.size;
        s += series.values[idx];
      }
      return s / k;
    }
  }

  function createSim({ seed, config } = {}) {
    return new SimInstance(seed || 42, config || {});
  }

  window.Sim = { createSim, DEFAULT_CONFIG };
})();

