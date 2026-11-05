#!/usr/bin/env python3
"""Список подборки /shared-memory/ и вход из каталога; --check без записи."""
import argparse
import html
import sys

from render_ai_analyst_hub import field
from site_materials import ROOT, replace_block, validate_url

READING_ORDER = [
    "/workspace/articles/company-brain/",
    "/workspace/articles/check-agent-fix/",
    "/workspace/articles/vindex-dot/",
    "/workspace/articles/inara-bobcat/",
    "/workspace/articles/lanes-lost-updates/",
    "/workspace/articles/component-integration/",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        items = []
        for url in READING_ORDER:
            validate_url(url)
            source = (ROOT / url.strip("/") / "index.html").read_text()
            title = field(source, r"<h1[^>]*>([^<]+)</h1>", "заголовок", url)
            blurb = field(source, r'<meta name="description" content="([^"]+)"', "описание", url)
            items.append(
                '      <li>\n'
                f'        <h3><a href="{html.escape(url, quote=True)}">{html.escape(title)}</a></h3>\n'
                f'        <p>{html.escape(blurb)}</p>\n'
                '      </li>')
        page = ROOT / "shared-memory/index.html"
        old = page.read_text()
        block = '  <div class="prose">\n    <ol>\n' + "\n".join(items) + "\n    </ol>\n  </div>"
        updates = [(page, old, replace_block(old, "shelf:shared-memory", block))]
        catalog = ROOT / "materials/index.html"
        catalog_old = catalog.read_text()
        entry = '''<section class="case-block" aria-labelledby="shared-memory-heading">
  <p class="case-block-tag">Отдельная подборка · Ринат Абдуллин и BitGN</p>
  <h2 id="shared-memory-heading">Общая память и работа агентов</h2>
  <p>Кейсы из одного эксперимента: как агенты передают работу, проверяют выводы и меняют общую память. С источниками и границами проверки.</p>
  <a class="sec-link" href="/shared-memory/">Открыть подборку →</a>
</section>'''
        updates.append((catalog, catalog_old, replace_block(catalog_old, "collection:shared-memory", entry)))
    except (ValueError, OSError) as exc:
        print(f"ОСТАНОВ: {exc}. Ничего не записано.", file=sys.stderr)
        return 1
    if args.check and any(old != new for _, old, new in updates):
        print("Подборка /shared-memory/ или вход из каталога расходятся с источниками", file=sys.stderr)
        return 1
    for page, old, new in updates:
        if old != new:
            page.write_text(new)
        print(str(page.relative_to(ROOT)) + ": " + ("без изменений" if old == new else "обновлён"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
