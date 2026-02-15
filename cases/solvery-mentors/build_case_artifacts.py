#!/usr/bin/env python3
"""Build derived artifacts for the Solvery Mentors case study.

Reads ``solvery_mentors.csv``, derives a category for each mentor based on
keyword matching against *skills* + *title* + *company*, then outputs:

* ``solvery_mentors_with_category.csv`` — original data + ``derived_category``
* ``summary.json`` — lightweight aggregated data consumed by ``charts.js``

The summary includes marketplace-level metrics (Gini, top-N session share,
cold-start rates), per-category price/session bands, a Lorenz curve for
sessions concentration, and p99-capped scatter data for linear-scale charts.
"""

from __future__ import annotations

import csv
import json
import math
import random
import re
import statistics
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_DIR: Path = Path(__file__).resolve().parent
_INPUT_CSV: Path = _DIR / "solvery_mentors.csv"
_OUTPUT_CSV: Path = _DIR / "solvery_mentors_with_category.csv"
_OUTPUT_JSON: Path = _DIR / "summary.json"

# ---------------------------------------------------------------------------
# Category rules  (priority order — first match wins)
# ---------------------------------------------------------------------------

_CATEGORY_RULES: list[tuple[str, list[str]]] = [
    (
        "Data Science / ML",
        [
            "machine learning",
            "ml",
            "deep learning",
            "pytorch",
            "tensorflow",
            "nlp",
            "cv",
            "llm",
            "data science",
            "datascience",
            "нейросет",
            "статист",
        ],
    ),
    (
        "Analytics / BI",
        [
            "analytics",
            "аналит",
            "bi",
            "tableau",
            "power bi",
            "looker",
            "metabase",
            "superset",
            "a/b",
            "ab test",
            "эксперимент",
            "sql",
            "clickhouse",
            "dwh",
            "etl",
            "dashboard",
            "метрик",
        ],
    ),
    (
        "Product Management",
        [
            "product",
            "pm",
            "product manager",
            "po",
            "roadmap",
            "jtbd",
            "custdev",
            "growth",
            "монетизац",
            "юнит-эконом",
        ],
    ),
    (
        "Backend",
        [
            "backend",
            "бэкенд",
            "python",
            "django",
            "flask",
            "fastapi",
            "java",
            "spring",
            "golang",
            "nodejs",
            "node.js",
            "php",
            "laravel",
            "ruby",
            "rails",
            "c#",
            ".net",
            "microservice",
            "api",
        ],
    ),
    (
        "Frontend",
        [
            "frontend",
            "фронтенд",
            "javascript",
            "typescript",
            "react",
            "vue",
            "angular",
            "html",
            "css",
        ],
    ),
    (
        "Mobile",
        [
            "android",
            "ios",
            "swift",
            "kotlin",
            "react native",
            "flutter",
        ],
    ),
    (
        "DevOps / SRE",
        [
            "devops",
            "sre",
            "kubernetes",
            "k8s",
            "docker",
            "terraform",
            "cicd",
            "ci/cd",
            "aws",
            "gcp",
            "azure",
            "linux",
            "prometheus",
            "grafana",
        ],
    ),
    (
        "Design / UX",
        [
            "design",
            "дизайн",
            "ux",
            "ui",
            "figma",
            "usability",
        ],
    ),
    (
        "QA / Testing",
        [
            "qa",
            "тестирован",
            "autotest",
            "selenium",
            "pytest",
        ],
    ),
    (
        "Security",
        [
            "security",
            "инфобез",
            "pentest",
            "owasp",
        ],
    ),
    (
        "Management / Career",
        [
            "lead",
            "manager",
            "teamlead",
            "тимлид",
            "руковод",
            "управлен",
            "карьер",
            "собесед",
        ],
    ),
    (
        "Marketing",
        [
            "marketing",
            "маркетинг",
            "seo",
            "smm",
            "performance",
            "brand",
        ],
    ),
    (
        "Finance / Legal",
        [
            "finance",
            "финанс",
            "gaap",
            "ifrs",
            "legal",
            "юрист",
        ],
    ),
]

# Pre-compile patterns (word-boundary aware where possible)
_COMPILED_RULES: list[tuple[str, list[re.Pattern[str]]]] = []
for _cat, _keywords in _CATEGORY_RULES:
    _patterns: list[re.Pattern[str]] = []
    for _kw in _keywords:
        # Use word boundary for ASCII keywords, substring match for Cyrillic
        if re.search(r"[а-яё]", _kw, re.IGNORECASE):
            _patterns.append(re.compile(re.escape(_kw), re.IGNORECASE))
        else:
            _patterns.append(
                re.compile(
                    r"(?<![a-zA-Z])" + re.escape(_kw) + r"(?![a-zA-Z])",
                    re.IGNORECASE,
                )
            )
    _COMPILED_RULES.append((_cat, _patterns))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def derive_category(row: dict[str, str]) -> str:
    """Return the first matching category for *row* based on keyword rules."""
    haystack = " ".join(
        [
            row.get("skills", ""),
            row.get("title", ""),
            row.get("company", ""),
        ]
    ).lower()

    for cat, patterns in _COMPILED_RULES:
        for pat in patterns:
            if pat.search(haystack):
                return cat
    return "Other"


def _safe_float(value: str) -> float | None:
    """Parse a float from *value*, returning ``None`` on failure."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _percentile(data: list[float], pct: float) -> float:
    """Return the *pct*-th percentile of sorted *data* (0-100 scale)."""
    if not data:
        return 0.0
    data_sorted = sorted(data)
    k = (pct / 100.0) * (len(data_sorted) - 1)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data_sorted[f]
    return data_sorted[f] * (c - k) + data_sorted[c] * (k - f)


def _distribution_stats(values: list[float]) -> dict[str, float]:
    """Return min, p25, median, p75, max, mean for a list of floats."""
    if not values:
        return {"min": 0, "p25": 0, "median": 0, "p75": 0, "max": 0, "mean": 0}
    return {
        "min": round(min(values), 1),
        "p25": round(_percentile(values, 25), 1),
        "median": round(statistics.median(values), 1),
        "p75": round(_percentile(values, 75), 1),
        "max": round(max(values), 1),
        "mean": round(statistics.mean(values), 1),
    }


def _gini(values: list[float]) -> float:
    """Compute the Gini coefficient for a list of non-negative values."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    total = sum(sorted_vals)
    if total == 0:
        return 0.0
    cum = 0.0
    weighted_sum = 0.0
    for i, v in enumerate(sorted_vals):
        cum += v
        weighted_sum += (2 * (i + 1) - n - 1) * v
    return weighted_sum / (n * total)


def _lorenz_curve(values: list[float], n_points: int = 101) -> list[dict[str, float]]:
    """Return *n_points* Lorenz curve points [{x, y}] for *values*.

    x = cumulative share of population (0..1),
    y = cumulative share of total (0..1).
    """
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    total = sum(sorted_vals)
    if total == 0 or n == 0:
        return [{"x": i / (n_points - 1), "y": 0.0} for i in range(n_points)]

    points: list[dict[str, float]] = []
    for step in range(n_points):
        x = step / (n_points - 1)
        # number of observations at this quantile
        idx = min(int(x * n), n)
        cum_share = sum(sorted_vals[:idx]) / total
        points.append({"x": round(x, 4), "y": round(cum_share, 4)})
    return points


def _top_share(sorted_desc: list[float], total: float, pct: float) -> float:
    """Share of *total* held by the top *pct* fraction of sorted-desc values."""
    if total == 0:
        return 0.0
    k = max(1, math.ceil(len(sorted_desc) * pct))
    return round(sum(sorted_desc[:k]) / total, 4)


def _build_histogram(values: list[float], n_bins: int = 30, cap_pct: float = 99) -> dict[str, Any]:
    """Build a linear-scale histogram dict with p99 capping.

    Returns ``{"bin_edges": [...], "counts": [...], "cap_p99": float}``.
    """
    if not values:
        return {"bin_edges": [], "counts": [], "cap_p99": 0.0}
    cap = _percentile(values, cap_pct)
    capped = [min(v, cap) for v in values]
    lo, hi = min(capped), max(capped)
    if hi == lo:
        hi = lo + 1.0
    step = (hi - lo) / n_bins
    bin_edges = [round(lo + step * i, 2) for i in range(n_bins + 1)]
    counts = [0] * n_bins
    for v in capped:
        idx = min(int((v - lo) / step), n_bins - 1)
        counts[idx] += 1
    return {"bin_edges": bin_edges, "counts": counts, "cap_p99": round(cap, 1)}


_MIN_CORR_PAIRS: int = 2


def _correlation(a: list[float], b: list[float]) -> float:
    """Pearson correlation between *a* and *b* (same length, drop NaN pairs)."""
    pairs = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]  # noqa: B905
    n = len(pairs)
    if n < _MIN_CORR_PAIRS:
        return 0.0
    ma = sum(x for x, _ in pairs) / n
    mb = sum(y for _, y in pairs) / n
    cov = sum((x - ma) * (y - mb) for x, y in pairs)
    sa = math.sqrt(sum((x - ma) ** 2 for x, _ in pairs))
    sb = math.sqrt(sum((y - mb) ** 2 for _, y in pairs))
    if sa == 0 or sb == 0:
        return 0.0
    return cov / (sa * sb)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def build() -> None:  # noqa: PLR0912, PLR0915
    """Read CSV, derive categories, write outputs."""
    # --- Read ---
    rows: list[dict[str, str]] = []
    with _INPUT_CSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    n = len(rows)
    print(f"Прочитано {n} менторов из {_INPUT_CSV.name}")

    # --- Derive categories ---
    for row in rows:
        row["derived_category"] = derive_category(row)

    # --- Category counts ---
    cat_counts: dict[str, int] = {}
    for row in rows:
        cat = row["derived_category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    categories_sorted = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)

    print(f"\nРаспределение по категориям ({len(cat_counts)} категорий):")
    for cat, cnt in categories_sorted:
        print(f"  {cat:25s}  {cnt:4d}  ({cnt / n * 100:5.1f}%)")

    # --- Write CSV ---
    fieldnames = list(rows[0].keys())
    with _OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nЗаписан {_OUTPUT_CSV.name}  ({n} строк)")

    # --- Numeric vectors ---
    prices = [v for r in rows if (v := _safe_float(r.get("price", ""))) is not None]
    sessions = [v for r in rows if (v := _safe_float(r.get("sessions_count", ""))) is not None]
    reviews = [v for r in rows if (v := _safe_float(r.get("reviews_count", ""))) is not None]

    # --- Marketplace metrics ---
    sessions_desc = sorted(sessions, reverse=True)
    total_sessions = sum(sessions)

    top_1 = _top_share(sessions_desc, total_sessions, 0.01)
    top_5 = _top_share(sessions_desc, total_sessions, 0.05)
    top_10 = _top_share(sessions_desc, total_sessions, 0.10)
    gini = round(_gini(sessions), 4)

    zero_reviews = sum(1 for v in reviews if v == 0)
    zero_sessions = sum(1 for v in sessions if v == 0)
    leq1_sessions = sum(1 for v in sessions if v <= 1)
    has_review = sum(1 for v in reviews if v >= 1)

    p25_price = _percentile(prices, 25)
    p75_price = _percentile(prices, 75)
    price_disp = round(p75_price / p25_price, 3) if p25_price > 0 else 0.0

    marketplace_metrics: dict[str, Any] = {
        "sessions_top_share": {
            "top_1_pct": top_1,
            "top_5_pct": top_5,
            "top_10_pct": top_10,
        },
        "sessions_gini": gini,
        "cold_start": {
            "zero_reviews_pct": round(zero_reviews / max(len(reviews), 1), 4),
            "zero_sessions_pct": round(zero_sessions / max(len(sessions), 1), 4),
            "leq1_sessions_pct": round(leq1_sessions / max(len(sessions), 1), 4),
        },
        "reviews_coverage_pct": round(has_review / max(len(reviews), 1), 4),
        "price_dispersion_p75_p25": price_disp,
    }

    print("\nМетрики маркетплейса:")
    print(f"  Gini сессий:            {gini:.4f}")
    print(f"  Топ-1% доля:            {top_1:.1%}")
    print(f"  Топ-5% доля:            {top_5:.1%}")
    print(f"  Топ-10% доля:           {top_10:.1%}")
    print(f"  Холодный старт (0 отз): {zero_reviews / max(len(reviews), 1):.1%}")
    print(f"  Холодный старт (0 сес): {zero_sessions / max(len(sessions), 1):.1%}")
    print(f"  Покрытие отзывами:      {has_review / max(len(reviews), 1):.1%}")
    print(f"  Ценовой разброс p75/p25:{price_disp:.2f}")

    # --- Category tables (price + sessions per category) ---
    cat_prices: dict[str, list[float]] = {}
    cat_sessions: dict[str, list[float]] = {}
    cat_reviews: dict[str, list[float]] = {}
    for r in rows:
        cat = r["derived_category"]
        p = _safe_float(r.get("price", ""))
        s = _safe_float(r.get("sessions_count", ""))
        rv = _safe_float(r.get("reviews_count", ""))
        if p is not None:
            cat_prices.setdefault(cat, []).append(p)
        if s is not None:
            cat_sessions.setdefault(cat, []).append(s)
        if rv is not None:
            cat_reviews.setdefault(cat, []).append(rv)

    category_price_table: list[dict[str, Any]] = []
    category_sessions_table: list[dict[str, Any]] = []
    cold_start_by_cat: list[dict[str, Any]] = []

    for cat, _cnt in categories_sorted:
        cp = cat_prices.get(cat, [])
        cs = cat_sessions.get(cat, [])
        cr = cat_reviews.get(cat, [])
        if cp:
            category_price_table.append(
                {
                    "category": cat,
                    "median": round(statistics.median(cp), 1),
                    "p25": round(_percentile(cp, 25), 1),
                    "p75": round(_percentile(cp, 75), 1),
                    "n": len(cp),
                }
            )
        if cs:
            category_sessions_table.append(
                {
                    "category": cat,
                    "median": round(statistics.median(cs), 1),
                    "p25": round(_percentile(cs, 25), 1),
                    "p75": round(_percentile(cs, 75), 1),
                    "n": len(cs),
                }
            )
        if cr:
            zero_rev_in_cat = sum(1 for v in cr if v == 0)
            cold_start_by_cat.append(
                {
                    "category": cat,
                    "zero_reviews_pct": round(zero_rev_in_cat / len(cr), 4),
                    "n": len(cr),
                }
            )

    # Sort price by median desc, sessions by median desc, cold start by pct desc
    category_price_table.sort(key=lambda x: x["median"], reverse=True)
    category_sessions_table.sort(key=lambda x: x["median"], reverse=True)
    cold_start_by_cat.sort(key=lambda x: x["zero_reviews_pct"], reverse=True)

    # --- Category marketplace (demand vs supply) ---
    total_mentors = n
    category_marketplace: list[dict[str, Any]] = []
    for cat, cnt in categories_sorted:
        cs = cat_sessions.get(cat, [])
        mentors_share = cnt / max(total_mentors, 1)
        sess_sum = sum(cs)
        sess_share = sess_sum / max(total_sessions, 1)
        ds_ratio = round(sess_share / mentors_share, 4) if mentors_share > 0 else 0.0
        liq_median = round(statistics.median(cs), 1) if cs else 0.0
        liq_p75 = round(_percentile(cs, 75), 1) if cs else 0.0
        category_marketplace.append(
            {
                "category": cat,
                "mentors_count": cnt,
                "mentors_share": round(mentors_share, 4),
                "sessions_sum": round(sess_sum, 1),
                "sessions_share": round(sess_share, 4),
                "demand_supply_ratio": ds_ratio,
                "liquidity_median_sessions": liq_median,
                "liquidity_p75_sessions": liq_p75,
            }
        )
    category_marketplace.sort(key=lambda x: x["demand_supply_ratio"], reverse=True)

    print("\nСпрос / предложение по категориям (топ-5):")
    for row in category_marketplace[:5]:
        print(
            f"  {row['category']:25s}  D/S={row['demand_supply_ratio']:.2f}"
            f"  спрос={row['sessions_share']:.1%}  предл.={row['mentors_share']:.1%}"
        )

    # --- Core vs Long Tail segmentation ---
    # Sort all mentors by sessions_count desc
    mentor_sessions: list[tuple[dict[str, str], float]] = []
    for r in rows:
        s_val = _safe_float(r.get("sessions_count", ""))
        mentor_sessions.append((r, s_val if s_val is not None else 0.0))
    mentor_sessions.sort(key=lambda x: x[1], reverse=True)

    n_core = max(1, math.ceil(n * 0.05))
    n_mid = max(1, math.ceil(n * 0.25))

    seg_core = mentor_sessions[:n_core]
    seg_mid = mentor_sessions[n_core : n_core + n_mid]
    seg_tail = mentor_sessions[n_core + n_mid :]

    def _segment_stats(
        seg: list[tuple[dict[str, str], float]],
    ) -> dict[str, Any]:
        seg_sess = [s for _, s in seg]
        seg_prices = [v for r, _ in seg if (v := _safe_float(r.get("price", ""))) is not None]
        seg_revs = [_safe_float(r.get("reviews_count", "")) or 0.0 for r, _ in seg]
        return {
            "mentors_count": len(seg),
            "mentors_share": round(len(seg) / max(n, 1), 4),
            "sessions_share": round(sum(seg_sess) / max(total_sessions, 1), 4),
            "median_price": round(statistics.median(seg_prices), 1) if seg_prices else 0.0,
            "median_sessions": round(statistics.median(seg_sess), 1) if seg_sess else 0.0,
            "median_reviews": round(statistics.median(seg_revs), 1) if seg_revs else 0.0,
        }

    core_top5 = _segment_stats(seg_core)
    mid_next25 = _segment_stats(seg_mid)
    long_tail = _segment_stats(seg_tail)

    # Thresholds: minimum sessions_count in core, minimum in mid
    core_threshold = seg_core[-1][1] if seg_core else 0.0
    mid_threshold = seg_mid[-1][1] if seg_mid else 0.0

    core_segments: dict[str, Any] = {
        "core_top_5_pct": core_top5,
        "mid_next_25_pct": mid_next25,
        "long_tail_rest": long_tail,
        "thresholds": {
            "top5_sessions_cutoff": round(core_threshold, 1),
            "top30_sessions_cutoff": round(mid_threshold, 1),
        },
    }

    print("\nЯдро vs длинный хвост:")
    print(f"  {'Сегмент':20s} {'менторы%':>10s} {'сессии%':>10s}")
    for label, seg_data in [
        ("Ядро (топ-5%)", core_top5),
        ("Средний слой (25%)", mid_next25),
        ("Длинный хвост", long_tail),
    ]:
        print(f"  {label:20s} {seg_data['mentors_share']:>9.1%} {seg_data['sessions_share']:>9.1%}")

    # --- Lorenz curve ---
    lorenz_points = _lorenz_curve(sessions, 101)

    # --- Top tables ---
    def _mentor_summary(r: dict[str, str]) -> dict[str, Any]:
        return {
            "name": r.get("name", ""),
            "price": _safe_float(r.get("price", "")) or 0,
            "sessions_count": _safe_float(r.get("sessions_count", "")) or 0,
            "reviews_count": _safe_float(r.get("reviews_count", "")) or 0,
            "profile_url": r.get("profile_url", ""),
            "derived_category": r.get("derived_category", ""),
        }

    top_n = 20
    by_sessions = sorted(
        rows,
        key=lambda r: _safe_float(r.get("sessions_count", "")) or 0,
        reverse=True,
    )
    by_reviews = sorted(
        rows,
        key=lambda r: _safe_float(r.get("reviews_count", "")) or 0,
        reverse=True,
    )

    # --- Scatter points (up to 2000 with p99 caps) ---
    max_scatter = 2000
    scatter_rows = rows
    if len(rows) > max_scatter:
        rng = random.Random(42)  # noqa: S311
        scatter_rows = rng.sample(rows, max_scatter)

    price_cap_p99 = round(_percentile(prices, 99), 1) if prices else 0
    sessions_cap_p99 = round(_percentile(sessions, 99), 1) if sessions else 0

    scatter_points: list[dict[str, Any]] = []
    for r in scatter_rows:
        p = _safe_float(r.get("price", ""))
        s = _safe_float(r.get("sessions_count", ""))
        rv = _safe_float(r.get("reviews_count", ""))
        if p is not None and s is not None:
            scatter_points.append(
                {
                    "price": round(p, 1),
                    "sessions": round(s, 1),
                    "reviews": round(rv, 1) if rv is not None else 0,
                    "category": r.get("derived_category", "Other"),
                }
            )

    # --- Histograms (p99-capped, linear bins) ---
    price_hist = _build_histogram(prices, n_bins=30, cap_pct=99)
    # sessions: NaN → 0 for histogram (include all mentors)
    sessions_for_hist = [_safe_float(r.get("sessions_count", "")) or 0.0 for r in rows]
    sessions_hist = _build_histogram(sessions_for_hist, n_bins=30, cap_pct=99)

    # --- Correlation matrix (price, sessions, reviews) ---
    # Build aligned vectors: only rows where all three are present
    aligned_p: list[float] = []
    aligned_s: list[float] = []
    aligned_r: list[float] = []
    for r in rows:
        pv = _safe_float(r.get("price", ""))
        sv = _safe_float(r.get("sessions_count", ""))
        rv = _safe_float(r.get("reviews_count", ""))
        if pv is not None and sv is not None and rv is not None:
            aligned_p.append(pv)
            aligned_s.append(sv)
            aligned_r.append(rv)

    corr_matrix: list[list[float]] = [
        [1.0, _correlation(aligned_p, aligned_s), _correlation(aligned_p, aligned_r)],
        [_correlation(aligned_s, aligned_p), 1.0, _correlation(aligned_s, aligned_r)],
        [_correlation(aligned_r, aligned_p), _correlation(aligned_r, aligned_s), 1.0],
    ]

    # --- Affordable active table: top 10 cheapest with sessions_count > threshold ---
    _affordable_min_sessions = 200
    affordable_active: list[dict[str, Any]] = []
    for r in rows:
        s_val = _safe_float(r.get("sessions_count", ""))
        p_val = _safe_float(r.get("price", ""))
        if s_val is not None and s_val > _affordable_min_sessions and p_val is not None:
            slug = r.get("slug", "")
            affordable_active.append(
                {
                    "name": r.get("name", ""),
                    "slug": slug,
                    "profile_url": f"https://solvery.io/ru/mentor/{slug}" if slug else "",
                    "derived_category": r.get("derived_category", ""),
                    "price": round(p_val, 1),
                    "sessions_count": round(s_val, 1),
                    "reviews_count": round(_safe_float(r.get("reviews_count", "")) or 0, 1),
                }
            )
    affordable_active.sort(key=lambda x: x["price"])
    affordable_active = affordable_active[:10]

    # --- Assemble summary ---
    summary: dict[str, Any] = {
        "counts": {
            "mentors_total": n,
            "categories": [{"category": cat, "mentors": cnt} for cat, cnt in categories_sorted],
        },
        "price": _distribution_stats(prices),
        "sessions": _distribution_stats(sessions),
        "marketplace_metrics": marketplace_metrics,
        "category_tables": {
            "category_counts": [
                {"category": cat, "mentors": cnt} for cat, cnt in categories_sorted
            ],
            "category_price": category_price_table,
            "category_sessions": category_sessions_table,
            "cold_start_by_category": cold_start_by_cat,
        },
        "category_marketplace": category_marketplace,
        "core_segments": core_segments,
        "lorenz": {
            "sessions_lorenz_points": lorenz_points,
        },
        "charts_data": {
            "scatter_price_sessions": {
                "points": scatter_points,
                "caps": {
                    "price_cap_p99": price_cap_p99,
                    "sessions_cap_p99": sessions_cap_p99,
                },
            },
            "distributions": {
                "price_hist": price_hist,
                "sessions_hist": sessions_hist,
            },
            "correlation_heatmap": {
                "labels": ["Цена", "Сессии", "Отзывы"],
                "matrix": corr_matrix,
            },
        },
        "top_tables": {
            "top_sessions": [_mentor_summary(r) for r in by_sessions[:top_n]],
            "top_reviews": [_mentor_summary(r) for r in by_reviews[:top_n]],
        },
        "tables": {
            "affordable_active": affordable_active,
        },
        # Keep legacy key for backward compat with existing scatter renderer
        "scatter_points_small": [
            {
                "price": pt["price"],
                "sessions_count": pt["sessions"],
                "reviews_count": pt["reviews"],
                "derived_category": pt["category"],
            }
            for pt in scatter_points
        ],
    }

    _OUTPUT_JSON.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\nЗаписан {_OUTPUT_JSON.name}  ({len(scatter_points)} точек scatter)")
    print(f"  Кривая Лоренца: {len(lorenz_points)} точек")
    print(f"  Price cap p99: {price_cap_p99}")
    print(f"  Sessions cap p99: {sessions_cap_p99}")
    print("\nТоп-5 категорий:")
    for cat, cnt in categories_sorted[:5]:
        print(f"  {cat}: {cnt}")


if __name__ == "__main__":
    build()
