#!/usr/bin/env python3
"""Build story_summary.json for NIKIFILINI Telegram story pack (V2).

Reads ``cases/nikifilini/nikifilini_catalog.csv`` and produces a compact
``story_summary.json`` optimised for 5 vertical story slides.
"""

from __future__ import annotations

import csv
import json
import math
import statistics
from pathlib import Path
from typing import Any

_DIR = Path(__file__).resolve().parent
_CSV = _DIR.parent / "nikifilini_catalog.csv"
_OUT = _DIR / "story_summary.json"


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


def _trunc(text: str, limit: int = 45) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def load() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with _CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            pc = r.get("price_current", "")
            po = r.get("price_old", "")
            price = float(pc) if pc else None
            old = float(po) if po else None
            disc = round((1 - price / old) * 100, 1) if price and old and old > price else None
            rows.append({
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
            })
    return rows


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(rows)
    prices = [r["price_current"] for r in rows if r["price_current"] is not None]
    med_price = round(statistics.median(prices)) if prices else 0
    has_discount = [r for r in rows if r["discount_pct"] is not None]
    oos = [r for r in rows if not r["in_stock"]]

    cats = sorted(set(r["category"] for r in rows))
    kpis = {
        "sku_total": n,
        "categories_count": len(cats),
        "median_price": med_price,
        "share_discounted": _pct(len(has_discount), n),
        "share_oos": _pct(len(oos), n),
    }

    # top expensive in-stock
    pool = [r for r in rows if r["in_stock"] and r["price_current"] is not None]
    if not pool:
        pool = [r for r in rows if r["price_current"] is not None]
    top_exp = sorted(pool, key=lambda r: -(r["price_current"] or 0))[:3]
    top_expensive = [{"title": _trunc(r["title"]), "price": round(r["price_current"]) if r["price_current"] else None, "category": r["category"]} for r in top_exp]

    # top discount
    if has_discount:
        top_d = sorted(has_discount, key=lambda r: -(r["discount_pct"] or 0))[:3]
        top_discount = [{"title": _trunc(r["title"]), "price": round(r["price_current"]) if r["price_current"] else None, "price_old": round(r["price_old"]) if r["price_old"] else None, "discount_pct": r["discount_pct"]} for r in top_d]
    else:
        top_discount = []

    # category mix
    cc: dict[str, int] = {}
    for r in rows:
        cc[r["category"]] = cc.get(r["category"], 0) + 1
    category_mix = [{"category": cat, "count": cnt, "share": _pct(cnt, n)} for cat, cnt in sorted(cc.items(), key=lambda x: -x[1])[:10]]

    # price histogram
    cap = round(_percentile(prices, 99)) if prices else 0
    capped = [min(p, cap) for p in prices]
    bins_n = 20
    lo, hi = (min(capped), max(capped)) if capped else (0, 1)
    if hi <= lo:
        hi = lo + 1
    bw = (hi - lo) / bins_n
    hist_bins = []
    for i in range(bins_n):
        elo = lo + i * bw
        ehi = lo + (i + 1) * bw
        count = sum(1 for p in capped if elo <= p < ehi)
        hist_bins.append({"bin_lo": round(elo), "bin_hi": round(ehi), "count": count})
    hist_bins[-1]["count"] += sum(1 for p in capped if p == hi)

    # stockout by category
    ct: dict[str, int] = {}
    co: dict[str, int] = {}
    for r in rows:
        c = r["category"]
        ct[c] = ct.get(c, 0) + 1
        if not r["in_stock"]:
            co[c] = co.get(c, 0) + 1
    sbc = [{"category": c, "total": ct[c], "oos": co.get(c, 0), "oos_pct": _pct(co.get(c, 0), ct[c])} for c in sorted(ct, key=lambda c: -(co.get(c, 0) / ct[c]) if ct[c] else 0) if co.get(c, 0)][:8]

    # promo anchor
    dv = [r["discount_pct"] for r in has_discount if r["discount_pct"] is not None]
    promo = {"share_with_discount": _pct(len(has_discount), n), "median_discount": round(statistics.median(dv), 1) if dv else None}

    return {
        "kpis": kpis,
        "top_expensive_instock": top_expensive,
        "top_discount": top_discount,
        "category_mix": category_mix,
        "price_hist": {"bins": hist_bins, "cap_price_p99": cap},
        "stockout_by_category": sbc,
        "promo_anchor": promo,
    }


def main() -> None:
    print(f"Reading {_CSV.name}…")
    rows = load()
    print(f"  {len(rows)} rows")
    s = build(rows)
    _OUT.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")
    k = s["kpis"]
    print(f"Saved story_summary.json")
    print(f"  SKU: {k['sku_total']}  Categories: {k['categories_count']}  Median: {k['median_price']} ₽  Discount: {k['share_discounted']}%  OOS: {k['share_oos']}%")


if __name__ == "__main__":
    main()
