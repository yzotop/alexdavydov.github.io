#!/usr/bin/env python3
"""Карточки /shared-memory/ из исходных статей; --check без записи."""
import argparse
import html
import sys

from render_ai_analyst_hub import field
from site_materials import ROOT, replace_block, validate_url

READING_ORDER = [
    ("/workspace/articles/company-brain/", "Начать с истории"),
    ("/workspace/articles/check-agent-fix/", "Перейти к практике"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        cards = []
        for url, label in READING_ORDER:
            validate_url(url)
            source = (ROOT / url.strip("/") / "index.html").read_text()
            title = field(source, r"<h1[^>]*>([^<]+)</h1>", "заголовок", url)
            blurb = field(source, r'<meta name="description" content="([^"]+)"', "описание", url)
            cards.append(
                f'    <a class="course" href="{html.escape(url, quote=True)}">\n'
                f'      <div class="course-meta">{html.escape(label)}</div>\n'
                f'      <h3>{html.escape(title)}</h3>\n'
                f'      <p>{html.escape(blurb)}</p>\n'
                '      <span class="course-arrow" aria-hidden="true">↗</span>\n'
                '    </a>')
        page = ROOT / "shared-memory/index.html"
        old = page.read_text()
        block = '  <div class="courses-grid">\n' + "\n".join(cards) + "\n  </div>"
        new = replace_block(old, "shelf:shared-memory", block)
    except (ValueError, OSError) as exc:
        print(f"ОСТАНОВ: {exc}. Ничего не записано.", file=sys.stderr)
        return 1
    if args.check and old != new:
        print("Карточки /shared-memory/ расходятся с источниками", file=sys.stderr)
        return 1
    if old != new:
        page.write_text(new)
    print("/shared-memory/: " + ("без изменений" if old == new else "обновлён"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
