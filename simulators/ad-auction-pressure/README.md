# Ad Auction & Ad Pressure (Live)

A fully client-side, deterministic, time-evolving simulator for **ad auction + ad pressure control + user fatigue**.

It is designed to run as a **static GitHub Pages** project with **no build step** and **no external dependencies**.

## What it simulates

- **User sessions** arriving as a Poisson process (users/sec), each with a planned length and a tolerance for ad fatigue.
- **Ad opportunities** occurring at a fixed cadence (opportunities per user-second).
- **Ad pressure policy** choosing whether to show an ad on each opportunity:
  - **Fixed**: aims for a global target ad rate.
  - **Adaptive**: reduces show probability when fatigue exceeds the user’s tolerance.
  - Both enforce **frequency cap** and **minimum gap** between ads.
- **Auction among bidders**:
  - Each bidder has a stable base CPM (lognormal).
  - Effective bids scale with **user quality** (CTR ratio), which decreases with fatigue.
  - **Floor CPM** can block delivery.
  - **Second-price** payment (winner pays max(floor, 2nd bid)).
- **Fatigue dynamics**:
  - Fatigue **increases** on impressions and **decays** over time.
  - Fatigue reduces CTR and increases early-exit hazard.

## How to run locally

### Option A — Open directly

Open `simulators/ad-auction-pressure/index.html` in your browser.

### Option B — Run a local static server (recommended)

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/simulators/ad-auction-pressure/`

## Controls & outputs

- **Left panel**: traffic, policy, auction, fatigue and display toggles.
- **Center canvas**: live “session stream” visualization:
  - dots move left→right (session progress)
  - color encodes fatigue (low→cyan, high→red)
  - optional trails and impression flashes
  - opportunity ticks (when “Show ad flashes” is enabled): tick = opportunity, ring = impression
  - banner impressions: small rectangles that fade out (~1s), colored by CPM bucket (low/mid/high); occasional CPM label
  - optional top heat strip showing last 60s pressure
- **Right panel**: rolling 60s metrics (updated every 1s) + 4 mini time-series charts (last 120s), including:
  - “Why no impression?” breakdown (Policy vs Floor vs Caps)
  - Split session endings (natural vs early) + rolling avg session time

## Determinism

- The simulation uses a **seeded RNG** (Mulberry32).
- Changing the seed + pressing **Reset** produces the same run again.
- Bidder base CPMs are generated from a **seed-derived sub-RNG**, so they remain stable and reproducible.

## Model assumptions (simplified on purpose)

- One placement, one opportunity cadence, one auction type.
- No pacing/budget constraints, no multi-armed bandits, no learning.
- “Quality” is CTR ratio only (no conversion value).
- Exit hazard is a simple multiplicative function of fatigue relative to tolerance.

## Suggested extensions

- Multiple placements (feed/interstitial/rewarded) with different opportunity cadence and UX impact.
- Pacing and budgets (daily caps, smooth delivery, reach vs frequency).
- Reserve price learning / floor optimization.
- Adaptive controller beyond sigmoid gating (PID controller targeting ad rate and churn simultaneously).
- Cohorts/segments with different tolerance and session lengths (new vs loyal, geo, device).

## Files

- `index.html` — layout & wiring
- `styles.css` — self-contained styling
- `utils.js` — RNG, math helpers, ring buffers, sampling
- `sim.js` — model and metrics aggregation
- `render.js` — main canvas rendering + mini chart rendering
- `ui.js` — controls, metrics binding, chart updates
- `main.js` — bootstrap + fixed-step simulation loop + RAF renderer
