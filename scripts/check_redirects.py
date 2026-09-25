#!/usr/bin/env python3
"""Проверка страниц-заглушек: цель существует и сама не заглушка.

Зачем отдельный скрипт, когда есть lychee. Lychee читает <a href> и не
читает <meta http-equiv="refresh">. Для него заглушка — обычная страница
с одной ссылкой, а цепочка из двух заглушек — две живые ссылки подряд.
Поэтому две поломки он пропускает обе:

  1. Заглушка ведёт на адрес, которого нет. Человек по ссылке из письма
     или Telegram попадает в 404, а проверка зелёная. Так сейчас живут
     пять заглушек: /simulators/ad-fatigue/, /simulators/ad-monetization/,
     /simulators/ride-hailing-mvp/ и два их about/.
  2. Заглушка ведёт на заглушку. Браузер доедет, но за два-три прыжка,
     и поисковик считает такой адрес слабее. Сейчас таких 29 из 72.

Скрипт смотрит на url= внутри meta refresh — то, по чему на самом деле
уезжает браузер, а не на дублирующую ссылку в теле страницы.

Запуск из корня репозитория:

    python3 scripts/check_redirects.py

Выход 0 — заглушки в порядке. Выход 1 — найдены мёртвые цели или цепочки,
список напечатан. Печатать и выходить нулём нельзя: проверка, которая
не валит сборку, перестаёт быть проверкой.
"""
from __future__ import annotations

import os
import posixpath
import re
import sys

REFRESH = re.compile(
    r'<meta[^>]+http-equiv=["\']refresh["\'][^>]*content=["\'][^"\']*?url=([^"\'\s>]+)',
    re.I,
)

SKIP_DIRS = {"_archive", "_staging", ".claude", ".git", "node_modules"}


def repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def html_files(root: str) -> list[str]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".html"):
                full = os.path.join(dirpath, name)
                out.append(os.path.relpath(full, root).replace(os.sep, "/"))
    return sorted(out)


def target_of(root: str, rel: str) -> str | None:
    """Адрес из meta refresh или None, если это не заглушка."""
    with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as f:
        m = REFRESH.search(f.read())
    return m.group(1) if m else None


def to_file(rel_from: str, href: str) -> str | None:
    """Адрес → путь файла от корня репозитория. None для внешних."""
    href = href.split("#")[0].split("?")[0]
    if not href or href.startswith(("http://", "https://", "mailto:", "//")):
        return None
    if href.startswith("/"):
        path = href.lstrip("/")
    else:
        path = posixpath.normpath(
            posixpath.join(posixpath.dirname(rel_from), href)
        )
    if path in (".", ""):
        path = "index.html"
    # Каталог — значит index.html внутри него.
    if path.endswith("/") or not posixpath.splitext(path)[1]:
        path = posixpath.join(path.rstrip("/"), "index.html")
    return path


def main() -> int:
    root = repo_root()
    files = html_files(root)
    stubs = {}
    for rel in files:
        t = target_of(root, rel)
        if t is not None:
            stubs[rel] = t

    existing = set(files)
    dead: list[tuple[str, str, str]] = []
    chains: list[tuple[str, str, str]] = []

    for rel, href in sorted(stubs.items()):
        path = to_file(rel, href)
        if path is None:
            continue  # внешний адрес — не наша забота
        if path not in existing and not os.path.exists(os.path.join(root, path)):
            dead.append((rel, href, path))
        elif path in stubs:
            chains.append((rel, href, stubs[path]))

    print(f"заглушек: {len(stubs)}")
    print(f"мёртвых целей: {len(dead)}")
    print(f"цепочек: {len(chains)}")

    if dead:
        print("\nЦЕЛЬ НЕ СУЩЕСТВУЕТ:", file=sys.stderr)
        for rel, href, path in dead:
            print(f"   {rel}\n      url={href}  →  {path}", file=sys.stderr)
    if chains:
        print("\nЦЕПОЧКА (цель — сама заглушка):", file=sys.stderr)
        for rel, href, nxt in chains:
            print(f"   {rel}\n      url={href}  →  и дальше на {nxt}",
                  file=sys.stderr)

    return 1 if (dead or chains) else 0


if __name__ == "__main__":
    raise SystemExit(main())
