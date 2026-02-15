#!/usr/bin/env python3
"""Export V2 story slides to PNG using Playwright.

Starts a tiny HTTP server so fetch() works, then screenshots each
<section class="slide"> at 1080x1920 → export/story_01.png … story_05.png.
"""

from __future__ import annotations

import http.server
import threading
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_EXPORT = _DIR / "export"


def _start_server(directory: str, port: int = 0) -> tuple[http.server.HTTPServer, int]:
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.HTTPServer(("127.0.0.1", port), lambda *a, **kw: handler(*a, directory=directory, **kw))
    actual_port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, actual_port


def main() -> None:
    _EXPORT.mkdir(parents=True, exist_ok=True)

    srv, port = _start_server(str(_DIR))
    url = f"http://127.0.0.1:{port}/story.html"
    print(f"Serving at :{port} → {url}")

    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1080, "height": 1920})
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(3000)

        slides = page.query_selector_all("section.slide")
        print(f"Found {len(slides)} slides")
        for i, slide in enumerate(slides, 1):
            out = _EXPORT / f"story_{i:02d}.png"
            slide.screenshot(path=str(out))
            print(f"  → {out.name}  ({out.stat().st_size // 1024} KB)")

        browser.close()
    srv.shutdown()
    print("Done.")


if __name__ == "__main__":
    main()
