#!/usr/bin/env python3
"""Собрать блок «Вся серия» в конце каждой статьи серии.

Источник тот же, что у хаба /ai-analyst/: рубрика в поисковом индексе,
номер «разбор N-й» в шапке статьи, дата, заголовок и подводка. Значит
список на хабе и список в конце статьи не могут разойтись — они
выводятся из одного места.

Блок был только у трёх статей из восьми, потому что его CSS жил в
<style> каркаса .ags. Стили перенесены в style.css (.series-nav), и
теперь одна и та же разметка ложится в оба каркаса.

Карта question-paths/map — подпункт под своим разбором, без номера:
номера в блоке обязаны совпадать с «разбор N-й» в тексте статей, а
карта разбором не является.

Разметка пишется между маркерами <!-- series:start --> и
<!-- series:end -->. Маркеров нет — блок вставляется: в каркасе .ags
перед footer, в старом — перед блоком автора.

Первый запуск заменяет блоки, собранные руками до генератора, а не
ставит новый рядом: <section class="series"> в каркасе .ags и список
<h2 id="series"> в task-brief. Иначе в статье было бы два списка серии.
Новая секция получает id="series": на него ведёт ссылка «внизу» из
вступления task-brief.

Ссылки относительные: lychee исключает https://davydov.my (так
помечены canonical и og:url), и абсолютная ссылка с опечаткой в слаге
прошла бы CI незамеченной.

Проверяется в CI: `git diff --exit-code workspace/articles`.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from render_ai_analyst_hub import collect          # noqa: E402  единый источник

# Материалы, которые идут в блоке подпунктом: они лежат рядом с серией,
# но разбором не являются и номера не занимают.
SIDE = {
    6: {"url": "/workspace/articles/question-paths/map/",
        "title": "Что бывает у AI-аналитика с вопросом по дороге к ответу (интерактив)",
        "meta": "2026.09 · карта",
        "sub": "Сто пять ячеек, каждая кликается"},
}

START, END = "<!-- series:start -->", "<!-- series:end -->"

# Блоки серии, собранные руками до генератора. Встречаются только при
# первом запуске: после него на их месте стоят маркеры.
LEGACY_AGS = re.compile(r'<section class="series">.*?</section>', re.S)
LEGACY_LIST = re.compile(r'\n\s*<hr/>\s*<h2 id="series">.*?</ul>\n', re.S)


def item(a: dict, here: bool) -> str:
    e = html.escape
    if here:
        return ('  <li><div class="this"><span class="idx"></span>\n'
                f'    <span><span class="ttl">{e(a["title"])}</span>'
                '<span class="sub">Вы здесь</span></span></div></li>')
    return (f'  <li><a href="{a["url"]}"><span class="idx"></span>\n'
            f'    <span><span class="ttl">{e(a["title"])}</span>'
            f'<span class="meta">{e(a["meta"])}</span>\n'
            f'    <span class="sub">{e(a["blurb"])}</span></span></a></li>')


def side(s: dict) -> str:
    e = html.escape
    return (f'  <li class="side"><a href="{s["url"]}"><span class="mark">↳</span>\n'
            f'    <span><span class="ttl">{e(s["title"])}</span>'
            f'<span class="meta">{e(s["meta"])}</span>\n'
            f'    <span class="sub">{e(s["sub"])}</span></span></a></li>')


def block(arts: list[dict], current: str) -> str:
    rows = []
    for a in sorted(arts, key=lambda x: x["num"]):
        rows.append(item(a, a["url"] == current))
        if a["num"] in SIDE:
            rows.append(side(SIDE[a["num"]]))
    return (f'{START}\n<section class="series-nav" id="series">\n<h2>Вся серия про AI-аналитика</h2>\n'
            '<ol>\n' + "\n".join(rows) + f'\n</ol>\n</section>\n{END}')


def place(s: str, blk: str) -> str:
    if START in s:
        i, j = s.index(START), s.index(END) + len(END)
        return s[:i] + blk + s[j:]
    m = LEGACY_AGS.search(s)                           # старый блок .ags —
    if m:                                              # на его же место
        return s[:m.start()] + blk + s[m.end():]
    s = LEGACY_LIST.sub("\n", s, count=1)              # список task-brief —
                                                       # убрать, блок встанет
                                                       # перед автором
    if '<div class="article-author">' in s:            # старый каркас
        i = s.index('  <div class="article-author">')
        return s[:i] + blk + "\n" + s[i:]
    i = s.index("<footer>")                            # каркас .ags
    return s[:i] + blk + "\n\n" + s[i:]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="слаг одной статьи, для показа правки")
    args = ap.parse_args()
    arts = collect()
    # у статей с меткой чтения meta для блока: «2026.09 · 8 мин»
    for a in arts:
        page = (ROOT / a["url"].strip("/") / "index.html").read_text(encoding="utf-8")
        m = re.search(r'class="article-meta[^"]*">(.*?)</div>', page, re.S)
        spans = re.findall(r"<span[^>]*>([^<]+)</span>", m.group(1))
        month, year = spans[0].split()
        months = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл",
                  "август", "сентябр", "октябр", "ноябр", "декабр"]
        n = next(i for i, mm in enumerate(months) if month.lower().startswith(mm)) + 1
        a["meta"] = f"{year}.{n:02d} · {spans[2]}"
    touched = 0
    for a in arts:
        if args.only and not a["url"].strip("/").endswith(args.only):
            continue
        p = ROOT / a["url"].strip("/") / "index.html"
        s = p.read_text(encoding="utf-8")
        new = place(s, block(arts, a["url"]))
        if new != s:
            p.write_text(new, encoding="utf-8")
            touched += 1
        print(f"  {a['url']:44} {'изменено' if new != s else 'без изменений'}")
    print(f"  всего изменено: {touched}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
