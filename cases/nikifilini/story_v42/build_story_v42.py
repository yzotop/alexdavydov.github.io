#!/usr/bin/env python3
"""Build story_summary_v42.json — NIKIFILINI pricing story with chart data."""
from __future__ import annotations

import csv, json, math, statistics
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_CSV = _DIR.parent / "nikifilini_catalog.csv"
_OUT = _DIR / "story_summary_v42.json"


def _round100(v: float) -> int:
    return round(v / 100) * 100


def _percentile(data: list[float], p: float) -> float:
    s = sorted(data)
    k = (len(s) - 1) * p / 100.0
    f = int(math.floor(k))
    c = min(f + 1, len(s) - 1)
    return s[f] + (k - f) * (s[c] - s[f])


def main() -> None:
    print(f"Reading {_CSV.name}…")
    with _CSV.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"  {len(rows)} rows")

    def _price(r):
        v = r.get("price_current", "")
        return float(v) if v else None

    priced = [(r, _price(r)) for r in rows if _price(r) is not None]

    # ── Top-10 cheapest ──
    cheapest = sorted(priced, key=lambda x: x[1])[:10]
    top10_cheapest = [{"title": r["title"][:40], "price": round(p)} for r, p in cheapest]

    # ── Category medians ──
    cats = {"Футболки": [], "Худи": [], "Джинсы": []}
    puhoviki = []
    for r, p in priced:
        c = r.get("category", "")
        if c in cats:
            cats[c].append(p)
        if "ПУХОВИК" in r.get("title", "").upper():
            puhoviki.append(p)

    medians = {}
    for cat, prices in cats.items():
        medians[cat] = _round100(statistics.median(prices)) if prices else 0

    puh_median = _round100(statistics.median(puhoviki)) if puhoviki else 0

    base_total = sum(medians.values())
    full_total = base_total + puh_median

    # ── Price histogram (20 bins, p99 cap) ──
    all_prices = [p for _, p in priced]
    cap = round(_percentile(all_prices, 99))
    capped = [min(p, cap) for p in all_prices]
    lo, hi = min(capped), max(capped)
    if hi <= lo:
        hi = lo + 1
    bins_n = 20
    bw = (hi - lo) / bins_n
    hist_bins = []
    for i in range(bins_n):
        elo = lo + i * bw
        ehi = lo + (i + 1) * bw
        count = sum(1 for p in capped if elo <= p < ehi)
        hist_bins.append({"bin_lo": round(elo), "bin_hi": round(ehi), "count": count})
    hist_bins[-1]["count"] += sum(1 for p in capped if p == hi)

    # ── Category price ranges (boxplot data) ──
    box_cats = {"Футболки": [], "Худи": [], "Джинсы": [], "Бомберы": []}
    for r, p in priced:
        c = r.get("category", "")
        if c in box_cats:
            box_cats[c].append(p)

    box_data = []
    for cat in ["Футболки", "Худи", "Джинсы", "Бомберы"]:
        prices = sorted(box_cats[cat])
        if prices:
            box_data.append({
                "category": cat,
                "min": round(min(prices)),
                "p25": round(_percentile(prices, 25)),
                "median": round(statistics.median(prices)),
                "p75": round(_percentile(prices, 75)),
                "max": round(max(prices)),
                "accent": "default",
            })
    # Пуховики
    if puhoviki:
        sp = sorted(puhoviki)
        box_data.append({
            "category": "Пуховики",
            "min": round(min(sp)),
            "p25": round(_percentile(sp, 25)) if len(sp) > 1 else round(sp[0]),
            "median": round(statistics.median(sp)),
            "p75": round(_percentile(sp, 75)) if len(sp) > 1 else round(sp[0]),
            "max": round(max(sp)),
            "accent": "red",
        })

    # ── Comparison bars (slide 4) ──
    compare_bars = [
        {"label": "Минимум", "value": round(min(all_prices))},
        {"label": "База", "value": base_total},
        {"label": "Полный лук", "value": full_total},
    ]

    summary = {
        "cheapest_sku": round(min(all_prices)),
        "median_catalog": round(statistics.median(all_prices)),
        "medians": {cat: val for cat, val in medians.items()},
        "puhovik_median": puh_median,
        "base_total": base_total,
        "full_total": full_total,
        "top10_cheapest": top10_cheapest,
        "price_hist": {"bins": hist_bins, "cap_p99": cap},
        "box_data": box_data,
        "compare_bars": compare_bars,
        "discount_share": 86.6,
        "median_discount": 40.0,
    }

    _OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {_OUT.name}")
    print(f"  Cheapest: {summary['cheapest_sku']} ₽  Median: {summary['median_catalog']} ₽")
    print(f"  Base: {base_total} ₽  Full: {full_total} ₽  Puhovik: {puh_median} ₽")


if __name__ == "__main__":
    main()
