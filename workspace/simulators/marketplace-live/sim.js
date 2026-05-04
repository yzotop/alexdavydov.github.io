/* sim.js — core marketplace simulation (time-evolving, deterministic with seed)
   Model summary:
   - Buyers arrive via Poisson(buyers_per_sec)
   - Each buyer has price_sensitivity, patience, intent (browse/buy-intent)
   - Sellers have quality, cost, bid, delivery_time_base
   - Feed/Ranking: 10-15 slots, two modes (Quality-first / Revenue-first)
   - Delivery queue with capacity, congestion, ETA
   - Trust/Fatigue: pressure degrades trust, affects CTR/conversion
*/

(() => {
  'use strict';

  const U = window.Utils;
  if (!U) throw new Error('utils.js must be loaded before sim.js');

  const DEFAULT_PARAMS = {
    // A) Traffic
    buyers_per_sec: 3.0,              // 0.5–10
    buy_intent_share: 0.35,            // 0.1–0.8
    price_sensitivity_mean: 0.6,        // 0.2–1.0 (higher = more price-sensitive)
    price_sensitivity_spread: 0.2,    // 0–0.4
    patience_mean: 0.7,                // 0.3–1.0 (tolerance to delay/spam)
    patience_spread: 0.15,            // 0–0.3

    // B) Marketplace Policy
    take_rate: 0.15,                   // 0.05–0.4
    ranking_mode: 'quality-first',     // 'quality-first' | 'revenue-first'
    promoted_share: 0.25,              // 0–0.6 (fraction of slots allowed for bid-driven)
    price_level: 1.0,                  // 0.5–2.0 (scale factor for prices)

    // C) Supply / Auction
    sellers_count: 12,                 // 5–30
    quality_mean: 0.65,                // 0.3–0.9
    quality_spread: 0.2,               // 0–0.3
    bid_mean: 2.5,                     // 0.5–10
    bid_spread: 1.2,                   // 0.3–3.0 (lognormal stddev)

    // D) Delivery / Ops
    capacity_deliveries_per_min: 8.0,  // 2–20
    congestion_factor: 0.15,           // 0.05–0.5
    ETA0: 180,                         // sec (60–600)
    cancel_sensitivity: 1.5,           // 0.5–3.0

    // E) Trust / Fatigue
    pressure_strength: 0.8,            // 0.3–2.0
    recovery_strength: 0.12,           // 0.05–0.3
    trust_floor: 0.3,                  // 0.1–0.6
  };

  const LIMITS = {
    max_active_buyers: 400,
    max_visible_buyers: 250, // Limit rendering for performance
    feed_slots: 8, // Reduced from 12
    max_orders: 200,
  };

  class Buyer {
    constructor(id, t0, params, rng) {
      this.id = id;
      this.t0 = t0;
      this.x = 0; // visual position (0 = left, 1 = right)
      this.y = 0; // visual y
      
      this.price_sensitivity = U.clamp(
        params.price_sensitivity_mean + (rng.float() - 0.5) * 2 * params.price_sensitivity_spread,
        0.1, 1.0
      );
      this.patience = U.clamp(
        params.patience_mean + (rng.float() - 0.5) * 2 * params.patience_spread,
        0.2, 1.0
      );
      this.intent = rng.bool(params.buy_intent_share) ? 'buy-intent' : 'browse';
      
      this.impressions = 0;
      this.last_impression_t = t0;
      this.fatigue = 0;
      this.trust = 1.0;
    }
  }

  class Seller {
    constructor(id, params, rng) {
      this.id = id;
      this.quality = U.clamp(
        params.quality_mean + (rng.float() - 0.5) * 2 * params.quality_spread,
        0.1, 1.0
      );
      this.cost = 10 + rng.float() * 20; // base cost
      this.price = this.cost * (1.2 + rng.float() * 0.8); // markup
      this.bid = rng.lognormal(params.bid_mean, params.bid_spread);
      this.delivery_time_base = 120 + rng.float() * 180; // sec
      this.stock = Infinity; // unlimited for MVP
    }
  }

  class Order {
    constructor(id, buyer, item, t0, params) {
      this.id = id;
      this.buyer = buyer;
      this.item = item;
      this.t0 = t0;
      this.price = item.price * params.price_level;
      this.gmv = this.price;
      this.platform_rev = this.gmv * params.take_rate;
      
      // Delivery
      this.eta = params.ETA0;
      this.delivery_progress = 0; // 0..1
      this.delivered = false;
      this.cancelled = false;
      this.late = false;
      
      // Visual
      this.x = 0;
      this.y = 0;
      this.delivery_x = 0;
      this.delivery_y = 0;
    }
  }

  class FeedSlot {
    constructor(slotIndex) {
      this.slotIndex = slotIndex;
      this.item = null;
      this.promoted = false;
      this.impressions = 0;
      this.lastPurchaseTime = null; // For ping animation
    }
  }

  class MarketplaceSim {
    constructor(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);
      this.params = { ...DEFAULT_PARAMS };
      
      this.time = 0;
      this._nextId = 1;
      
      // Entities
      this.buyers = [];
      this.sellers = [];
      this.feed = [];
      this.orders = [];
      this.delivery_queue = [];
      this.completed_orders = [];
      
      // Visual effects
      this.purchase_lines = []; // {buyer, item, t0, ttl}
      this.delivery_particles = []; // {order, x, y, progress}
      this.cancel_flashes = []; // {x, y, t0, ttl}
      this.delivered_flashes = []; // {x, y, t0, ttl}
      
      // Per-second accumulators
      this._sec = {
        buyers_arrived: 0,
        impressions: 0,
        orders_created: 0,
        orders_completed: 0,
        orders_cancelled: 0,
        orders_late: 0,
        gmv: 0,
        platform_rev: 0,
      };
      this._secAcc = 0;
      
      // Rolling series 120s
      this.ts = {
        revenue_per_min: new U.RingSeries(120),
        orders_per_min: new U.RingSeries(120),
        p90_eta: new U.RingSeries(120),
        trust: new U.RingSeries(120),
        gmv_per_min: new U.RingSeries(120),
        conversion_rate: new U.RingSeries(120),
        fill_rate: new U.RingSeries(120),
        cancel_rate: new U.RingSeries(120),
        late_share: new U.RingSeries(120),
        avg_price_shown: new U.RingSeries(120),
        avg_quality_shown: new U.RingSeries(120),
      };
      
      // Trust state
      this.trust = 1.0;
      this.pressure = 0; // current pressure level
      
      // Hero buyer tracking
      this.heroBuyerId = null;
      this.heroBuyerLastUpdate = 0;
      this.heroEvents = []; // Last events for hero: {t, type, data}
      
      // Initialize sellers
      this._initSellers();
      
      // Initialize feed (reduce to 8 slots)
      for (let i = 0; i < 8; i++) {
        this.feed.push(new FeedSlot(i));
      }
      
      this.onSecond = null;
    }
    
    setSeed(seed) {
      this.seed = (seed >>> 0) || 1;
      this.rng = new U.RNG(this.seed);
      this._initSellers();
    }
    
    _initSellers() {
      this.sellers = [];
      for (let i = 0; i < this.params.sellers_count; i++) {
        this.sellers.push(new Seller(i, this.params, this.rng));
      }
    }
    
    setParams(patch) {
      Object.assign(this.params, patch);
      if (patch.sellers_count !== undefined) {
        this._initSellers();
      }
    }
    
    reset() {
      this.time = 0;
      this._nextId = 1;
      this.buyers = [];
      this.orders = [];
      this.delivery_queue = [];
      this.completed_orders = [];
      this.purchase_lines = [];
      this.delivery_particles = [];
      this.cancel_flashes = [];
      this.delivered_flashes = [];
      this.trust = 1.0;
      this.pressure = 0;
      this.heroBuyerId = null;
      this.heroBuyerLastUpdate = 0;
      this.heroEvents = [];
      this._sec = {
        buyers_arrived: 0,
        impressions: 0,
        orders_created: 0,
        orders_completed: 0,
        orders_cancelled: 0,
        orders_late: 0,
        gmv: 0,
        platform_rev: 0,
      };
      this._secAcc = 0;
      for (const k of Object.keys(this.ts)) {
        this.ts[k] = new U.RingSeries(120);
      }
      this._initSellers();
      for (let i = 0; i < 8; i++) {
        this.feed[i].item = null;
        this.feed[i].promoted = false;
        this.feed[i].impressions = 0;
        this.feed[i].lastPurchaseTime = null;
      }
      if (typeof this.onReset === 'function') this.onReset();
    }
    
    step(dt) {
      this.time += dt;
      
      // 1. Generate new buyers (Poisson)
      const lambda = this.params.buyers_per_sec * dt;
      const nBuyers = U.samplePoisson(lambda, this.rng);
      for (let i = 0; i < nBuyers; i++) {
        if (this.buyers.length < LIMITS.max_active_buyers) {
          const buyer = new Buyer(this._nextId++, this.time, this.params, this.rng);
          buyer.y = 0.1 + this.rng.float() * 0.8; // random y position
          this.buyers.push(buyer);
          this._sec.buyers_arrived++;
        }
      }
      
      // 2. Update hero buyer (every 8-12 seconds or when hero completes order)
      this._updateHeroBuyer();
      
      // 3. Update feed ranking
      this._updateFeed();
      
      // 4. Process buyer impressions and purchases
      this._processBuyers(dt);
      
      // 5. Update delivery queue
      this._updateDelivery(dt);
      
      // 6. Update trust/fatigue
      this._updateTrust(dt);
      
      // 7. Cleanup old buyers
      this._cleanupBuyers();
      
      // 8. Update visual effects
      this._updateVisuals(dt);
      
      // 9. Per-second flush
      this._secAcc += dt;
      if (Math.floor(this.time) !== Math.floor(this.time - dt)) {
        this._flushSecond();
      }
    }
    
    _updateHeroBuyer() {
      // Update hero every 8-12 seconds or when hero completes order
      const shouldUpdate = this.time - this.heroBuyerLastUpdate > (8 + this.rng.float() * 4);
      const heroCompleted = this.heroBuyerId && 
        this.orders.some(o => o.buyer.id === this.heroBuyerId && o.delivered);
      
      if (shouldUpdate || heroCompleted || !this.heroBuyerId) {
        // Find new hero (active buyer with buy-intent)
        const candidates = this.buyers.filter(b => 
          b.intent === 'buy-intent' && b.x < 0.8 && b.fatigue < 1.5
        );
        if (candidates.length > 0) {
          this.heroBuyerId = this.rng.choice(candidates).id;
          this.heroBuyerLastUpdate = this.time;
          this.heroEvents = [];
          this._logHeroEvent('selected', {});
        }
      }
    }
    
    _logHeroEvent(type, data) {
      if (!this.heroBuyerId) return;
      this.heroEvents.push({ t: this.time, type, data });
      // Keep last 10 events
      if (this.heroEvents.length > 10) {
        this.heroEvents.shift();
      }
    }
    
    _updateFeed() {
      // Rank items for each slot
      for (let slot of this.feed) {
        const isPromoted = this.rng.bool(this.params.promoted_share);
        slot.promoted = isPromoted;
        
        if (this.sellers.length === 0) {
          slot.item = null;
          continue;
        }
        
        // Score all sellers
        const scores = this.sellers.map(seller => {
          if (this.params.ranking_mode === 'quality-first') {
            // Quality-first: wq*q + wp*expected_user_value - wlate*expected_late_risk
            const wq = 0.6;
            const wp = 0.3;
            const wlate = 0.1;
            const expected_user_value = seller.quality * (1 - this.params.price_sensitivity_mean * (seller.price / 100));
            const queue_len = this.delivery_queue.length;
            const expected_late_risk = Math.min(1, queue_len / (this.params.capacity_deliveries_per_min * 2));
            return wq * seller.quality + wp * expected_user_value - wlate * expected_late_risk;
          } else {
            // Revenue-first: wbid*bid + wtake*take_rate*price + wq*q - wbad*fatigue_risk
            const wbid = isPromoted ? 0.5 : 0.2;
            const wtake = 0.3;
            const wq = 0.2;
            const wbad = 0.1;
            const fatigue_risk = Math.max(0, this.pressure - 0.5);
            return wbid * seller.bid + wtake * this.params.take_rate * seller.price + wq * seller.quality - wbad * fatigue_risk;
          }
        });
        
        // Pick best seller
        const bestIdx = U.pickWeightedIndex(scores, this.rng);
        slot.item = this.sellers[bestIdx];
      }
    }
    
    _processBuyers(dt) {
      for (let buyer of this.buyers) {
        // Move buyer forward
        buyer.x = Math.min(1, buyer.x + dt * 0.3); // visual movement
        
        // Check for impressions (browse feed)
        if (this.rng.bool(0.5 * dt)) { // 0.5 impressions per second per buyer
          const slot = this.feed[this.rng.int(0, this.feed.length - 1)];
          if (slot.item) {
            buyer.impressions++;
            buyer.last_impression_t = this.time;
            slot.impressions++;
            this._sec.impressions++;
            
            // Log hero impression
            if (buyer.id === this.heroBuyerId) {
              this._logHeroEvent('impression', { slotIndex: slot.slotIndex, itemPrice: slot.item.price });
            }
            
            // Check for purchase (conversion)
            const ctr = this._computeCTR(buyer, slot.item);
            if (this.rng.bool(ctr * dt)) {
              // Create order
              const order = new Order(this._nextId++, buyer, slot.item, this.time, this.params);
              this.orders.push(order);
              this.delivery_queue.push(order);
              this._sec.orders_created++;
              this._sec.gmv += order.gmv;
              this._sec.platform_rev += order.platform_rev;
              
              // Visual: purchase line
              this.purchase_lines.push({
                buyer,
                item: slot.item,
                slotIndex: slot.slotIndex,
                t0: this.time,
                ttl: 1.0,
                isHero: buyer.id === this.heroBuyerId,
              });
              
              // Mark slot for ping animation
              slot.lastPurchaseTime = this.time;
              
              // Log hero order
              if (buyer.id === this.heroBuyerId) {
                this._logHeroEvent('orderCreated', { orderId: order.id, price: order.price });
                this._logHeroEvent('enqueued', { orderId: order.id });
              }
              
              // Update buyer fatigue
              buyer.fatigue += 0.1;
              this.pressure += 0.02;
            }
          }
        }
        
        // Update buyer fatigue decay
        buyer.fatigue = Math.max(0, buyer.fatigue - dt * 0.1);
      }
    }
    
    _computeCTR(buyer, item) {
      const baseCTR = buyer.intent === 'buy-intent' ? 0.15 : 0.05;
      const qualityFactor = item.quality;
      const priceFactor = 1 - buyer.price_sensitivity * (item.price / 200);
      const trustFactor = buyer.trust;
      const fatiguePenalty = Math.exp(-2 * buyer.fatigue);
      return U.clamp(baseCTR * qualityFactor * priceFactor * trustFactor * fatiguePenalty, 0, 1);
    }
    
    _updateDelivery(dt) {
      const capacity = this.params.capacity_deliveries_per_min / 60; // per second
      const queue_len = this.delivery_queue.length;
      const congestion = queue_len > 0 ? 1 + this.params.congestion_factor * (queue_len / capacity) : 1;
      
      // Process deliveries
      let processed = 0;
      for (let i = this.delivery_queue.length - 1; i >= 0; i--) {
        const order = this.delivery_queue[i];
        
        // Update ETA
        order.eta = this.params.ETA0 * congestion;
        
        // Update delivery progress
        order.delivery_progress += dt / order.eta;
        
        // Check cancellation
        if (!order.cancelled && !order.delivered) {
          const cancelHazard = this.params.cancel_sensitivity * (order.eta / this.params.ETA0) + 0.5 * this.pressure;
          if (this.rng.bool(cancelHazard * dt * 0.01)) {
            order.cancelled = true;
            this._sec.orders_cancelled++;
            this.cancel_flashes.push({ x: order.x, y: order.y, t0: this.time, ttl: 1.0 });
            
            // Log hero cancel
            if (order.buyer.id === this.heroBuyerId) {
              this._logHeroEvent('cancelled', { orderId: order.id });
            }
            
            this.delivery_queue.splice(i, 1);
            continue;
          }
        }
        
        // Check completion
        if (order.delivery_progress >= 1 && !order.cancelled) {
          order.delivered = true;
          const actual_time = this.time - order.t0;
          if (actual_time > order.eta * 1.1) {
            order.late = true;
            this._sec.orders_late++;
          }
          this._sec.orders_completed++;
          this.completed_orders.push(order);
          this.delivered_flashes.push({ x: order.x, y: order.y, t0: this.time, ttl: 1.0 });
          this.delivery_queue.splice(i, 1);
          processed++;
          
          // Log hero delivery
          if (order.buyer.id === this.heroBuyerId) {
            this._logHeroEvent('delivered', { orderId: order.id, late: order.late });
          }
          
          // Trust recovery from good delivery
          if (!order.late) {
            this.trust = Math.min(1, this.trust + this.params.recovery_strength * 0.01);
          }
        }
        
        // Log hero delivery start (when progress > 0.1)
        if (order.delivery_progress > 0.1 && !order.delivery_started_logged) {
          order.delivery_started_logged = true;
          if (order.buyer.id === this.heroBuyerId) {
            this._logHeroEvent('deliveryStart', { orderId: order.id, eta: order.eta });
          }
        }
      }
    }
    
    _updateTrust(dt) {
      // Trust degrades from pressure
      const pressureImpact = this.params.pressure_strength * this.pressure;
      this.trust = Math.max(this.params.trust_floor, this.trust - pressureImpact * dt * 0.1);
      
      // Trust recovery (natural)
      this.trust = Math.min(1, this.trust + this.params.recovery_strength * dt * 0.01);
      
      // Pressure decay
      this.pressure = Math.max(0, this.pressure - dt * 0.05);
      
      // Update buyer trust
      for (let buyer of this.buyers) {
        buyer.trust = this.trust;
      }
    }
    
    _cleanupBuyers() {
      // Remove buyers that moved off screen or have high fatigue
      for (let i = this.buyers.length - 1; i >= 0; i--) {
        const buyer = this.buyers[i];
        if (buyer.x > 1.2 || buyer.fatigue > 2.0) {
          this.buyers.splice(i, 1);
        }
      }
    }
    
    _updateVisuals(dt) {
      // Update purchase lines
      for (let i = this.purchase_lines.length - 1; i >= 0; i--) {
        const line = this.purchase_lines[i];
        line.ttl -= dt;
        if (line.ttl <= 0) {
          this.purchase_lines.splice(i, 1);
        }
      }
      
      // Update cancel flashes
      for (let i = this.cancel_flashes.length - 1; i >= 0; i--) {
        const flash = this.cancel_flashes[i];
        flash.ttl -= dt;
        if (flash.ttl <= 0) {
          this.cancel_flashes.splice(i, 1);
        }
      }
      
      // Update delivered flashes
      for (let i = this.delivered_flashes.length - 1; i >= 0; i--) {
        const flash = this.delivered_flashes[i];
        flash.ttl -= dt;
        if (flash.ttl <= 0) {
          this.delivered_flashes.splice(i, 1);
        }
      }
    }
    
    _flushSecond() {
      const sec = Math.floor(this.time);
      
      // Push metrics
      this.ts.revenue_per_min.push(this._sec.platform_rev * 60);
      this.ts.orders_per_min.push(this._sec.orders_completed * 60);
      
      // P90 ETA
      const etas = this.delivery_queue.map(o => o.eta);
      const p90eta = etas.length > 0 ? U.percentile(etas, 0.9) : 0;
      this.ts.p90_eta.push(p90eta);
      
      this.ts.trust.push(this.trust);
      this.ts.gmv_per_min.push(this._sec.gmv * 60);
      
      // Conversion rate
      const convRate = this._sec.impressions > 0 ? this._sec.orders_created / this._sec.impressions : 0;
      this.ts.conversion_rate.push(convRate);
      
      // Fill rate
      const filledSlots = this.feed.filter(s => s.item !== null).length;
      this.ts.fill_rate.push(filledSlots / LIMITS.feed_slots);
      
      // Cancel rate
      const totalOrders = this._sec.orders_created;
      const cancelRate = totalOrders > 0 ? this._sec.orders_cancelled / totalOrders : 0;
      this.ts.cancel_rate.push(cancelRate);
      
      // Late share
      const completed = this._sec.orders_completed;
      const lateShare = completed > 0 ? this._sec.orders_late / completed : 0;
      this.ts.late_share.push(lateShare);
      
      // Avg price/quality shown
      const shownItems = this.feed.filter(s => s.item !== null).map(s => s.item);
      if (shownItems.length > 0) {
        const avgPrice = shownItems.reduce((sum, item) => sum + item.price, 0) / shownItems.length;
        const avgQuality = shownItems.reduce((sum, item) => sum + item.quality, 0) / shownItems.length;
        this.ts.avg_price_shown.push(avgPrice);
        this.ts.avg_quality_shown.push(avgQuality);
      } else {
        this.ts.avg_price_shown.push(0);
        this.ts.avg_quality_shown.push(0);
      }
      
      // Reset per-second accumulators
      this._sec = {
        buyers_arrived: 0,
        impressions: 0,
        orders_created: 0,
        orders_completed: 0,
        orders_cancelled: 0,
        orders_late: 0,
        gmv: 0,
        platform_rev: 0,
      };
      
      // Callback (sec = per-second counts for flow strip / funnel)
      if (typeof this.onSecond === 'function') {
        try {
          const sec = {
            impressions: this._sec.impressions,
            orders_created: this._sec.orders_created,
            orders_completed: this._sec.orders_completed,
            orders_cancelled: this._sec.orders_cancelled,
          };
          this.onSecond({ derived: this.getDerived(), ts: this.ts, sec });
        } catch (e) {
          console.error('Error in onSecond:', e);
        }
      }
    }
    
    getDerived() {
      const buyersPerSec = this.ts.revenue_per_min.count > 0 ? this.params.buyers_per_sec : 0;
      const cap = this.params.capacity_deliveries_per_min;
      const q = this.delivery_queue.length;
      const delivery_load = cap > 0 ? q / cap : 0;
      return {
        time: this.time,
        buyers_per_sec: buyersPerSec,
        active_orders: this.orders.filter(o => !o.delivered && !o.cancelled).length,
        queue_len: q,
        capacity_deliveries_per_min: cap,
        delivery_load,
        p90_eta: this.ts.p90_eta.last() || 0,
        ranking_mode: this.params.ranking_mode,
        take_rate: this.params.take_rate,
        promoted_share: this.params.promoted_share,
        price_level: this.params.price_level,
        sellers_count: this.sellers.length,
        avg_quality: this.sellers.length > 0 ? this.sellers.reduce((sum, s) => sum + s.quality, 0) / this.sellers.length : 0,
        avg_bid: this.sellers.length > 0 ? this.sellers.reduce((sum, s) => sum + s.bid, 0) / this.sellers.length : 0,
        trust: this.trust,
        cancel_rate: this.ts.cancel_rate.last() || 0,
        late_share: this.ts.late_share.last() || 0,
        limiter: this._getLimiter(),
        limiterReason: this._getLimiterReason(),
        heroBuyerId: this.heroBuyerId,
        heroEvents: this.heroEvents.slice(),
      };
    }
    
    _getLimiter() {
      const queue = this.delivery_queue.length;
      const capacity = this.params.capacity_deliveries_per_min;
      const lateShare = this.ts.late_share.last() || 0;
      const trust = this.trust;
      const buyers = this.buyers.length;
      const sellers = this.sellers.length;
      const fillRate = this.ts.fill_rate.last() || 0;
      
      if (queue > capacity * 0.8 && lateShare > 0.1) return 'Ops-limited';
      if (trust < 0.5) return 'Trust-limited';
      if (buyers < 10) return 'Demand-limited';
      if (sellers < 5 || fillRate < 0.3) return 'Supply-limited';
      return 'Balanced';
    }
    
    _getLimiterReason() {
      const queue = this.delivery_queue.length;
      const capacity = this.params.capacity_deliveries_per_min;
      const p90eta = this.ts.p90_eta.last() || 0;
      const lateShare = this.ts.late_share.last() || 0;
      const trust = this.trust;
      const buyers = this.buyers.length;
      const sellers = this.sellers.length;
      const fillRate = this.ts.fill_rate.last() || 0;
      
      if (queue > capacity * 0.8 || p90eta > this.params.ETA0 * 1.5) {
        return `queue↑ (${queue}) → ETA↑ (${U.formatSeconds(p90eta)})`;
      }
      if (trust < 0.5) {
        return `trust↓ (${(trust * 100).toFixed(0)}%) → CTR↓`;
      }
      if (buyers < 10) {
        return `buyers↓ (${buyers})`;
      }
      if (sellers < 5 || fillRate < 0.3) {
        return `sellers↓ (${sellers}) or fill↓ (${(fillRate * 100).toFixed(0)}%)`;
      }
      return 'balanced';
    }
  }

  function createMarketplace(seed) {
    return new MarketplaceSim(seed || 42);
  }

  window.Marketplace = { createMarketplace, DEFAULT_PARAMS };
})();
