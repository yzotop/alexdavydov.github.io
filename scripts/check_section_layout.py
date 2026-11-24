"""Check the shared frame across menu sections and Workshop entry pages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = "/materials/"
WORKSHOP = "/ai-first/workshop/"
WORKSHOP_ENTRIES = (
    "practicum/",
    "sasha/",
    "inventory/",
    "inventory/comparison/",
    "projects/cookie-cats/",
    "projects/upworthy/",
    "projects/ab-atlas/",
    "projects/cookie-cats/memos.html",
    "recipes/",
    "book/",
)
MEASURE = """heading => {
    const frame = heading.closest(".section-frame");
    if (!frame) throw Error("H1 is outside .section-frame");
    const box = frame.getBoundingClientRect();
    const css = getComputedStyle(frame);
    const h1 = heading.getBoundingClientRect();
    return {
        frameWidth: box.width,
        left: box.left + parseFloat(css.paddingLeft),
        right: box.right - parseFloat(css.paddingRight),
        headingLeft: h1.left,
        headingTop: h1.top,
        fontSize: getComputedStyle(heading).fontSize,
        fontFamily: getComputedStyle(heading).fontFamily,
        overflow: document.documentElement.scrollWidth - innerWidth
    };
}"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def check_pages(browser, origin, width):
    page = browser.new_page(viewport={"width": width, "height": 900})
    page.route("**/*", lambda route: route.continue_()
               if route.request.url.startswith(origin + "/") else route.abort())
    page.goto(origin + REFERENCE)
    paths = page.locator(".nav-links a").evaluate_all(
        "links => links.filter(a => a.origin === location.origin).map(a => a.pathname)"
    )
    if REFERENCE not in paths:
        raise AssertionError("Materials missing from primary navigation")
    def measure(path):
        response = page.goto(origin + path)
        assert response.ok, (path, response.status)
        page.evaluate("document.fonts.ready")
        metrics = page.locator("main h1").evaluate(MEASURE)
        assert metrics["overflow"] == 0, (width, path, metrics)
        return metrics

    reference = measure(REFERENCE)
    for path in paths:
        if path == REFERENCE:
            continue
        metrics = measure(path)
        assert metrics == reference, (width, path, metrics, "expected", reference)

    # Breadcrumbs may push the H1 down. The frame and heading scale stay shared.
    reference.pop("headingTop")
    for suffix in WORKSHOP_ENTRIES:
        path = WORKSHOP + suffix
        metrics = measure(path)
        metrics.pop("headingTop")
        assert metrics == reference, (width, path, metrics, "expected", reference)

    page.close()
    print(f"{width}px: {len(paths)} menu sections and {len(WORKSHOP_ENTRIES)} Workshop entries match {REFERENCE} {reference}")


if __name__ == "__main__":
    handler = partial(QuietHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        browser = pw.chromium.launch()
        try:
            for width in (320, 375, 901, 1280, 1440):
                check_pages(browser, f"http://127.0.0.1:{server.server_port}", width)
        finally:
            browser.close()
            server.shutdown()
