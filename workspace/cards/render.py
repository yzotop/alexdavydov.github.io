#!/usr/bin/env python3
"""
render.py — Playwright-based PNG renderer for LinkedIn carousel cards.

Usage:
    python3 render.py <carousel-dir>

Example:
    python3 render.py monetization-funnel

Steps:
  1. Renders each .card element to card-NN.png in out/ at 2× retina
     resolution (2160×2700 px, 4:5 LinkedIn portrait ratio).
  2. Assembles all PNGs into out/carousel.pdf at 144 DPI.

Requirements:
    pip install playwright Pillow
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

    assemble_pdf(out_dir, total)


def assemble_pdf(out_dir: Path, expected: int) -> None:
    """Assemble card-NN.png files in out_dir into carousel.pdf at 144 DPI."""
    # JpegImagePlugin must be imported explicitly in Pillow 12+ to register
    # the JPEG save handler before the PDF plugin tries to use it.
    from PIL import Image, JpegImagePlugin  # noqa: F401

    pngs = sorted(out_dir.glob("card-*.png"))

    if not pngs:
        print("Warning: no card-*.png found, skipping PDF assembly.", file=sys.stderr)
        return

    if len(pngs) != expected:
        print(
            f"Warning: expected {expected} PNGs, found {len(pngs)}. Assembling anyway.",
            file=sys.stderr,
        )

    print(f"\nAssembling PDF from {len(pngs)} PNG(s)...")

    images = [Image.open(p).convert("RGB") for p in pngs]

    pdf_path = out_dir / "carousel.pdf"
    images[0].save(
        pdf_path,
        save_all=True,
        append_images=images[1:],
        resolution=144.0,
    )

    size_mb = pdf_path.stat().st_size / (1024 * 1024)
    print(f"PDF saved → out/carousel.pdf  ({size_mb:.1f} MB, {len(images)} pages)")


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
