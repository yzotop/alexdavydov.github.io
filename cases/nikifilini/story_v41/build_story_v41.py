#!/usr/bin/env python3
"""Build story_summary_v41.json — "Сколько стоит одеться в NIKIFILINI?"

Reads nikifilini_catalog.csv, computes median prices per category,
finds пуховики inside "Другое", and builds outfit totals.
"""
from __future__ import annotations

import csv
import json
import statistics
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_CSV = _DIR.parent / "nikifilini_catalog.csv"
_OUT = _DIR / "story_summary_v41.json"


def _round100(v: float) -> int:
    return round(v / 100) * 100


def main() -> None:
    print(f"Reading {_CSV.name}…")
    with _CSV.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"  {len(rows)} rows")

    def _prices(subset):
        return [float(r["price_current"]) for r in subset if r.get("price_current")]

    # Category medians
    cats = {"Футболки": [], "Худи": [], "Джинсы": []}
    puhoviki = []
    for r in rows:
        c = r.get("category", "")
        if c in cats:
            cats[c].append(r)
        if "ПУХОВИК" in r.get("title", "").upper():
            puhoviki.append(r)

    medians = {}
    for cat, sub in cats.items():
        p = _prices(sub)
        raw = statistics.median(p) if p else 0
        medians[cat] = {"raw": round(raw), "rounded": _round100(raw), "count": len(sub)}

    # Пуховики
    puh_prices = _prices(puhoviki)
    puh_raw = statistics.median(puh_prices) if puh_prices else 0
    puh_rounded = _round100(puh_raw)

    # Cheapest SKU
    all_prices = _prices(rows)
    cheapest = round(min(all_prices)) if all_prices else 0

    # Totals
    base_total = sum(m["rounded"] for m in medians.values())
    full_total = base_total + puh_rounded

    summary = {
        "cheapest_sku": cheapest,
        "medians": medians,
        "puhovik": {
            "raw": round(puh_raw),
            "rounded": puh_rounded,
            "count": len(puhoviki),
            "titles": [r["title"] for r in puhoviki],
        },
        "base_total": base_total,
        "full_total": full_total,
    }

    _OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {_OUT.name}")
    print(f"  Cheapest: {cheapest} ₽")
    for cat, m in medians.items():
        print(f"  {cat}: {m['rounded']} ₽  (raw {m['raw']}, n={m['count']})")
    print(f"  Пуховик: {puh_rounded} ₽  (raw {round(puh_raw)}, n={len(puhoviki)})")
    print(f"  Base outfit: {base_total} ₽")
    print(f"  Full outfit: {full_total} ₽")


if __name__ == "__main__":
    main()
