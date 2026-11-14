"""Compare the internal primary navigation pages with the materials catalog."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = "/materials/"
MEASURE = """heading => {
    const frame = heading.closest(".section-frame");
    if (!frame) throw Error("H1 is outside .section-frame");
    const box = frame.getBoundingClientRect();
    const css = getComputedStyle(frame);
    const h1 = heading.getBoundingClientRect();
    return {
        left: box.left + parseFloat(css.paddingLeft),
        right: box.right - parseFloat(css.paddingRight),
        headingLeft: h1.left,
        headingTop: h1.top,
        fontSize: getComputedStyle(heading).fontSize,
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
    reference = None
    for path in [REFERENCE, *(p for p in paths if p != REFERENCE)]:
        response = page.goto(origin + path)
        assert response.ok, (path, response.status)
        page.evaluate("document.fonts.ready")
        metrics = page.locator("main h1").evaluate(MEASURE)
        assert metrics["overflow"] == 0, (width, path, metrics)
        if reference is None:
            reference = metrics
        assert metrics == reference, (width, path, metrics, "expected", reference)
    page.close()
    print(f"{width}px: {len(paths)} sections match {REFERENCE} {reference}")


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
