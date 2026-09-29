#!/usr/bin/env python3
"""Шапка сайта — основное меню и шторка — из одного шаблона.

Меню было вписано руками в каждую страницу, 47 копий. Переименовать
пункт значило поправить 47 файлов и не пропустить ни одного; новая
страница, собранная копированием соседней, уносила её версию меню.

Шаблон — _partials/site-header.html. Каталог с подчёркиванием Jekyll не
публикует: шаблон лежит в репозитории, но не на сайте.

Разметка пишется между маркерами <!-- header:start --> и
<!-- header:end -->. Первый запуск оборачивает маркерами шапку,
вписанную руками: от <nav class="nav" aria-label="Основное меню"> до
закрывающего </nav> шторки.

aria-current="page" ставится на пункт основного меню, чей адрес совпадает
с адресом страницы. Внутренние страницы раздела свой пункт не подсвечивают:
так решено 2026-09-29. Поменять — правка в current().

Предохранитель: страница с шапкой вне маркеров — ОСТАНОВ, ничего не
записано. Иначе такая страница жила бы со своей копией меню, а CI бы
молчал: генератор её не видит.

Проверяется в CI:
    python3 scripts/render_site_header.py && git diff --exit-code -- '*.html'
"""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE = os.path.join(ROOT, "_partials", "site-header.html")
SKIP_DIRS = {"_archive", "_staging", "_partials", ".claude", ".git", "node_modules"}

START, END = "<!-- header:start -->", "<!-- header:end -->"
NAV_OPEN = '<nav class="nav" aria-label="Основное меню">'
# Шапка, вписанная руками: основное меню, подложка, шторка.
LEGACY = re.compile(
    re.escape(NAV_OPEN) + r'.*?<nav class="nav-drawer"[^>]*>.*?</nav>', re.S)
NAV_LINKS = re.compile(r'(<div class="nav-links">)(.*?)(</div>)', re.S)


def page_url(rel: str) -> str:
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def current(block: str, url: str) -> str:
    """Отметить пункт основного меню, ведущий на эту же страницу."""
    def mark(m: re.Match) -> str:
        links = m.group(2).replace(f'<a href="{url}">',
                                   f'<a href="{url}" aria-current="page">', 1)
        return m.group(1) + links + m.group(3)
    return NAV_LINKS.sub(mark, block, count=1)


def main() -> int:
    with open(TEMPLATE, encoding="utf-8") as f:
        template = f.read().rstrip("\n")

    todo: list[tuple[str, str]] = []
    stray: list[str] = []
    for dp, dirnames, files in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(files):
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            with open(path, encoding="utf-8") as f:
                s = f.read()
            block = f"{START}\n{current(template, page_url(rel))}\n{END}"
            if START in s:
                i, j = s.index(START), s.index(END) + len(END)
                new = s[:i] + block + s[j:]
            elif LEGACY.search(s):
                new = LEGACY.sub(lambda _: block, s, count=1)
            else:
                if NAV_OPEN in s:          # шапка есть, но не узнана целиком
                    stray.append(rel)
                continue
            outside = new[: new.index(START)] + new[new.index(END):]
            if NAV_OPEN in outside:
                stray.append(rel)
            todo.append((path, new if new != s else ""))

    if stray:
        print("ОСТАНОВ: шапка вне маркеров header:start/end — "
              "её не обновит ни генератор, ни CI:")
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
    print(f"  страниц с шапкой: {len(todo)}, изменено: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
