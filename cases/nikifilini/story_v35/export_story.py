#!/usr/bin/env python3
"""Export V3.5 refined premium story slides to JPG (quality 90).

Serves files via local HTTP, then Playwright screenshots each
<section class="slide"> at 1080x1920.
"""
from __future__ import annotations
import http.server, threading
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_EXPORT = _DIR / "export"


def _serve(directory: str):
    handler = http.server.SimpleHTTPRequestHandler
    srv = http.server.HTTPServer(
        ("127.0.0.1", 0),
        lambda *a, **kw: handler(*a, directory=directory, **kw),
    )
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


def main() -> None:
    _EXPORT.mkdir(parents=True, exist_ok=True)
    srv, port = _serve(str(_DIR))
    url = f"http://127.0.0.1:{port}/story.html"
    print(f"Serving → {url}")

    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920})
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(3000)

        slides = page.query_selector_all("section.slide")
        print(f"Found {len(slides)} slides")
        for i, slide in enumerate(slides, 1):
            out = _EXPORT / f"nikifilini_story_v35_{i:02d}.jpg"
            slide.screenshot(path=str(out), type="jpeg", quality=90)
            print(f"  → {out.name}  ({out.stat().st_size // 1024} KB)")

        browser.close()
    srv.shutdown()
    print("Done.")


if __name__ == "__main__":
    main()
