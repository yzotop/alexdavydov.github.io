#!/usr/bin/env python3
"""Шапка сайта — основное меню и шторка — и подвал из шаблонов.

Меню было вписано руками в каждую страницу, 47 копий. Переименовать
пункт значило поправить 47 файлов и не пропустить ни одного; новая
страница, собранная копированием соседней, уносила её версию меню.

Шаблоны — _partials/site-header.html и _partials/site-footer.html.
Каталог с подчёркиванием Jekyll не публикует: шаблоны лежат в
репозитории, но не на сайте. Подвал подключён тем же способом, когда
в него переехал «Поиск»: иначе его пришлось бы вписывать в 47 копий.

Разметка пишется между маркерами <!-- header:start --> и
<!-- header:end -->, <!-- footer:start --> и <!-- footer:end -->.
Первый запуск оборачивает маркерами то, что вписано руками: шапку от
<nav class="nav" aria-label="Основное меню"> до закрывающего </nav>
шторки, подвал — <footer class="footer"> целиком.

aria-current="page" ставится на пункт основного меню, чей адрес совпадает
с адресом страницы. Внутренние страницы раздела свой пункт не подсвечивают:
так решено 2026-09-29. Поменять — правка в current().

Предохранитель: страница с шапкой или подвалом вне маркеров — ОСТАНОВ,
ничего не записано. Иначе такая страница жила бы со своей копией меню, а CI бы
молчал: генератор её не видит.

Проверяется в CI:
    python3 scripts/render_site_header.py && git diff --exit-code -- '*.html'
"""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKIP_DIRS = {"_archive", "_staging", "_partials", ".claude", ".git", "node_modules"}

NAV_OPEN = '<nav class="nav" aria-label="Основное меню">'
NAV_LINKS = re.compile(r'(<div class="nav-links">)(.*?)(</div>)', re.S)

# Части страницы: шаблон, маркеры, как узнать вписанное руками, и строка,
# по которой видна копия вне маркеров.
PARTS = [
    {"name": "шапка", "template": "_partials/site-header.html",
     "start": "<!-- header:start -->", "end": "<!-- header:end -->",
     # основное меню, подложка, шторка
     "legacy": re.compile(re.escape(NAV_OPEN)
                          + r'.*?<nav class="nav-drawer"[^>]*>.*?</nav>', re.S),
     "sign": NAV_OPEN},
    {"name": "подвал", "template": "_partials/site-footer.html",
     "start": "<!-- footer:start -->", "end": "<!-- footer:end -->",
     "legacy": re.compile(r'<footer class="footer">.*?</footer>', re.S),
     "sign": '<footer class="footer">'},
]


def page_url(rel: str) -> str:
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def current(block: str, url: str) -> str:
    """Отметить пункт основного меню, ведущий на эту же страницу."""
    link = re.compile(r'(<a href="' + re.escape(url) + r'")')

    def mark(m: re.Match) -> str:
        links = link.sub(r'\1 aria-current="page"', m.group(2), count=1)
        return m.group(1) + links + m.group(3)
    return NAV_LINKS.sub(mark, block, count=1)


def render(s: str, part: dict, block: str) -> str | None:
    """Страница с этой частью на месте шаблона; None — части на странице нет."""
    start, end = part["start"], part["end"]
    block = f"{start}\n{block}\n{end}"
    if start in s:
        i, j = s.index(start), s.index(end) + len(end)
        return s[:i] + block + s[j:]
    if part["legacy"].search(s):
        return part["legacy"].sub(lambda _: block, s, count=1)
    return None


def main() -> int:
    templates = {}
    for part in PARTS:
        with open(os.path.join(ROOT, part["template"]), encoding="utf-8") as f:
            templates[part["name"]] = f.read().rstrip("\n")

    todo: list[tuple[str, str]] = []
    stray: list[str] = []
    counts = {part["name"]: 0 for part in PARTS}
    for dp, dirnames, files in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(files):
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            with open(path, encoding="utf-8") as f:
                s = f.read()
            new = s
            for part in PARTS:
                block = templates[part["name"]]
                if part["name"] == "шапка":
                    block = current(block, page_url(rel))
                out = render(new, part, block)
                if out is None:
                    if part["sign"] in new:      # часть есть, но не узнана
                        stray.append(f"{rel}  ({part['name']})")
                    continue
                i = out.index(part["start"])
                j = out.index(part["end"]) + len(part["end"])
                if part["sign"] in out[:i] + out[j:]:
                    stray.append(f"{rel}  ({part['name']})")
                counts[part["name"]] += 1
                new = out
            if new != s or any(p["start"] in new for p in PARTS):
                todo.append((path, new if new != s else ""))

    if stray:
        print("ОСТАНОВ: шапка или подвал вне маркеров — "
              "их не обновит ни генератор, ни CI:")
        for rel in stray:
            print(f"   {rel}")
        print("Ничего не записано.")
        return 1

    changed = 0
    for path, new in todo:
        if new:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new)
            changed += 1
    print(f"  шапка: {counts['шапка']} стр., подвал: {counts['подвал']} стр., "
          f"изменено файлов: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
