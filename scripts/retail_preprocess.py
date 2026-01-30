#!/usr/bin/env python3
"""
Retail Retention & Revenue Lab — local preprocessing for GitHub Pages.

Reads Kaggle dataset "Online Retail II (UCI)" from CSV and outputs processed JSON
variants consumed by the static frontend.

Input (default):
  simulators/retail-retention/data/raw/online_retail_ii.csv

Output:
  simulators/retail-retention/data/processed/variant_<granularity>_ret<0|1>_anon<0|1>.json
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


def _repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


RAW_DEFAULT = os.path.join(
    _repo_root(),
    "simulators",
    "retail-retention",
    "data",
    "raw",
    "online_retail_ii.csv",
)

OUT_DEFAULT = os.path.join(
    _repo_root(),
    "simulators",
    "retail-retention",
    "data",
    "processed",
)


DATE_FORMATS_MONTHFIRST = (
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y %H:%M:%S",
)

DATE_FORMATS_DAYFIRST = (
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y %H:%M:%S",
)

DATE_FORMATS_ISO = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
)


def parse_invoice_date(raw: str) -> Optional[dt.datetime]:
    s = (raw or "").strip()
    if not s:
        return None

    # Heuristic for dd/mm vs mm/dd when using slashes:
    # if the first token > 12 => day-first; if second token > 12 => month-first; else try both.
    prefer_dayfirst = False
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s+\d{1,2}:\d{2}", s)
    if m:
        a = int(m.group(1))
        b = int(m.group(2))
        if a > 12 and b <= 12:
            prefer_dayfirst = True
        elif b > 12 and a <= 12:
            prefer_dayfirst = False

    formats: Tuple[str, ...]
    if "/" in s:
        formats = (DATE_FORMATS_DAYFIRST + DATE_FORMATS_MONTHFIRST) if prefer_dayfirst else (DATE_FORMATS_MONTHFIRST + DATE_FORMATS_DAYFIRST)
    else:
        formats = ()

    for fmt in formats + DATE_FORMATS_ISO:
        try:
            return dt.datetime.strptime(s, fmt)
        except ValueError:
            pass

    # Last resort
    try:
        return dt.datetime.fromisoformat(s)
    except ValueError:
        return None


def parse_int(raw: str) -> Optional[int]:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def parse_float(raw: str) -> Optional[float]:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalize_customer_id(raw: str) -> Optional[str]:
    s = (raw or "").strip()
    if not s:
        return None
    if s.endswith(".0") and s[:-2].isdigit():
        s = s[:-2]
    return s


def month_key(d: dt.datetime) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def iso_week_key(d: dt.datetime) -> str:
    iso_year, iso_week, _ = d.isocalendar()
    return f"{iso_year:04d}-{iso_week:02d}"


def fmt_int(n: int) -> str:
    return f"{n:,}"


def fmt_pct(r: float) -> str:
    return f"{r * 100:.2f}%"


def fmt_money(x: float) -> str:
    return f"{x:,.2f}"


def percentile(sorted_vals: List[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    if p <= 0:
        return sorted_vals[0]
    if p >= 1:
        return sorted_vals[-1]
    k = (len(sorted_vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    d0 = sorted_vals[f] * (c - k)
    d1 = sorted_vals[c] * (k - f)
    return d0 + d1


def quintile_edges(values: List[float]) -> List[float]:
    vals = sorted(values)
    if not vals:
        return [0.0, 0.0, 0.0, 0.0]
    return [
        vals[int((len(vals) - 1) * 0.2)],
        vals[int((len(vals) - 1) * 0.4)],
        vals[int((len(vals) - 1) * 0.6)],
        vals[int((len(vals) - 1) * 0.8)],
    ]


def score_quintile(value: float, edges: List[float]) -> int:
    s = 1
    for e in edges:
        if value > e:
            s += 1
    return max(1, min(5, s))


@dataclass
class InvoiceAgg:
    invoice: str
    customer_id: Optional[str]
    country: str
    invoice_date: dt.datetime
    revenue: float
    is_return: bool
    line_count: int


@dataclass
class ParseStats:
    raw_rows_seen: int = 0  # rows with invoice+date present (attempted)
    parsed_rows: int = 0  # rows successfully parsed for qty/unit/date
    skipped_bad_numeric: int = 0
    skipped_bad_date: int = 0


@dataclass
class RawStats:
    total_rows: int = 0
    missing_customer_rows: int = 0
    qty_le_0_rows: int = 0
    unitprice_le_0_rows: int = 0
    cancellations_rows: int = 0  # Invoice starts with 'C'
    duplicate_rows: int = 0
    min_date: Optional[dt.datetime] = None
    max_date: Optional[dt.datetime] = None

    def update_date_range(self, d: dt.datetime) -> None:
        if self.min_date is None or d < self.min_date:
            self.min_date = d
        if self.max_date is None or d > self.max_date:
            self.max_date = d


def _stable_row_key_hash(invoice: str, stock_code: str, customer_id: Optional[str], qty: int, unit_price: float) -> int:
    s = f"{invoice}|{stock_code}|{customer_id or ''}|{qty}|{unit_price:.4f}"
    digest = hashlib.blake2b(s.encode("utf-8", errors="replace"), digest_size=8).digest()
    return int.from_bytes(digest, byteorder="big", signed=False)


def read_and_aggregate_invoices(csv_path: str) -> Tuple[Dict[str, InvoiceAgg], RawStats, ParseStats]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(csv_path)

    raw = RawStats()
    parse = ParseStats()
    seen_row_hashes: set[int] = set()
    invoices: Dict[str, InvoiceAgg] = {}

    with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            invoice = (row.get("Invoice") or row.get("InvoiceNo") or "").strip()
            stock_code = (row.get("StockCode") or "").strip()
            qty_raw = (row.get("Quantity") or "").strip()
            date_raw = (row.get("InvoiceDate") or "").strip()
            unit_raw = (row.get("UnitPrice") or row.get("Price") or row.get("Unit Price") or "").strip()
            cust_raw = row.get("CustomerID") or row.get("Customer ID") or ""
            country = (row.get("Country") or "").strip() or "Unknown"

            if not invoice or not date_raw:
                continue

            parse.raw_rows_seen += 1

            qty = parse_int(qty_raw)
            unit_price = parse_float(unit_raw)
            invoice_date = parse_invoice_date(date_raw)

            if qty is None or unit_price is None:
                parse.skipped_bad_numeric += 1
                continue
            if invoice_date is None:
                parse.skipped_bad_date += 1
                continue

            parse.parsed_rows += 1

            customer_id = normalize_customer_id(str(cust_raw))

            raw.total_rows += 1
            raw.update_date_range(invoice_date)
            if customer_id is None:
                raw.missing_customer_rows += 1
            if qty <= 0:
                raw.qty_le_0_rows += 1
            if unit_price <= 0:
                raw.unitprice_le_0_rows += 1
            if invoice.startswith("C"):
                raw.cancellations_rows += 1

            h = _stable_row_key_hash(invoice, stock_code, customer_id, qty, unit_price)
            if h in seen_row_hashes:
                raw.duplicate_rows += 1
            else:
                seen_row_hashes.add(h)

            line_revenue = float(qty) * float(unit_price)
            is_return = invoice.startswith("C") or (qty < 0)

            if invoice in invoices:
                inv = invoices[invoice]
                inv.revenue += line_revenue
                inv.line_count += 1
                inv.is_return = inv.is_return or is_return
                if inv.customer_id is None and customer_id is not None:
                    inv.customer_id = customer_id
                if inv.country == "Unknown" and country != "Unknown":
                    inv.country = country
                if invoice_date > inv.invoice_date:
                    inv.invoice_date = invoice_date
            else:
                invoices[invoice] = InvoiceAgg(
                    invoice=invoice,
                    customer_id=customer_id,
                    country=country,
                    invoice_date=invoice_date,
                    revenue=line_revenue,
                    is_return=is_return,
                    line_count=1,
                )

    return invoices, raw, parse


def build_variant(
    invoices: Dict[str, InvoiceAgg],
    raw: RawStats,
    granularity: str,
    include_returns: bool,
    include_anon: bool,
    max_offsets: int,
) -> Dict[str, Any]:
    if granularity not in ("month", "week"):
        raise ValueError("granularity must be month|week")

    period_fn = month_key if granularity == "month" else iso_week_key

    # customer -> period_key -> (orders, revenue)
    customer_period: Dict[str, Dict[str, List[float]]] = {}
    customer_last_date_any: Dict[str, dt.datetime] = {}
    customer_last_date_pos: Dict[str, dt.datetime] = {}
    country_revenue: Dict[str, float] = {}

    rows_after_filters = 0
    inv_values_pos: List[float] = []

    inv_min: Optional[dt.datetime] = None
    inv_max: Optional[dt.datetime] = None

    for inv_id, inv in invoices.items():
        if (not include_returns) and inv.is_return:
            continue

        if inv.customer_id is None:
            if not include_anon:
                continue
            cust = f"anon:{inv_id}"
        else:
            cust = inv.customer_id

        period = period_fn(inv.invoice_date)
        rows_after_filters += inv.line_count

        inv_min = inv.invoice_date if inv_min is None else min(inv_min, inv.invoice_date)
        inv_max = inv.invoice_date if inv_max is None else max(inv_max, inv.invoice_date)

        cp = customer_period.setdefault(cust, {})
        if period not in cp:
            cp[period] = [0.0, 0.0]
        cp[period][0] += 1.0
        cp[period][1] += inv.revenue

        country_revenue[inv.country] = country_revenue.get(inv.country, 0.0) + inv.revenue
        customer_last_date_any[cust] = max(customer_last_date_any.get(cust, inv.invoice_date), inv.invoice_date)
        if inv.revenue > 0:
            customer_last_date_pos[cust] = max(customer_last_date_pos.get(cust, inv.invoice_date), inv.invoice_date)
            inv_values_pos.append(inv.revenue)

    period_keys = sorted({p for per in customer_period.values() for p in per.keys()})
    if not period_keys:
        raise ValueError(f"Empty dataset after filters for variant: {granularity}, ret={include_returns}, anon={include_anon}")
    period_index = {p: i for i, p in enumerate(period_keys)}

    # Cohort: first period with positive net revenue; fallback to first period with any orders.
    cohort_idx_by_customer: Dict[str, int] = {}
    for cust, per in customer_period.items():
        pos_idxs = [period_index[p] for p, v in per.items() if v[0] > 0 and v[1] > 0]
        if pos_idxs:
            cohort_idx_by_customer[cust] = min(pos_idxs)
        else:
            any_idxs = [period_index[p] for p, v in per.items() if v[0] > 0]
            cohort_idx_by_customer[cust] = min(any_idxs) if any_idxs else 0

    cohorts_used = sorted({idx for idx in cohort_idx_by_customer.values()})
    if not cohorts_used:
        raise ValueError("No cohorts computed (unexpected).")

    max_possible = max(0, (len(period_keys) - 1) - min(cohorts_used))
    horizon = min(max_possible, max(1, int(max_offsets)))
    offsets = list(range(0, horizon + 1))

    cohort_size: Dict[int, int] = {c: 0 for c in cohorts_used}
    ret_counts: Dict[int, List[int]] = {c: [0] * (horizon + 1) for c in cohorts_used}
    rev_sums: Dict[int, List[float]] = {c: [0.0] * (horizon + 1) for c in cohorts_used}
    rev_base: Dict[int, float] = {c: 0.0 for c in cohorts_used}

    for cust, per in customer_period.items():
        cidx = cohort_idx_by_customer[cust]
        cohort_size[cidx] = cohort_size.get(cidx, 0) + 1
        for p, v in per.items():
            pidx = period_index[p]
            off = pidx - cidx
            if off < 0 or off > horizon:
                continue
            orders = int(v[0])
            revenue = float(v[1])
            if orders > 0 and revenue > 0:
                ret_counts[cidx][off] += 1
            rev_sums[cidx][off] += revenue

        cohort_period_key = period_keys[cidx] if cidx < len(period_keys) else None
        if cohort_period_key is not None and cohort_period_key in per:
            rev0 = float(per[cohort_period_key][1])
            if rev0 > 0:
                rev_base[cidx] += rev0

    cohort_labels = [period_keys[i] for i in cohorts_used]

    def pct_counts() -> List[List[float]]:
        out: List[List[float]] = []
        for c in cohorts_used:
            size = cohort_size.get(c, 0)
            row: List[float] = []
            for off in offsets:
                if size <= 0:
                    row.append(0.0)
                else:
                    row.append(round(max(0.0, min(100.0, 100.0 * (ret_counts[c][off] / size))), 1))
            out.append(row)
        return out

    def pct_revenue() -> List[List[float]]:
        out: List[List[float]] = []
        for c in cohorts_used:
            base = rev_base.get(c, 0.0)
            row: List[float] = []
            for off in offsets:
                if base <= 0:
                    row.append(0.0)
                else:
                    row.append(round(max(0.0, min(100.0, 100.0 * (rev_sums[c][off] / base))), 1))
            out.append(row)
        return out

    cohort_matrix = {"cohorts": cohort_labels, "offsets": offsets, "values": pct_counts()}
    revenue_matrix = {"cohorts": cohort_labels, "offsets": offsets, "values": pct_revenue()}

    # RFM segmentation (lightweight, quantiles)
    max_date = inv_max or raw.max_date or dt.datetime(1970, 1, 1)
    recencies: List[float] = []
    freqs: List[float] = []
    monies: List[float] = []

    cust_metrics: Dict[str, Dict[str, float]] = {}
    for cust, per in customer_period.items():
        orders_total = float(sum(int(v[0]) for v in per.values()))
        revenue_total = float(sum(float(v[1]) for v in per.values()))
        last_date = customer_last_date_pos.get(cust) or customer_last_date_any.get(cust) or max_date
        recency_days = float((max_date - last_date).days)
        cust_metrics[cust] = {"orders": orders_total, "revenue": revenue_total, "recency_days": recency_days}
        recencies.append(recency_days)
        freqs.append(orders_total)
        monies.append(revenue_total)

    r_edges = quintile_edges(recencies)
    f_edges = quintile_edges(freqs)
    m_edges = quintile_edges(monies)

    def segment_name(r: int, f: int) -> str:
        if r >= 4 and f >= 4:
            return "Champions"
        if f >= 4 and r >= 2:
            return "Loyal"
        if r >= 4 and f in (2, 3):
            return "Potential Loyalist"
        if r == 5 and f == 1:
            return "New Customers"
        if r == 4 and f == 1:
            return "Promising"
        if r == 3 and f in (2, 3):
            return "Need Attention"
        if r == 2 and f in (1, 2):
            return "About To Sleep"
        if r <= 2 and f >= 3:
            return "At Risk"
        if r == 1 and f >= 4:
            return "Can't Lose"
        if r == 1 and f <= 2:
            return "Lost"
        return "Others"

    seg_customers: Dict[str, int] = {}
    seg_repeaters: Dict[str, int] = {}
    seg_revenue: Dict[str, float] = {}
    seg_orders: Dict[str, float] = {}

    for _, m in cust_metrics.items():
        r_worse = score_quintile(m["recency_days"], r_edges)  # smaller recency => score 1 => invert
        r = 6 - r_worse
        f = score_quintile(m["orders"], f_edges)
        _ = score_quintile(m["revenue"], m_edges)  # mscore not needed for segments map, kept for future
        sname = segment_name(r, f)

        seg_customers[sname] = seg_customers.get(sname, 0) + 1
        seg_repeaters[sname] = seg_repeaters.get(sname, 0) + (1 if m["orders"] >= 2 else 0)
        seg_revenue[sname] = seg_revenue.get(sname, 0.0) + float(m["revenue"])
        seg_orders[sname] = seg_orders.get(sname, 0.0) + float(m["orders"])

    segments: List[Dict[str, Any]] = []
    for sname in seg_customers.keys():
        customers = int(seg_customers[sname])
        repeaters = int(seg_repeaters.get(sname, 0))
        revenue = float(seg_revenue.get(sname, 0.0))
        orders = float(seg_orders.get(sname, 0.0))
        aov = (revenue / orders) if orders > 0 else 0.0
        repeat_rate = (repeaters / customers) if customers > 0 else 0.0
        segments.append(
            {
                "segment": sname,
                "customers": customers,
                "repeaters": repeaters,
                "orders": int(round(orders)),
                "revenue": round(revenue, 2),
                "aov": round(aov, 2),
                "repeat_rate": round(repeat_rate * 100.0, 1),
            }
        )

    segments.sort(key=lambda r: (r["revenue"], r["customers"]), reverse=True)
    segment_bars = [{"label": r["segment"], "value": max(0.0, float(r["revenue"]))} for r in segments[:10]]

    top_countries = sorted(country_revenue.items(), key=lambda kv: kv[1], reverse=True)[:5]
    inv_values_pos.sort()
    p99 = percentile(inv_values_pos, 0.99)

    missing_ratio = (raw.missing_customer_rows / raw.total_rows) if raw.total_rows else 0.0
    qty_le_0_ratio = (raw.qty_le_0_rows / raw.total_rows) if raw.total_rows else 0.0
    unit_le_0_ratio = (raw.unitprice_le_0_rows / raw.total_rows) if raw.total_rows else 0.0
    canc_ratio = (raw.cancellations_rows / raw.total_rows) if raw.total_rows else 0.0
    dup_ratio = (raw.duplicate_rows / raw.total_rows) if raw.total_rows else 0.0

    sanity_checks = [
        {"key": "total_rows", "label": "Total rows", "value": fmt_int(raw.total_rows), "ok": raw.total_rows > 0},
        {
            "key": "rows_after_filters",
            "label": "Rows after filters",
            "value": fmt_int(rows_after_filters),
            "ok": 0 <= rows_after_filters <= raw.total_rows,
        },
        {
            "key": "missing_customerid",
            "label": "Missing CustomerID",
            "value": f"{fmt_int(raw.missing_customer_rows)} ({fmt_pct(missing_ratio)})",
            "ok": True,
        },
        {"key": "qty_le_0", "label": "Quantity ≤ 0", "value": f"{fmt_int(raw.qty_le_0_rows)} ({fmt_pct(qty_le_0_ratio)})", "ok": True},
        {
            "key": "unitprice_le_0",
            "label": "UnitPrice ≤ 0",
            "value": f"{fmt_int(raw.unitprice_le_0_rows)} ({fmt_pct(unit_le_0_ratio)})",
            "ok": True,
        },
        {
            "key": "cancellations",
            "label": "Cancellations (Invoice starts with C)",
            "value": f"{fmt_int(raw.cancellations_rows)} ({fmt_pct(canc_ratio)})",
            "ok": True,
        },
        {"key": "duplicates", "label": "Duplicate rows (row key)", "value": f"{fmt_int(raw.duplicate_rows)} ({fmt_pct(dup_ratio)})", "ok": True},
        {
            "key": "date_range",
            "label": "InvoiceDate range",
            "value": f"{(raw.min_date.date().isoformat() if raw.min_date else '—')} → {(raw.max_date.date().isoformat() if raw.max_date else '—')}",
            "ok": raw.min_date is not None and raw.max_date is not None and raw.min_date <= raw.max_date,
        },
        {
            "key": "top_countries",
            "label": "Top 5 countries by revenue (net)",
            "value": ", ".join([f"{c} ({fmt_money(v)})" for c, v in top_countries]) if top_countries else "—",
            "ok": True,
        },
        {"key": "p99_invoice_value", "label": "p99 invoice value (positive invoices)", "value": fmt_money(p99), "ok": True},
    ]

    return {
        "meta": {
            "dataset": "Online Retail II (UCI)",
            "generated_at": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "variant": {"granularity": granularity, "include_returns": include_returns, "include_anon": include_anon},
            "raw_rows": int(raw.total_rows),
            "rows_after_filters": int(rows_after_filters),
            "date_min": raw.min_date.date().isoformat() if raw.min_date else None,
            "date_max": raw.max_date.date().isoformat() if raw.max_date else None,
            "max_offsets": int(max_offsets),
            "definitions": {
                "returns": "Invoice startswith 'C' OR Quantity < 0 treated as returns/cancellations",
                "retention": "share of cohort customers with >=1 order in offset period (with positive net revenue)",
            },
        },
        "sanity": {"checks": sanity_checks, "top_countries": [{"country": c, "revenue": round(v, 2)} for c, v in top_countries]},
        "cohort_matrix": cohort_matrix,
        "revenue_matrix": revenue_matrix,
        "segments": segments,
        "segment_bars": segment_bars,
    }


def write_json(path: str, data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _default_max_offsets_for(granularity: str) -> int:
    return 12 if granularity == "month" else 16


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Preprocess Online Retail II CSV into JSON variants for the simulator.")
    p.add_argument("--input", default=RAW_DEFAULT, help="Path to raw online_retail_ii.csv")
    p.add_argument("--out", default=OUT_DEFAULT, help="Output directory for processed JSON")
    p.add_argument("--max_offsets", type=int, default=None, help="Cap horizon offsets (default: 12 months / 16 weeks)")
    args = p.parse_args(argv)

    csv_path = os.path.abspath(args.input)
    outdir = os.path.abspath(args.out)

    if not os.path.exists(csv_path):
        print("ERROR: Dataset not found.", file=sys.stderr)
        print(f"Expected CSV at: {csv_path}", file=sys.stderr)
        print("See guide:", file=sys.stderr)
        print("  simulators/retail-retention/DATASET.md", file=sys.stderr)
        return 1

    invoices, raw, parse = read_and_aggregate_invoices(csv_path)

    if raw.total_rows <= 0:
        raise SystemExit("ERROR: raw_rows == 0 after parsing. Check that the CSV has expected columns and non-empty rows.")

    date_ok_ratio = (parse.parsed_rows / parse.raw_rows_seen) if parse.raw_rows_seen else 0.0
    if date_ok_ratio < 0.99:
        print(
            f"WARNING: Only {date_ok_ratio:.3f} of candidate rows were parsed (bad date/numeric rows skipped).",
            file=sys.stderr,
        )
        print(f"  raw_rows_seen={parse.raw_rows_seen:,} parsed_rows={parse.parsed_rows:,} skipped_bad_date={parse.skipped_bad_date:,} skipped_bad_numeric={parse.skipped_bad_numeric:,}", file=sys.stderr)

    if abs(sum(inv.revenue for inv in invoices.values())) <= 0.0:
        raise SystemExit("ERROR: revenue appears to be all zeros after aggregation. Check Quantity/UnitPrice parsing.")

    variants = [(gran, ret, anon) for gran in ("month", "week") for ret in (False, True) for anon in (False, True)]
    written = 0

    for granularity, include_returns, include_anon in variants:
        max_off = int(args.max_offsets) if args.max_offsets is not None else _default_max_offsets_for(granularity)
        data = build_variant(
            invoices=invoices,
            raw=raw,
            granularity=granularity,
            include_returns=include_returns,
            include_anon=include_anon,
            max_offsets=max_off,
        )

        # Strict validation: matrices must be non-empty for every variant
        for k in ("cohort_matrix", "revenue_matrix"):
            m = data.get(k) or {}
            if not (m.get("cohorts") and m.get("offsets") and m.get("values")):
                raise SystemExit(f"ERROR: {k} empty for variant: {granularity}, ret={include_returns}, anon={include_anon}")

        fname = f"variant_{granularity}_ret{1 if include_returns else 0}_anon{1 if include_anon else 0}.json"
        out_path = os.path.join(outdir, fname)
        write_json(out_path, data)
        written += 1

    if written != 8:
        raise SystemExit(f"ERROR: expected 8 variants, wrote {written}")

    print(f"OK: wrote {written} variants into {outdir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

