# Model Notes

## Architecture Overview

The simulator demonstrates a two-layer ad monetization system:

1. **Placement Policy Layer**: Decides when and how many ad slots to open
2. **Auction Layer**: For each opened slot, runs an auction to select winner and price

This separation allows exploring how policy decisions (e.g., "open slots only when eCPM > $5") interact with auction mechanics (e.g., second-price vs first-price).

## Policy Layer

### Fixed Policy
- Opens `slots_per_open` slots every `every_n_events` events
- Simple, predictable pattern
- Useful for baseline comparisons

### Threshold Policy
- Opens slots when expected eCPM exceeds `threshold_ecpm`
- Uses current average eCPM or estimates from top bidder
- Opens up to `max_slots` slots
- Balances revenue opportunity with user experience

### Utility Policy
- Maximizes utility = revenue - lambda × annoyance
- `annoyance` is proportional to ad pressure (impressions / time)
- Higher `lambda_annoyance` → more conservative (fewer slots)
- Lower `lambda_annoyance` → more aggressive (more slots)
- Opens up to `max_slots` slots

## Auction Layer

### Scoring Formula

```
score = bid_cpm × pCTR × quality
```

Where:
- `bid_cpm`: Advertiser's bid (CPM)
- `pCTR`: Predicted click-through rate
- `quality`: Advertiser quality multiplier

The winner is the advertiser with the highest score among eligible bidders.

### Eligibility

An advertiser is eligible if:
1. Their format matches the slot format (e.g., banner, video)
2. They have remaining budget (if budgets are enabled in scenario)

### Floor Check

After selecting the winner, we check:
```
if winner.bid_cpm < slot.floor_cpm × floor_multiplier:
    reject (no fill, reason = "below_floor")
```

This prevents low-quality fills even if the winner has the highest score.

## Pricing

### Second Price

The winner pays the second-highest **effective value** converted back to CPM:

```
effective_value = bid_cpm × pCTR × quality
pay_cpm = max(floor, second_best_effective_value / (winner_pCTR × winner_quality))
```

This ensures the winner pays at least the floor, and at most their bid.

### First Price

The winner pays their bid CPM (subject to floor):

```
pay_cpm = max(floor, winner.bid_cpm)
```

### Hybrid

Weighted combination:

```
pay_cpm = max(floor, alpha × first_price + (1 - alpha) × second_price)
```

Where `alpha` is the hybrid parameter (0 = second price, 1 = first price).

## pCTR Prediction

The predicted CTR for an advertiser-slot pair is:

```
pCTR = clamp(
    base_pctr × user_multiplier × slot_multiplier × fatigue_multiplier + noise,
    0,
    1
)
```

Where:
- `base_pctr`: Advertiser's baseline CTR
- `user_multiplier`: User-specific quality (constant = 1.0 in this sim)
- `slot_multiplier`: `slot.viewability` if viewability enabled, else 1.0
- `fatigue_multiplier`: `exp(-fatigue_strength × ad_pressure)`
- `noise`: Random noise in `[-baseline_noise, baseline_noise]`

### Fatigue Model

Fatigue reduces CTR as ad pressure increases:

```
ad_pressure = impressions_so_far / max(1, t)
fatigue_multiplier = exp(-fatigue_strength × ad_pressure)
```

- Higher `fatigue_strength` → stronger fatigue effect
- As pressure increases, CTR decays exponentially
- This creates a trade-off: more slots → more revenue opportunity, but lower CTR per slot

## Impression and Click Realization

After auction and pricing:

1. **Impression**: Realized with probability `slot.viewability` (if viewability enabled) or 1.0
2. **Click**: If impression occurred, click is realized with probability `pCTR` (Bernoulli)

Revenue is only counted for realized impressions:
```
revenue += pay_cpm / 1000  // CPM to revenue per impression
```

## Metrics

### Rolling Metrics

- **Revenue per 100 events**: Sum of revenue in rolling 100-event windows
- **CTR (rolling)**: Clicks / impressions over last 100 events
- **FillRate (rolling)**: Filled slots / opened slots over last 100 events

### Scatter Plot

- **AdPressure vs Revenue**: Binned by 100-event windows
- Shows relationship between ad pressure and revenue generation
- Helps identify optimal pressure levels

## Event Log

Each event records:
- `t`: Event time
- `opened_slots`: Number of slots opened by policy
- `filled_slots`: Number of slots filled by auction
- `winners`: Advertiser names (comma-separated)
- `prices`: Payment CPMs (comma-separated)
- `clicks`: Number of clicks realized
- `reason`: Why slot wasn't filled ("filled", "below_floor", "no_eligible", "not_opened")

## Design Decisions

### Why Two Layers?

Separating policy and auction allows:
- Testing different policy strategies independently
- Understanding how policy affects auction outcomes
- Optimizing each layer separately

### Why Fatigue?

Fatigue models the real-world effect where users become less engaged as they see more ads. This creates a non-linear trade-off between ad pressure and revenue.

### Why Viewability?

Not all impressions are viewable. The simulator models this probabilistically, affecting both CTR prediction and impression realization.

### Why Multiple Pricing Models?

Different pricing models have different incentive properties:
- Second price: Encourages truthful bidding
- First price: Simpler, but may lead to bid shading
- Hybrid: Balances properties of both

## Limitations

This simulator is a simplified model:
- Single slot type per simulation (uses first slot from data)
- No budget constraints by default
- User quality is constant (not modeled as varying)
- No time-of-day or session effects
- Fatigue is global (not per-user)

These simplifications make the model easier to understand while still demonstrating key concepts.
