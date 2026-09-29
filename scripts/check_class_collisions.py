#!/usr/bin/env python3
"""Классы страницы, которые незаметно получают оформление из /style.css.

Страница со своим <style> называет свой компонент .badge, .tag или
.case-metric — и не знает, что в /style.css класс с тем же именем уже
есть. Правило сайта применяется к её элементам тоже: чего страница не
переопределила, то протекает. Так в прототипе «Механика AI-аналитика»
.badge стал капсом, а .tag получил рамку; в /cases/industriya/ плитки
метрик получили чужую сетку с промежутком 16px и линию сверху. Нашлось
глазами, не проверкой. В /workspace/articles/question-paths/ то же самое
однажды заметили и закрыли сбросом руками (.qp .note{display:block;...}).

Что считается совпадением. Во встроенном <style> страницы берётся
последний составной селектор каждого правила: у «.qp .note» это .note.
В /style.css — правила из одного составного селектора: .note, .note:hover,
a.note. Контекстные правила сайта (.cases-grid .case) к элементам страницы
не пристают, их не смотрим. Составной класс сайта .a.b действует только на
элемент с обоими классами: совпадением он считается, если такой элемент
есть в разметке страницы. Иначе .reveal.in из /style.css засчитывался бы
утечкой в свой .in страницы, у которого .reveal нет. Класс, объявленный и там и там, — совпадение;
свойства сайта, которых страница не задала сама, — утечка. Сокращённое
свойство страницы закрывает полные: border закрывает border-top.

Громко только там, где больно:

  ОШИБКА — утекает то, что меняет вид: display, сетка, шрифт, регистр,
            цвет, фон, рамки, размеры, позиция. Выход 1.
  предупреждение — утекают только отступы и выравнивание (margin,
            padding, gap, align-*). Печатается, выход 0: так бывает
            и при намеренном расширении компонента сайта — например,
            .ags .series-nav{grid-column:1} в разборах на каркасе .ags.
  без вывода — страница переопределила всё, или утекает то, что вида не
            меняет (transition, cursor, -webkit-overflow-scrolling).

Если страница намеренно берёт у сайта компонент вместе с видом, пару
«страница — класс» добавить в ALLOW с причиной. Лучше — переименовать
свой класс, как сделано в прототипе (.chk, .art, .pbar).

Не видит: стили и классы, которые вставляет JS (класс in у .reveal
ставит main.js — в разметке его нет), и страницы без /style.css.

Запуск из корня репозитория:

    python3 scripts/check_class_collisions.py
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKIP_DIRS = {"_archive", "_staging", "_partials", ".claude", ".git", "node_modules"}

# (страница, класс) → почему совпадение намеренное.
ALLOW: dict[tuple[str, str], str] = {}

# Утечка этих свойств вида не меняет — не печатаем.
QUIET = ("transition", "cursor", "will-change", "-webkit-overflow-scrolling",
         "-webkit-tap-highlight-color")
# Отступы и выравнивание — предупреждение, не ошибка.
SOFT = ("margin", "padding", "gap", "row-gap", "column-gap", "align-",
        "justify-", "place-", "order", "z-index")

COMMENT = re.compile(r"/\*.*?\*/", re.S)
TOKEN = re.compile(r"([^{}]+)\{([^{}]*)\}|(@[^{}]+)\{|\}")
STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
ELEMENT_CLASS = re.compile(r'\bclass="([^"]*)"')
CLASS = re.compile(r"\.([A-Za-z_][\w-]*)")


def rules(css: str):
    """(селектор, свойства) по каждому правилу; @media раскрывается."""
    css = COMMENT.sub("", css)
    for m in TOKEN.finditer(css):
        if m.group(1) is None:
            continue                     # @media { … } или закрывающая скобка
        sel, body = m.group(1).strip(), m.group(2)
        if sel.startswith("@"):
            continue                     # @font-face, @keyframes и подобное
        props = {p.split(":", 1)[0].strip().lower()
                 for p in body.split(";") if ":" in p}
        for s in sel.split(","):
            yield s.strip(), props


def compounds(sel: str) -> list[str]:
    return [c for c in re.split(r"\s*[>+~]\s*|\s+", sel.strip()) if c]


def covered(prop: str, props: set[str]) -> bool:
    return prop in props or prop.split("-")[0] in props


def kind(prop: str) -> str:
    if prop.startswith(QUIET):
        return "quiet"
    if prop.startswith(SOFT):
        return "soft"
    return "hard"


def site_classes() -> dict[frozenset[str], set[str]]:
    """Классы одиночных правил сайта: .x → {x}, .a.b → {a, b}."""
    with open(os.path.join(ROOT, "style.css"), encoding="utf-8") as f:
        css = f.read()
    out: dict[frozenset[str], set[str]] = defaultdict(set)
    for sel, props in rules(css):
        parts = compounds(sel)
        if len(parts) == 1:
            key = frozenset(CLASS.findall(parts[0]))
            if key:
                out[key] |= props
    return out


def main() -> int:
    site = site_classes()
    errors, warnings = [], []
    pages = 0
    for dp, dirnames, files in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for fn in sorted(files):
            if not fn.endswith(".html"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
            with open(path, encoding="utf-8") as f:
                s = f.read()
            if 'href="/style.css"' not in s or 'http-equiv="refresh"' in s:
                continue
            own = "".join(STYLE.findall(s))
            if not own:
                continue
            pages += 1
            mine: dict[str, set[str]] = defaultdict(set)
            for sel, props in rules(own):
                parts = compounds(sel)
                if parts:
                    for c in CLASS.findall(parts[-1]):
                        mine[c] |= props
            elements = [set(m.split()) for m in ELEMENT_CLASS.findall(s)]
            for key, site_props in sorted(site.items(), key=lambda kv: sorted(kv[0])):
                hit = key & mine.keys()
                if not hit:
                    continue
                if len(key) > 1 and not any(key <= el for el in elements):
                    continue             # .a.b: на странице нет элемента с обоими
                c = ".".join(sorted(key))
                if (rel, c) in ALLOW:
                    continue
                props = set().union(*(mine[k] for k in hit))
                leak = sorted(p for p in site_props if not covered(p, props))
                hard = [p for p in leak if kind(p) == "hard"]
                soft = [p for p in leak if kind(p) == "soft"]
                if hard:
                    errors.append(f"{rel}  .{c}  ← {', '.join(hard + soft)}")
                elif soft:
                    warnings.append(f"{rel}  .{c}  ← {', '.join(soft)}")

    print(f"страниц со своим <style>: {pages}")
    print(f"ошибок: {len(errors)}, предупреждений: {len(warnings)}")
    if warnings:
        print("\nпредупреждение — из /style.css протекают отступы/выравнивание:")
        for w in warnings:
            print(f"   {w}")
    if errors:
        print("\nОШИБКА — класс страницы получает вид из /style.css:",
              file=sys.stderr)
        for e in errors:
            print(f"   {e}", file=sys.stderr)
        print("Переименуйте свой класс или переопределите эти свойства.",
              file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
