#!/usr/bin/env python3
"""
Generate courses/index.html from courses/courses-registry.json (REDESIGN.md §5).
Run after editing the registry: python3 scripts/render_courses_hub.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REGISTRY = os.path.join(ROOT, "courses", "courses-registry.json")
OUT = os.path.join(ROOT, "courses", "index.html")

# REDESIGN §3.3 tags + ab-decisions
COURSE_LABELS: dict[str, str] = {
    "ab-stat-os": "A/B · Middle→Senior",
    "monetization": "Монетизация · Middle",
    "product-analytics": "Продукт · Junior→Senior",
    "quasi-experiments": "Causal · Senior",
    "ab-decisions": "A/B · Middle",
}

# Display order: learning path narrative
DISPLAY_ORDER = [
    "product-analytics",
    "ab-decisions",
    "ab-stat-os",
    "monetization",
    "quasi-experiments",
]

THEME_BTN = """<button type="button" class="theme-toggle" aria-label="Тёмная тема">
<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>
<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
</svg>
</button>"""

BURGER_BTN = """<button type="button" class="nav-burger" id="nav-burger" aria-expanded="false" aria-controls="nav-drawer" aria-label="Меню">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
</button>"""


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def nav_html(active: str) -> str:
    ac = lambda key: ' class="is-active"' if active == key else ""

    return f"""<header class="site-nav">
  <div class="site-nav-inner">
    <div class="site-nav-left">
      <a href="/" class="nav-brand">Alex Davydov</a>
      <nav class="nav-links" aria-label="Основное меню">
        <a href="/courses/"{ac("courses")}>Курсы</a>
        <a href="/cases/">Кейсы</a>
        <a href="/notes/">Заметки</a>
        <a href="/career/">Карьера</a>
      </nav>
    </div>
    <div class="site-nav-right">
      <a href="/career/" class="nav-mentor">Менторство</a>
      {THEME_BTN}
      {BURGER_BTN}
    </div>
  </div>
</header>
<div class="nav-drawer-backdrop" id="nav-drawer-backdrop"></div>
<nav class="nav-drawer" id="nav-drawer" aria-label="Мобильное меню">
  <a href="/courses/">Курсы</a>
  <a href="/cases/">Кейсы</a>
  <a href="/notes/">Заметки</a>
  <a href="/career/">Карьера</a>
  <a href="/lab/">Инструменты</a>
  <a href="/knowledge/">База знаний</a>
  <a href="/about/">Обо мне</a>
  <a href="/search/">Поиск</a>
  <a href="/companies/">Для компаний</a>
  <a href="/career/" class="nav-mentor">Менторство</a>
</nav>"""


def footer_html() -> str:
    return """<footer class="site-footer">
  <nav class="site-footer-links" aria-label="Подвал">
    <a href="/courses/">Курсы</a>
    <a href="/cases/">Кейсы</a>
    <a href="/career/">Карьера</a>
    <a href="/companies/">Для компаний</a>
    <a href="https://t.me/Datalake">Telegram</a>
  </nav>
  <span class="footer-copy">© 2026 davydov.my</span>
</footer>"""


def course_card(slug: str, title: str, desc: str) -> str:
    label = COURSE_LABELS.get(slug, "")
    href = f"/lab/{slug}/"
    return f"""<a class="course-card" href="{href}">
  <span class="course-tag">{esc(label)}</span>
  <span class="course-arr">↗</span>
  <div class="course-title">{esc(title)}</div>
  <div class="course-desc">{esc(desc)}</div>
</a>"""


def main() -> int:
    with open(REGISTRY, encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        print("courses-registry.json must be an array", file=sys.stderr)
        return 1
    by_slug = {item["slug"]: item for item in raw if isinstance(item, dict) and item.get("slug")}

    cards_html = []
    for slug in DISPLAY_ORDER:
        item = by_slug.get(slug)
        if not item:
            continue
        cards_html.append(
            course_card(slug, item.get("title") or "", item.get("description") or "")
        )
    for item in raw:
        slug = item.get("slug")
        if slug in DISPLAY_ORDER:
            continue
        if slug:
            cards_html.append(
                course_card(slug, item.get("title") or "", item.get("description") or "")
            )

    body = f"""{nav_html("courses")}
<div class="site-wrap">
  <h1 class="page-title">Курсы</h1>
  <p class="page-lead">Траектория от продукта к экспериментам и причинному выводу. Практика — в <a href="/lab/">/lab/</a>.</p>

  <div class="learning-path">
    <p class="path-label">С чего начать</p>
    <div class="path-steps">
      <a href="/lab/product-analytics/">Аналитика продукта</a>
      <span>→</span>
      <a href="/lab/ab-decisions/">A/B-решения</a>
      <span>→</span>
      <a href="/lab/ab-stat-os/">Статистика A/B</a>
      <span>→</span>
      <a href="/lab/quasi-experiments/">Квазиэксперименты</a>
    </div>
  </div>

  <div class="karpov-banner">
    <div class="karpov-dot"></div>
    <p><strong>Скоро на karpov.courses</strong> — новый курс по аналитике. Следи за анонсом в <a href="https://t.me/Datalake">Telegram</a>.</p>
  </div>

  <div class="course-grid">
{chr(10).join("    " + c for c in cards_html)}
  </div>
</div>
{footer_html()}
<script src="/main.js" defer></script>"""

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Курсы — davydov.my</title>
<link rel="canonical" href="https://davydov.my/courses/"/>
<meta name="description" content="Курсы по аналитике продукта, A/B, монетизации и квазиэкспериментам. Рекомендованный путь и материалы на davydov.my."/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="Курсы — davydov.my"/>
<meta property="og:description" content="Курсы по аналитике продукта, A/B, монетизации и квазиэкспериментам."/>
<meta property="og:url" content="https://davydov.my/courses/"/>
<meta property="og:image" content="https://davydov.my/assets/og-card.svg"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="stylesheet" href="/style.css"/>
</head>
<body>
{body}
</body>
</html>
"""

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
