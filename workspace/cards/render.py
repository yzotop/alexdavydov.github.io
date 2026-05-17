#!/usr/bin/env python3
"""
render.py — Playwright-based PNG renderer for LinkedIn carousel cards.

Usage:
    python3 render.py <carousel-dir>

Example:
    python3 render.py monetization-funnel

The script reads cards.html inside the given directory, renders each
.card element to a separate PNG in out/, at 2× retina resolution
(output size: 2160×2700 px).

Requirements:
    pip install playwright
    playwright install chromium
"""

import sys
import os
from pathlib import Path


def render_carousel(carousel_dir: str) -> None:
    from playwright.sync_api import sync_playwright

    script_dir = Path(__file__).parent.resolve()
    carousel_path = script_dir / carousel_dir

    if not carousel_path.is_dir():
        print(f"Error: directory not found: {carousel_path}", file=sys.stderr)
        sys.exit(1)

    cards_html = carousel_path / "cards.html"
    if not cards_html.exists():
        print(f"Error: cards.html not found in {carousel_path}", file=sys.stderr)
        sys.exit(1)

    out_dir = carousel_path / "out"
    out_dir.mkdir(exist_ok=True)

    file_url = f"file://{cards_html.resolve()}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": 1080, "height": 1350},
            device_scale_factor=2,
        )

        print(f"Loading {file_url}")
        page.goto(file_url)

        # Wait for network idle (handles any local resource loading)
        page.wait_for_load_state("networkidle")

        # Wait for all fonts to be loaded and rendered
        # This is critical: without it the first card sometimes falls back
        # to a system font before Playwright captures the screenshot.
        page.evaluate("document.fonts.ready")

        cards = page.query_selector_all(".card")

        if not cards:
            print("Warning: no .card elements found in cards.html", file=sys.stderr)
            browser.close()
            return

        total = len(cards)
        print(f"Found {total} card(s). Rendering...")

        for i, card in enumerate(cards, start=1):
            filename = f"card-{i:02d}.png"
            out_path = out_dir / filename

            # Clip the screenshot to exactly 1080×1350 (before device_scale_factor)
            # card.screenshot() uses the element's bounding box automatically.
            card.screenshot(path=str(out_path))

            print(f"  [{i:02d}/{total:02d}] → out/{filename}")

        browser.close()

    print(f"\nDone. {total} PNG(s) saved to {out_dir}/")
    print(f"Output resolution: 2160×2700 px (2× retina).")


def main() -> None:
    if len(sys.argv) != 2:
        print(
            "Usage: python3 render.py <carousel-dir>\n"
            "Example: python3 render.py monetization-funnel",
            file=sys.stderr,
        )
        sys.exit(1)

    render_carousel(sys.argv[1])


if __name__ == "__main__":
    main()
