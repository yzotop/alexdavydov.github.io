#!/usr/bin/env python3
"""Проверка адресов, которые lychee не читает: og:url, og:image, url() в CSS.

Lychee смотрит на <a href>, <link href>, <img src> и подобное. Мимо него
проходят:

  1. content у <meta> — og:url и og:image на каждой статье. Битая
     og:image не ломает страницу, но превью в Telegram и LinkedIn выходит
     без картинки, а заметить это можно только поделившись ссылкой.
  2. url() в CSS — шрифты и фоны. Битый шрифт тоже ничего не роняет:
     браузер подставит системный, и страница просто выглядит иначе.

Каждый адрес проверяется как файл рабочего дерева, так же как lychee
с root_dir и --remap проверяет ссылки:

  https://davydov.my/путь  и  /путь   → от корня репозитория;
  относительный url() в CSS           → от каталога файла со стилями
                                        (для <style> и style="" — от
                                        каталога страницы);
  путь на / или без расширения        → каталог с index.html.

Чужие домены, data: и #фрагменты не проверяются. Каталоги _archive,
_staging, .claude, node_modules пропускаются — как exclude_path
в lychee.toml.

Запуск из корня репозитория:

    python3 scripts/check_meta_css_refs.py [корень]

Корень нужен только для отрицательного теста на копии дерева.
Выход 0 — все цели на месте. Выход 1 — список битых с файлом и строкой.
"""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import unquote, urlsplit

OWN = "https://davydov.my"
SKIP_DIRS = {"_archive", "_staging", ".claude", "node_modules", ".git"}

META = re.compile(r"<meta\b[^>]*>", re.I)
# Только ключи, в которых лежит адрес. og:title, og:image:width и прочие
# — текст и числа, их как путь проверять нельзя.
URL_KEYS = {"og:url", "og:image", "og:image:url", "og:image:secure_url",
            "twitter:image", "twitter:image:src"}
META_KEY = re.compile(r'\b(?:property|name)="([^"]+)"', re.I)
META_CONTENT = re.compile(r'\bcontent="([^"]*)"', re.I)
STYLE_BLOCK = re.compile(r"<style\b[^>]*>(.*?)</style>", re.S | re.I)
STYLE_ATTR = re.compile(r'\bstyle="([^"]*)"', re.I)


def line_of(text: str, pos: int) -> int:
    return text.count("\n", 0, pos) + 1


def target(root: str, base_dir: str, ref: str) -> str | None:
    """Путь на диске, который должен существовать; None — не наш адрес."""
    ref = ref.strip()
    if not ref or ref.startswith(("data:", "#")):
        return None
    if ref.startswith(OWN):
        ref = ref[len(OWN):] or "/"
    elif re.match(r"^[a-z][a-z0-9+.-]*:|^//", ref, re.I):
        return None                                   # чужой домен
    path = unquote(urlsplit(ref).path)
    if path.startswith("/"):
        return os.path.normpath(os.path.join(root, path.lstrip("/")))
    return os.path.normpath(os.path.join(base_dir, path))


def exists(path: str) -> bool:
    if os.path.isfile(path):
        return True
    return os.path.isfile(os.path.join(path, "index.html"))


def refs_in_css(css: str, offset: int = 0):
    """url(...) по порядку, значение читается до своей кавычки.

    Регулярка тут не годится: внутри data:image/svg+xml бывает свой
    url(%23n) — ссылка на фильтр внутри SVG, а не адрес. Разбор по
    символам проглатывает значение целиком и вложенное не видит.
    """
    i = 0
    while (i := css.find("url(", i)) != -1:
        j = i + 4
        while j < len(css) and css[j] in " \t\n":
            j += 1
        q = css[j] if j < len(css) and css[j] in "'\"" else ""
        start = j + len(q)
        end = css.find(q or ")", start)
        if end == -1:
            break
        yield offset + start, "url()", css[start:end]
        i = end + 1


def refs_in_html(html: str):
    for m in META.finditer(html):
        key, content = META_KEY.search(m.group(0)), META_CONTENT.search(m.group(0))
        if key and content and key.group(1).lower() in URL_KEYS:
            yield m.start(), key.group(1), content.group(1)
    for m in STYLE_BLOCK.finditer(html):
        yield from refs_in_css(m.group(1), m.start(1))
    for m in STYLE_ATTR.finditer(html):
        yield from refs_in_css(m.group(1), m.start(1))


def main() -> int:
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    checked, broken = 0, []
    for dp, dirnames, files in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(files):
            if not fn.endswith((".html", ".css")):
                continue
            path = os.path.join(dp, fn)
            with open(path, encoding="utf-8", errors="replace") as f:
                text = f.read()
            refs = refs_in_html(text) if fn.endswith(".html") else refs_in_css(text)
            for pos, kind, ref in refs:
                t = target(root, dp, ref)
                if t is None:
                    continue
                checked += 1
                if not exists(t):
                    rel = os.path.relpath(path, root)
                    broken.append(f"{rel}:{line_of(text, pos)}  {kind}  {ref}")
    print(f"проверено адресов: {checked}")
    print(f"битых: {len(broken)}")
    for b in broken:
        print(f"   {b}")
    return 1 if broken else 0


if __name__ == "__main__":
    raise SystemExit(main())
