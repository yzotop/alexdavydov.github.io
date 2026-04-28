> **АРХИВНЫЙ ДОКУМЕНТ.**
> Это изначальный план редизайна сайта от апреля 2026.
> Сайт пошёл другим путём: swiss-стиль с красным акцентом, без
> тёмной темы, шрифт Space Grotesk + Geist Mono.
> Актуальная дизайн-документация — /DESIGN.md в корне.
> Этот документ сохранён как исторический след принятых решений.
>
> ---
>
> # REDESIGN.md — davydov.my (исходный план)

Это техническое задание для редизайна сайта davydov.my.
Сайт публикуется через GitHub Pages. Реализуй изменения строго по этому документу.

---

## 0. Контекст

Саша Давыдов — тимлид аналитики (Дзен), ментор на Solvery и GetMentor, автор курса на karpov.courses.
Цель сайта: доказывать экспертность и усиливать личный бренд среди аналитиков данных.
Главная проблема текущего сайта: выглядит как документация, а не как страница человека. Нет фото, нет личности, нет живого контента.

---

## 1. Дизайн-система

### 1.1 CSS-переменные — светлая тема (по умолчанию)

```css
:root {
  --bg:       #ffffff;
  --bg2:      #f7f7f5;
  --bg3:      #f0efea;
  --tx:       #111111;
  --tx2:      #666666;
  --tx3:      #999999;
  --br:       #e5e5e0;
  --br2:      #d0d0c8;
  --card:     #f7f7f5;
  --accent:   #1D9E75;   /* зелёный — для акцентов и dot-индикаторов */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 20px;
}
```

### 1.2 CSS-переменные — тёмная тема

```css
[data-theme="dark"] {
  --bg:    #0f0f0f;
  --bg2:   #1a1a1a;
  --bg3:   #222222;
  --tx:    #ebebeb;
  --tx2:   #888888;
  --tx3:   #555555;
  --br:    #2a2a2a;
  --br2:   #3a3a3a;
  --card:  #181818;
}
```

### 1.3 Переключатель тем

- Кнопка в правом углу навигации: иконка солнце/луна (SVG, 16×16px).
- При клике переключает `data-theme` на `<html>`.
- Сохраняет выбор в `localStorage`.
- По умолчанию — светлая тема.

### 1.4 Типографика

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--tx);
  background: var(--bg);
}

h1 { font-size: 32px; font-weight: 500; letter-spacing: -0.025em; line-height: 1.1; }
h2 { font-size: 22px; font-weight: 500; letter-spacing: -0.015em; }
h3 { font-size: 16px; font-weight: 500; }
```

### 1.5 Общие правила

- Нет градиентов, теней, blur-эффектов.
- Все бордеры: `0.5px solid var(--br)` (акцентные: `var(--br2)`).
- Максимальная ширина контента: `720px`, центрирование через `margin: 0 auto`.
- Горизонтальные паддинги: `32px` (desktop), `20px` (mobile < 640px).
- Все страницы — статические HTML-файлы, CSS в одном `style.css`, JS в `main.js`.

---

## 2. Навигация (общая для всех страниц)

### Структура

```
[Alex Davydov]    [Курсы] [Кейсы] [Заметки] [Карьера]    [Менторство]  [☀/🌙]
```

### Требования

- Sticky-шапка (`position: sticky; top: 0; z-index: 100`).
- Фон: `var(--bg)` с `border-bottom: 0.5px solid var(--br)`.
- Логотип-имя: `font-size: 14px; font-weight: 500`.
- Ссылки: `font-size: 13px; color: var(--tx2)`, при hover → `var(--tx)`.
- «Менторство» — pill-кнопка: `border: 0.5px solid var(--br2); border-radius: var(--radius-pill); padding: 6px 14px`.
- Кнопка темы: крайняя правая, `16×16px SVG`, без текста.
- Мобильный бургер при ширине < 640px (гамбургер → drawer снизу или сверху).

---

## 3. Главная страница (index.html)

### 3.1 Hero-блок

```html
<!-- Структура: левая колонка + аватар справа -->
<section class="hero">
  <div class="hero-left">
    <p class="eyebrow">Тимлид аналитики · Ментор · Преподаватель</p>
    <h1>Саша Давыдов</h1>
    <p class="bio">
      Помогаю аналитикам понимать системы, а не только считать метрики.
      Тимлид в <strong>Дзене</strong>, ментор на <strong>Solvery</strong> и <strong>GetMentor</strong>,
      автор курса на <strong>karpov.courses</strong>.
    </p>
    <div class="badges">
      <span>Дзен</span>
      <span>inDrive</span>
      <span>Самокат</span>
      <span>karpov.courses</span>
    </div>
    <div class="cta-row">
      <a href="/courses/" class="btn-primary">Начать с курса →</a>
      <a href="/career/" class="btn-ghost">Записаться на менторство</a>
    </div>
    <div class="socials">
      <a href="https://t.me/Datalake">Telegram</a>
      <a href="https://solvery.io/ru/mentor/alex_davydov">Solvery</a>
      <a href="https://getmentor.dev/mentor/sasha-davydov-3357">GetMentor</a>
      <a href="https://www.linkedin.com/in/alexanderdavydow/">LinkedIn</a>
    </div>
  </div>
  <div class="avatar">
    <!-- Сейчас: плейсхолдер с инициалами АД -->
    <!-- Потом: заменить на <img src="/assets/photo.jpg"> -->
    <span>АД</span>
  </div>
</section>
```

**Стили hero:**

```css
.hero {
  display: grid;
  grid-template-columns: 1fr 80px;
  gap: 28px;
  align-items: start;
  padding: 48px 32px 40px;
  border-bottom: 0.5px solid var(--br);
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--tx3);
  margin-bottom: 12px;
}

.bio { font-size: 15px; color: var(--tx2); line-height: 1.7; max-width: 420px; margin-bottom: 20px; }
.bio strong { color: var(--tx); font-weight: 500; }

.badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 26px; }
.badges span {
  font-size: 11px;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--br);
  color: var(--tx3);
  background: var(--bg2);
}

.cta-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 22px; }

.btn-primary {
  font-size: 13px; font-weight: 500;
  padding: 9px 20px;
  border-radius: var(--radius-md);
  background: var(--tx); color: var(--bg);
  text-decoration: none;
}
.btn-primary:hover { opacity: 0.85; }

.btn-ghost {
  font-size: 13px;
  padding: 9px 16px;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--br2);
  color: var(--tx2);
  text-decoration: none;
}
.btn-ghost:hover { background: var(--bg2); }

.socials { display: flex; gap: 7px; }
.socials a {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  border: 0.5px solid var(--br);
  color: var(--tx3);
  text-decoration: none;
}
.socials a:hover { color: var(--tx2); border-color: var(--br2); }

.avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: var(--bg3);
  border: 0.5px solid var(--br);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-top: 4px;
}
.avatar span { font-size: 20px; font-weight: 500; color: var(--tx3); }
```

### 3.2 Статистика-стрип

Три ячейки, разделённые вертикальными бордерами:

| Цифра | Подпись |
|-------|---------|
| 300+  | часов менторства |
| 18+   | отзывов на Solvery |
| 5 курсов | по аналитике и экспериментам |

```css
.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 0.5px solid var(--br);
}
.stat { padding: 18px 32px; }
.stat + .stat { border-left: 0.5px solid var(--br); }
.stat-n { font-size: 22px; font-weight: 500; letter-spacing: -0.02em; margin-bottom: 2px; }
.stat-l { font-size: 12px; color: var(--tx3); }
```

### 3.3 Секция «Курсы»

Заголовок секции + ссылка «Все курсы →» + грид карточек.

**Карточки курсов** (4 штуки, 2×2 на desktop, 1 колонка на mobile):

| Тег | Заголовок | Описание |
|-----|-----------|----------|
| A/B · Middle→Senior | Статистика A/B-тестирования | Метрики, CUPED, типовые ошибки |
| Монетизация · Middle | Математика монетизации рекламы | Модели дохода, давление на метрики |
| Продукт · Junior→Senior | Аналитика продукта | Читать систему, а не цифры |
| Causal · Senior | Квазиэксперименты | DiD, RDD, IV — когда A/B невозможен |

```css
.course-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 9px;
}
.course-card {
  padding: 14px;
  border: 0.5px solid var(--br);
  border-radius: var(--radius-lg);
  background: var(--card);
  position: relative;
  text-decoration: none;
  display: block;
}
.course-card:hover { border-color: var(--br2); }
.course-tag { font-size: 10px; letter-spacing: 0.04em; color: var(--tx3); text-transform: uppercase; margin-bottom: 8px; }
.course-title { font-size: 13px; font-weight: 500; color: var(--tx); line-height: 1.35; margin-bottom: 5px; }
.course-desc { font-size: 12px; color: var(--tx2); line-height: 1.45; }
.course-arr { position: absolute; top: 13px; right: 13px; font-size: 13px; color: var(--tx3); }
```

### 3.4 Баннер karpov.courses

```html
<div class="karpov-banner">
  <div class="karpov-dot"></div>
  <p><strong>Скоро на karpov.courses</strong> — новый курс по аналитике. Следи за анонсом в <a href="https://t.me/Datalake">Telegram</a>.</p>
</div>
```

```css
.karpov-banner {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px;
  border: 0.5px solid var(--br);
  border-radius: var(--radius-lg);
  background: var(--bg2);
  margin: 0 32px 28px;
}
.karpov-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.karpov-banner p { font-size: 13px; color: var(--tx2); line-height: 1.45; }
.karpov-banner strong { color: var(--tx); font-weight: 500; }
.karpov-banner a { color: var(--tx2); }
```

### 3.5 Секция «Заметки»

Список последних 3 заметок (пока — placeholder-контент, см. тексты ниже). Ссылка «Все заметки →» ведёт на `/notes/`.

**Placeholder-заметки:**

1. **апр 2026** — «Почему 80% аналитиков неправильно читают A/B-результаты» — Самая частая ошибка из 300+ сессий — и как её исправить за один разговор
2. **мар 2026** — «Что значит "думать системой", а не метриками» — Разбор конфликта retention и revenue на примере рекламной монетизации
3. **фев 2026** — «IC → Lead: что реально меняется» — Не навыки — а зона ответственности и язык разговора с бизнесом

```css
.note-item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 16px;
  padding: 12px 0;
  border-top: 0.5px solid var(--br);
  align-items: start;
  text-decoration: none;
  color: inherit;
}
.note-item:first-child { border-top: none; }
.note-item:hover { background: var(--bg2); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: var(--radius-md); }
.note-date { font-size: 11px; color: var(--tx3); padding-top: 2px; }
.note-title { font-size: 13px; font-weight: 500; color: var(--tx); margin-bottom: 3px; line-height: 1.35; }
.note-desc { font-size: 12px; color: var(--tx2); line-height: 1.5; }
```

### 3.6 Футер

```
[Курсы] [Кейсы] [Карьера] [Для компаний] [Telegram]          © 2026 davydov.my
```

```css
footer {
  padding: 14px 32px;
  border-top: 0.5px solid var(--br);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg2);
}
footer a { font-size: 12px; color: var(--tx3); text-decoration: none; margin-right: 16px; }
footer a:hover { color: var(--tx2); }
.footer-copy { font-size: 11px; color: var(--tx3); }
```

---

## 4. Страница /about/

### Что изменить

1. **Добавить фото** (сейчас — круглый плейсхолдер с инициалами, потом заменить на `photo.jpg`).
2. **Добавить места работы явно:**

```html
<div class="work-history">
  <div class="work-item">
    <span class="work-period">2023 — сейчас</span>
    <span class="work-role">Тимлид аналитики — <strong>Дзен</strong></span>
  </div>
  <div class="work-item">
    <span class="work-period">2021 — 2023</span>
    <span class="work-role">Senior Analyst — <strong>inDrive</strong></span>
  </div>
  <div class="work-item">
    <span class="work-period">2020 — 2021</span>
    <span class="work-role">Analyst — <strong>Самокат</strong></span>
  </div>
</div>
```

3. **Добавить блок менторства:**

```html
<div class="mentor-block">
  <p>Ментор на <a href="https://solvery.io/ru/mentor/alex_davydov">Solvery</a> (18+ отзывов)
  и <a href="https://getmentor.dev/mentor/sasha-davydov-3357">GetMentor</a>.
  Автор курса на <a href="https://karpov.courses">karpov.courses</a> (в разработке).</p>
</div>
```

4. **Убрать** абстрактный текст про «операционную систему» — заменить живым тоном.

**Новый текст bio для /about/:**

> Я занимаюсь аналитикой данных 4+ лет. Работал в Самокате, inDrive, сейчас — тимлид в Дзене.
>
> За это время я понял: большинство аналитических ошибок — не технические. Люди умеют считать, но не умеют читать систему: почему метрика ведёт себя именно так, какое решение из этого следует, и что сломается, если нажать вот эту кнопку.
>
> Этот сайт — способ зафиксировать и передать этот опыт. Курсы, кейсы и заметки здесь про одно: как переходить от данных к решениям в реальных условиях — когда метрики конфликтуют, данных не хватает, и нет времени на идеальный анализ.

---

## 5. Страница /courses/

### Что исправить

1. **Убрать баг** — счётчик «Всего курсов: 0» удалить полностью.
2. **Убрать фильтры** Ready/Draft — не нужны публично.
3. Каждый курс — карточка по тому же шаблону, что на главной (тег с уровнем, заголовок, описание, стрелка ↗).
4. **Добавить рекомендованный путь** вверху страницы:

```html
<div class="learning-path">
  <p class="path-label">С чего начать:</p>
  <div class="path-steps">
    <a href="/lab/product-analytics/">Аналитика продукта</a>
    <span>→</span>
    <a href="/lab/ab-stat-os/">Статистика A/B</a>
    <span>→</span>
    <a href="/lab/quasi-experiments/">Квазиэксперименты</a>
  </div>
</div>
```

5. **Добавить плашку** «Скоро: курс на karpov.courses» — тот же `karpov-banner` из главной.

---

## 6. Страница /cases/

### Что изменить

1. Каждая карточка кейса — добавить **инсайт-строку** под описанием:

| Кейс | Инсайт-строка |
|------|--------------|
| Solvery | 5% менторов генерируют 42% сессий — типичный winner-take-most рынок |
| NIKIFILINI | 22% stock-out при медиане 4 044 ₽ — прайсинг работает, логистика нет |
| National Lottery | Портфель из 17 продуктов с RTP > 0.9 — где реальные деньги? |
| MacBook Avito | Chip M1 vs Intel: разрыв медиан 34% при одинаковом году выпуска |

2. **Добавить CTA** в конце каждой карточки:

```html
<a href="/companies/" class="case-cta">Хочешь такой разбор для своего продукта? →</a>
```

3. **Добавить теги** на каждой карточке: `Маркетплейс`, `D2C`, `Монетизация`, `Рыночный анализ`.

---

## 7. Страница /career/ и /career/results/

### Что изменить

1. **Цитаты** — добавить компанию без имени: вместо «Senior Analyst, переход в Tier-1» → «Senior Analyst → Яндекс».
2. **Добавить скриншот** раздела с отзывами Solvery (вставить как `<img>` с alt-текстом). Файл: `/assets/solvery-reviews.png`.
3. **Добавить ценовую вилку** на /career/:

```html
<div class="price-hint">
  <span>От 3 000 ₽ за сессию</span>
  <span class="sep">·</span>
  <a href="https://solvery.io/ru/mentor/alex_davydov">Записаться через Solvery</a>
</div>
```

---

## 8. Страница /companies/

### Что изменить

1. **Перелинковать с кейсами** — добавить блок:

```html
<div class="cases-ref">
  <p>Примеры того, как я работаю с данными:</p>
  <a href="/cases/">Смотреть кейсы →</a>
</div>
```

2. **Добавить Telegram** как способ связи прямо на странице (сейчас только email).
3. Заменить абстрактный список услуг на конкретные результаты — например: «После аудита A/B-системы команда сократила время принятия решений с 2 недель до 3 дней».

---

## 9. Новая страница /notes/ (создать с нуля)

### Структура

```
/notes/index.html        — список заметок
/notes/[slug]/index.html — отдельная заметка
```

### Список (index.html)

Простой хронологический список в том же стиле, что блок заметок на главной (дата + заголовок + 1 строка описания). Без категорий, без тегов — пока просто список.

### Шаблон отдельной заметки

```html
<article class="note-article">
  <header>
    <p class="note-meta">апр 2026 · 4 мин</p>
    <h1>Заголовок заметки</h1>
  </header>
  <div class="note-body">
    <!-- Контент -->
  </div>
  <footer class="note-footer">
    <a href="/notes/">← Все заметки</a>
  </footer>
</article>
```

```css
.note-article { max-width: 600px; margin: 0 auto; padding: 48px 32px; }
.note-meta { font-size: 12px; color: var(--tx3); margin-bottom: 12px; }
.note-body { font-size: 16px; line-height: 1.75; color: var(--tx2); margin-top: 24px; }
.note-body p { margin-bottom: 1.25em; }
.note-body strong { color: var(--tx); font-weight: 500; }
.note-footer { margin-top: 48px; padding-top: 24px; border-top: 0.5px solid var(--br); }
```

---

## 10. Мобильная адаптация (< 640px)

```css
@media (max-width: 640px) {
  .hero { grid-template-columns: 1fr; }
  .avatar { display: none; } /* скрыть плейсхолдер на мобиле до появления фото */
  .stats-strip { grid-template-columns: 1fr 1fr; }
  .stats-strip .stat:last-child { grid-column: span 2; border-left: none; border-top: 0.5px solid var(--br); }
  .course-grid { grid-template-columns: 1fr; }
  .nav-links { display: none; } /* заменить бургером */
  .karpov-banner { margin: 0 20px 24px; }
  section, .sec { padding-left: 20px; padding-right: 20px; }
  .hero { padding: 32px 20px 28px; }
}
```

---

## 11. Приоритет задач для Cursor

Реализуй в следующем порядке:

### Этап 1 — критичные исправления (сделай первым)
- [ ] Убрать баг «Всего курсов: 0» на /courses/
- [ ] Добавить переключатель тем (светлая/тёмная) в навигацию
- [ ] Применить CSS-переменные из раздела 1 ко всем страницам

### Этап 2 — главная страница
- [ ] Переделать hero по разделу 3.1
- [ ] Добавить stats-strip (раздел 3.2)
- [ ] Добавить karpov-banner (раздел 3.4)
- [ ] Добавить блок заметок (раздел 3.5) с placeholder-контентом
- [ ] Обновить навигацию (раздел 2)
- [ ] Обновить футер (раздел 3.6)

### Этап 3 — внутренние страницы
- [ ] /about/ — новый текст, work-history, mentor-block (раздел 4)
- [ ] /courses/ — убрать баг, добавить learning-path и karpov-banner (раздел 5)
- [ ] /cases/ — добавить инсайт-строки, теги, CTA (раздел 6)
- [ ] /career/ — обновить цитаты, добавить цену (раздел 7)
- [ ] /companies/ — добавить кейсы-ссылку, Telegram, конкретные результаты (раздел 8)

### Этап 4 — новый контент
- [ ] Создать /notes/ с шаблоном (раздел 9)
- [ ] Заполнить 3 placeholder-заметки из раздела 3.5

### Этап 5 — мобильная версия
- [ ] Применить media queries из раздела 10
- [ ] Добавить бургер-меню

---

## 12. Файловая структура (что не трогать)

```
/lab/           — курсы, не трогать содержимое
/cases/         — кейсы, только добавить инсайты и теги
/knowledge/     — база знаний, не трогать
/simulators/    — не трогать
/calculators/   — не трогать
/assets/        — добавить: photo.jpg (потом), solvery-reviews.png (потом)
style.css       — переписать на новую дизайн-систему
main.js         — добавить логику переключателя тем
```

---

*Документ подготовлен апрель 2026. При вопросах по реализации — уточнять у автора сайта.*