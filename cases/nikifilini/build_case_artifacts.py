#!/usr/bin/env python3
"""Build summary.json for the NIKIFILINI case study.

Reads ``nikifilini_catalog.csv`` and produces ``summary.json`` consumed
by ``charts.js`` for SVG chart rendering.

Aggregations:
* KPIs: sku_total, categories_total, median_price, p10/p90, discount/oos share
* Charts: price histogram, category counts, category price bands, OOS by category
* Tables: top-20 expensive, top-20 affordable, top-20 discounted
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_DIR: Path = Path(__file__).resolve().parent
_INPUT_CSV: Path = _DIR / "nikifilini_catalog.csv"
_OUTPUT_JSON: Path = _DIR / "summary.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _percentile(data: list[float], p: float) -> float:
    """Simple percentile (nearest-rank)."""
    if not data:
        return 0.0
    data_sorted = sorted(data)
    k = (len(data_sorted) - 1) * (p / 100.0)
    f = int(math.floor(k))
    c = min(f + 1, len(data_sorted) - 1)
    d = k - f
    return data_sorted[f] + d * (data_sorted[c] - data_sorted[f])


def _round2(v: float) -> float:
    return round(v, 2)


# ---------------------------------------------------------------------------
# Load
# ---------------------------------------------------------------------------


def load_csv() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with _INPUT_CSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            # Parse fields
            price = r.get("price_current", "")
            old_price = r.get("price_old", "")
            row: dict[str, Any] = {
                "product_id": r.get("product_id", ""),
                "title": r.get("title", ""),
                "product_url": r.get("product_url", ""),
                "price_current": float(price) if price else None,
                "price_old": float(old_price) if old_price else None,
                "currency": r.get("currency", "RUB"),
                "on_sale": r.get("on_sale", "").lower() == "true",
                "in_stock": r.get("in_stock", "").lower() == "true",
                "category": r.get("category", "Другое"),
                "collection": r.get("collection", ""),
            }
            rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------


def build_kpis(rows: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(rows)
    prices = [r["price_current"] for r in rows if r["price_current"] is not None]
    categories = set(r["category"] for r in rows)
    discount_count = sum(1 for r in rows if r["price_old"] is not None and r["price_current"] is not None)
    oos_count = sum(1 for r in rows if not r["in_stock"])

    return {
        "sku_total": n,
        "categories_total": len(categories),
        "median_price": _round2(statistics.median(prices)) if prices else 0,
        "p10_price": _round2(_percentile(prices, 10)) if prices else 0,
        "p90_price": _round2(_percentile(prices, 90)) if prices else 0,
        "discount_share": _round2(discount_count / n) if n else 0,
        "out_of_stock_share": _round2(oos_count / n) if n else 0,
        "on_sale_count": discount_count,
        "out_of_stock_count": oos_count,
        "price_count": len(prices),
    }


# ---------------------------------------------------------------------------
# Charts data
# ---------------------------------------------------------------------------


def build_price_histogram(rows: list[dict[str, Any]], bins: int = 30) -> dict[str, Any]:
    """Price distribution histogram, capped at p99."""
    prices = sorted(p for r in rows if (p := r["price_current"]) is not None)
    if not prices:
        return {"bins": [], "bin_width": 0, "p99_cap": 0}

    cap = _percentile(prices, 99)
    capped = [min(p, cap) for p in prices]

    lo, hi = min(capped), max(capped)
    if hi <= lo:
        hi = lo + 1
    bw = (hi - lo) / bins

    hist: list[dict[str, Any]] = []
    for i in range(bins):
        edge_lo = lo + i * bw
        edge_hi = lo + (i + 1) * bw
        count = sum(1 for p in capped if edge_lo <= p < edge_hi)
        hist.append({
            "bin_lo": _round2(edge_lo),
            "bin_hi": _round2(edge_hi),
            "count": count,
        })
    # Last bin includes the right edge
    hist[-1]["count"] += sum(1 for p in capped if p == hi)

    return {"bins": hist, "bin_width": _round2(bw), "p99_cap": _round2(cap)}


def build_category_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """SKU count per category, sorted descending."""
    counts: dict[str, int] = {}
    for r in rows:
        cat = r["category"]
        counts[cat] = counts.get(cat, 0) + 1

    total = len(rows)
    result = [
        {"category": cat, "sku_count": cnt, "sku_share": _round2(cnt / total) if total else 0}
        for cat, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]
    return result


def build_category_price_bands(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Median + p25..p75 price per category."""
    by_cat: dict[str, list[float]] = {}
    for r in rows:
        if r["price_current"] is not None:
            cat = r["category"]
            by_cat.setdefault(cat, []).append(r["price_current"])

    result = []
    for cat, prices in sorted(by_cat.items(), key=lambda x: -statistics.median(x[1])):
        if len(prices) < 3:
            continue
        result.append({
            "category": cat,
            "p25": _round2(_percentile(prices, 25)),
            "median": _round2(statistics.median(prices)),
            "p75": _round2(_percentile(prices, 75)),
            "count": len(prices),
        })
    return result


def build_oos_by_category(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Out-of-stock share per category."""
    total: dict[str, int] = {}
    oos: dict[str, int] = {}
    for r in rows:
        cat = r["category"]
        total[cat] = total.get(cat, 0) + 1
        if not r["in_stock"]:
            oos[cat] = oos.get(cat, 0) + 1

    result = []
    for cat in sorted(total.keys(), key=lambda c: -(oos.get(c, 0) / total[c]) if total[c] else 0):
        t = total[cat]
        o = oos.get(cat, 0)
        result.append({
            "category": cat,
            "total": t,
            "out_of_stock": o,
            "oos_share": _round2(o / t) if t else 0,
        })
    return result


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


def _table_row(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": r["title"],
        "product_url": r["product_url"],
        "category": r["category"],
        "price_current": r["price_current"],
        "price_old": r["price_old"],
        "in_stock": r["in_stock"],
        "collection": r["collection"],
    }


def build_tables(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    priced = [r for r in rows if r["price_current"] is not None]

    top_expensive = sorted(priced, key=lambda r: -(r["price_current"] or 0))[:20]
    top_affordable = sorted(priced, key=lambda r: (r["price_current"] or 0))[:20]

    discounted = [
        r for r in rows
        if r["price_old"] is not None
        and r["price_current"] is not None
        and r["price_old"] > r["price_current"]
    ]
    discounted.sort(key=lambda r: -(r["price_old"] - r["price_current"]))  # type: ignore[operator]

    return {
        "top_20_expensive": [_table_row(r) for r in top_expensive],
        "top_20_affordable": [_table_row(r) for r in top_affordable],
        "discounted_top_20": [_table_row(r) for r in discounted[:20]],
    }


# ---------------------------------------------------------------------------
# Collection counts
# ---------------------------------------------------------------------------


def build_collection_counts(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for r in rows:
        col = r.get("collection", "")
        if col:
            counts[col] = counts.get(col, 0) + 1

    return [
        {"collection": col, "count": cnt}
        for col, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    rows = load_csv()
    print(f"Loaded {len(rows)} rows from {_INPUT_CSV.name}")

    summary: dict[str, Any] = {
        "kpis": build_kpis(rows),
        "charts_data": {
            "price_hist": build_price_histogram(rows),
            "category_counts": build_category_counts(rows),
            "category_price_bands": build_category_price_bands(rows),
            "oos_by_category": build_oos_by_category(rows),
            "collection_counts": build_collection_counts(rows),
        },
        "tables": build_tables(rows),
    }

    _OUTPUT_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {_OUTPUT_JSON.name}")

    # Quick summary
    kpis = summary["kpis"]
    print(f"\n  SKU total:      {kpis['sku_total']}")
    print(f"  Categories:     {kpis['categories_total']}")
    print(f"  Median price:   {kpis['median_price']} RUB")
    print(f"  P10–P90:        {kpis['p10_price']}–{kpis['p90_price']} RUB")
    print(f"  Discount share: {kpis['discount_share'] * 100:.1f}%")
    print(f"  OOS share:      {kpis['out_of_stock_share'] * 100:.1f}%")


if __name__ == "__main__":
    main()
