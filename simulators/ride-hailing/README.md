# Ride-Hailing Simulator (MVP)

Client-side, agent-based ride-hailing (taxi) simulation: drivers move on a 2D city map, orders spawn over time, matching assigns drivers to orders using a spatial grid (no \(O(N^2)\)), surge pricing reacts by zones, and cancellations occur based on pickup ETA.

Everything is static **HTML/CSS/JS**. No build step. No backend. No dependencies.

## What you get

- **2D map** (Canvas 2D): drivers + orders + matching “flash” lines.
- **Zones grid**: 3×2, 4×3, 5×4.
- **Demand patterns**: Uniform / Center-heavy / Two-hotspots.
- **Surge** per zone: computed from pending demand vs idle supply, smoothed with EMA.
- **Cancellations**: hazard increases with pickup ETA vs reference ETA0.
- **Metrics**: rolling 60s aggregates and last 120s time-series.
- **Mini charts**: Revenue/min, P90 pickup ETA, Cancel rate, Utilization (last 120 seconds).
- **Seeded RNG**: deterministic and reproducible runs; “Randomize” changes the seed.

## How to run locally

Option A (recommended): use a tiny static server:

```bash
cd simulators/ride-hailing-mvp
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Option B: open the file directly:

- Open `simulators/ride-hailing-mvp/index.html` in a modern browser.

This project avoids ES module imports specifically to work on `file://`.

## Deploy to GitHub Pages

If your repo is already served by GitHub Pages, just commit/push this folder.
The simulator will be available at:

- `/simulators/` → `ride-hailing-mvp/`

## Model assumptions (units + logic)

### Units

- Time: **seconds**
- Distance: **pixels**
- Speed: **px/sec**

### Demand generation

- Orders arrive via a **Poisson process** with rate \( \lambda \) orders/min.
- For each tick \(dt\), we sample \(k \sim \text{Poisson}(\lambda/60 \cdot dt)\) and spawn \(k\) orders.
- Pickup locations are sampled by zone weights (pattern); destinations are sampled with a mild “away from origin” bias.

### Matching (batched)

Runs every `matching batch interval` seconds:

- Consider `waiting` orders.
- Find `K` candidate idle drivers using a **spatial grid** (expanding rings of nearby cells).
- ETA estimate: \( \text{ETA} = \text{distance} / \text{speed} \).
- Pricing: `fare = base + per_km * trip_distance_km`, multiplied by zone surge multiplier.
- Policy:
  - **Nearest ETA**: pick minimum ETA.
  - **Score(ETA,Price)**: maximize `1/ETA + 0.002*price`.

### Movement

Drivers move toward their current target at `driver speed`:

- Arrive pickup: `order= picked`, driver goes to dropoff.
- Arrive dropoff: `order=done`, driver returns to idle; fare split:
  - platform revenue = `take_rate * fare`
  - driver earnings = `(1 - take_rate) * fare`

### Cancellations

For orders in `waiting` or `assigned (not picked)`:

- Hazard per second:
  - `hazard = clamp(0, 0.5, cancel_sensitivity * (ETA / ETA0))`
- Cancel probability per tick:
  - `p = 1 - exp(-hazard * dt)`
- If an assigned order cancels before pickup, the driver is freed back to idle (waste).

### Surge (per zone)

Every 1 second, per zone:

- `ratio = pending_orders / max(1, idle_drivers)`
- `raw = surge_strength * (ratio - 1)`
- `surge_zone = clamp(0, surge_cap, raw)`
- Smoothed:
  - `surge = EMA(surge, surge_zone, alpha=0.3)`
- Displayed multiplier is `1 + surge`.

### Metrics

Stored at 1-second resolution with ring buffers for the **last 120 seconds**:

- orders created, cancels, completed trips, GMV, platform revenue, driver earnings
- avg surge multiplier
- avg pickup ETA (from actual assignment→pickup times)
- p90 pickup ETA
- utilization (driver-seconds non-idle / total driver-seconds)

Rolling 60-second metrics are derived from these series.

## Suggested extensions

- Driver acceptance / rejection (price sensitivity).
- Repositioning / rebalancing policy (drivers drift toward high-demand zones).
- Dispatch constraints: max pickup radius, batching across zones, car types.
- More realistic ETA: add congestion map + travel time based on local density.
- Multi-modal (bike/scooter) and pooled rides.
- RL hooks: treat pricing/matching/repositioning as control; export trajectories.

## Files

- `index.html` — layout + canvases
- `styles.css` — UI styling
- `utils.js` — RNG + helpers + ring buffers
- `sim.js` — simulation model
- `render.js` — city rendering + mini charts
- `ui.js` — controls + metrics binding
- `main.js` — bootstrap + loops

