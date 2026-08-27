#!/usr/bin/env python3
"""Build sitemap.xml from assets/search-index.json + hub URLs (canonical: https://davydov.my)."""
from __future__ import annotations

import json
import os
import sys
from xml.sax.saxutils import escape

SITE_ORIGIN = "https://davydov.my"

# Страницы, которые есть в поиске по сайту, но не должны попадать
# в карту сайта. Карта — заявка поисковику «вот что индексировать»,
# поиск по сайту — навигация для того, кто уже пришёл. Это разные вещи,
# и разводятся они здесь: search-index.json остаётся полным, из карты
# путь вычитается.
#
# Ветка AI-evals скрыта из навигации: карточек на хабе нет, но статьи
# должны находиться поиском. Единственная дверь — /workspace/blind-verdict-evals/.
# Возврат — убрать путь отсюда и вернуть карточку на хаб. См. CHANGELOG.md.
EXCLUDED_FROM_SITEMAP = (
    "/workspace/articles/honesty-probe-hint/",
    "/workspace/articles/llm-decisions-two-metrics/",
    "/workspace/articles/sgr-ab-decisions/",
)

# Paths not guaranteed to appear in search-index (add when new hubs ship).
EXTRA_PATHS = (
    "/",
    "/approach/",
    "/cases/",
    "/cases/macbook-market/",
    "/workspace/glossary/",
    "/workspace/articles/",
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

    # Ругаемся, если исключение перестало на что-то указывать: иначе опечатка
    # или переименование статьи молча вернут её в карту, и заметить это будет
    # нечем — карта просто станет на строку длиннее.
    stale = [u for u in EXCLUDED_FROM_SITEMAP if u not in urls]
    if stale:
        print("ОШИБКА: EXCLUDED_FROM_SITEMAP указывает на пути, которых нет "
              "в search-index.json:", file=sys.stderr)
        for u in stale:
            print(f"   {u}", file=sys.stderr)
        print("Уберите их из списка или поправьте путь. Ничего не записано.",
              file=sys.stderr)
        return 1
    urls -= set(EXCLUDED_FROM_SITEMAP)

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
