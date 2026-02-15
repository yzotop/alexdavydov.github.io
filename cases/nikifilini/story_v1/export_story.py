#!/usr/bin/env python3
"""Export NIKIFILINI story slides to PNG (1080×1920) via Playwright.

Starts a local HTTP server (so fetch() works), then screenshots each slide.

Outputs:
    stories/nikifilini-telega/export/01.png … 05.png

Usage:
    python3 export_story.py

Requires: playwright (``pip install playwright && playwright install chromium``)
"""

from __future__ import annotations

import http.server
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

_DIR = Path(__file__).resolve().parent
_EXPORT = _DIR / "export"

_SLIDE_W = 1080
_SLIDE_H = 1920
_NUM_SLIDES = 5
_PORT = 18923


def _start_server() -> http.server.HTTPServer:
    """Start a background HTTP server serving _DIR."""
    handler = type(
        "H",
        (http.server.SimpleHTTPRequestHandler,),
        {"__init__": lambda self, *a, **kw: super(type(self), self).__init__(*a, directory=str(_DIR), **kw)},
    )
    srv = http.server.HTTPServer(("127.0.0.1", _PORT), handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


def main() -> None:
    _EXPORT.mkdir(exist_ok=True)
    srv = _start_server()
    url = f"http://127.0.0.1:{_PORT}/story.html"
    print(f"Serving at :{_PORT}, opening {url}")

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": _SLIDE_W, "height": _SLIDE_H})
            page.goto(url, wait_until="networkidle")

            # Wait for charts_story.js to fetch JSON + render
            time.sleep(3)

            for i in range(1, _NUM_SLIDES + 1):
                selector = f'section[data-slide="{i}"]'
                slide = page.query_selector(selector)
                if slide is None:
                    print(f"  WARN: slide {i} not found")
                    continue

                out_path = _EXPORT / f"{i:02d}.png"
                slide.screenshot(path=str(out_path))
                print(f"  Saved {out_path.name} ({_SLIDE_W}×{_SLIDE_H})")

            browser.close()
    finally:
        srv.shutdown()

    print(f"\nDone — {_NUM_SLIDES} slides in {_EXPORT}/")


if __name__ == "__main__":
    main()
