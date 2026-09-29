#!/usr/bin/env python3
"""Карточки трёх секций главной — из тех же источников, что хабы.

Главная повторяет то, что уже есть на других страницах: разборы серии,
статьи основы, кейсы. Карточки, вписанные руками, расходились с хабами —
подпись разбора 01 на главной и на /ai-analyst/ была разной. Теперь
главная выводится, а не ведётся.

  § 01 AI-аналитик — разборы 01–03 серии (render_ai_analyst_hub.collect)
                     и карточка доклада;
  § 02 Основа      — четыре последние статьи второй полки /ai-analyst/
                     (render_ai_analyst_hub.collect_base);
  § 03 Аналитика везде — кейсы из списка HOME_CASES. Список — выбор
                     автора, из страниц его не вывести; всё остальное
                     берётся из карточек /cases/: название, №, заголовок,
                     описание.

Каждая сетка пишется между маркерами <!-- home:ИМЯ:start --> и
<!-- home:ИМЯ:end -->. Нет маркеров или кейса из списка нет на /cases/ —
ОСТАНОВ, ничего не записано.

Проверяется в CI: python3 scripts/render_home.py && git diff --exit-code index.html
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_ai_analyst_hub import WORDS, collect, collect_base  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "index.html"
CASES = ROOT / "cases" / "index.html"

# Кейсы на главной — выбор автора, 2026-09-29: три, названные в
# подзаголовке /cases/ (кроссовки, салфетка, Корейко), и «Лего». Четыре —
# чтобы сетка в две колонки закрывалась без пустой клетки.
HOME_CASES = ["ub22", "menu-check", "telenok", "lego-octan"]
SERIES_ON_HOME = 3
BASE_ON_HOME = 4

TALK_CARD = """    <a class="course" href="/talks/">
      <div class="course-meta"><span class="course-num">26.11</span><span>МАТЕМАРКЕТИНГ’26 · ДОКЛАД</span></div>
      <h3>Сколько работы аналитика можно отдать агенту и чем это проверять</h3>
      <p class="course-status">Москва, ИНТЦ Кластер Ломоносов</p>
      <span class="course-arrow">↗</span>
    </a>"""


def stop(msg: str) -> None:
    sys.exit(f"ОСТАНОВ: {msg}. Ничего не записано.")


def card(href: str, num: str, label: str, title: str, text: str) -> str:
    e = html.escape
    return (f'    <a class="course" href="{href}">\n'
            f'      <div class="course-meta"><span class="course-num">{e(num)}</span>'
            f'<span>{e(label)}</span></div>\n'
            f'      <h3>{e(title)}</h3>\n'
            f'      <p>{e(text)}</p>\n'
            f'      <span class="course-arrow">↗</span>\n'
            f'    </a>')


def grid(cards: list[str]) -> str:
    return '  <div class="courses-grid">\n' + "\n".join(cards) + "\n  </div>"


def series_cards() -> list[str]:
    first = sorted(collect(), key=lambda a: a["num"])[:SERIES_ON_HOME]
    cards = [card(a["url"], f'{a["num"]:02d}', f'РАЗБОР {WORDS[a["num"] - 1]}'.upper(),
                  a["title"], a["blurb"]) for a in first]
    return cards + [TALK_CARD]


def base_cards() -> list[str]:
    return [card(a["url"], a["rubric"].upper(), a["date"].upper(), a["title"], a["blurb"])
            for a in collect_base()[:BASE_ON_HOME]]


def case_cards() -> list[str]:
    s = CASES.read_text(encoding="utf-8")
    found = {}
    for block in re.findall(r'<div class="case">(.*?)\n    </div>\n', s, re.S):
        link = re.search(r'<a href="(/cases/([^/"]+)/)" class="case-link">([^<]+)</a>', block)
        co = re.search(r'<span class="case-co">([^<]+)</span>', block)
        num = re.search(r'<span>(№ \d+)</span>', block)
        text = re.search(r'<p>(.*?)</p>', block, re.S)
        if link and co and num and text:
            found[link.group(2)] = (link.group(1), num.group(1), html.unescape(co.group(1)),
                                    html.unescape(link.group(3)),
                                    html.unescape(re.sub(r"<[^>]+>", "", text.group(1))))
    missing = [slug for slug in HOME_CASES if slug not in found]
    if missing:
        stop(f"кейсов из HOME_CASES нет на /cases/: {', '.join(missing)}")
    return [card(href, num, co.upper(), title, text)
            for href, num, co, title, text in (found[slug] for slug in HOME_CASES)]


def main() -> int:
    s = HOME.read_text(encoding="utf-8")
    new = s
    for name, cards in (("series", series_cards()), ("base", base_cards()),
                        ("cases", case_cards())):
        start, end = f"<!-- home:{name}:start -->", f"<!-- home:{name}:end -->"
        if start not in new or end not in new:
            stop(f"на главной нет маркеров {start} … {end}")
        i, j = new.index(start) + len(start), new.index(end)
        new = new[:i] + "\n" + grid(cards) + "\n  " + new[j:]
    if new != s:
        HOME.write_text(new, encoding="utf-8")
    print(f"  index.html  серия, основа, кейсы"
          f"{'  (изменено)' if new != s else '  (без изменений)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
