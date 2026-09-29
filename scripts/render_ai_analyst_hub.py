#!/usr/bin/env python3
"""Собрать сетку карточек на /ai-analyst/ из самих статей.

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
    s = HUB.read_text(encoding="utf-8")
    i = s.index('<div class="courses-grid">')
    j = s.index("</div>", s.index("</a>", s.rindex('<a class="course"')))
    grid = '<div class="courses-grid">\n' + "\n".join(card(a) for a in arts) + "\n      "
    new = s[:i] + grid + s[j:]
    if new != s:
        HUB.write_text(new, encoding="utf-8")
    print(f"  {HUB.relative_to(ROOT)}  {len(arts)} карточек, "
          f"{arts[0]['num']:02d}→{arts[-1]['num']:02d}"
          f"{'  (изменено)' if new != s else '  (без изменений)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
