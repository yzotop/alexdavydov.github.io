#!/usr/bin/env python3
"""Build story_summary.json for the NIKIFILINI Telegram story pack.

Reads ``cases/nikifilini/nikifilini_catalog.csv``, normalises fields,
and produces a compact ``story_summary.json`` optimised for 5 story slides.
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

_DIR = Path(__file__).resolve().parent
_REPO = _DIR.parent.parent  # alexdavydov.github.io root
_CSV = _REPO / "cases" / "nikifilini" / "nikifilini_catalog.csv"
_OUT = _DIR / "story_summary.json"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _pct(num: int, den: int) -> float:
    return round(num / den * 100, 1) if den else 0.0


def _percentile(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    s = sorted(data)
    k = (len(s) - 1) * p / 100.0
    f = int(math.floor(k))
    c = min(f + 1, len(s) - 1)
    return s[f] + (k - f) * (s[c] - s[f])


def _trunc(text: str, limit: int = 48) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


# ---------------------------------------------------------------------------
# Load + normalise
# ---------------------------------------------------------------------------


def load() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with _CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pc = r.get("price_current", "")
            po = r.get("price_old", "")
            price = float(pc) if pc else None
            old = float(po) if po else None
            disc = round((1 - price / old) * 100, 1) if price and old and old > price else None

            rows.append(
                {
                    "product_id": r.get("product_id", ""),
                    "title": r.get("title", ""),
                    "product_url": r.get("product_url", ""),
                    "price_current": price,
                    "price_old": old,
                    "discount_pct": disc,
                    "in_stock": r.get("in_stock", "").lower() == "true",
                    "on_sale": r.get("on_sale", "").lower() == "true",
                    "category": r.get("category", "Другое"),
                    "collection": r.get("collection", ""),
                    "image_url": r.get("image_url", ""),
                }
            )
    return rows


# ---------------------------------------------------------------------------
# Aggregations
# ---------------------------------------------------------------------------


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(rows)
    prices = [r["price_current"] for r in rows if r["price_current"] is not None]
    med_price = round(statistics.median(prices)) if prices else 0

    has_discount = [r for r in rows if r["discount_pct"] is not None]
    has_stock = any("in_stock" in r for r in rows)
    oos = [r for r in rows if not r["in_stock"]]

    # --- a) KPIs ---
    cats = sorted(set(r["category"] for r in rows))
    kpis: dict[str, Any] = {
        "sku_total": n,
        "categories_count": len(cats),
        "median_price": med_price,
        "share_discounted": _pct(len(has_discount), n),
        "share_oos": _pct(len(oos), n) if has_stock else None,
    }

    # --- b) top_expensive_instock ---
    in_stock = [r for r in rows if r["in_stock"] and r["price_current"] is not None]
    pool = in_stock if in_stock else [r for r in rows if r["price_current"] is not None]
    top_exp = sorted(pool, key=lambda r: -(r["price_current"] or 0))[:3]
    top_expensive_instock = [
        {
            "title": _trunc(r["title"]),
            "price": round(r["price_current"]) if r["price_current"] else None,
            "category": r["category"],
        }
        for r in top_exp
    ]

    # --- c) top_discount ---
    if has_discount:
        top_disc_rows = sorted(has_discount, key=lambda r: -(r["discount_pct"] or 0))[:3]
        top_discount = [
            {
                "title": _trunc(r["title"]),
                "price": round(r["price_current"]) if r["price_current"] else None,
                "price_old": round(r["price_old"]) if r["price_old"] else None,
                "discount_pct": r["discount_pct"],
            }
            for r in top_disc_rows
        ]
    else:
        # fallback: cheapest relative to median
        priced = [r for r in rows if r["price_current"] is not None]
        priced.sort(key=lambda r: r["price_current"] / med_price if med_price else 0)
        top_discount = [
            {
                "title": _trunc(r["title"]),
                "price": round(r["price_current"]) if r["price_current"] else None,
                "price_old": None,
                "discount_pct": None,
                "ratio_to_median": round(r["price_current"] / med_price, 2) if med_price else None,
            }
            for r in priced[:3]
        ]

    # --- d) category_mix ---
    cat_counts: dict[str, int] = {}
    for r in rows:
        cat_counts[r["category"]] = cat_counts.get(r["category"], 0) + 1
    category_mix = [
        {"category": cat, "count": cnt, "share": _pct(cnt, n)}
        for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1])[:10]
    ]

    # --- e) price_hist ---
    cap = round(_percentile(prices, 99)) if prices else 0
    capped = [min(p, cap) for p in prices]
    bins_n = 20
    lo = min(capped) if capped else 0
    hi = max(capped) if capped else 1
    if hi <= lo:
        hi = lo + 1
    bw = (hi - lo) / bins_n
    hist_bins: list[dict[str, Any]] = []
    for i in range(bins_n):
        edge_lo = lo + i * bw
        edge_hi = lo + (i + 1) * bw
        count = sum(1 for p in capped if edge_lo <= p < edge_hi)
        hist_bins.append({"bin_lo": round(edge_lo), "bin_hi": round(edge_hi), "count": count})
    hist_bins[-1]["count"] += sum(1 for p in capped if p == hi)
    price_hist = {"bins": hist_bins, "cap_price_p99": cap}

    # --- f) stockout_by_category ---
    stockout_by_cat: list[dict[str, Any]] = []
    if has_stock:
        cat_total: dict[str, int] = {}
        cat_oos: dict[str, int] = {}
        for r in rows:
            c = r["category"]
            cat_total[c] = cat_total.get(c, 0) + 1
            if not r["in_stock"]:
                cat_oos[c] = cat_oos.get(c, 0) + 1
        for c in sorted(cat_total, key=lambda c: -(cat_oos.get(c, 0) / cat_total[c]) if cat_total[c] else 0):
            t = cat_total[c]
            o = cat_oos.get(c, 0)
            if o > 0:
                stockout_by_cat.append({"category": c, "total": t, "oos": o, "oos_pct": _pct(o, t)})
        stockout_by_cat = stockout_by_cat[:8]

    # --- g) promo_anchor ---
    disc_vals = [r["discount_pct"] for r in has_discount if r["discount_pct"] is not None]
    promo_anchor: dict[str, Any] = {
        "share_with_discount": _pct(len(has_discount), n),
        "median_discount": round(statistics.median(disc_vals), 1) if disc_vals else None,
        "has_discount_data": bool(has_discount),
    }

    return {
        "kpis": kpis,
        "top_expensive_instock": top_expensive_instock,
        "top_discount": top_discount,
        "category_mix": category_mix,
        "price_hist": price_hist,
        "stockout_by_category": stockout_by_cat,
        "promo_anchor": promo_anchor,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print(f"Reading {_CSV.name}…")
    rows = load()
    print(f"  {len(rows)} rows loaded")

    summary = build(rows)
    _OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {_OUT.name}")

    k = summary["kpis"]
    print(f"\n  SKU:            {k['sku_total']}")
    print(f"  Категорий:      {k['categories_count']}")
    print(f"  Медиана цены:   {k['median_price']} ₽")
    print(f"  Со скидкой:     {k['share_discounted']}%")
    if k["share_oos"] is not None:
        print(f"  Stock-out:      {k['share_oos']}%")


if __name__ == "__main__":
    main()
