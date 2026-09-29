#!/usr/bin/env python3
"""Собрать полки карточек на /ai-analyst/ из самих статей.

Список на хабе поддерживался руками и отставал: восьмой разбор вышел
28.09 и на хаб не попал. Правда о статье живёт на её странице, хаб
выводится — иначе список разойдётся снова.

Что откуда берётся (всё со страницы статьи, ничего из этого файла):
  рубрика   — тег «AI-аналитик» в assets/search-index.json;
  номер     — «разбор N-й» в шапке статьи, до h1. У старых статей он
              стоит в article-meta, у новых — в блоке kick каркаса .ags;
              обе разметки покрываются одним поиском по шапке;
  дата      — первый span блока article-meta;
  заголовок — h1;
  подводка  — <meta name="series-blurb">.

Разбором считается статья, у которой есть И рубрика, И номер. Так из
списка сама собой выпадает интерактивная карта question-paths/map:
она лежит рядом со статьями, но разбором не является.

Порядок — от большего номера к меньшему: новые сверху.

Вторая полка — «Основа: эксперименты и монетизация». В неё идут статьи
с рубрикой A/B-эксперименты или Монетизация (span.chip в article-meta),
от новых к старым по <meta property="article:published_time">. Дата в
шапке статьи — только месяц, а в мае 2026 вышло восемь статей: порядок
внутри месяца без точного времени не вывести. Подводка — description
статьи.

У каждой статьи не больше одной полки: статья, попавшая в обе, —
ОСТАНОВ. Статьи ни в одной полке печатаются списком и на хаб не идут.

Каждая полка пишется между своими маркерами <!-- shelf:ИМЯ:start --> и
<!-- shelf:ИМЯ:end -->. Первый запуск оборачивает маркерами сетку серии,
собранную раньше без них, и добавляет секцию второй полки после неё.

Проверяется в CI шагом `git diff --exit-code ai-analyst/index.html`
рядом с картой сайта: забытая правка роняет сборку, а не тихо живёт
в репозитории месяц.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HUB = ROOT / "ai-analyst" / "index.html"
INDEX = ROOT / "assets" / "search-index.json"
RUBRIC = "AI-аналитик"
BASE_RUBRICS = ("A/B-эксперименты", "Монетизация")
BASE_TITLE = "Основа: эксперименты и монетизация"
BASE_LEAD = ("Глубина в домене: A/B на двусторонних рынках, аукционы, "
             "монетизация. Без неё агенту нечего объявить.")

WORDS = ["первый", "второй", "третий", "четвёртый", "пятый", "шестой",
         "седьмой", "восьмой", "девятый", "десятый"]


def field(text: str, pattern: str, what: str, url: str) -> str:
    m = re.search(pattern, text, re.S)
    if not m:
        sys.exit(f"ОСТАНОВ: у {url} не найдено: {what}")
    return html.unescape(m.group(1)).strip()


def collect() -> list[dict]:
    out = []
    for entry in json.loads(INDEX.read_text(encoding="utf-8")):
        if entry.get("type") != "article" or RUBRIC not in entry.get("tags", []):
            continue
        page = ROOT / entry["url"].strip("/") / "index.html"
        if not page.exists():
            sys.exit(f"ОСТАНОВ: нет файла {page}")
        s = page.read_text(encoding="utf-8")
        meta = re.search(r'class="article-meta[^"]*">(.*?)</div>', s, re.S)
        if not meta:
            continue                       # не статья серии: блока меты нет
        # Номер ищем по всей шапке, до h1: в старой разметке он в
        # article-meta, в каркасе .ags — в kick. Тело статьи не берём,
        # там «разбор» встречается прозой («разбор ниже», «разбор руками»).
        head = s[:s.index("</h1>")] if "</h1>" in s else s
        num = re.search(r"разбор (" + "|".join(WORDS) + r")", head)
        if not num:
            continue                       # рубрика есть, номера нет — не разбор
        out.append({
            "url": entry["url"],
            "num": WORDS.index(num.group(1)) + 1,
            "date": field(meta.group(1), r"<span>([^<]+)</span>", "дата", entry["url"]),
            "title": field(s, r"<h1[^>]*>([^<]+)</h1>", "заголовок", entry["url"]),
            "blurb": field(s, r'name="series-blurb" content="([^"]+)"',
                           "подводка (meta name=series-blurb)", entry["url"]),
        })
    nums = [a["num"] for a in out]
    if len(set(nums)) != len(nums):
        sys.exit(f"ОСТАНОВ: номера разборов повторяются: {sorted(nums)}")
    if sorted(nums) != list(range(1, len(nums) + 1)):
        sys.exit(f"ОСТАНОВ: в номерах разборов дыра: {sorted(nums)}")
    return sorted(out, key=lambda a: -a["num"])


def articles() -> list[tuple[str, str]]:
    """(url, html) всех статей из поискового индекса."""
    out = []
    for entry in json.loads(INDEX.read_text(encoding="utf-8")):
        if entry.get("type") != "article":
            continue
        page = ROOT / entry["url"].strip("/") / "index.html"
        if not page.exists():
            sys.exit(f"ОСТАНОВ: нет файла {page}")
        out.append((entry["url"], page.read_text(encoding="utf-8")))
    return out


def rubric(s: str) -> str | None:
    meta = re.search(r'class="article-meta[^"]*">(.*?)</div>', s, re.S)
    chip = re.search(r'<span class="chip">([^<]+)</span>', meta.group(1)) if meta else None
    return html.unescape(chip.group(1)).strip() if chip else None


def collect_base() -> list[dict]:
    """Вторая полка: рубрики BASE_RUBRICS, от новых к старым."""
    series = {a["url"] for a in collect()}
    out = []
    for url, s in articles():
        r = rubric(s)
        if r not in BASE_RUBRICS:
            continue
        if url in series:
            sys.exit(f"ОСТАНОВ: {url} попадает в две полки — серия и «{BASE_TITLE}»")
        meta = re.search(r'class="article-meta[^"]*">(.*?)</div>', s, re.S)
        out.append({
            "url": url,
            "rubric": r,
            "published": field(s, r'property="article:published_time" content="([^"]+)"',
                               "дата публикации (meta property=article:published_time)", url),
            "date": field(meta.group(1), r"<span>([^<]+)</span>", "дата", url),
            "title": field(s, r"<h1[^>]*>([^<]+)</h1>", "заголовок", url),
            "blurb": field(s, r'<meta name="description" content="([^"]+)"', "description", url),
        })
    return sorted(out, key=lambda a: a["published"], reverse=True)


def unplaced() -> list[str]:
    placed = {a["url"] for a in collect()} | {a["url"] for a in collect_base()}
    return sorted(url for url, _ in articles() if url not in placed)


def base_card(a: dict) -> str:
    e = html.escape
    return (f'        <a class="course" href="{a["url"]}">\n'
            f'          <div class="course-meta"><span class="course-num">{e(a["rubric"])}</span>'
            f'<span>{e(a["date"])}</span></div>\n'
            f'          <h3>{e(a["title"])}</h3>\n'
            f'          <p>{e(a["blurb"])}</p>\n'
            f'          <span class="course-arrow">↗</span>\n'
            f'        </a>')


def shelf(name: str, cards: list[str]) -> str:
    return (f'<!-- shelf:{name}:start -->\n      <div class="courses-grid">\n'
            + "\n".join(cards) + f'\n      </div>\n      <!-- shelf:{name}:end -->')


def put(s: str, name: str, block: str) -> str | None:
    start, end = f"<!-- shelf:{name}:start -->", f"<!-- shelf:{name}:end -->"
    if start not in s:
        return None
    return s[:s.index(start)] + block + s[s.index(end) + len(end):]


def card(a: dict) -> str:
    e = html.escape
    return (f'        <a class="course" href="{a["url"]}">\n'
            f'          <div class="course-meta"><span class="course-num">{a["num"]:02d}</span>'
            f'<span>{e(a["date"])}</span></div>\n'
            f'          <h3>{e(a["title"])}</h3>\n'
            f'          <p>{e(a["blurb"])}</p>\n'
            f'          <span class="course-arrow">↗</span>\n'
            f'        </a>')


def main() -> int:
    arts = collect()
    base = collect_base()
    s = HUB.read_text(encoding="utf-8")

    series_block = shelf("series", [card(a) for a in arts])
    new = put(s, "series", series_block)
    if new is None:                        # первый запуск: сетка без маркеров
        i = s.index('<div class="courses-grid">')
        j = s.index("</div>", s.index("</a>", s.rindex('<a class="course"'))) + len("</div>")
        new = s[:i] + series_block + s[j:]

    base_block = shelf("base", [base_card(a) for a in base])
    out = put(new, "base", base_block)
    if out is None:                        # первый запуск: секции второй полки нет
        k = new.index("</section>", new.index("<!-- shelf:series:end -->")) + len("</section>")
        out = (new[:k] + "\n    <section>\n"
               f"      <h2>{html.escape(BASE_TITLE)}</h2>\n"
               f"      <p>{html.escape(BASE_LEAD)}</p>\n      "
               + base_block + "\n    </section>" + new[k:])

    if out != s:
        HUB.write_text(out, encoding="utf-8")
    print(f"  {HUB.relative_to(ROOT)}  серия {arts[0]['num']:02d}→{arts[-1]['num']:02d}, "
          f"основа: {len(base)} карточек"
          f"{'  (изменено)' if out != s else '  (без изменений)'}")
    rest = unplaced()
    if rest:
        print("  ни в одной полке (на хаб не идут):")
        for url in rest:
            print(f"     {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
