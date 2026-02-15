#!/usr/bin/env python3
"""Extract the public NIKIFILINI catalog from nikifilinistore.ru.

Scrapes paginated shop listing pages (/shop/page/N/), parses WooCommerce
HTML product cards, and saves:

* ``nikifilini_catalog_raw.json`` — list of raw dicts per product
* ``nikifilini_catalog.csv``     — normalised flat CSV

Uses HTML-first approach: requests + BeautifulSoup.
Rate-limited: 0.4–1.0 s random sleep between page requests.
"""

from __future__ import annotations

import csv
import hashlib
import html
import json
import random
import re
import time
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup, Tag

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_DIR: Path = Path(__file__).resolve().parent
_BASE_URL = "https://nikifilinistore.ru"
_SHOP_URL = f"{_BASE_URL}/shop/page/{{page}}/"
_SHOP_FIRST = f"{_BASE_URL}/shop/"
_OUTPUT_RAW: Path = _DIR / "nikifilini_catalog_raw.json"
_OUTPUT_CSV: Path = _DIR / "nikifilini_catalog.csv"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

_RETRIES = 3
_BACKOFF = 2.0

# ---------------------------------------------------------------------------
# Category mapping: WooCommerce product_cat-* → human-readable type
# ---------------------------------------------------------------------------

_CAT_MAP: dict[str, str] = {
    "tshirt-unisex": "Футболки",
    "tshirts-men": "Футболки",
    "tshirts-women": "Футболки",
    "hoodie-men": "Худи",
    "hoodie-unisex": "Худи",
    "hoodie-women": "Худи",
    "longsleeves-men": "Лонгсливы",
    "longsleeves-unisex": "Лонгсливы",
    "longsleeves-women": "Лонгсливы",
    "sweatshirt-unisex": "Свитшоты",
    "sweatshirts-men": "Свитшоты",
    "sweatshirts-women": "Свитшоты",
    "jeans-man": "Джинсы",
    "jeans-unisex": "Джинсы",
    "jeans-woman": "Джинсы",
    "bombers": "Бомберы",
    "top-women": "Топы",
}

_COLLECTION_MAP: dict[str, str] = {
    "evangelion": "Evangelion",
    "naruto": "Naruto",
    "chainsaw-man": "Chainsaw Man",
    "berserk-tag": "Berserk",
    "bibop-tag": "Cowboy Bebop",
    "coolteacher": "Cool Teacher",
    "japanesemood": "Japanese Mood",
}


# ---------------------------------------------------------------------------
# Network helpers
# ---------------------------------------------------------------------------


def _fetch(url: str) -> str | None:
    """GET with retries and exponential backoff."""
    for attempt in range(1, _RETRIES + 1):
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=20)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            if attempt == _RETRIES:
                print(f"  FAIL {url}: {exc}")
                return None
            wait = _BACKOFF**attempt + random.random()
            print(f"  retry {attempt}/{_RETRIES} for {url} (wait {wait:.1f}s)")
            time.sleep(wait)
    return None


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def _extract_price(price_span: Tag | None) -> tuple[float | None, float | None]:
    """Return (current_price, old_price) from a WooCommerce price span."""
    if price_span is None:
        return None, None

    old_price: float | None = None
    current_price: float | None = None

    del_tag = price_span.find("del")
    ins_tag = price_span.find("ins")

    if del_tag and ins_tag:
        # Sale price
        old_price = _parse_amount(del_tag)
        current_price = _parse_amount(ins_tag)
    else:
        # Regular price (might be a range for variable products)
        amounts = price_span.find_all("span", class_="woocommerce-Price-amount")
        if amounts:
            current_price = _parse_amount(amounts[0])

    return current_price, old_price


def _parse_amount(tag: Tag) -> float | None:
    """Extract numeric price from a woocommerce-Price-amount tag or parent."""
    bdi = tag.find("bdi")
    text = bdi.get_text(strip=True) if bdi else tag.get_text(strip=True)
    text = text.replace("\xa0", "").replace(" ", "").replace("руб", "").replace("₽", "")
    text = text.replace(",", ".")
    # Remove range markers
    text = text.split("–")[0].strip()
    try:
        return float(text)
    except ValueError:
        return None


def _derive_category(css_classes: list[str]) -> str:
    """Map WooCommerce product_cat-* classes to a product-type category."""
    cats = [c.replace("product_cat-", "") for c in css_classes if c.startswith("product_cat-")]

    for cat_key, label in _CAT_MAP.items():
        if cat_key in cats:
            return label

    # Fallback heuristics
    if "denim" in cats:
        return "Джинсы"
    if "custom" in cats:
        return "Custom"
    if "limited-edition" in cats:
        return "Limited Edition"
    if "stonewashed" in cats:
        return "Stonewashed"

    return "Другое"


def _derive_collection(css_classes: list[str]) -> str:
    """Extract the anime/brand collection tag if any."""
    cats = set(c.replace("product_cat-", "") for c in css_classes if c.startswith("product_cat-"))
    tags = set(c.replace("product_tag-", "") for c in css_classes if c.startswith("product_tag-"))
    all_keys = cats | tags

    for key, label in _COLLECTION_MAP.items():
        if key in all_keys:
            return label

    return ""


def _parse_product(li: Tag) -> dict[str, Any] | None:
    """Parse one <li class="product ..."> into a dict."""
    css_classes = li.get("class", [])
    if "product" not in css_classes:
        return None

    # Product URL + title
    title_link = li.select_one("h2 a, h3 a, .product-title a, .woocommerce-loop-product__link")
    if title_link is None:
        # Try the add-to-cart link
        title_link = li.select_one("a.add_to_cart_button, a[data-product_id]")

    product_url = ""
    title = ""

    # Try getting URL from the first anchor that points to /product/
    for a_tag in li.find_all("a", href=True):
        href = a_tag["href"]
        if "/product/" in href and href != "#":
            product_url = href
            break

    # Title from h2/h3 inside product card
    for heading in li.find_all(["h2", "h3"]):
        txt = heading.get_text(strip=True)
        if txt and len(txt) > 2:
            title = txt
            break

    if not product_url:
        return None

    # Product ID
    atc_link = li.select_one("a[data-product_id]")
    product_id = atc_link["data-product_id"] if atc_link else hashlib.md5(product_url.encode()).hexdigest()[:12]

    # Price
    price_span = li.select_one("span.price")
    price_current, price_old = _extract_price(price_span)

    # Stock
    is_outofstock = "outofstock" in css_classes
    is_on_sale = "sale" in css_classes

    # Category
    category = _derive_category(css_classes)
    collection = _derive_collection(css_classes)

    # Image
    img_tag = li.select_one("img.wp-post-image, img.attachment-woocommerce_thumbnail")
    image_url = ""
    if img_tag:
        image_url = img_tag.get("data-src") or img_tag.get("src") or ""

    return {
        "product_id": str(product_id),
        "title": title,
        "product_url": product_url,
        "price_current": price_current,
        "price_old": price_old,
        "currency": "RUB",
        "on_sale": is_on_sale,
        "in_stock": not is_outofstock,
        "category": category,
        "collection": collection,
        "image_url": image_url,
        "css_classes": " ".join(css_classes),
    }


# ---------------------------------------------------------------------------
# Main extraction loop
# ---------------------------------------------------------------------------


def extract_all() -> list[dict[str, Any]]:
    """Paginate through /shop/page/N/ and collect all products."""
    all_products: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    page = 1
    consecutive_empty = 0

    while True:
        url = _SHOP_FIRST if page == 1 else _SHOP_URL.format(page=page)
        print(f"[page {page:>3}] {url}")

        page_html = _fetch(url)
        if page_html is None:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                print(f"  3 consecutive empty/404 pages — stopping.")
                break
            page += 1
            continue

        soup = BeautifulSoup(page_html, "lxml")
        product_items = soup.select("li.product")

        if not product_items:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                print(f"  3 consecutive empty pages — stopping.")
                break
            page += 1
            continue

        consecutive_empty = 0
        page_count = 0

        for li in product_items:
            rec = _parse_product(li)
            if rec is None:
                continue
            pid = rec["product_id"]
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            all_products.append(rec)
            page_count += 1

        print(f"  → {page_count} new products (total: {len(all_products)})")
        page += 1

        # Rate limit
        time.sleep(0.4 + random.random() * 0.6)

    return all_products


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

_CSV_FIELDS = [
    "product_id",
    "title",
    "product_url",
    "price_current",
    "price_old",
    "currency",
    "on_sale",
    "in_stock",
    "category",
    "collection",
    "image_url",
]


def save(products: list[dict[str, Any]]) -> None:
    """Write raw JSON and normalised CSV."""
    # Raw JSON
    _OUTPUT_RAW.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved {_OUTPUT_RAW.name} ({len(products)} records)")

    # CSV
    with _OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=_CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)
    print(f"Saved {_OUTPUT_CSV.name}")


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------


def report(products: list[dict[str, Any]]) -> None:
    """Print a validation summary."""
    n = len(products)
    if n == 0:
        print("\nNo products extracted.")
        return

    categories = set(p["category"] for p in products)
    missing_price = sum(1 for p in products if p["price_current"] is None)
    out_of_stock = sum(1 for p in products if not p["in_stock"])
    on_sale = sum(1 for p in products if p["on_sale"])

    print("\n" + "=" * 50)
    print("VALIDATION REPORT")
    print("=" * 50)
    print(f"  Total SKU:          {n}")
    print(f"  Categories:         {len(categories)}")
    print(f"  % missing price:    {missing_price / n * 100:.1f}%")
    print(f"  % out-of-stock:     {out_of_stock / n * 100:.1f}%")
    print(f"  % on sale:          {on_sale / n * 100:.1f}%")
    print(f"  Categories:         {', '.join(sorted(categories))}")
    print("=" * 50)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    products = extract_all()
    save(products)
    report(products)
