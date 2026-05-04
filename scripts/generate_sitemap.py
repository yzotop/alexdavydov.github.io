#!/usr/bin/env python3
"""Build sitemap.xml from assets/search-index.json + hub URLs (canonical: https://davydov.my)."""
from __future__ import annotations

import json
import os
import sys
from xml.sax.saxutils import escape

SITE_ORIGIN = "https://davydov.my"

# Paths not guaranteed to appear in search-index (add when new hubs ship).
EXTRA_PATHS = (
    "/",
    "/approach/",
    "/cases/",
    "/cases/macbook-market/",
    "/workspace/glossary/",
    "/search/",
    "/workspace/simulators/",
    "/workspace/calculators/",
    "/site-map/",
    "/system-map/",
    "/workspace/",
)


def repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def normalize_loc(path: str) -> str:
    if not path.startswith("/"):
        path = "/" + path
    if path.endswith(".html") or path.endswith(".htm"):
        return SITE_ORIGIN + path
    if not path.endswith("/"):
        path = path + "/"
    return SITE_ORIGIN + path


def main() -> int:
    root = repo_root()
    idx_path = os.path.join(root, "assets", "search-index.json")
    out_path = os.path.join(root, "sitemap.xml")

    urls: set[str] = set(EXTRA_PATHS)
    if os.path.isfile(idx_path):
        with open(idx_path, encoding="utf-8") as f:
            data = json.load(f)
        for row in data:
            u = row.get("url")
            if isinstance(u, str) and u.strip():
                urls.add(u.strip())

    locs = sorted({normalize_loc(p) for p in urls})

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc in locs:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc)}</loc>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")

    text = "\n".join(lines)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Wrote {out_path} ({len(locs)} URLs)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
