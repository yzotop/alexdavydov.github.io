#!/usr/bin/env python3
"""Избранное и кейсы — из материалов; текущая практика — из JSON.

Постоянное представление правится в HTML. --check не пишет файлы.
"""
from __future__ import annotations

import argparse
import html
import json
import sys
from urllib.parse import urlsplit

from site_materials import ROOT, cases, materials, replace_block, validate_url

SELECTED = [
    ("/workspace/articles/how-agent-sees-decisions/", "Контекст и решения",
     "Где записанное правило теряется по дороге к модели."),
    ("/workspace/articles/harness-by-type/", "Подготовка и приёмка",
     "Почему способ проверки зависит от результата задачи."),
    ("/workspace/articles/two-sided-interference/", "Эксперименты",
     "Что меняется, когда тест и контроль влияют друг на друга."),
    ("/workspace/articles/pctr-calibration/", "Монетизация",
     "Почему качество модели нужно связывать с экономикой продукта."),
]
HOME_CASES = [("ub22", "Кроссовки"), ("menu-check", "Кофейня")]


def selected_block() -> str:
    by_url = {a["url"]: a for a in materials()}
    rows = []
    for url, label, why in SELECTED:
        if url not in by_url:
            raise ValueError(f"Избранного материала нет в каталоге: {url}")
        a = by_url[url]
        rows.append(f'        <a class="dv-work-card" href="{url}">\n'
                    f'          <span class="dv-work-label">{html.escape(label)}</span>\n'
                    f'          <h3>{html.escape(a["title"])}</h3>\n'
                    f'          <p>{html.escape(why)}</p>\n'
                    '          <span class="dv-read">Читать разбор <span aria-hidden="true">↗</span></span>\n'
                    '        </a>')
    return "\n".join(rows)


def curiosity_block() -> str:
    found = {a["slug"]: a for a in cases()}
    rows = []
    for slug, label in HOME_CASES:
        if slug not in found:
            raise ValueError(f"Кейса из HOME_CASES нет на /cases/: {slug}")
        a = found[slug]
        rows.append(f'        <a href="{a["url"]}"><span>{label}</span>'
                    f'<strong>{html.escape(a["title"])}</strong><span class="dv-arrow">↗</span></a>')
    rows.append('        <a href="https://null.davydov.my/"><span>∅ Сад</span>'
                '<strong>Математические объекты и рассуждения</strong><span class="dv-arrow">↗</span></a>')
    return "\n".join(rows)


def practice_block() -> str:
    data = json.loads((ROOT / "assets/home-practice.json").read_text())
    e = html.escape
    updates = []
    for update in data["updates"]:
        url = update["url"]
        if url.startswith("/"):
            validate_url(url)
        elif urlsplit(url).scheme != "https" or not urlsplit(url).netloc:
            raise ValueError(f"Недопустимая ссылка обновления: {url}")
        updates.append('        <article class="dv-update">\n'
                       f'          <div class="dv-update-meta">{e(update["label"])}</div>\n'
                       f'          <h3><a href="{e(url, quote=True)}">{e(update["title"])}</a></h3>\n'
                       f'          <p>{e(update["text"])}</p>\n'
                       '        </article>')
    return ('      <div class="dv-section-heading"><h2 id="practice-title">Сейчас в практике'
            '</h2>'
            f'<span class="dv-date">{e(data["updated"])}</span></div>\n'
            '      <div class="dv-practice-grid">\n'
            '        <div class="dv-focus">\n'
            f'          <h3>{e(data["title"])}</h3><p>{e(data["text"])}</p>\n'
            f'          <p class="dv-muted">{e(data["stage"])}</p>\n'
            '        </div>\n'
            '        <div class="dv-updates">\n' + "\n".join(updates) + '\n        </div>\n      </div>')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        blocks = {"practice": practice_block(), "selected": selected_block(), "curiosity": curiosity_block()}
        path = ROOT / "index.html"
        old = path.read_text()
        new = old
        for name, block in blocks.items():
            new = replace_block(new, "home:" + name, block)
    except (KeyError, ValueError, OSError) as exc:
        print(f"ОСТАНОВ: {exc}. Ничего не записано.", file=sys.stderr)
        return 1
    if args.check and old != new:
        print("Главная расходится с источниками", file=sys.stderr)
        return 1
    if old != new:
        path.write_text(new)
    print("  главная: практика, избранное, авторские разборы — " + ("без изменений" if old == new else "обновлены"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
