#!/usr/bin/env python3
"""Собрать тематические полки каталога. --check проверяет без записи."""
import argparse
import html
import sys

from render_shared_memory_hub import READING_ORDER
from site_materials import ROOT, TOPICS, catalog_item, materials, replace_block, validate_url


SHELVES = {
    "workshop": ("Проекты и практика", "Саша, Запасы, книга и проверка работы агента.",
                 "/ai-first/workshop/", "Открыть AI-мастерскую →"),
    "ai": ("AI в работе аналитика", "Постановка задачи, контекст, метрики и приёмка результата.",
           "/ai-analyst/", "Читать серию «AI-аналитик» →"),
    "memory": ("Общая память агентов", "Разборы экспериментов Рината Абдуллина и сообщества BitGN.",
               "/shared-memory/", "Читать подборку по порядку →"),
    "ab": (TOPICS["ab"], "Дизайн A/B-тестов, ошибки и интерпретация результатов.", "", ""),
    "money": (TOPICS["money"], "Доход продукта, рекламные аукционы и экономика решений.", "", ""),
    "everywhere": (TOPICS["everywhere"], "Математика в историях, играх и повседневных вещах.", "", ""),
}


def shelf_key(row):
    if row["url"].startswith("/ai-first/workshop/"):
        return "workshop"
    if row["url"] in READING_ORDER:
        return "memory"
    return row["topic"]


def grouped_items(rows):
    shelves = {key: [] for key in SHELVES}
    for row in rows:
        shelves[shelf_key(row)].append(row)

    blocks = []
    for key, (title, description, url, label) in SHELVES.items():
        entries = shelves[key]
        if not entries:
            continue
        link = ""
        if url:
            validate_url(url)
            link = f'<p class="shelf-link"><a href="{url}">{html.escape(label)}</a></p>'
        if key == "workshop":
            entries.sort(key=lambda entry: entry["format"] == "Статья")
        if key == "memory":
            entries.sort(key=lambda entry: READING_ORDER.index(entry["url"]))
        items = "\n".join(catalog_item(entry) for entry in entries)
        topic = entries[0]["topic"]
        blocks.append(
            f'<details class="material-shelf" data-catalog-topic="{topic}" id="topic-{key}">\n'
            f'  <summary><strong>{html.escape(title)}</strong><span>{html.escape(description)}</span></summary>\n'
            f'{link}\n  <ul class="dv-catalog-list">\n{items}\n  </ul>\n</details>')
    return "\n".join(blocks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        rows = materials()
        page = ROOT / "materials/index.html"
        old = page.read_text()
        new = replace_block(old, "catalog", grouped_items(rows))
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
