#!/usr/bin/env python3
"""Счётчик GoatCounter: на живой странице ровно один, на заглушке ни одного.

Живая страница без счётчика не видна в статистике, две копии считают
визит дважды. Заглушка со счётчиком тоже считает визит дважды: сначала
её саму, потом страницу, на которую она уводит.

Счётчик приходит из шаблона подвала (_partials/site-footer.html) на всех
страницах с маркерами footer; на страницах без шаблонного подвала
(симуляторы, site-map, тренажёр) он вписан руками. Проверка не различает
эти случаи — она смотрит только на итог.

Какие файлы опубликованы, считается так же, как у Jekyll: без каталогов
на «_» и «.», без шаблонов из exclude в _config.yml. Заглушка — страница
с <meta http-equiv="refresh">. Исключение — файл подтверждения Google:
его содержимое задаёт Google, трогать нельзя.

Код выхода: 0 — всё сходится, 1 — есть нарушения.
"""
import fnmatch
import os
import re
import subprocess
import sys

COUNTER = re.compile(r'<script[^>]*src="[^"]*gc\.zgo\.at/count\.js"', re.I)
REFRESH = re.compile(r'<meta[^>]+http-equiv=["\']refresh["\']', re.I)
SKIP = ("google9b84a06f40ea405c.html",)


def repo_root() -> str:
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def excludes(root: str) -> list[str]:
    """Шаблоны из exclude в _config.yml — простым разбором, без yaml."""
    out, inside = [], False
    with open(os.path.join(root, "_config.yml"), encoding="utf-8") as f:
        for line in f:
            if re.match(r"^exclude:\s*$", line):
                inside = True
                continue
            if inside:
                m = re.match(r'^\s+-\s+"?([^"#\n]+?)"?\s*$', line)
                if m:
                    out.append(m.group(1))
                elif line.strip() and not line.startswith((" ", "#")):
                    break
    return out


def excluded(rel: str, patterns: list[str]) -> bool:
    # Как у Jekyll 3: fnmatch без FNM_PATHNAME («*» захватывает и «/»)
    # или совпадение префикса каталога — для файла и каждого его каталога.
    parts = rel.split("/")
    for i in range(1, len(parts) + 1):
        cand = "/".join(parts[:i])
        for p in patterns:
            if fnmatch.fnmatchcase(cand, p) or cand == p or cand.startswith(p + "/"):
                return True
    return False


def published(root: str) -> list[str]:
    files = subprocess.check_output(
        ["git", "ls-files", "*.html"], cwd=root, text=True).split()
    pats = excludes(root)
    return [f for f in files
            if not re.search(r"(^|/)[_.]", f) and not excluded(f, pats)]


def main() -> int:
    root = repo_root()
    errors, live, stubs = [], 0, 0
    for rel in published(root):
        if rel in SKIP:
            continue
        with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as f:
            s = f.read()
        n = len(COUNTER.findall(s))
        if REFRESH.search(s):
            stubs += 1
            if n:
                errors.append(f"{rel}: заглушка со счётчиком ({n}) — визит посчитается дважды")
        else:
            live += 1
            if n != 1:
                errors.append(f"{rel}: живая страница, счётчиков {n}, нужен ровно один")
    print(f"живых страниц: {live}, заглушек: {stubs}")
    for e in errors:
        print(f"ОШИБКА  {e}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
