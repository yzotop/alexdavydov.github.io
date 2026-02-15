#!/usr/bin/env python3
"""Build data.json for story v4.3 — slides 1–4."""
from __future__ import annotations
import csv, json, math, statistics
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_CSV = _DIR.parent / "nikifilini_catalog.csv"
_OUT = _DIR / "data.json"


def _pctl(data, p):
    s = sorted(data)
    k = (len(s) - 1) * p / 100.0
    f = int(math.floor(k))
    c = min(f + 1, len(s) - 1)
    return round(s[f] + (k - f) * (s[c] - s[f]))


def _round100(v):
    return round(v / 100) * 100


def main():
    with _CSV.open(encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    prices = [float(r["price_current"]) for r in rows if r.get("price_current")]
    n = len(prices)

    # ── Slide 1: price distribution ──
    cap = _pctl(prices, 99)
    capped = [min(p, cap) for p in prices]
    lo, hi = min(capped), max(capped)
    bins_n = 20
    bw = (hi - lo) / bins_n
    hist = []
    for i in range(bins_n):
        elo = lo + i * bw
        ehi = lo + (i + 1) * bw
        cnt = sum(1 for p in capped if elo <= p < ehi)
        if i == bins_n - 1:
            cnt += sum(1 for p in capped if p == hi)
        hist.append({"bin_lo": round(elo), "bin_hi": round(ehi), "count": cnt})

    under6k = sum(1 for p in prices if p <= 6000)
    over10k = sum(1 for p in prices if p > 10000)
    over20k = sum(1 for p in prices if p > 20000)

    # ── Slide 2: category prices + boxplot ──
    cat_buckets = {"Футболки": [], "Худи": [], "Джинсы": [], "Бомберы": []}
    puhoviki = []
    for r in rows:
        p = float(r["price_current"]) if r.get("price_current") else None
        if p is None:
            continue
        c = r.get("category", "")
        if c in cat_buckets:
            cat_buckets[c].append(p)
        if "ПУХОВИК" in r.get("title", "").upper():
            puhoviki.append(p)

    box_data = []
    medians_rounded = {}
    for cat in ["Футболки", "Худи", "Джинсы", "Бомберы"]:
        pr = sorted(cat_buckets[cat])
        med = statistics.median(pr)
        box_data.append({
            "category": cat, "min": round(min(pr)),
            "p25": _pctl(pr, 25), "median": round(med),
            "p75": _pctl(pr, 75), "max": round(max(pr)),
            "count": len(pr), "accent": "blue",
        })
        medians_rounded[cat] = _round100(med)

    if puhoviki:
        sp = sorted(puhoviki)
        med_p = statistics.median(sp)
        box_data.append({
            "category": "Пуховики", "min": round(min(sp)),
            "p25": _pctl(sp, 25) if len(sp) > 1 else round(sp[0]),
            "median": round(med_p),
            "p75": _pctl(sp, 75) if len(sp) > 1 else round(sp[0]),
            "max": round(max(sp)),
            "count": len(sp), "accent": "red",
        })
        medians_rounded["Пуховики"] = _round100(med_p)

    # ── Slide 3: top-10 most expensive (apparel only, no certificates) ──
    CERT_KEYWORDS = {"СЕРТИФИКАТ", "GIFT CARD", "ЭЛЕКТРОННЫЙ СЕРТИФИКАТ"}
    all_parsed = []
    for r in rows:
        p = float(r["price_current"]) if r.get("price_current") else None
        if p is None:
            continue
        title_upper = r.get("title", "").upper()
        # skip gift-cards / certificates
        if any(kw in title_upper for kw in CERT_KEYWORDS):
            continue
        all_parsed.append({
            "title": r["title"],
            "category": r.get("category", ""),
            "price": round(p),
            "is_puffer": "ПУХОВИК" in title_upper,
            "is_bomber": r.get("category", "") == "Бомберы",
        })

    top10 = sorted(all_parsed, key=lambda x: -x["price"])[:10]
    top10_out = []
    for t in top10:
        label = t["title"]
        if len(label) > 36:
            label = label[:35].rstrip() + "…"
        top10_out.append({
            "label": label,
            "price": t["price"],
            "accent": "red" if t["is_puffer"] else ("amber" if t["is_bomber"] else "default"),
        })

    max_apparel = top10[0]["price"] if top10 else 0
    puf_in_top10 = sum(1 for t in top10 if t["is_puffer"])
    bomber_in_top10 = sum(1 for t in top10 if t["is_bomber"])
    pct_over_20k = round(over20k / n * 100, 1)

    # ── Slide 4: price segments ──
    seg_bounds = [
        ("< 1 000", 0, 1000),
        ("1–3 тыс", 1000, 3000),
        ("3–6 тыс", 3000, 6000),
        ("6–10 тыс", 6000, 10000),
        ("10–20 тыс", 10000, 20000),
        ("> 20 000", 20000, float("inf")),
    ]
    segments = []
    for label, lo_b, hi_b in seg_bounds:
        cnt = sum(1 for p in prices if lo_b <= p < hi_b)
        if hi_b == float("inf"):
            cnt = sum(1 for p in prices if p >= lo_b)
        pct = round(cnt / n * 100, 1)
        is_mass = lo_b < 10000
        segments.append({
            "label": label,
            "count": cnt,
            "pct": pct,
            "accent": "blue" if is_mass else "red",
        })

    # discount stats
    discounts = []
    for r in rows:
        pc = float(r["price_current"]) if r.get("price_current") else None
        po = float(r["price_old"]) if r.get("price_old") and float(r.get("price_old", 0)) > 0 else None
        if pc and po and po > pc:
            discounts.append(round((1 - pc / po) * 100, 1))
    disc_share = round(len(discounts) / n * 100) if n else 0
    disc_median = round(statistics.median(discounts)) if discounts else 0

    data = {
        # slide 1
        "n": n,
        "median": round(statistics.median(prices)),
        "mean": round(statistics.mean(prices)),
        "p25": _pctl(prices, 25),
        "p75": _pctl(prices, 75),
        "p95": _pctl(prices, 95),
        "p99": cap,
        "max_price": round(max(prices)),
        "pct_under_6k": round(under6k / n * 100),
        "pct_over_10k": round(over10k / n * 100),
        "over_20k_count": over20k,
        "pct_over_20k": pct_over_20k,
        "histogram": hist,
        # slide 2
        "box_data": box_data,
        "medians_rounded": medians_rounded,
        # slide 3
        "max_apparel": max_apparel,
        "top10_expensive": top10_out,
        "top10_puffers": puf_in_top10,
        "top10_bombers": bomber_in_top10,
        # slide 4
        "price_segments": segments,
        "discount_share": disc_share,
        "discount_median": disc_median,
    }

    _OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved data.json  (n={n}, median={data['median']}, cap_p99={cap})")
    for cat, val in medians_rounded.items():
        print(f"  {cat}: ~{val} ₽")
    print(f"  Top-10: {puf_in_top10} puffers, {bomber_in_top10} bombers")


if __name__ == "__main__":
    main()
