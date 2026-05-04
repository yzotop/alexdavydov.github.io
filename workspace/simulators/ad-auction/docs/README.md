# Ad Auction Simulator

A static web simulator demonstrating two-layer ad monetization:
1. **Placement Policy** - Decides how many ad slots to open and when
2. **Ad Auction** - Determines which advertiser wins each opened slot and what price is paid

## Running Locally

Simply open `index.html` in a modern web browser. All files are self-contained and work offline.

```bash
# From the project root
open lab/simulators/ad-auction/index.html

# Or use a local server (optional)
cd lab/simulators/ad-auction
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Architecture

The simulator is organized into:

- **`index.html`** - Main UI with control panel and results
- **`assets/`** - UI code (CSS, JavaScript for UI, charts, formatters)
- **`engine/`** - Core simulation logic (models, policies, auctions, pricing)
- **`data/`** - Configuration files (advertisers, slots, scenarios)
- **`docs/`** - Documentation

## Adding Scenarios

Edit `data/scenarios.json` to add new scenarios. Each scenario should have:

```json
{
  "scenario_key": {
    "description": "Human-readable description",
    "policy": {
      "mode": "fixed|threshold|utility",
      // ... mode-specific params
    },
    "auction": {
      "pricing": "second_price|first_price|hybrid",
      "floor_multiplier": 1.0,
      "hybrid_alpha": 0.5  // if pricing is hybrid
    },
    "fatigue": {
      "fatigue_strength": 0.5,
      "baseline_noise": 0.01,
      "viewability_enabled": true
    }
  }
}
```

After adding, refresh the page and select your scenario from the dropdown.

## Policy Modes

### Fixed Policy
Opens slots every N events with a fixed number of slots per open.

### Threshold Policy
Opens slots when expected eCPM exceeds a threshold.

### Utility Policy
Maximizes utility = revenue - lambda × annoyance, where annoyance is related to ad pressure.

## Auction Pricing

- **Second Price**: Winner pays the second-highest effective value (converted to CPM)
- **First Price**: Winner pays their bid CPM
- **Hybrid**: Weighted combination: `alpha × first_price + (1 - alpha) × second_price`

## A/B Comparison

Click "Run A/B Compare" to run two simulations with the same seed but different configurations. The UI shows:
- Delta percentages for all KPIs
- Overlaid charts with Control and Test series
- Toggle to view Control or Test event log

## Metrics

- **Revenue**: Total revenue from filled impressions
- **Impressions**: Total impressions (after viewability check)
- **Clicks**: Total clicks (Bernoulli with pCTR)
- **CTR**: Click-through rate (clicks / impressions)
- **eCPM**: Effective CPM (revenue × 1000 / impressions)
- **FillRate**: Filled slots / opened slots
- **AdPressure**: Impressions / time (average impressions per event)

## See Also

- `docs/model-notes.md` - Detailed model explanation
