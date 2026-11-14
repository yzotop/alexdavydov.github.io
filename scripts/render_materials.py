#!/usr/bin/env python3
"""Собрать каталог из статей и /cases/. --check проверяет без записи."""
import argparse
import html
import sys

from site_materials import ROOT, TOPICS, catalog_item, field, materials, replace_block, validate_url


WORKSHOP_URL = "/ai-first/workshop/"


def practice_entry() -> str:
    url = WORKSHOP_URL
    validate_url(url)
    source = (ROOT / url.strip("/") / "index.html").read_text()
    title = field(source, r"<title>(.*?) — Саша Давыдов</title>", "название практики", url)
    blurb = field(source, r'<meta name="description" content="([^"]+)"', "описание практики", url)
    return ('<div class="case-block">\n'
            f'  <h3>{html.escape(title)}</h3>\n'
            f'  <p>{html.escape(blurb)}</p>\n'
            f'  <a class="sec-link" href="{url}">Открыть мастерскую →</a>\n'
            '</div>')


def collection_blocks() -> tuple[str, str]:
    cards = []
    links = [f'<a href="{WORKSHOP_URL}">Мастерская</a>']
    for url in ["/shared-memory/", "/ai-analyst/"]:
        validate_url(url)
        source = (ROOT / url.strip("/") / "index.html").read_text()
        title = field(source, r"<title>(.*?) — Саша Давыдов</title>", "название подборки", url)
        blurb = field(source, r'<meta name="description" content="([^"]+)"', "описание", url)
        links.append(f'<a href="{url}">{html.escape(title)}</a>')
        cards.append(
            f'  <a class="course" href="{html.escape(url, quote=True)}">\n'
            f'    <h3>{html.escape(title)}</h3>\n'
            f'    <p>{html.escape(blurb)}</p>\n'
            '    <span class="course-arrow" aria-hidden="true">↗</span>\n'
            '  </a>')
    grid = '<div class="courses-grid">\n' + "\n".join(cards) + "\n</div>"
    return grid, ' <span aria-hidden="true">·</span> '.join(links)


def grouped_items(rows: list[dict]) -> str:
    groups = []
    for topic, title in TOPICS.items():
        items = [catalog_item(a) for a in rows if a["topic"] == topic]
        if not items:
            continue
        groups.append(
            f'<section class="dv-catalog-group" data-catalog-topic="{topic}" aria-labelledby="topic-{topic}">\n'
            f'  <h3 id="topic-{topic}">{html.escape(title)}</h3>\n'
            '  <ul class="dv-catalog-list">\n' + "\n".join(items) + '\n  </ul>\n</section>')
    return "\n".join(groups)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        rows = materials()
        items = grouped_items(rows)
        page = ROOT / "materials/index.html"
        old = page.read_text()
        new = replace_block(old, "catalog", items)
        cards, links = collection_blocks()
        new = replace_block(new, "catalog:collections", cards)
        new = replace_block(new, "catalog:shortcuts", links)
        new = replace_block(new, "catalog:practice", practice_entry())
    except (ValueError, OSError) as exc:
        print(f"ОСТАНОВ: {exc}. Ничего не записано.", file=sys.stderr)
        return 1
    if args.check and old != new:
        print("Каталог расходится с источниками", file=sys.stderr)
        return 1
    if old != new:
        page.write_text(new)
    print(f"  /materials/: {len(rows)} материалов; " + ("без изменений" if old == new else "обновлён"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
