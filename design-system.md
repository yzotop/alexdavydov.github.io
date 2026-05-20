# Design System — davydov.my Swiss Grid

> **Перед началом работы над любым уроком, сценарием или компонентом дизайн-системы — прочитай `/working-protocol.md`. Этот документ описывает правила распределения ответственности между Claude Code и автором. Не пропускай его, даже если кажется, что задача рутинная.**

> Зеркало того, что сейчас есть в коде. Не рекомендации — факты.  
> Источник правды: `style.css` + реальные HTML-файлы переехавших страниц.  
> Дата: 2026-04-26 · Обновлено: 2026-05-20 (fonts: Space Grotesk → Manrope, self-hosted @font-face)

---

## 1. Переехавшие страницы

### Полностью переехавшие (используют `style.css` и CSS-переменные)

| Файл | Статус |
|------|--------|
| `index.html` | ✅ Полностью |
| `approach/index.html` | ✅ Полностью |
| `cases/index.html` | ✅ Полностью |
| `career/index.html` | ✅ Полностью |
| `notes/index.html` | ✅ Полностью |
| `about/index.html` | ✅ Полностью |
| `companies/index.html` | ✅ Полностью |
| `courses/index.html` | ✅ Полностью (генерируется `render_courses_hub.py`) |

### Частично переехавшие (nav + footer переехали; тело — кастомные `<style>`)

| Файл | Статус |
|------|--------|
| `lab/index.html` | ⚠️ Nav/footer swiss; тело — custom styles, hardcoded hex, `border-radius: 16px` |
| `knowledge/index.html` | ⚠️ Аналогично lab |
| `simulators/index.html` | ⚠️ Аналогично lab + своя цветовая схема (`#2563eb`) |
| `calculators/index.html` | ⚠️ Аналогично simulators |
| `search/index.html` | ⚠️ Nav/footer swiss; тело — custom styles, inline JS-стили |
| `cases/industriya/index.html` | ⚠️ Nav/footer swiss; тело — editorial тёплая палитра (`#444441`, `#2C2C2A`) + Chart.js 4.4.1 (CDN); намеренное исключение → см. раздел 8 |

### Не переехавшие

| Что | Признаки |
|-----|----------|
| Страницы уроков (`/lab/ab-stat-os/`, `/lab/product-analytics/` и др.) | `base.css` + отдельный `./assets/style.css`, другой дизайн |
| Страницы заметок (`/notes/thinking-modes/`, `/notes/gorillas/` и др.) | `<article class="article">` с инлайн-стилями, другая типографика |

---

## 2. Дизайн-токены

### 2.1 Цвета

Все переменные объявлены в `:root` в `style.css`:

```css
:root {
  --bg:       #ffffff;   /* фон страницы */
  --ink:      #0a0a0a;   /* основной текст, первичный цвет */
  --muted:    #737373;   /* второстепенный текст */
  --mute2:    #a3a3a3;   /* третичный текст */
  --line:     #e5e5e5;   /* разделители, лёгкие рамки */
  --line-d:   #d4d4d4;   /* разделители (темнее) */
  --soft:     #f5f5f5;   /* фоновые заливки (лёгкие) */
  --soft2:    #fafafa;   /* ещё более лёгкий фон */
  --accent:   #e63946;   /* акцент (красный) */
  --accent-d: #c92a37;   /* акцент тёмный (hover) */
}
```

**Применение:**

| Переменная | Где используется |
|-----------|-----------------|
| `--bg` | `body { background: var(--bg) }` |
| `--ink` | Основной текст, заголовки, рамки grid-компонентов, кнопка `.btn-primary`, фон футера |
| `--muted` | Подзаголовки, подписи, вторичный текст, `page-sub`, `sec-right`, `note-cat` |
| `--mute2` | Самые мелкие служебные подписи (`.stat-idx`, `.footer-center`) |
| `--line` | Разделители между карточками, bottom-border в заметках, `border-bottom` в timeline |
| `--line-d` | Усиленные разделители (план-список) |
| `--soft` | Hover-фон на `.note-cat`, фоновая заливка `.chip`, лёгкий фон на `.course:hover` (через `--soft2`) |
| `--soft2` | Hover-фон на курсах, кейсах, планах |
| `--accent` | Красный: `.nav-cta`, `.course-num`, `.stat-idx` числа, `.accent-dot`, underline на hover у курсов, blockquote border, звёзды в отзывах, `.sec-kicker` (частично) |
| `--accent-d` | Hover-состояние `.nav-cta`, `.btn-primary:hover` |

**Важно:** Чёрный фон (футер, `.news`, `.plan.feat`) — hardcoded `var(--ink)` = `#0a0a0a`, не отдельный токен. Белый текст поверх — `#fff` или `#ffffff`.

### 2.2 Типографика

**Шрифтовые стеки:**

```css
--sans: "Manrope", system-ui, sans-serif;
--mono: "Geist Mono", ui-monospace, monospace;
```

Шрифты self-hosted через `@font-face` в `style.css`, файлы в `/assets/fonts/`:

| Семья | Языки | Веса |
|---|---|---|
| `"Manrope"` | latin + cyrillic | 400, 500, 600, 700 |
| `"Geist Mono"` | latin + cyrillic (native) | 400, 500, 600 |

Формат: `woff2` с `unicode-range` для автоматического выбора файла по символу. Google Fonts не используются.

**Уровни типографики (из `style.css`):**

| Уровень | Класс / элемент | Размер | Вес | Line-height | Letter-spacing | Шрифт |
|---------|----------------|--------|-----|-------------|----------------|-------|
| Дисплей / H1 главная | `.display` | `clamp(84px, 12vw, 176px)` | 500 | `.88` | `-0.055em` | `--sans` |
| Заголовок страницы | `.page-title` | `clamp(64px, 9vw, 128px)` | 500 | `.9` | `-0.04em` | `--sans` |
| Заголовок секции | `.sec-title` | `72px` | 500 | `.96` | `-.04em` | `--sans` |
| Статья H1 | `.article h1` | `clamp(44px, 5.5vw, 68px)` | 500 | `1.06` | `-.035em` | `--sans` |
| H2 в prose | `.prose h2` | `32px` | 500 | — | — | `--sans` |
| H3 в plan/case | `h3` (инлайн) | `36px` (plan), `22px` (prose inline) | 500–600 | — | — | `--sans` |
| Лид-абзац | `.page-lead` | `22px` | 400 | `1.45` | — | `--sans` |
| `.hero-lede` | `.hero-lede` | `clamp(18px, 2vw, 22px)` | 500 | `1.38` | — | `--sans` |
| Body / prose | `.prose p`, body | `16px` | 400 | `1.65` | — | `--sans` |
| Под-текст | `.page-sub` | `15px` | 400 | `1.6` | — | `--sans`; цвет `--muted` |
| `.hero-sub` | `.hero-sub` | `14px` | 400 | `1.65` | — | `--sans`; цвет `--muted` |
| Навигация | `.nav-links a` | `13px` | 500 | — | — | `--sans` |
| Кнопки | `.btn` | `14px` | 500 | — | — | `--sans` |
| Мета-строки | `.course-meta span`, `.note-cat`, `.sec-kicker` | `11px` | 500–600 | — | `.12em` | `--mono` |
| Footnotes / index | `.stat-idx` | `10px` | 500 | — | — | `--mono` |
| Stat числа | `.stat-num` | `64px` | 500 | — | — | `--sans` |
| Plan цена | `.plan-price` | `48px` | 500 | — | — | `--sans` |
| Код | `.prose code`, `kbd` | ~`14px` | 400 | — | — | `--mono` |

**Правило: моноширинный шрифт (`--mono`) только для:**
- Мета-меток и нумерации (`01`, `02`, `11px uppercase`)
- Секций-кикеров (`§ 02 — КУРСЫ`)
- Чипов/тегов (`.note-cat`, `.chip`)
- Кода и технических строк
- Футер-центр

**Manrope (`--sans`) — всё остальное.**

### 2.3 Отступы и ритм

Формальной шкалы нет — но паттерн прослеживается:

| Контекст | Значение |
|----------|----------|
| Боковые паддинги секций (desktop) | `48px` |
| Боковые паддинги (mobile < 900px) | `24px` |
| Верхний отступ `.page` | `64px` (`.page { padding: 64px 48px 0 }`) |
| Верхний отступ `.article` | `72px` (различие с `.page` — **несоответствие №1**) |
| Между крупными секциями | `64px` |
| Между блоками внутри секции | `40px–48px` |
| Компактные разрывы | `24px–32px` |
| Внутри карточек / padding | `28px–32px` |
| Grid gap (12-кол) | `16px` |
| Grid gap курсы/кейсы | `0` (карточки встык, рамки в CSS) |
| Margin между абзацами (prose) | `16px` |

### 2.4 Сетка

**Основная сетка (только на index.html):**
```css
.grid12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
```

**Max-width контента:**
- На переехавших страницах — нет явного `max-width` на уровне `.page`; контент растягивается на всю ширину с `padding: 0 48px`
- На approach/index.html: класс `.prose--narrow { max-width: 680px }` — единственный случай явного ограничения ширины контейнера (ранее был инлайн, закрыто несоответствие №5)
- На hub-страницах: `.container { max-width: 900px; margin: 0 auto }` — кастомный (не из `style.css`)

**Компонентные сетки (двухколоночные):**

```css
/* Курсы */
.courses-grid { display: grid; grid-template-columns: 1fr 1fr; }

/* Кейсы */
.cases-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }

/* Планы (pricing) */
.pricing { display: grid; grid-template-columns: 1fr 1fr; }

/* Статистика */
.stats { display: grid; grid-template-columns: repeat(4, 1fr); }

/* Отзывы */
.tests-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
```

**Breakpoints:**

```css
@media (max-width: 900px) { /* единственный breakpoint в style.css */ }
```

Hub-страницы добавляют свой breakpoint:
```css
@media (min-width: 640px) { .hub-grid { grid-template-columns: repeat(2, 1fr); } }
```

---

## 3. Компоненты

### 3.1 Навигация (`.nav`)

**Где:** все страницы.

**HTML-структура (актуальный канон — 36 страниц, включая главную):**
```html
<nav class="nav" aria-label="Основное меню">
  <a href="/" class="logo">
    <div class="logo-mark"><span>Δ</span></div>
    <span>davydov.my</span>
  </a>
  <div class="nav-links">
    <a href="/courses/">Курсы</a>
    <a href="/workspace/">Workspace</a>
    <a href="/cases/">Кейсы</a>
    <a href="/notes/">Заметки</a>
    <a href="/career/">Менторство</a>
  </div>
  <button class="nav-burger" ...><!-- SVG --></button>
</nav>
<div class="nav-drawer-backdrop" ...></div>
<nav class="nav-drawer" ...>
  <div class="nav-drawer-section nav-drawer-section--primary">...</div>
  <hr class="nav-drawer-divider"/>
  <div class="nav-drawer-section nav-drawer-section--secondary">...</div>
</nav>
```

**Ключевые CSS-значения:**
- Layout: `display: grid; grid-template-columns: 200px 1fr auto auto`
- `padding: 20px 48px`
- `border-bottom: 1px solid var(--line)`
- `position: sticky; top: 0; z-index: 100`
- `background: rgba(255,255,255,.85); backdrop-filter: blur(12px)`
- `font-size: 13px; font-weight: 500`

**`.logo-mark`:**
- `28×28px`, `background: var(--ink)`, `color: #fff`
- Содержимое — символ Δ (греческая «дельта», семантически связан с тематикой A/B-экспериментов)
- Псевдоэлемент `::after` — красная полоска, слайдит вверх: `transform: translateY(101%) → 0`

**`.nav-links a`:**
- `gap: 28px`
- Анимированное подчёркивание: `::after { height: 2px; transform: scaleX(0) → scaleX(1) }`
- Цвет: `var(--ink)` по умолчанию

**Активная ссылка:** атрибут `aria-current="page"` + CSS `.nav-links a[aria-current="page"] { color: var(--ink) }`. Класса `.active` нет — семантика через ARIA.

**`.nav-cta` (опционально, не во всех страницах):**
- `background: var(--accent); color: #fff`
- `padding: 8px 16px; font-size: 12px; font-weight: 600`
- Pulse-анимация точки: `box-shadow` spreading, `2s infinite`
- Сейчас встречается на 3 страницах (`lab/ab-decisions/`, `lab/ab-decisions/practice/`, `lab/quasi-experiments/`) как устаревший вариант — на остальных страницах «Менторство» идёт пунктом в `.nav-links`.

**`.nav-drawer`:**
- `width: min(300px, 88vw)`; слайдит из правого края
- `transform: translateX(100%) → translateX(0)` при `.is-open`
- `padding: 72px 24px 32px`
- Секция `--primary`: основные ссылки
- Секция `--secondary`: вспомогательные

**История:** ранее в этом разделе был зафиксирован вариант с логотипом «АД» и обязательной `.nav-cta` — но этот вариант существует только на 3 страницах. Фактический канон — версия с Δ и `/workspace/` в `.nav-links` (36 страниц, включая главную). Унификация 3 расходящихся страниц — отдельная задача в бэклоге.

---

### 3.2 Подвал (`.footer`)

**Где:** все страницы.

**HTML-структура:**
```html
<div class="footer-spacer"></div>
<footer class="footer">
  <nav class="footer-links" aria-label="Подвал">
    <a href="...">Telegram</a>
    <a href="...">Solvery</a>
    <a href="...">GetMentor</a>
    <a href="...">LinkedIn</a>
  </nav>
  <span class="footer-center">DAVYDOV.MY — SINCE 2020</span>
  <span class="footer-right">© 2026</span>
</footer>
```

**CSS:**
- Layout: `display: grid; grid-template-columns: 1fr auto 1fr`
- `padding: 40px 48px; background: var(--ink); color: #fff; font-size: 13px`
- `.footer-links`: `display: flex; gap: 24px; opacity: .8` → hover: `color: var(--accent)`
- `.footer-center`: `--mono`, `11px`, `opacity: .5`, `text-align: center`, `letter-spacing: .1em`
- `.footer-right`: `opacity: .5`, `text-align: right`
- `.footer-spacer`: `height: 1px; background: var(--ink); margin-top: 64px` (тёмный разделитель перед футером)

---

### 3.3 Заголовок страницы (`.page-title`)

**Где:** cases, career, notes, about, companies, approach, courses, knowledge (через inline style).

**HTML:**
```html
<div class="page">
  <h1 class="page-title">Текст<span class="accent-dot">.</span></h1>
```

**CSS:**
- `font-size: clamp(64px, 9vw, 128px)`
- `font-weight: 500; letter-spacing: -0.04em; line-height: .9`
- Иногда предшествует `<p class="page-sub">` (подзаголовок-кикер)

**`.accent-dot`:**
- Цвет `var(--accent)` (красная точка в конце заголовка)
- Анимация bounce при hover на `.page-title`

**`.page`:**
- `padding: 64px 48px 0`

---

### 3.4 Лид-абзац (`.page-lead`)

**Где:** cases, career, about, companies, approach.

**HTML:**
```html
<p class="page-lead">Текст лида</p>
```

**CSS:**
- `font-size: 22px; font-weight: 400; line-height: 1.45`
- `max-width: 680px` — **только через инлайн-стиль на approach** (в style.css нет)

---

### 3.5 Подзаголовок / кикер страницы (`.page-sub`)

**Где:** career (перед h1), approach (внутри контента), about (в portrait-row).

**HTML:**
```html
<p class="page-sub">Менторство в аналитике</p>
```

**CSS:**
- `font-size: 15px; color: var(--muted); line-height: 1.6`
- Используется как для надписи перед H1, так и для подписей под блоками

---

### 3.6 Секция-заголовок (`.sec-head`)

**Где:** index.html (секции «Курсы», «Заметки», «Подход»).

**Варианты:**

**Стандартный (`.sec-head`):**
```html
<div class="sec-head">
  <div style="grid-column:1/span 6">
    <div class="sec-kicker">§ 02 — КУРСЫ</div>
    <h2 class="sec-title" id="...">Заголовок</h2>
  </div>
  <div class="sec-right">Описание</div>
</div>
```
- Layout: 12-кол grid, `padding: 0 48px`, `margin-top: 72px/80px`

**Компактный (`.sec-head.tight`):**
```html
<div class="sec-head tight">
  <div>
    <div class="sec-kicker">§ 03 — ЗАМЕТКИ</div>
    <h2 class="sec-title">Заголовок.</h2>
  </div>
  <a class="sec-link" href="...">Все → </a>
</div>
```
- Layout: `display: flex; justify-content: space-between`
- `border-bottom: 1px solid var(--ink); padding-bottom: 16px`

**`.sec-kicker`:**
- `--mono`, `11px`, `color: var(--accent)`, `letter-spacing: .12em`, uppercase

**`.sec-title`:**
- `72px`, weight `500`, letter-spacing `-.04em`, line-height `.96`

---

### 3.7 Курс-карточка (`.course`)

**Где:** index.html, courses/index.html.

**HTML:**
```html
<a class="course" href="...">
  <div class="course-meta">
    <span class="course-num">01</span>
    <span>A/B / MIDDLE→SENIOR</span>
  </div>
  <h3>Название курса</h3>
  <p>Подзаголовок</p>
  <span class="course-arrow">↗</span>
</a>
```

**CSS:**
- `display: block; padding: 32px 28px; min-height: 200px`
- `border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink)`
- Hover: `background: var(--soft2)`
- Акцент-полоска слева: `::before { width: 4px; background: var(--accent); transform: translateX(-4px) → 0 }`
- Стрелка: `transition: translate(4px, -4px)` при hover

**`.courses-grid`:**
- `border-top: 1px solid var(--ink); border-left: 1px solid var(--ink)`
- `grid-template-columns: 1fr 1fr`
- Карточки встык, рамки образуют общую сетку

---

### 3.8 Кейс-карточка (`.case`)

**Где:** cases/index.html.

**HTML:**
```html
<div class="case">
  <div class="case-meta">
    <span class="case-co">Название компании</span>
    <span>Case #1</span>
  </div>
  <h3>Заголовок</h3>
  <p>Описание</p>
  <div class="case-metric">
    <div><div class="m-num">5%</div><div class="m-lbl">топ-менторов</div></div>
    <div><div class="m-num">42%</div><div class="m-lbl">всех сессий</div></div>
  </div>
  <div style="margin-top:16px"><span class="tag">...</span></div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
    <a class="sec-link" href="...">Открыть кейс →</a>
    <a class="sec-link" href="...">Хочешь такой разбор? →</a>
  </div>
</div>
```

**CSS:**
- `border: 1px solid var(--line); padding: 28px 28px 24px`
- Hover: `border-color: var(--ink); background: var(--soft2)`

**`.case-meta`:** `display: flex; justify-content: space-between; --mono; 11px`  
**`.case-co`:** `font-weight: 600`  
**`.m-num`:** `font-size: 28px; color: var(--accent)`  
**`.m-lbl`:** `--mono; 11px; color: var(--muted)`

---

### 3.9 Прайсинг / план (`.plan`)

**Где:** career/index.html, companies/index.html.

**HTML:**
```html
<div class="pricing">
  <div class="plan">
    <div class="plan-tag">IC · Junior→Senior</div>
    <h3>Карьерный разбор</h3>
    <ul>
      <li>Пункт</li>
    </ul>
    <a href="#" class="sec-link">Разобрать мой кейс →</a>
  </div>
  <div class="plan feat">
    <!-- Тёмная карточка -->
  </div>
</div>
```

**CSS `.plan`:**
- `padding: 32px 28px`
- `border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink)`
- Hover: `background: var(--soft2)`

**CSS `.plan.feat`:**
- `background: var(--ink); color: #fff`
- Hover: `background: #1a1a1a`

**`.plan-tag`:** `--mono; 11px; color: var(--accent); letter-spacing: .1em; uppercase`  
**`.pricing`:** `border-top: 1px solid var(--ink); border-left: 1px solid var(--ink)`

---

### 3.10 Список заметок (`.note`)

**Где:** notes/index.html, index.html (в секции заметок).

**HTML:**
```html
<a class="note" href="...">
  <span class="note-date">2026.04</span>
  <span class="note-cat">Мышление</span>
  <span class="note-title">Заголовок заметки</span>
  <span class="note-read">4 мин</span>
  <span class="note-arrow">→</span>
</a>
```

**CSS `.note`:**
- Layout: `display: grid; grid-template-columns: 90px 90px 1fr 80px 40px`
- `padding: 22px 0; border-bottom: 1px solid var(--line)`
- Hover: `padding-left: 12px` + `.note-arrow` translate

**`.note-cat`:** `--mono; 10px; background: var(--soft); padding: 4px 8px; font-weight: 500`  
**`.note-date`:** `--mono; 12px; color: var(--muted)`  
**`.note-title`:** `15px; font-weight: 500`  
**`.note-read`:** `12px; color: var(--muted2); text-align: right`

---

### 3.11 Кнопки (`.btn`)

**Где:** index.html, career, about, approach и т.д.

**HTML:**
```html
<a class="btn btn-primary" href="...">Текст <span class="chev">→</span></a>
<a class="btn btn-ghost" href="...">Текст</a>
```

**Общие:**
- `display: inline-flex; align-items: center; gap: 12px`
- `padding: 14px 22px; font-size: 14px; font-weight: 500`

**`.btn-primary`:**
- `background: var(--ink); color: #fff`
- Hover: `background: var(--accent)`

**`.btn-ghost`:**
- `border: 1px solid var(--ink); color: var(--ink)`
- Hover: `background: var(--ink); color: #fff`

**`.sec-link`:**
- Inline ссылка без рамки: `font-size: 14px; font-weight: 500`
- `::after { content: ""; height: 1px; background: var(--ink) }` — подчёркивание трансформируется при hover

---

### 3.12 Теги и чипы (`.tag`, `.chip`)

**`.tag`:**
- `display: inline-flex; padding: 8px 14px`
- `border: 1px solid var(--ink); font-size: 12px; font-weight: 500`
- Hover: `background: var(--ink); color: #fff`
- Где: cases/index.html

**`.chip`:**
- `display: inline-flex; padding: 3px 8px` (варьируется по контексту)
- `background: var(--soft); font-size: 12px`
- Где: career (contact block), search (фильтры), course-meta

---

### 3.13 Prose-блок (`.prose`)

**Где:** approach/index.html, career/index.html, companies/index.html, about/index.html.

**HTML:**
```html
<div class="prose" style="margin-top:32px">
  <p>Текст...</p>
  <h2>Раздел</h2>
  <ul>
    <li>Пункт</li>
  </ul>
</div>
```

**CSS `.prose`:**
- `p`: `font-size: 16px; line-height: 1.65; margin: 0 0 16px; max-width: 620px`
- `ul`: `font-size: 16px; line-height: 1.7; padding-left: 20px`
- `li`: `margin-bottom: 6px`
- `h2`: `font-size: 32px; font-weight: 500; letter-spacing: -.02em; margin: 48px 0 14px` (закрыто несоответствие №3)
- `h3`: `font-size: 20px; font-weight: 600; margin: 32px 0 10px`
- `table`: `width: 100%; border-collapse: collapse; font-size: 14px; margin: 0 0 24px`
- `th`: `--mono; 11px; text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--ink); uppercase`
- `th:first-child`: `width: 40%`
- `td`: `padding: 12px; border-bottom: 1px solid var(--line)`
- `tbody tr:last-child td`: `border-bottom: none`
- `pre`: `--mono; 13px; background: var(--soft); border: 1px solid var(--line); padding: 20px 24px; overflow-x: auto`
- `figure`: `margin: 32px 0`
- `figcaption`: `--mono; 11px; color: var(--muted); letter-spacing: .06em; margin-top: 8px`
- `blockquote`: `border-left: 3px solid var(--accent); padding: 4px 0 4px 20px`
- `code`: `font-family: var(--mono); background: var(--soft); padding: 1px 6px`
- `a`: цвет `var(--ink)`, подчёркивание `1px solid`

**Модификатор `.prose--narrow`:**
- `max-width: 680px` — ограничивает ширину контейнера (не параграфов)
- Используется на approach/index.html

---

### 3.14 Timeline (`.timeline`)

**Где:** about/index.html.

**HTML:**
```html
<div class="timeline">
  <div class="tl-row">
    <div class="tl-year">2023 — сейчас</div>
    <div class="tl-body">
      <div class="tl-role"><span class="co">Дзен</span> — Тимлид аналитики</div>
    </div>
  </div>
</div>
```

**CSS:**
- `.tl-row`: `display: grid; grid-template-columns: 120px 180px 1fr; gap: 32px; padding: 24px 0; border-bottom: 1px solid var(--line)`
- `.tl-year`: `--mono; 14px; color: var(--accent); font-weight: 600`
- `.tl-role`: `18px; font-weight: 600`
- `.co`: `13px; color: var(--muted)`

---

### 3.15 Portrait Row (`.portrait-row`)

**Где:** about/index.html.

**HTML:**
```html
<div class="portrait-row">
  <div class="author-av"><span>АД</span></div>
  <div>
    <p class="page-lead">...</p>
    <p class="page-sub">...</p>
  </div>
</div>
```

**CSS:**
- `display: flex; gap: 40px; align-items: flex-start`
- `.author-av`: квадрат `100×100px`, `background: var(--ink); color: #fff; font-size: 28px; font-weight: 600`

---

### 3.16 Статистика (`.stats`)

**Где:** index.html.

**HTML:**
```html
<div class="stats">
  <div class="stat">
    <span class="stat-idx">01</span>
    <div class="stat-num">300+</div>
    <div class="stat-lbl">часов менторства</div>
  </div>
  ...
</div>
```

**CSS:**
- `display: grid; grid-template-columns: repeat(4, 1fr)`
- `border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink)`
- Каждый `.stat`: `padding: 32px 24px; border-right: 1px solid var(--line); position: relative`
- `.stat-idx`: `--mono; 10px; position: absolute; top: 8px; left: 12px; opacity: .38`
- `.stat-num`: `64px; font-weight: 500`
- `.stat-lbl`: `13px; color: var(--muted); margin-top: 4px`

---

### 3.17 Banner (`.banner`)

**Где:** index.html, courses/index.html.

**HTML:**
```html
<div class="banner">
  <div class="banner-left">
    <span class="banner-tag">COMING SOON</span>
    <span>Текст объявления</span>
  </div>
  <a href="..." class="banner-right">Ссылка →</a>
</div>
```

**CSS:**
- `display: flex; justify-content: space-between; align-items: center`
- `padding: 20px 28px; border: 1px solid var(--line); background: var(--soft2)`
- `.banner-tag`: `--mono; 10px; color: var(--accent); letter-spacing: .1em; margin-right: 12px`

---

### 3.18 CTA-стрип (`.cta-strip`)

**Где:** career/index.html, companies/index.html.

**HTML:**
```html
<div class="cta-strip">
  <h3>Заголовок</h3>
  <p>Описание</p>
  <a class="btn btn-primary" href="...">Действие →</a>
</div>
```

**CSS:**
- `border: 1px solid var(--ink); padding: 48px`
- `margin-top: 64px`

---

### 3.19 Разделитель / подпись для ссылки (`.sec-link`)

**Где:** index.html, cases, career, about, knowledge, notes.

**CSS:**
- `font-size: 14px; font-weight: 500`
- Animated underline: `::after { transform: scaleX(0) → 1 }`
- Цвет: `var(--ink)` (в `.plan.feat` — белый, через `color: #fff`)

---

### 3.20 Урок (`.lesson`, `.lesson-header`)

**Где:** страницы уроков (`/lab/*/lessons/`). Шаблон: `_template.html`.

**HTML:**
```html
<article class="lesson">
  <nav class="breadcrumb">...</nav>
  <header class="lesson-header">
    <div class="lesson-meta">
      <span class="lesson-num">01</span>
      <span class="lesson-module">A/B-решения · Модуль 1</span>
      <span>8 мин</span>
    </div>
    <h1 class="lesson-title">Название урока</h1>
    <p class="lesson-lede">Лид урока</p>
  </header>
  <div class="prose">...</div>
  <footer class="lesson-footer">...</footer>
</article>
```

**CSS `.lesson`:**
- `padding: 64px 48px 0; max-width: 800px; margin: 0 auto`

**CSS `.lesson-header`:**
- `margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid var(--ink)` (жирная секционная линия, аналог `.sec-head.tight`)

**CSS `.lesson-meta`:**
- `display: flex; gap: 16px; --mono; 11px; uppercase; color: var(--muted); flex-wrap: wrap`

**CSS `.lesson-num`:** `color: var(--accent); font-weight: 600`

**CSS `.lesson-title`:** `font-size: clamp(36px, 5vw, 56px); font-weight: 500; letter-spacing: -.035em; line-height: 1.05`

**CSS `.lesson-lede`:** `font-size: 22px; line-height: 1.45; color: var(--ink); max-width: 640px` — крупный тёмный тезис, аналог `.page-lead`

**Правило:** в `.lesson-lede` ссылок не используем. Лид — это сильный тезис; подчёркивание ссылок ослабляет фразу. Первое упоминание терминов со ссылкой на словарь делается в первом абзаце `.prose`, не в лиде.

---

### 3.21 Блок-кейс (`.case-block`)

**Где:** уроки курса A/B-решения.

**HTML:**
```html
<div class="case-block">
  <div class="case-block-tag">Кейс · контекст</div>
  <p>Описание ситуации...</p>
</div>

<!-- Вариант: возврат к кейсу -->
<div class="case-block case-block--return">
  <div class="case-block-tag">Кейс · разбор</div>
  <p>Разбор ситуации...</p>
</div>
```

**CSS `.case-block`:** `border: 1px solid var(--line); padding: 24px 28px; margin: 32px 0`  
**CSS `.case-block-tag`:** `--mono; 10px; color: var(--accent); uppercase; letter-spacing: .12em; margin-bottom: 12px`  
**CSS `.case-block--return`:** `border-color: var(--accent)` (красная рамка для финального разбора)

---

### 3.22 Стоп-вопрос (`.stop-question`)

**Где:** уроки — пауза для самостоятельного размышления.

**HTML:**
```html
<div class="stop-question">
  <strong>Стоп-вопрос.</strong> Текст вопроса...
</div>
```

**CSS:** `border-left: 3px solid var(--accent); padding: 16px 20px; margin: 32px 0; background: var(--soft2)`

---

### 3.23 Формульный блок (`.formula-box`)

**Где:** уроки — отображение формул в псевдокоде.

**Визуальная концепция:** типографический акцент — формула «выходит» из текста между двумя жирными горизонталями. Без боковых рамок и заливки, в отличие от `.case-block`. Центрированная, крупная.

**HTML:**
```html
<div class="formula-box">
  <div class="formula-label">Формула · название</div>
  <div class="formula-expr">Метрика = Числитель / Знаменатель</div>
</div>
```

**CSS `.formula-box`:** `border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 32px 24px; margin: 32px 0; text-align: center`  
**CSS `.formula-label`:** `--mono; 10px; color: var(--muted); uppercase; letter-spacing: .1em; margin-bottom: 10px`  
**CSS `.formula-expr`:** `--mono; 22px; font-weight: 500; line-height: 1.4`

**Правило:** ссылок внутри `.formula-expr` не используем. Формула читается как формула, а не как текст. Если нужно сослаться на словарь по терминам из формулы — делается в абзаце-расшифровке после `.formula-box`.

**Отличие от `.case-block`:** `.case-block` — врезка с рамкой и лейблом; `.formula-box` — чистый типографический акцент без фона и боковых границ.

---

### 3.24 Протокольный список (`.protocol-list`)

**Где:** уроки — нумерованный список шагов с CSS-счётчиком.

**HTML:**
```html
<ol class="protocol-list">
  <li>Шаг первый</li>
  <li>Шаг второй</li>
</ol>
```

**CSS:**
- `counter-reset: protocol; list-style: none; padding: 0`
- `li`: `counter-increment: protocol; padding: 14px 0 14px 52px; border-bottom: 1px solid var(--line)`
- `li::before`: `content: counter(protocol, "decimal-leading-zero")` — двузначный номер `01`, `02`
- Номер: `--mono; 11px; color: var(--accent); font-weight: 600; position: absolute; left: 0`

---

### 3.25 Вывод-итог (`.takeaway`)

**Где:** уроки — финальный блок с главным инсайтом.

**HTML:**
```html
<div class="takeaway">
  <div class="takeaway-tag">Главное из урока</div>
  <p>Ключевой вывод...</p>
</div>
```

**CSS `.takeaway`:** `background: var(--ink); color: #fff; padding: 24px 28px; margin: 40px 0`  
**CSS `.takeaway-tag`:** `--mono; 10px; color: var(--accent); uppercase; letter-spacing: .12em; margin-bottom: 12px`  
**CSS `.takeaway p`:** `color: #fff` — явный override, необходим потому что `.prose p { color: var(--ink) }` имеет ту же специфичность `(0,1,1)` и без явного правила бьёт наследование от контейнера  
**CSS `.takeaway p strong`:** `color: #fff`  
**CSS `.takeaway p+p`:** `margin-top: 10px`  
**CSS `.takeaway a`:** `color: var(--accent)` — красный виден на тёмном фоне и соответствует акцентному цвету системы  
**CSS `.takeaway a:hover`:** `color: #fff; text-decoration: underline`

**Важно:** `.takeaway` всегда живёт внутри `.prose`. Все текстовые элементы внутри белые (`#fff`); красным остаётся только `.takeaway-tag`. Явные `color: #fff` на `.takeaway p` и `.takeaway p strong` необходимы — наследование от контейнера перебивается конкретными правилами `.prose`.

---

### 3.26 Навигация по урокам (`.lesson-footer`, `.lesson-nav`)

**Где:** нижняя часть каждого урока.

**HTML:**
```html
<footer class="lesson-footer">
  <nav class="lesson-nav">
    <a class="lesson-nav--prev" href="../prev-slug/">
      <div class="lesson-nav-label">← Предыдущий</div>
      <div class="lesson-nav-title">Название урока</div>
    </a>
    <a class="lesson-nav--next" href="../next-slug/">
      <div class="lesson-nav-label">Следующий →</div>
      <div class="lesson-nav-title">Название урока</div>
    </a>
  </nav>
</footer>
```

**CSS `.lesson-footer`:** `margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--ink)` (жирная секционная линия)  
**CSS `.lesson-nav`:** `display: grid; grid-template-columns: 1fr 1fr; gap: 16px`  
**CSS `.lesson-nav--prev`:** `text-align: left`  
**CSS `.lesson-nav--next`:** `text-align: right`  
**CSS `.lesson-nav-label`:** `--mono; 10px; color: var(--muted); uppercase; letter-spacing: .1em; margin-bottom: 6px`  
**CSS `.lesson-nav-title`:** `18px; font-weight: 500; letter-spacing: -.01em; transition: color .15s` → hover: `var(--accent)`

**Мобильный адаптив (< 900px):**  
- `.lesson`: `padding-left: 24px; padding-right: 24px`
- `.lesson-nav`: `grid-template-columns: 1fr`
- `.lesson-nav--next`: `text-align: left`

---

### 3.27 Breadcrumb (`.breadcrumb`)

**Где:** страницы уроков — над `.lesson-header`, связывает урок → курс → каталог. На главных разделах сайта не используется.

**HTML:**
```html
<nav class="breadcrumb" aria-label="Хлебные крошки">
  <a href="/">Главная</a>
  <span class="breadcrumb-sep">/</span>
  <a href="/courses/">Курсы</a>
  <span class="breadcrumb-sep">/</span>
  <a href="/lab/quasi-experiments/">Квазиэксперименты</a>
  <span class="breadcrumb-sep">/</span>
  <span class="breadcrumb-current">Урок 1</span>
</nav>
```

**CSS `.breadcrumb`:**
- `display: flex; flex-wrap: wrap; gap: 8px; align-items: center`
- `margin-bottom: 32px`
- `--mono; 11px; font-weight: 500; uppercase; letter-spacing: .12em`
- `color: var(--muted)`

**CSS `.breadcrumb a`:** `color: var(--muted); transition: color .15s` → hover: `color: var(--ink)`  
**CSS `.breadcrumb-sep`:** `color: var(--mute2); user-select: none`  
**CSS `.breadcrumb-current`:** `color: var(--ink)` (текущий пункт, без ссылки)

---

### 3.28 Блок вопроса (`.think-block`)

**Где:** страницы сценариев практики — между чистым графиком и кнопкой «Показать разбор».

**Назначение:** побудить читателя сформулировать собственный ответ до открытия разбора. Задаёт 2–3 конкретных вопроса. Не является стоп-вопросом урока (`.stop-question`): тот — однострочный, для пауз внутри лекционного текста; `.think-block` — структурированный, с нумерованным списком, для практических сценариев.

**HTML:**
```html
<div class="think-block">
  <div class="think-block-tag">Подумай</div>
  <ol>
    <li>Что здесь произошло?</li>
    <li>Можно ли катить в прод?</li>
    <li>Какие метрики проверить дополнительно?</li>
  </ol>
</div>
```

**CSS:**
- `.think-block`: `margin: 40px 0; padding: 28px 32px; border-left: 4px solid var(--accent); background: var(--soft)`
- `.think-block-tag`: `display: block; --mono; 11px; font-weight: 600; uppercase; letter-spacing: .12em; color: var(--accent); margin-bottom: 16px`
- `.think-block ol`: `padding-left: 20px; margin: 0`
- `.think-block li`: `font-size: 17px; line-height: 1.6; margin-bottom: 10px`
- `.think-block li:last-child`: `margin-bottom: 0`

**Отличие от `.stop-question`:** `.stop-question` — акцент с красной левой полосой на `var(--soft2)`, однострочный, без внутренней структуры. `.think-block` — более широкий, `var(--soft)` фон, содержит нумерованный список, полоса жирнее (`4px` vs `3px`).

---

### 3.29 Раскрываемый разбор (`.disclosure`)

**Где:** страницы сценариев практики — скрывает текст разбора и аннотированный SVG.

**Назначение:** читатель сначала видит только задачу (контекст + чистый график + `think-block`), затем сам нажимает кнопку и открывает разбор. После открытия кнопка заливается тёмным, сигнализируя, что режим «разбор активен».

> **Конфликт имён:** класс `.reveal` в `style.css` уже используется для scroll-анимации (IntersectionObserver добавляет `.in`; применяется на index.html). Новый компонент называется `.disclosure`, чтобы избежать конфликта. Переименование `.reveal` (анимации) в `js-reveal` — открытый вопрос (7.12).

**HTML:**
```html
<details class="disclosure">
  <summary class="disclosure-trigger">Показать разбор</summary>
  <div class="disclosure-content">
    <p>Текст разбора...</p>
    <figure>
      <img src="/path/to/your/chart.svg" alt="Аннотированный график"/>
      <figcaption>График с аннотациями: CPM растёт, выручка падает.</figcaption>
    </figure>
  </div>
</details>
```

**CSS:**
- `.disclosure`: `margin: 32px 0`
- `.disclosure-trigger`: `display: inline-block; padding: 14px 24px; border: 1px solid var(--ink); background: var(--bg); --mono; 12px; font-weight: 500; uppercase; letter-spacing: .08em; color: var(--ink); cursor: pointer; user-select: none; list-style: none`
- `.disclosure-trigger::-webkit-details-marker`: `display: none` — убирает стрелку в Chrome/Safari
- `.disclosure-trigger::marker`: `content: ""` — убирает стрелку в Firefox
- `.disclosure-trigger:hover`: `background: var(--ink); color: #fff`
- `.disclosure[open] .disclosure-trigger`: `background: var(--ink); color: #fff` — после раскрытия кнопка остаётся тёмной
- `.disclosure-content`: `margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--line)`
- `.disclosure-content > *:first-child`: `margin-top: 0`
- `.disclosure-content > *:last-child`: `margin-bottom: 0`

**Кросс-браузерность:**
- Chrome/Edge: работает штатно; `::-webkit-details-marker { display: none }` скрывает треугольник
- Safari: то же; `list-style: none` на `.disclosure-trigger` как запасной вариант
- Firefox 78+: `::marker { content: "" }` скрывает треугольник

---

### 3.30 Мета-строка сценария (`.lesson-meta--scenario`, `.lesson-type`)

**Где:** страницы сценариев практики. Расширяет существующий компонент `.lesson-meta` (раздел 3.20).

**Назначение:** в уроке третий span показывает время чтения (`5 мин`, цвет `var(--muted)`). В сценарии третий span показывает тип решения — с акцентным красным, чтобы читатель сразу видел, какой навык тренируется.

**HTML:**
```html
<div class="lesson-meta lesson-meta--scenario">
  <span class="lesson-num">001</span>
  <span class="lesson-module">Сценарий · A/B-решения</span>
  <span class="lesson-type">Что именно дало эффект</span>
</div>
```

**CSS:**
- `.lesson-type`: `color: var(--accent)` — акцентный красный вместо `var(--muted)`
- Все остальные стили наследуются от `.lesson-meta` (--mono, 11px, uppercase, flex, gap)

**Правило:** `.lesson-meta--scenario` не добавляет новых CSS-правил на контейнер — весь визуальный эффект достигается классом `.lesson-type` на конкретном `<span>`. Модификатор-класс нужен только как семантический маркер для будущих нужд (JS, фильтрация).

---

## 4. Паттерны вёрстки

### 4.1 Первый экран (hero)

Используется только на index.html. Структура: 12-кол grid.
- Левая часть (cols 1–8): `.hero-title` с огромным H1
- Правая часть (cols 9–12): лид + подзаголовок
- Ниже: теги + CTA-кнопки

На остальных страницах первый экран — просто `.page` с `.page-title` + `.page-lead`.

### 4.2 Разделение секций

Нет цветных разделителей и отбивок-плашек. Вместо этого:
- **Горизонтальные линии**: `border-bottom: 1px solid var(--ink)` (жирная) или `var(--line)` (тонкая)
- **Вертикальные линии**: `border-right: 1px solid var(--ink)` между колонками grid
- **Воздух**: большие `margin-top: 64px–80px` между секциями

### 4.3 Компонентные сетки — принцип одна рамка

Курсы, кейсы, план, статистика — все построены по одному принципу:
- Внешняя рамка: `border-top + border-left` на контейнере
- Элементы: `border-right + border-bottom`
- Итог: таблицеобразная сетка без gap

Это создаёт типографическую «газетную» раскладку.

### 4.4 Акценты в тексте

- **Жирный**: `<strong>`, вес `600` — для ключевых утверждений в prose
- **Красный**: `var(--accent)` — только функциональные акценты (числа статистики, кикеры, dot, нумерация)
- **Курсив**: `<em>` в prose, только для подписей / цитат
- **Подчёркивание**: только как hover-эффект на ссылках (animated `::after`)
- Подчёркивание в HTML-атрибуте `<u>` — не используется

### 4.5 Воздух

- Внутри компонентов: `padding: 28px–32px`
- Между секциями страницы: `margin-top: 64px–80px`
- Верх страницы (`.page`): `64px` (`.article`: `72px`)
- Prose — без декоративных вставок, только пробелы между абзацами

### 4.6 Анимации

Все анимации простые и одного типа: transform + opacity, transition `.25s–.35s`. Паттерны:
- Slide-in слева (accent bar у курсов)
- Scale-x 0→1 (underline у ссылок)
- Translate (стрелки, note indent)
- Pulse (dot в nav-cta)
- Fade+slide (`.reveal` на hero)

Нет: stagger, parallax, morphing, scroll-triggered (кроме IntersectionObserver для `.reveal`).

### 4.7 Мобильный адаптив

- Единственный breakpoint: `900px`
- Паддинги: `48px → 24px`
- Все grid → `1fr` (однocolumn)
- Nav: hamburger, desktop links скрываются (`display: none`)
- Заметки: скрываются `.note-cat` и `.note-read`
- Timeline: `120px 1fr` вместо трёхколоночного

---

## 5. Чего нет на swiss-страницах

Ниже — элементы, сознательно исключённые из системы:

| Элемент | Статус |
|---------|--------|
| Тени (`box-shadow`) | ❌ Отсутствуют (кроме pulse-анимации в nav-cta и nav-blur backdrop) |
| Скруглённые углы (`border-radius`) | ❌ Не используются на основных компонентах |
| Цветные фоны секций | ❌ Только `--ink` (чёрный) для футера и `.plan.feat` |
| Иконки (SVG/emoji наборы) | ❌ Только unicode-символы (→, ↗, §, ·, ✓) |
| Градиенты | ❌ Не используются |
| Изображения и фотографии | ❌ Не используются на swiss-страницах |
| Декоративные карточки с цветным акцентом | ❌ Hub-страницы с синими `#2563eb` карточками не считаются swiss |
| Фоновые паттерны | ❌ Нет (кроме SVG-шума на portrait в about — через `mix-blend-mode`, почти незаметен) |
| Третичные кнопки (pill-shaped, soft) | ❌ Только primary + ghost |
| Progress bars, badges с color-fill | ❌ Нет |
| Tooltips / popovers | ❌ Нет |
| Sticky sidebar | ❌ Нет |
| Breadcrumbs | ✅ Есть на страницах уроков (`.breadcrumb`, раздел 3.27); на главных разделах сайта не используются |

---

## 6. Несоответствия

### №1: Верхний отступ страницы
- `.page { padding: 64px 48px 0 }` — на большинстве страниц
- `.article { padding: 72px 48px 0 }` — на страницах заметок
- Разница: `64px` vs `72px`. Неясно, намеренно ли.

### ~~№2: Активная ссылка в nav — инлайн-стиль вместо класса~~ ✅ Закрыто
- Добавлено `.nav-links a[aria-current="page"] { color: var(--ink) }` в `style.css`
- Инлайн-атрибут `style="color:var(--ink)"` заменён на `aria-current="page"` во всех 35 источниках (33 HTML-файла + генератор `render_courses_hub.py` + `courses/index.html` регенерирован)

### ~~№3: H2 в `.prose` — два размера~~ ✅ Закрыто
- Добавлено `.prose h2 { font-size: 32px; font-weight: 500; letter-spacing: -.02em; margin: 48px 0 14px }` в `style.css`
- Инлайн-оверрайды `style="font-size:22px..."` удалены с career/index.html
- Теперь все `.prose h2` используют одно правило из CSS

### №4: Hub-страницы (lab, knowledge, simulators, calculators, search) — другая система
- Используют `font-family: -apple-system, BlinkMacSystemFont, ...` вместо `var(--sans)`
- Hardcoded цвета: `#111`, `#666`, `#0071e3`, `rgba(17,17,17,*)` вместо CSS-переменных
- `border-radius: 16px` на hub-карточках (противоречит швейцарскому стилю)
- Отдельный breakpoint `640px` вместо `900px`
- Синий цвет ссылок `#2563eb` вместо красного `var(--accent)`

### ~~№5: `max-width` текстового блока не унифицирован~~ ✅ Закрыто
- Добавлен класс `.prose--narrow { max-width: 680px }` в `style.css`
- `approach/index.html` обновлён: `<div class="prose prose--narrow">` (инлайн убран)
- Остальные prose-блоки остаются без `max-width` на контейнере (параграфы внутри `.prose p` имеют `max-width: 620px`)

### ~~№6: Таблицы — нет компонента в style.css~~ ✅ Закрыто
- Добавлены `.prose table`, `.prose th`, `.prose th:first-child`, `.prose td`, `.prose tbody tr:last-child td` в `style.css`
- `career/index.html`: все инлайн-стили с `<table>`, `<th>`, `<td>` убраны; оставлены только `style="color:var(--muted);font-style:italic"` на контентно-специфичных ячейках «До»

### ~~№7: `<details>/<summary>` — без стилизации~~ ✅ Закрыто
- Добавлен компонент `.disclosure` (раздел 3.29) в `style.css`
- `companies/index.html`: нативные `<details><summary>` остаются без стилизации — они не используют класс `.disclosure`; закрытие касается нового компонента для сценариев практики

### №8: Стат-число "4+ года в аналитике" на index.html расходится с about (9 лет)
- `index.html`: `4+` лет (стат-блок)
- `about/index.html`: «9 лет» (prose), «4+ лет» (page-lead)
- Контентное несоответствие, не дизайнерское

---

## 7. Открытые вопросы

**~~7.1 Кодовые блоки~~** ✅ Закрыто  
Добавлено `.prose pre { --mono; 13px; background: var(--soft); border: 1px solid var(--line); padding: 20px 24px; overflow-x: auto }` в `style.css`.

**7.2 Hub-страницы (lab, knowledge, simulators, calculators)**  
Эти страницы сейчас используют swiss nav/footer, но тело страницы — совсем другая система. Нужно ли их переписывать полностью, или оставить гибридными?

**~~7.3 Страницы уроков~~** ✅ Частично закрыто  
Создан шаблон `_template.html` в `/lab/ab-decisions/lessons/`. Добавлены компоненты: `.lesson`, `.lesson-header`, `.lesson-meta`, `.case-block`, `.stop-question`, `.formula-box`, `.protocol-list`, `.takeaway`, `.lesson-footer`, `.lesson-nav`, `.prose pre`, `.prose figure`, `.prose figcaption`.  
Остаётся открытым: рендеринг `<math>` / LaTeX, интерактивные embed-блоки, Sidebar/ToC.

**7.4 Sidebar / Table of Contents**  
Для длинных уроков нужна ли боковая колонка с оглавлением? В `style.css` нет ничего похожего.

**~~7.5 Изображения и подписи~~** ✅ Закрыто  
Добавлены `.prose figure { margin: 32px 0 }` и `.prose figcaption { --mono; 11px; color: var(--muted); margin-top: 8px }` в `style.css`.

**7.6 Формы**  
`.news-form` (newsletter) — единственная форма, стилизованная в `style.css`. Нет универсальных правил для `input`, `select`, `textarea`, `label`.

**~~7.7 Пагинация~~** ✅ Закрыто  
Добавлены `.lesson-footer`, `.lesson-nav`, `.lesson-nav--prev`, `.lesson-nav--next`, `.lesson-nav-label`, `.lesson-nav-title` в `style.css`. Шаблон показывает использование.

**7.8 Прогресс по курсу**  
Нет визуального маркера «урок X из Y», «пройдено/не пройдено». Нет `.progress` компонента. В шаблоне в `.lesson-meta` есть поле модуля и номер урока — можно использовать как ориентир без JS-трекинга.

**7.9 Spacing scale**  
Используемые отступы (`12px`, `16px`, `24px`, `28px`, `32px`, `40px`, `48px`, `64px`, `72px`, `80px`) похожи на неформальную 8px-сетку, но нигде не задокументированы как токены. Не ясно, можно ли использовать `20px` или только кратные 8.

**7.10 Цвета для hover на чёрном фоне**  
В `.plan.feat` (чёрная карточка) ссылки получают `color: #fff` инлайном. Нет токена `--on-dark` или аналогичного.

**7.12 Конфликт имён `.reveal`** — Открыт  
Класс `.reveal` используется в двух значениях: (1) scroll-анимация на index.html (`opacity: 0 → 1` через IntersectionObserver); (2) имя, запланированное для details/summary компонента. Конфликт разрешён переименованием нового компонента в `.disclosure`. Вопрос: переименовать анимационный класс в `.js-reveal` или `.scroll-reveal`, чтобы освободить `.reveal` для семантического использования?

**7.13 Scroll-анимация `.reveal` — плановая задача на удаление**  
Анимация «контент материализуется при появлении в viewport» (`.reveal { opacity:0; transform:translateY(24px) }` + IntersectionObserver в `main.js`) противоречит swiss-принципам: контент должен существовать как статичный объект, не возникать по триггеру прокрутки. Плановая задача — удалить компонент из `style.css` и связанный JS в IntersectionObserver, заменить поведение на статичное (контент виден сразу). Не блокирует текущую работу.

**7.11 Ссылки внутри `.takeaway`** ✅ Решено  
Принято правило: ссылки в `.takeaway a` — `color: var(--accent)` (красный виден на тёмном `var(--ink)` фоне и соответствует акцентной системе). Hover: `color: #fff; text-decoration: underline` — белый с подчёркиванием, без неожиданных цветовых переходов. Логика инвертирована по сравнению со светлым фоном (там acc → hover ink), на тёмном — acc → hover white.

---

---

## 8. Намеренные исключения из swiss-системы

### /cases/industriya/ — editorial серый

Кейс намеренно использует тёплую серую палитру (`#444441`, `#2C2C2A`, `#888780`, `#B4B2A9`) и editorial-типографику вместо стандартной swiss (`var(--ink)`, `var(--muted)`, `var(--line)`). Это сознательное стилистическое решение: математический разбор настольной игры читается естественнее в редакционном тоне, чем в технологичной чёрно-белой swiss-палитре.

**Что в кейсе уже swiss:**
- nav и footer (стандартные `.nav`, `.nav-drawer`, `.footer`)
- `/style.css` подключён
- breadcrumb работает (`.crumbs`)
- акцент-красный совпадает (`#e63946`)

**Что НЕ swiss — не трогать:**
- `inline <style>` (228 строк) с тёплой палитрой и `border-radius`
- 3 интерактивных компонента на Chart.js 4.4.1 (CDN) с hardcoded цветами в JS
- SVG-схема L→R (68 строк) с hardcoded `fill=` в attributes
- range-slider калькулятор раундов
- `.container` max-width 900px (vs `.article` 880px)
- back-link в legacy-стиле (`.back-link` класс)

Глубокая переверстка под swiss требует синхронных правок в 4 местах (CSS + 3 JS-блока + SVG attributes) и угрожает интерактиву. Соотношение риск/выигрыш — отрицательное.

**Решение:** оставить как есть. Каталог `/cases/` становится богаче, имея два жанра: классические продуктовые разборы (nloto, nikifilini, solvery, macbook — все в swiss) и математический editorial (industriya — в своём тоне).

Зафиксировано: 2026-05-05.

---

## 9. CSS-конвенции

### 9.1 Никаких inline-стилей

Запрещено использовать атрибут `style="..."` на HTML-элементах.

**Всегда:** существующий класс из `/style.css`, либо новый
класс в `/style.css`.

**Никогда:** статические оформительские стили inline на
элементе.

**Обоснование:** inline-стили дублируются между файлами,
не переиспользуются, не отражаются в дизайн-системе и
создают долг — каждый случай нужно потом находить и
рефакторить. Дизайн-система имеет смысл только когда
**все** оформительские решения проходят через неё.

**Единственное исключение:** динамические стили, задаваемые
из JavaScript в runtime — например, `position` элемента,
вычисляемая ширина, значения из пользовательского ввода.
Это не «оформление», а «состояние», и оно естественно
живёт в JS, а не в CSS.

**Если нужного класса нет:**
1. Проверить — может быть, в `/style.css` уже есть похожий
   класс (`.prose`, `.lesson`, `.case-block` и т.п.) —
   завернуть содержимое в его контейнер.
2. Если действительно нет — добавить новый класс в
   `/style.css` с описанием в этом документе (раздел 3 или
   раздел 4 — в зависимости от типа компонента).
3. Если решение «временное» (одна страница, один случай) —
   всё равно добавить класс. «Временное» в этом проекте
   живёт годами.

**Существующие исключения (зафиксированы как несоответствия,
будут устраняться):**
- В отдельных legacy-файлах остаются inline-стили,
  переехавшие из старого дизайна — устранение по мере
  редактуры этих файлов.

### 9.2 Pre-commit отчёт по CSS

Если правка трогает `/style.css` или меняет визуальную
структуру страницы — перед коммитом обязательно показать
автору как изменения отрисовались. Скриншот или ссылка на
локальный сервер. Без визуальной проверки — не коммитить.

См. также `/working-protocol.md` раздел «Процедурные
требования» — общее правило pre-commit отчёта.

---

*Документ сгенерирован на основе анализа кода. При изменении `style.css` или переехавших страниц — обновить.*
