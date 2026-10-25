"""Общие данные каталога и карточек главной, без записи файлов."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

from render_ai_analyst_hub import collect, collect_base, field

ROOT = Path(__file__).resolve().parent.parent
TOPICS = {"ai": "AI-first аналитика", "ab": "Эксперименты",
          "money": "Монетизация", "everywhere": "Аналитика везде"}
# Датированные справочники и замороженные исследования сохраняют свои URL,
# но не попадают в витрину. Включение обратно — редакционное решение.
NOT_PROMOTED = {
    "/workspace/articles/analytics-community-map/", "/workspace/articles/tools-map/",
    "/workspace/articles/ab-traps-factory/", "/workspace/articles/ai-evals-production/",
    "/workspace/articles/honesty-probe-hint/", "/workspace/articles/llm-decisions-two-metrics/",
    "/workspace/articles/sgr-ab-decisions/",
}


def validate_url(url: str) -> None:
    if not url.startswith("/") or url.startswith("//") or ".." in url.split("/"):
        raise ValueError(f"Недопустимый внутренний адрес: {url}")
    page = ROOT / url.strip("/") / "index.html"
    if not page.is_file() or re.search(r'http-equiv=["\']refresh', page.read_text(), re.I):
        raise ValueError(f"Материал отсутствует или стал заглушкой: {url}")


def cases() -> list[dict]:
    source = (ROOT / "cases/index.html").read_text(encoding="utf-8")
    out = []
    for block in re.findall(r'<div class="case">(.*?)\n    </div>\n', source, re.S):
        link = re.search(r'<a href="(/cases/([^/\"]+)/)" class="case-link">([^<]+)</a>', block)
        text = re.search(r"<p>(.*?)</p>", block, re.S)
        if not link or not text:
            raise ValueError("Не удалось прочитать карточку /cases/ целиком")
        url, slug, title = link.groups()
        validate_url(url)
        out.append({"url": url, "slug": slug, "title": html.unescape(title),
                    "blurb": html.unescape(re.sub(r"<[^>]+>", "", text.group(1))),
                    "topic": "ab" if slug == "llm-ab-case" else "everywhere",
                    "format": "Разбор"})
    if not out:
        raise ValueError("На /cases/ не найдены карточки")
    return out


def materials() -> list[dict]:
    series = collect()
    out = [{**a, "topic": "ai", "format": "Серия «AI-аналитик»"} for a in series]
    out += [{**a, "topic": "money" if a["rubric"] == "Монетизация" else "ab",
             "format": "Статья"} for a in collect_base()]
    out += cases()
    # Новый самостоятельный AI-first текст не обязан быть частью прежней серии.
    # В его HTML указываются material-topic и description, запись — в поиске.
    known = {a["url"] for a in out}
    for entry in json.loads((ROOT / "assets/search-index.json").read_text()):
        url = entry["url"]
        if entry.get("type") != "article" or url in known or url in NOT_PROMOTED:
            continue
        validate_url(url)
        source = (ROOT / url.strip("/") / "index.html").read_text()
        topic = re.search(r'<meta name="material-topic" content="([^"]+)"', source)
        if not topic:
            continue
        if topic[1] not in TOPICS:
            raise ValueError(f"Неизвестная тема у {url}: {topic[1]}")
        out.append({"url": url, "topic": topic[1], "format": "Статья",
                    "title": field(source, r"<h1[^>]*>([^<]+)</h1>", "заголовок", url),
                    "blurb": field(source, r'<meta name="description" content="([^"]+)"', "description", url)})
    urls = [a["url"] for a in out]
    if len(set(urls)) != len(urls):
        raise ValueError("Один материал повторяется в каталоге")
    for a in out:
        validate_url(a["url"])
        if a["url"] in NOT_PROMOTED:
            raise ValueError(f"Скрытый материал попал в каталог: {a['url']}")
    return out


def catalog_item(a: dict) -> str:
    e = html.escape
    return (f'        <li class="dv-catalog-item" data-topic="{a["topic"]}">\n'
            f'          <a href="{e(a["url"], quote=True)}">\n'
            f'            <div class="dv-material-copy"><h2>{e(a["title"])}</h2>\n'
            f'              <p>{e(a["blurb"])}</p></div>\n'
            f'            <span class="dv-material-meta">{e(TOPICS[a["topic"]])}</span>\n'
            f'            <span class="dv-material-arrow" aria-hidden="true">↗</span>\n'
            f'          </a>\n        </li>')


def replace_block(source: str, name: str, value: str) -> str:
    start, end = f"<!-- {name}:start -->", f"<!-- {name}:end -->"
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError(f"Нужна одна пара маркеров {name}")
    i, j = source.index(start) + len(start), source.index(end)
    if i > j:
        raise ValueError(f"Неверный порядок маркеров {name}")
    return source[:i] + "\n" + value + "\n" + source[j:]
