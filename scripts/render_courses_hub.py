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

# REDESIGN §3.3 tags
COURSE_LABELS: dict[str, str] = {
    "ab-stat-os": "A/B · Middle→Senior",
    "ab-decisions": "A/B · Middle",
    "monetization": "Монетизация · Middle",
    "product-analytics": "Продукт · Junior→Senior",
    "quasi-experiments": "Causal · Senior",
}

# Display order: learning path narrative
DISPLAY_ORDER = [
    "product-analytics",
    "ab-stat-os",
    "ab-decisions",
    "monetization",
    "quasi-experiments",
]

BURGER_BTN = '<button type="button" class="nav-burger" id="nav-burger" aria-expanded="false" aria-controls="nav-drawer" aria-label="Меню"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>'


def esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def nav_html(active: str) -> str:
    def _a(href: str, label: str, key: str) -> str:
        style = ' style="color:var(--ink)"' if active == key else ""
        return f'<a href="{href}"{style}>{label}</a>'

    return f"""<nav class="nav" aria-label="Основное меню">
  <a href="/" class="logo">
    <div class="logo-mark"><span>Δ</span></div>
    <span>davydov.my</span>
  </a>
  <div class="nav-links">
    {_a("/courses/", "Курсы", "courses")}
    {_a("/workspace/", "Workspace", "workspace")}
    {_a("/cases/", "Кейсы", "cases")}
    {_a("/notes/", "Заметки", "notes")}
    {_a("/career/", "Менторство", "career")}
  </div>
  {BURGER_BTN}
</nav>
<div class="nav-drawer-backdrop" id="nav-drawer-backdrop"></div>
<nav class="nav-drawer" id="nav-drawer" aria-label="Мобильное меню">
  <div class="nav-drawer-section nav-drawer-section--primary">
    <a href="/companies/">Для компаний</a>
    <a href="/courses/">Курсы</a>
    <a href="/workspace/">Workspace</a>
    <a href="/cases/">Кейсы</a>
    <a href="/notes/">Заметки</a>
    <a href="/approach/">Подход</a>
    <a href="/career/">Карьера</a>
    <a href="/career/">Менторство</a>
  </div>
  <hr class="nav-drawer-divider" aria-hidden="true"/>
  <div class="nav-drawer-section nav-drawer-section--secondary">
    <a href="/about/">Обо мне</a>
    <a href="/search/">Поиск</a>
  </div>
</nav>"""


def footer_html() -> str:
    return """<div class="footer-spacer"></div>
<footer class="footer">
  <nav class="footer-links" aria-label="Подвал">
    <a href="https://t.me/Datalake">Telegram</a>
    <a href="https://solvery.io/ru/mentor/alex_davydov">Solvery</a>
    <a href="https://getmentor.dev/mentor/sasha-davydov-3357">GetMentor</a>
    <a href="https://www.linkedin.com/in/alexanderdavydow/">LinkedIn</a>
  </nav>
  <span class="footer-center">DAVYDOV.MY — SINCE 2020</span>
  <span class="footer-right">© 2026</span>
</footer>"""


def course_card(slug: str, title: str, desc: str, num: int) -> str:
    label = COURSE_LABELS.get(slug, "")
    href = f"/lab/{slug}/"
    num_str = f"{num:02d}"
    return f"""<a class="course" href="{href}">
  <div class="course-meta"><span class="course-num">{num_str}</span><span>{esc(label)}</span></div>
  <h3>{esc(title)}</h3>
  <p>{esc(desc)}</p>
  <span class="course-arrow">↗</span>
</a>"""


def main() -> int:
    with open(REGISTRY, encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        print("courses-registry.json must be an array", file=sys.stderr)
        return 1
    by_slug = {item["slug"]: item for item in raw if isinstance(item, dict) and item.get("slug")}

    cards_html = []
    counter = 1
    for slug in DISPLAY_ORDER:
        item = by_slug.get(slug)
        if not item:
            continue
        cards_html.append(
            course_card(slug, item.get("title") or "", item.get("description") or "", counter)
        )
        counter += 1
    for item in raw:
        slug = item.get("slug")
        if slug in DISPLAY_ORDER:
            continue
        if slug:
            cards_html.append(
                course_card(slug, item.get("title") or "", item.get("description") or "", counter)
            )
            counter += 1

    body = f"""{nav_html("courses")}
<div class="page">
  <h1 class="page-title">Курсы<span class="accent-dot">.</span></h1>
  <p class="page-lead">Траектория от продукта к экспериментам и причинному выводу. <a href="/lab/">Практические инструменты и симуляторы</a> — в разделе Lab.</p>

  <div class="learning-path">
    <span class="learning-path-label">С чего начать</span>
    <span class="learning-path-chain">
      <a href="/lab/product-analytics/">Аналитика продукта</a>
      <span class="learning-path-arrow">→</span>
      <a href="/lab/ab-stat-os/">Статистика A/B</a>
      <span class="learning-path-arrow">→</span>
      <a href="/lab/ab-decisions/">A/B-решения</a>
      <span class="learning-path-arrow">→</span>
      <a href="/lab/monetization/">Монетизация</a>
      <span class="learning-path-arrow">→</span>
      <a href="/lab/quasi-experiments/">Квазиэксперименты</a>
    </span>
  </div>

  <div class="banner" style="margin:32px 0">
    <div class="banner-left">
      <span class="banner-tag">COMING SOON</span>
      <span>Новый курс на <strong>karpov.courses</strong> — следи за анонсом в <a href="https://t.me/Datalake">Telegram</a></span>
    </div>
  </div>

  <div class="courses-grid">
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
<meta property="og:image" content="https://davydov.my/assets/og/courses.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
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
