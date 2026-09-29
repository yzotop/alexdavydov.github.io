# Design System — davydov.my Swiss Grid

> **Перед началом работы над любой страницей или компонентом — прочитай `/working-protocol.md`. Этот документ описывает правила распределения ответственности между Claude Code и автором. Не пропускай его, даже если кажется, что задача рутинная.**

> Зеркало того, что сейчас есть в коде. Не рекомендации — факты.
> Источник правды: `style.css`, шаблоны `_partials/` и живые HTML-страницы.
> Правила «когда какой компонент» — в `CLAUDE.md`, раздел «Дизайн: типы и компоненты».
> Дата: 2026-04-26 · Обновлено: 2026-09-29 (сайт после смены позиционирования: курсы, заметки, Workspace и симуляторы в архиве; шапка и подвал из шаблонов; главная из пяти блоков)

---

## 1. Типы страниц

| Тип | Каркас | Страницы |
|---|---|---|
| Главная | `.hero`, `.companies`, секции `.courses-wrap` с `.sec-head` и `.courses-grid` | `/` |
| Хаб | `.page` → `.page-title`, `.page-lead`, сетка карточек, `.cta-strip` | `/ai-analyst/`, `/cases/` |
| Статья | `.article` → `h1`, `.article-meta`, `.prose`; у серии `.series-nav` | статьи `/workspace/articles/…`, страницы кейсов `/cases/…` |
| Текстовая | `.page` → `.page-title`, `.page-lead`, `.prose`; по месту `.timeline`, `.case-block`, `.pricing`, `.cta-strip` | `/about/`, `/approach/`, `/talks/`, `/teaching/`, `/career/`, `/career/results/`, `/companies/`, `404` |
| Интерактивная | своя разметка и свой `<style>`; шапка и подвал из шаблона, если страница самостоятельная | симуляторы, карта `question-paths/map`, `/workspace/mechanics/`, `/search/` |

**Каркас статьи.** Стандартный — `.article` из `style.css`. Три разбора серии собраны на своих каркасах со стилями внутри страницы: `.ags` (`harness-by-type`, `how-agent-sees-decisions`) и `.qp` (`question-paths` и её карта), 6–8 КБ CSS на страницу. Для новых статей не используются.

**Что генерируется** (подробно — `CLAUDE.md`, «Генерируемые файлы правятся только через генератор»):

| Часть | Шаблон или источник | Генератор |
|---|---|---|
| шапка: меню и шторка | `_partials/site-header.html` | `scripts/render_site_header.py` |
| подвал | `_partials/site-footer.html` | тот же |
| карточки хаба `/ai-analyst/` | сами статьи | `scripts/render_ai_analyst_hub.py` |
| карточки главной | статьи и карточки `/cases/` | `scripts/render_home.py` |
| блок серии в статьях | сами статьи | `scripts/render_series_block.py` |

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

| Переменная | Где используется |
|-----------|-----------------|
| `--bg` | `body { background: var(--bg) }` |
| `--ink` | Основной текст, заголовки, рамки сеток, кнопка `.btn-primary`, фон подвала, `.takeaway` |
| `--muted` | Подписи, вторичный текст, `.page-sub`, `.sec-right`, неактивные пункты меню |
| `--mute2` | Самые мелкие служебные подписи (`.stat-idx`, `.breadcrumb-sep`) |
| `--line` | Разделители, рамка `.case` и `.case-block`, строки `.timeline` |
| `--line-d` | Усиленные разделители (строки `.series-nav`) |
| `--soft` | Фон `.chip`, `.prose code`, `.prose pre` |
| `--soft2` | Hover-фон карточек `.course`, `.case`, `.plan`; фон `.stop-question` |
| `--accent` | `.course-num`, `.accent-dot`, `.sec-kicker`, `.case-block-tag`, номера `.series-nav`, подчёркивание пунктов меню при наведении |
| `--accent-d` | Hover у `.btn-primary` |

**Важно:** тёмный фон (подвал, `.plan.feat`, `.takeaway`) — `var(--ink)`, отдельного токена нет. Белый текст поверх — `#fff`.

### 2.2 Типографика

**Шрифтовые стеки:**

```css
--sans: "Manrope", system-ui, sans-serif;
--mono: "Geist Mono", ui-monospace, monospace;
```

Шрифты self-hosted через `@font-face` в `style.css`, файлы в `/assets/fonts/`:

| Семья | Языки | Веса |
|---|---|---|
| `"Manrope"` | latin + cyrillic + знаки Δ и ∅ | 400, 500, 600, 700 |
| `"Geist Mono"` | latin + cyrillic (native) | 400, 500, 600 |

Формат: `woff2` с `unicode-range` для автоматического выбора файла по символу. Знаки Δ (логотип) и ∅ (Сад в меню) — отдельные файлы `manrope-signs-*.woff2`. Google Fonts не используются. Лицензии OFL лежат рядом со шрифтами.

**Уровни типографики:**

| Уровень | Класс / элемент | Размер | Вес | Line-height | Letter-spacing | Шрифт |
|---------|----------------|--------|-----|-------------|----------------|-------|
| Имя на главной | `h1.display` | `clamp(84px, 12vw, 176px)` | 500 | `.88` | `-0.055em` | `--sans` |
| Заголовок страницы | `.page-title` | `clamp(64px, 9vw, 128px)` | 500 | `.9` | `-0.04em` | `--sans` |
| Заголовок секции главной | `.sec-title` | `72px` | 500 | `.95` | `-.04em` | `--sans` |
| Статья H1 | `.article h1` | `clamp(44px, 5.5vw, 68px)` | 500 | `1.05` | `-.035em` | `--sans` |
| H2 в prose | `.prose h2` | `32px` | 500 | — | `-.02em` | `--sans` |
| Заголовок блока-призыва | `.cta-strip h3` | `40px` | 500 | `1.05` | `-.03em` | `--sans` |
| Заголовок карточки | `.course h3` / `.case h3` / `.case-block h3` | `30px` / `26px` / `26px` | 500 | `1.1–1.15` | `-.02em` | `--sans` |
| Лид-абзац | `.page-lead` | `22px` | 400 | `1.45` | — | `--sans` |
| `.hero-lede` | `.hero-lede` | `clamp(18px, 2vw, 22px)` | 500 | `1.38` | — | `--sans` |
| Body / prose | `.prose p`, body | `16px` | 400 | `1.65` | — | `--sans` |
| Под-текст | `.page-sub` | `15px` | 400 | `1.6` | — | `--sans`; цвет `--muted` |
| `.hero-sub` | `.hero-sub` | `14px` | 400 | `1.65` | — | `--sans`; цвет `--muted` |
| Меню | `.nav-links a` | `13px` | 500 | — | — | `--sans` |
| Кнопки | `.btn` | `14px` | 500 | — | — | `--sans` |
| Мета-строки | `.course-meta`, `.case-meta`, `.sec-kicker`, `.case-block-tag` | `10–11px` | 500–600 | — | `.06–.12em` | `--mono` |
| Stat числа | `.stat-num` | `64px` | 500 | — | — | `--sans` |
| Plan цена | `.plan-price` | `48px` | 500 | — | — | `--sans` |
| Код | `.prose code`, `kbd` | ~`14px` | 400 | — | — | `--mono` |

**Правило: моноширинный шрифт (`--mono`) только для:**
- мета-меток и нумерации (`01`, `№ 6`, `11px uppercase`);
- кикеров секций (`§ 02 — ОСНОВА`) и меток врезок;
- чипов (`.chip`);
- кода и технических строк;
- центра подвала.

**Manrope (`--sans`) — всё остальное.**

### 2.3 Отступы и ритм

Формальной шкалы нет — но паттерн прослеживается:

| Контекст | Значение |
|----------|----------|
| Боковые паддинги секций (desktop) | `48px` |
| Боковые паддинги (mobile < 900px) | `24px` |
| Верхний отступ `.page` | `64px` |
| Верхний отступ `.article` | `72px` (несоответствие №1) |
| Перед `.cta-strip` | `96px` (`margin-top` компонента) |
| Перед подвалом | `96px` (`.footer-spacer`) |
| Между блоками внутри секции | `40px–48px` |
| Компактные разрывы | `24px–32px` |
| Внутри карточек / padding | `28px–32px` |
| Grid gap (12-кол) | `16px` |
| Grid gap карточек `.course` | `0` (карточки встык, рамки в CSS) |
| Grid gap карточек `.case` | `16px` (карточки отдельные) |
| Margin между абзацами (prose) | `16px` |

### 2.4 Сетка

**12-колоночная сетка (только главная):**
```css
.grid12 { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; }
```

**Max-width контента:**
- `.page` — без явного `max-width`, контент тянется на всю ширину с `padding: 0 48px`;
- `.article` — `max-width: 880px; margin: 0 auto`;
- `.prose p` — `max-width: 620px`; `.prose--narrow` — `max-width: 680px` на контейнере (`/approach/`).

**Компонентные сетки (двухколоночные):**

```css
.courses-grid { display: grid; grid-template-columns: 1fr 1fr; }        /* карточки материалов */
.cases-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } /* кейсы */
.pricing      { display: grid; grid-template-columns: 1fr 1fr; }        /* тарифы */
.stats        { display: grid; grid-template-columns: repeat(4, 1fr); }  /* счётчики */
.tests-grid   { display: grid; grid-template-columns: repeat(3, 1fr); } /* отзывы, /career/ */
```

**Breakpoints в `style.css`:**

| Ширина | Что меняется |
|---|---|
| `1000px` | меню сжимается: промежутки внутри группы 18px, между группами 30px |
| `900px` | основной мобильный: меню → бургер, паддинги 48 → 24, сетки → одна колонка, подвал в столбик |
| `768px` | полоса площадок на главной (`.companies`): метка на своей строке, пункты по верху |

---

## 3. Компоненты

### 3.1 Шапка: меню и шторка (`.nav`, `.nav-drawer`)

**Где:** все страницы с шапкой. **Правится только в шаблоне** `_partials/site-header.html`, в страницы её пишет генератор между `<!-- header:start -->` и `<!-- header:end -->`.

**HTML (шаблон):**
```html
<nav class="nav" aria-label="Основное меню">
  <a href="/" class="logo">
    <div class="logo-mark"><span>Δ</span></div>
    <span>davydov.my</span>
  </a>
  <div class="nav-links">
    <span class="nav-group">
      <a href="/talks/">ММ’26</a>
      <a href="/ai-analyst/">AI-аналитик</a>
    </span>
    <span class="nav-group">
      <a href="/cases/">Аналитика везде</a>
      <a href="https://null.davydov.my/" rel="noopener">∅ Сад</a>
    </span>
    <span class="nav-group">
      <a href="/career/">Менторство</a>
      <a href="/about/">Обо мне</a>
    </span>
  </div>
  <button type="button" class="nav-burger" id="nav-burger" …>…</button>
</nav>
<div class="nav-drawer-backdrop" id="nav-drawer-backdrop"></div>
<nav class="nav-drawer" id="nav-drawer" aria-label="Мобильное меню">
  <div class="nav-drawer-section nav-drawer-section--primary">
    <div class="nav-drawer-group">…</div>   <!-- те же три группы -->
  </div>
  <hr class="nav-drawer-divider" aria-hidden="true"/>
  <div class="nav-drawer-section nav-drawer-section--secondary">
    <a href="/companies/">Для компаний</a>
    <a href="/career/results/">Результаты менторства</a>
  </div>
</nav>
```

**Ключевые CSS-значения:**
- Layout: `display: grid; grid-template-columns: 200px 1fr auto auto`; `position: sticky; top: 0`; фон с `backdrop-filter`.
- Группы: `.nav-links { gap: 56px }`, `.nav-group { gap: 28px }` — промежуток между группами вдвое шире, без линий и символов. В зоне 901–1000px — 30 и 18.
- `.nav-links a` — `white-space: nowrap`: подпись в две строки ломает высоту шапки.
- Подчёркивание при наведении: `::after { height: 2px; background: var(--accent); transform: scaleX(0) → 1 }`.
- Ниже 900px `.nav-links` скрыт, открывается шторка.

**Шторка:** справа, `width: min(300px, 88vw)`. Группы основного уровня — строками, между строками отступ `row-gap: 10px`; внутри группы пункты через «·». Второй уровень мельче и серым.

**Активный пункт:** `aria-current="page"` ставит генератор — на пункт, чей адрес совпадает с адресом страницы. Внутренние страницы раздела свой пункт не подсвечивают. CSS: `.nav-links a[aria-current="page"] { color: var(--ink) }`. Класса `.active` нет.

**`.logo-mark`:** `28×28px`, фон `var(--ink)`, символ Δ; при наведении снизу выезжает красная заливка (`::after`, `translateY(101%) → 0`).

---

### 3.2 Подвал (`.footer`)

**Где:** все страницы с шапкой. **Правится только в шаблоне** `_partials/site-footer.html`, маркеры `<!-- footer:start -->` / `<!-- footer:end -->`.

**HTML (шаблон):**
```html
<footer class="footer">
  <nav class="footer-links" aria-label="Подвал">
    <a href="https://t.me/Datalake">Telegram</a>
    <a href="https://solvery.io/ru/mentor/alex_davydov">Solvery</a>
    <a href="https://getmentor.dev/mentor/sasha-davydov-3357">GetMentor</a>
    <a href="https://www.linkedin.com/in/alexanderdavydow/">LinkedIn</a>
    <a href="/search/">Поиск</a>
  </nav>
  <span class="footer-center">DAVYDOV.MY — SINCE 2020</span>
  <span class="footer-right">© 2026</span>
</footer>
```

**CSS:**
- `display: grid; grid-template-columns: 1fr auto 1fr`; `padding: 40px 48px; background: var(--ink); color: #fff; font-size: 13px`.
- `.footer-links`: `display: flex; gap: 24px; opacity: .8` → hover `color: var(--accent)`. Ниже 900px ссылки переносятся (`flex-wrap: wrap`): иначе пятая ссылка выталкивает подвал за край.
- `.footer-center`: `--mono`, `11px`, `opacity: .5`, `letter-spacing: .1em`.
- Перед подвалом — `<div class="footer-spacer">`, пустой отступ `96px`.

---

### 3.3 Заголовок страницы (`.page-title`)

**Где:** хабы и текстовые страницы: `/ai-analyst/`, `/cases/`, `/about/`, `/approach/`, `/talks/`, `/teaching/`, `/career/`, `/career/results/`, `/companies/`.

```html
<div class="page">
  <h1 class="page-title">Аналитика везде<span class="accent-dot">.</span></h1>
  <p class="page-lead">…</p>
```

- `font-size: clamp(64px, 9vw, 128px); font-weight: 500; letter-spacing: -0.04em; line-height: .9`.
- `.accent-dot` — красная точка в конце заголовка, bounce при наведении на `.page-title`.
- `.page` — `padding: 64px 48px 0`.

### 3.4 Лид-абзац (`.page-lead`)

Под заголовком страницы: `font-size: 22px; line-height: 1.45`. Не повторяет заголовок блока ниже — на `/talks/` лид убран, потому что дублировал заголовок доклада во врезке.

### 3.5 Подзаголовок (`.page-sub`)

`font-size: 15px; color: var(--muted); line-height: 1.6`. Над H1 как кикер или под блоком как подпись; в статьях — подпись к врезке, «Термин: …».

---

### 3.6 Главная: герой, площадки, секции (`.hero`, `.companies`, `.sec-head`)

**Где:** только `/`. Карточки в секциях пишет `scripts/render_home.py`.

**Структура главной сверху вниз:**
1. `.hero` на `.grid12`: строка `.meta-row` («Саша Давыдов — AI-аналитик · A/B · монетизация»), `h1.display` слева, справа `.hero-lede` и две `.hero-sub`, ниже `.tags` и `.ctas` (две кнопки).
2. `.companies` — полоса площадок преподавания со ссылкой «Преподаю →».
3. Секции `.courses-wrap`: § 01 AI-аналитик, § 02 Основа, § 03 Аналитика везде — каждая `.sec-head` + сетка карточек между маркерами `<!-- home:ИМЯ:start/end -->`.
4. § 04 Контакт — `.sec-head` с `.ctas` справа (Telegram, LinkedIn).

**`.sec-head`:**
```html
<div class="sec-head">
  <div class="sec-head-main">
    <div class="sec-kicker">§ 02 — ОСНОВА</div>
    <h2 class="sec-title" id="sec-base">Эксперименты<br>и монетизация.</h2>
  </div>
  <div class="sec-right">
    <p>Описание секции.</p>
    <div class="sec-right-link"><a class="sec-link" href="/ai-analyst/">Все статьи →</a></div>
  </div>
</div>
```
- 12-колоночная сетка; `.sec-head-main` — колонки 1–6, `.sec-right` — 9–12.
- `.sec-kicker`: `--mono`, `11px`, `var(--accent)`, `letter-spacing: .12em`.
- `.sec-title`: `72px`, вес `500`.
- Ниже 900px сетка выключается, блоки идут столбиком.

---

### 3.7 Карточка материала (`.courses-grid` / `.course`)

**Где:** главная (§ 01–03), `/ai-analyst/` (полки «Серия» и «Основа»). **Только генераторами.**

```html
<div class="courses-grid">
  <a class="course" href="/workspace/articles/…/">
    <div class="course-meta"><span class="course-num">01</span><span>РАЗБОР ПЕРВЫЙ</span></div>
    <h3>Заголовок</h3>
    <p>Подпись</p>
    <span class="course-arrow">↗</span>
  </a>
</div>
```
- Карточки встык: у сетки `border-top` + `border-left`, у карточки `border-right` + `border-bottom` (`var(--ink)`).
- `padding: 32px 28px 28px; min-height: 200px`; hover — фон `var(--soft2)`, красная полоса слева (`::before`, `translateX(-4px) → 0`), заголовок красным.
- **Число карточек чётное** — в две колонки без пустой клетки.
- На главной метки в `.course-meta` капсом («РАЗБОР ПЕРВЫЙ», «МОНЕТИЗАЦИЯ»), на хабе — как в статье («Монетизация», «Май 2026»). Так пишет генератор.

---

### 3.8 Карточка кейса (`.cases-grid` / `.case`)

**Где:** только `/cases/`.

```html
<div class="case">
  <div class="case-meta">
    <span class="case-co">Ultraboost 22</span>
    <span>№ 6</span>
  </div>
  <h3><a href="/cases/ub22/" class="case-link">Зачем кроссовки делают разноцветными</a></h3>
  <p>Описание</p>
  <div class="case-metric">
    <div><div class="m-num">30 расцветок</div><div class="m-lbl">33 оттенка · 90 слотов</div></div>
  </div>
  <div class="case-open" aria-hidden="true">Открыть →</div>
</div>
```
- Карточки отдельные: `border: 1px solid var(--line)`, `gap: 16px`; hover — рамка `var(--ink)`, фон `var(--soft2)`.
- **Кликабельна целиком:** ссылка одна — заголовок; `.case-link::after { position: absolute; inset: 0 }` растягивает её на всю карточку (`.case` — `position: relative`). Ссылки в описании и метрике поднимаются над растянутой областью (`z-index: 1`).
- «Открыть →» (`.case-open`) — подпись, не вторая ссылка.
- Фокус с клавиатуры — рамка по всей карточке: `.case-link:focus-visible::after { outline: 2px solid var(--ink) }`.

---

### 3.9 Тарифы (`.pricing` / `.plan`)

**Где:** `/companies/`.

```html
<div class="pricing">
  <div class="plan">…</div>
  <div class="plan feat">…</div>   <!-- тёмная карточка -->
</div>
```
- Сетка одной рамкой, как у `.courses-grid`.
- `.plan-tag`: `--mono; 11px; var(--accent); uppercase`. `.plan.feat` — фон `var(--ink)`, текст белый.

### 3.10 Счётчики (`.stats`)

**Где:** `/career/`, `/career/results/` (`.stats.stats--page`). С главной убраны.

```html
<div class="stats stats--page">
  <div class="stat"><span class="stat-idx">01</span><div class="stat-num">600+</div><div class="stat-lbl">занятий</div></div>
</div>
```
- Четыре колонки, жирные линии сверху и снизу; `.stat-num` — `64px`; ниже 900px — две колонки.

---

### 3.11 Кнопки и ссылки (`.btn`, `.ctas`, `.sec-link`)

```html
<div class="ctas">
  <a class="btn btn-primary" href="…">Текст <span class="chev">→</span></a>
  <a class="btn btn-ghost" href="…">Текст</a>
</div>
```
- `.btn`: `display: inline-flex; padding: 14px 22px; font-size: 14px; font-weight: 500`.
- `.btn-primary`: фон `var(--ink)`, hover — `var(--accent)`. `.btn-ghost`: рамка `var(--ink)`, hover — заливка.
- `.ctas`: `display: flex; gap: 12px; justify-content: flex-end` — так нужно в герое главной; внутри `.cta-strip` прижимается влево (см. 3.15).
- `.sec-link` — текстовая ссылка-действие («Все →», «Сайт конференции →»): `14px`, вес `500`, подчёркивание с отступом `4px`, hover — красным.

### 3.12 Теги и чипы (`.tag`, `.chip`)

- `.tag` — рамочная плашка в герое главной (AI-аналитик, A/B-эксперименты, монетизация, ментор): `padding: 8px 14px; border: 1px solid var(--ink); 12px`.
- `.chip` — рубрика в `.article-meta` статьи; `.chip--contact` — контакт на `/career/`. Фон `var(--soft)`, `12px`.

---

### 3.13 Текст (`.prose`)

**Где:** статьи и все текстовые страницы.

```html
<div class="prose">
  <p>Текст…</p>
  <h2>Раздел</h2>
  <ul><li>Пункт</li></ul>
</div>
```
- `p`: `16px; line-height: 1.65; margin: 0 0 16px; max-width: 620px`.
- `ul`: `16px; line-height: 1.7; padding-left: 20px`; `li`: `margin-bottom: 6px`.
- `h2`: `32px; font-weight: 500; letter-spacing: -.02em; margin: 48px 0 14px`. `h3`: `20px; 600`.
- `table`, `th` (`--mono; 11px; uppercase`, жирная линия снизу), `td` (тонкая линия).
- `pre`: `--mono; 13px`, фон `var(--soft)`, рамка `var(--line)`. `code`: фон `var(--soft)`.
- `figure`: `margin: 32px 0`; `figcaption`: `--mono; 11px; var(--muted)`.
- `blockquote`: `border-left: 3px solid var(--accent)`.
- `.prose--narrow` — `max-width: 680px` на контейнере (`/approach/`).

---

### 3.14 Строка списка (`.timeline`)

**Где:** `/about/` (работа), `/teaching/` (преподавание). **Только для трёх и больше однотипных пунктов с датой;** один-два пункта — `.case-block`.

```html
<div class="timeline timeline--talks">
  <div class="tl-row">
    <div class="tl-year">2026</div>
    <div class="tl-role">Название<span class="co">Площадка</span></div>
    <div class="tl-body">Описание</div>
  </div>
</div>
```
- `.tl-row`: `grid-template-columns: 120px 180px 1fr; gap: 32px; padding: 24px 0; border-bottom: 1px solid var(--line)`.
- `.timeline--talks` — для длинных названий: `100px 1fr auto`, у `.tl-body` нет ограничения ширины.
- `.tl-year`: `--mono; 14px; var(--accent); 600`. `.tl-role`: `18px; 600`. `.co`: `13px; var(--muted)`.
- Ниже 900px: `80px 1fr`, `.tl-body` на всю ширину.

---

### 3.15 Блок-призыв (`.cta-strip`)

**Где:** в конце страницы, не больше одного: `/ai-analyst/`, `/cases/`, `/talks/`, `/teaching/`, `/career/`, `/companies/`.

```html
<div class="cta-strip">
  <h3>Обсудить задачу</h3>
  <p>Аналитическая диагностика для продукта или команды: данные, механизмы, решения.</p>
  <div class="ctas"><a href="/companies/" class="btn btn-primary">Для компаний →</a></div>
</div>
```
- `margin: 96px 48px 0; padding: 48px; border: 1px solid var(--ink)`; сетка `1fr auto`: заголовок слева, текст справа, кнопка под заголовком.
- **Кнопка под заголовком, своей ширины** — это делает CSS: `.cta-strip .ctas { justify-content: flex-start }` и `.cta-strip > .btn { justify-self: start }`. Инлайн не нужен. До 2026-09-29 было три варианта разметки, и кнопка на разных страницах висела посередине блока или растягивалась во всю колонку.
- Ниже 900px — одна колонка.

---

### 3.16 Врезка (`.case-block`)

**Где:** статьи и кейсы (`lego-octan`, `menu-check`, `ub22`, `ab-traps-factory`) — выделенная мысль; `/talks/` — одиночный объект (доклад).

```html
<div class="case-block">
  <div class="case-block-tag">Матемаркетинг’26 · 26–27 ноября · Москва, ИНТЦ Кластер Ломоносов</div>
  <h3>Сколько работы аналитика можно отдать агенту и чем это проверять</h3>
  <p>Описание</p>
  <a class="sec-link" href="https://matemarketing.ru/" rel="noopener">Сайт конференции →</a>
</div>
```
- `border: 1px solid var(--line); padding: 24px 28px; margin: 32px 0`.
- `.case-block-tag`: `--mono; 10px; var(--accent); uppercase; letter-spacing: .12em`.
- `h3` во врезке — как у карточки кейса: `26px; 500`. Заголовок есть только у врезки на `/talks/`.
- `.case-block--return` — красная рамка, финальный разбор.

---

### 3.17 Блок серии (`.series-nav`)

**Где:** разборы серии AI-аналитик, в конце статьи. **Только генератором** `render_series_block.py`, маркеры `<!-- series:start -->` / `<!-- series:end -->`.

- Нумерованный список всех разборов серии; текущий — `.this` с подписью «Вы здесь».
- Интерактивная карта `question-paths/map` — подпункт `li.side` со стрелкой ↳ под своим разбором, без номера.
- Номера `№ 01…` — CSS-счётчиком, красным.
- В каркасах `.ags` и `.qp` правило со сдвоенным классом `.series-nav.series-nav` гасит их ссылки и отступ заголовка.

### 3.18 Хлебные крошки (`.breadcrumb`)

**Где:** `/about/`, `/career/`, `/career/results/`, `/site-map/`, `blind-verdict-evals`. В `industriya` — свой вариант `.crumbs` (несоответствие №3).

- `display: flex; flex-wrap: wrap; gap: 8px`; `--mono; 11px; 500; uppercase; letter-spacing: .12em`; `color: var(--muted)`.
- `.breadcrumb-sep` — `var(--mute2)`; `.breadcrumb-current` — `var(--ink)`, без ссылки.

---

### 3.19 Компоненты внутри статей

Живут в `.prose` статей и кейсов.

**Стоп-вопрос (`.stop-question`)** — `menu-check`, `ub22`. Однострочная пауза: `border-left: 3px solid var(--accent); padding: 16px 20px; background: var(--soft2)`.

**Формула (`.formula-box`)** — `lego-octan`, `menu-check`, `where-revenue-is-born`. Формула между двумя жирными горизонталями, без боковых рамок и фона: `border-top/bottom: 1px solid var(--ink); padding: 32px 24px; text-align: center`. `.formula-label` — `--mono; 10px; uppercase`; `.formula-expr` — `--mono; 22px`. Ссылок внутри формулы нет — расшифровка в абзаце после.

**Протокольный список (`.protocol-list`)** — `ab-test-lies`. Нумерация `01, 02…` CSS-счётчиком, красным, строки через тонкую линию.

**Вывод (`.takeaway`)** — кейсы `lego-octan`, `menu-check`, `ub22`, статьи `pctr-calibration`, `ab-auction-interference`, `two-sided-interference` и страницы замороженной ветки AI-evals. Тёмный блок: `background: var(--ink); color: #fff; padding: 24px 28px; margin: 40px 0`. `.takeaway-tag` красным. Явные `color: #fff` на `.takeaway p` и `strong` нужны: правила `.prose` перебивают наследование. Ссылки — красным, hover — белым с подчёркиванием.

**Раскрываемый блок (`.disclosure`)** — `/career/results/`, `/companies/`. `<details class="disclosure">` с `summary.disclosure-trigger` как кнопкой-рамкой; открытый — залит `var(--ink)`. Маркер треугольника скрыт во всех браузерах.

---

### 3.20 Врезка с симулятором (`.sim-embed`)

**Где:** статья `ab-test-lies` — три симулятора, которые остались при статье после архива Workspace.

**Назначение:** встроить интерактивный симулятор в текст, чтобы ошибку можно было воспроизвести, а не только прочитать.

```html
<figure class="sim-embed sim-embed--classifier">
  <figcaption class="sim-embed-head">
    <div>
      <div class="sim-embed-tag">Симулятор</div>
      <div class="sim-embed-title">Классификатор метрик</div>
      <div class="sim-embed-note">…</div>
    </div>
    <a class="sim-embed-link" href="…" target="_blank" rel="noopener">Открыть отдельно ↗</a>
  </figcaption>
  <iframe class="sim-embed-frame" src="…" title="…" loading="lazy"></iframe>
  <a class="sim-embed-fallback" href="…">Открыть … ↗</a>
</figure>
```

- `.sim-embed`: сплошная рамка `var(--ink)` — граница между статьёй и «прибором».
- `.prose .sim-embed`: `margin: 40px -48px` — выход на ширину `.article`. Селектор с `.prose` обязателен: `.prose figure` по специфичности бьёт одиночный класс.
- `.sim-embed-frame`: `height: var(--sim-h)`, `border: 0`.
- Ниже 900px фрейм скрыт, показывается `.sim-embed-fallback`.

**Правило высоты — замерять, а не назначать.** Высота живёт в модификаторе на каждый симулятор (`--sim-h`): у каждого своя сетка и свой внутренний брейкпоинт.

| Модификатор | Симулятор | Разброс по состояниям | `--sim-h` |
|---|---|---|---|
| `--classifier` | `metric_classifier` | 732–869 | 880px |
| `--distributions` | `distribution_playground` | 806–1095 | 1100px |
| `--cluster` | `cluster_simulator` | 1257–1522 | 1530px |

**Как мерить.** Загрузить симулятор во врезку, временно задать фрейму маленькую высоту (200px) и снять `documentElement.scrollHeight` на каждом пресете. При большом вьюпорте метод не работает: у симуляторов `body { min-height: 100% }`.

**Когда симулятор во врезку не годится.** Врезка оправдана, когда симулятор *показывает* механизм ошибки, а не *отвечает на запрос*. Критерий применяется к паре «симулятор + механизм», а не к симулятору: `metric_classifier` прошёл для ошибки 6 и не прошёл для ошибки 12; `test_selection_map` — лукап «подбери тест», ушёл ссылкой в чек-лист.

**Ограничение:** `display: none` на мобильном не отменяет загрузку iframe — документ скачивается и не показывается. Осознанный размен.

---

### 3.21 В `style.css`, но на страницах не используются

Остались от курсов, заметок и старой главной. Кандидаты на удаление из CSS отдельной задачей:

`.lesson`, `.lesson-header`, `.lesson-meta`, `.lesson-type`, `.lesson-footer`, `.lesson-nav` (уроки курсов) · `.think-block` (сценарии практики) · `.portrait-row` · `.news`, `.news-form` · `.nav-cta` · `.prose-grid` · `.approach-wrap`, `.notes-wrap`, `.tests-wrap` · `.note` — строка-ссылка старой главной. Класс `.note` на `/cases/telenok/` и в `question-paths` — свой у страницы, совпадение имён (одно из предупреждений `check_class_collisions.py`). `.banner` на странице тренажёра `ab-trap-trainer` — его собственный CSS.

---

## 4. Паттерны вёрстки

### 4.1 Первый экран

- Главная — `.hero` на 12-колоночной сетке (3.6).
- Хаб и текстовая — `.page` с `.page-title` + `.page-lead`.
- Статья — `.article` с `h1` и `.article-meta` (дата, рубрика `.chip`, время чтения).

### 4.2 Разделение секций

Нет цветных разделителей и плашек. Вместо этого:
- горизонтальные линии: `1px solid var(--ink)` (жирная) или `var(--line)` (тонкая);
- вертикальные линии между колонками сетки;
- воздух: `96px` перед блоком-призывом и подвалом, `64px–80px` между секциями.

### 4.3 Сетки одной рамкой

Карточки материалов, тарифы, счётчики — по одному принципу: у контейнера `border-top + border-left`, у элементов `border-right + border-bottom`, без gap. Получается газетная таблица. Исключение — `.cases-grid`: карточки кейсов отдельные, с `gap: 16px` и своей рамкой.

### 4.4 Акценты в тексте

- **Жирный** `<strong>`, вес `600` — ключевые утверждения в prose.
- **Красный** `var(--accent)` — только функциональные акценты: нумерация, кикеры, точка, метки врезок.
- **Курсив** `<em>` — подписи и цитаты.
- **Подчёркивание** — только у ссылок; `<u>` не используется.

### 4.5 Анимации

Простые, одного типа: transform + opacity, `.25s–.35s`.
- полоса слева у карточки `.course`;
- scale-x 0 → 1 у подчёркивания пунктов меню;
- сдвиг стрелок;
- fade + slide у `.reveal` на главной (IntersectionObserver в `main.js`).

Нет: stagger, parallax, morphing.

### 4.6 Мобильный адаптив

- Основной брейкпоинт `900px`: паддинги `48px → 24px`, сетки → одна колонка, меню → бургер и шторка, подвал в столбик с переносом ссылок.
- `1000px` — только меню (3.1).
- `.timeline` → две колонки, `.stats` → две колонки.
- Проверка на телефоне — ширина 375px, без горизонтальной прокрутки (`scrollWidth ≤ innerWidth`).

---

## 5. Чего нет на swiss-страницах

| Элемент | Статус |
|---------|--------|
| Тени (`box-shadow`) | ❌ Нет (кроме размытия фона шапки) |
| Скруглённые углы (`border-radius`) | ❌ Не используются на основных компонентах |
| Цветные фоны секций | ❌ Только `--ink`: подвал, `.plan.feat`, `.takeaway` |
| Иконки (SVG/emoji наборы) | ❌ Только unicode-символы (→, ↗, ↳, §, ·, №) |
| Градиенты | ❌ Нет |
| Фотографии | ❌ Нет на swiss-страницах |
| Третичные кнопки (pill, soft) | ❌ Только primary + ghost |
| Tooltips / popovers | ❌ Нет |
| Sticky sidebar | ❌ Нет (оглавление в `.ags` — часть собственного каркаса статьи) |
| Числа количества в текстах | ❌ Не пишем («семь разборов», «9 симуляторов» устаревают) |

---

## 6. Несоответствия

### №1: Верхний отступ страницы
`.page { padding: 64px 48px 0 }` против `.article { padding: 72px 48px 0 }`. Неясно, намеренно ли.

### №2: Каркасы `.ags` и `.qp`
Три разбора серии собраны на каркасах со своим CSS внутри страницы (6–8 КБ): `harness-by-type`, `how-agent-sees-decisions`, `question-paths` и её карта. Стандарт — `.article`.

### №3: Хлебные крошки в двух вариантах
`.breadcrumb` на пяти страницах и `.crumbs` в `industriya`. Из текстовых страниц крошки есть только у `/about/`, `/career/`, `/career/results/`.

### №4: Свой `<style>` у страниц на стандартном каркасе
`macbook-market` (7,4 КБ), `nikifilini` (5,7 КБ), `where-revenue-is-born` (3,6 КБ), `profit-vs-revenue-pivot` (1,7 КБ), `ai-analyst-checks` (188 Б).

### №5: Инлайн-стили
По числу `style="…"`: `industriya` 53 (намеренное исключение, раздел 8), `question-paths` 12, `/site-map/` 12, `macbook-market` 9, `404` 6, `/career/` 5, `/companies/` 5, `/approach/` 3, главная 3, статьи «Основы» (`retention-vs-revenue`, `mde-marketplace`, `ab-planning-mistakes`) по 4.

### №6: `/site-map/`
Отдельная страница без шапки сайта, со своим CSS.

### ~~№7: Кнопка в блоке-призыве~~ ✅ Закрыто 2026-09-29
Три варианта разметки, кнопка посередине или во всю колонку. Выравнивание перенесено в `.cta-strip` (3.15), инлайн на `/cases/` и `/companies/` убран.

---

## 7. Открытые вопросы

**7.1 Spacing scale.** Отступы (`12, 16, 24, 28, 32, 40, 48, 64, 72, 80, 96px`) похожи на неформальную 8px-сетку, но не заведены токенами.

**7.2 Цвета на тёмном фоне.** В `.plan.feat` и `.takeaway` ссылки и текст получают `#fff` правилами компонента. Токена `--on-dark` нет.

**7.3 Имя `.reveal`.** Класс занят scroll-анимацией на главной; для раскрываемого блока взято `.disclosure`. Переименовать анимацию в `.js-reveal` — открыто.

**7.4 Scroll-анимация `.reveal`** противоречит swiss-принципу «контент существует сразу, а не по триггеру прокрутки». Плановая задача — удалить из `style.css` и `main.js`.

**7.5 Чистка `style.css`** от классов из 3.21.

---

## 8. Намеренные исключения из swiss-системы

### /cases/industriya/ — editorial серый

Кейс намеренно использует тёплую серую палитру (`#444441`, `#2C2C2A`, `#888780`, `#B4B2A9`) и editorial-типографику вместо стандартной swiss. Математический разбор настольной игры читается естественнее в редакционном тоне.

**Что в кейсе уже swiss:** шапка и подвал из шаблонов, `/style.css` подключён, акцент-красный совпадает (`#e63946`).

**Что не swiss — не трогать:**
- свой `<style>` с тёплой палитрой и `border-radius`;
- три интерактивных компонента на Chart.js 4.4.1 (CDN) с цветами в JS;
- SVG-схема с `fill=` в атрибутах;
- калькулятор раундов на range-slider;
- `.container` `max-width: 900px` (против `880px` у `.article`), хлебные крошки `.crumbs`.

Переверстка под swiss требует синхронных правок в CSS, трёх JS-блоках и SVG и угрожает интерактиву. **Решение:** оставить как есть. Зафиксировано: 2026-05-05.

Собственный класс плиток переименован в `.ind-metric` (2026-09-29): под старым именем `.case-metric` они получали сетку и линию от карточек `/cases/`.

---

## 9. CSS-конвенции

### 9.1 Никаких inline-стилей

Запрещено использовать атрибут `style="..."` на HTML-элементах.

**Всегда:** существующий класс из `/style.css`, либо новый класс в `/style.css`.

**Обоснование:** inline-стили дублируются между файлами, не переиспользуются, не отражаются в дизайн-системе и создают долг. Дизайн-система имеет смысл только когда **все** оформительские решения проходят через неё.

**Единственное исключение:** динамические стили, задаваемые из JavaScript в runtime (позиция, вычисляемая ширина, пользовательский ввод). Это состояние, а не оформление.

**Если нужного класса нет:**
1. Проверить — может быть, в `/style.css` уже есть похожий (`.prose`, `.case-block`, `.cta-strip` и т.п.).
2. Если нет — добавить новый класс в `/style.css` и описать его в разделе 3.
3. Если решение «временное» — всё равно класс. «Временное» в этом проекте живёт годами.

Существующие инлайн-стили — несоответствие №5, устраняются при редактуре страниц.

### 9.2 Свой класс не называть как класс сайта

Класс из встроенного `<style>` страницы, совпавший по имени с классом `/style.css`, получает всё оформление сайта, которое страница не переопределила. Проверяет `scripts/check_class_collisions.py` в CI (подробно — `CLAUDE.md`).

### 9.3 Pre-commit отчёт по CSS

Если правка трогает `/style.css` или меняет визуальную структуру страницы — перед коммитом показать автору, как изменения отрисовались: скриншоты на 1280 и 375. Без визуальной проверки — не коммитить.

См. также `/working-protocol.md`, раздел «Процедурные требования».

---

*Документ описывает код. При изменении `style.css`, шаблонов `_partials/` или типов страниц — обновить.*
