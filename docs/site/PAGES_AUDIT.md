# Pages Audit — классы вне style.css

Дата: 2026-04-26  
Метод: сравнение `class="..."` из HTML с полным списком классов `style.css`  
(включая классы внутри `@media`-блоков)

Статус страниц: ✅ чисто / ⚠️ есть несовпадения / 🔴 много несовпадений

---

## cases/index.html ✅

Все классы совпадают с `style.css`. Страница исправлена.

---

## courses/index.html ⚠️

Страница генерируется скриптом `scripts/render_courses_hub.py`.  
Скрипт использует самописные классы карточек, не совпадающие с CSS.

| Сломанный класс | Заменить на |
|---|---|
| `.course-card` | `.course` |
| `.course-arr` | `.course-arrow` |
| `.course-tag` (лейбл уровня) | `.course-meta` > `.course-num` + `<span>` |
| `.course-title` | `h3` (стилизуется через `.course h3`) |
| `.course-desc` | `p` (стилизуется через `.course p`) |
| `.course-grid` | `.courses-grid` |
| `.site-wrap` (обёртка страницы) | `.page` |
| `.karpov-banner` | `.banner` + `.banner-left` + `.banner-right` + `.banner-tag` |
| `.karpov-dot` | нет эквивалента (удалить или заменить точкой `.dot`) |
| `.learning-path` | нет эквивалента в CSS (требует добавления или удаления) |
| `.path-label` | нет эквивалента |
| `.path-steps` | нет эквивалента |

**Причина:** скрипт `render_courses_hub.py` генерирует структуру карточек, отличную от
компонента `.course` / `.courses-grid` из `style.css`. Нужно обновить шаблон в скрипте.

---

## notes/index.html ⚠️

| Сломанный класс | Заменить на |
|---|---|
| `.note-item` | `.note` |
| `.note-desc` | нет эквивалента (CSS-компонент `.note` не включает описание; удалить или использовать `.note-cat` для категории и `.note-read` для времени чтения) |
| `.site-wrap` | `.page` |
| `.muted` | нет класса `.muted` в CSS (использовать `color:var(--muted)` через существующий элемент или добавить класс в CSS) |

**Примечание:** CSS-компонент `.note` рассчитан на строку с колонками
`.note-date` / `.note-cat` / `.note-title` / `.note-read` / `.note-arrow`.
Текущий HTML использует другую структуру (дата + заголовок + описание в `<div>`).

---

## about/index.html ⚠️

| Сломанный класс | Заменить на |
|---|---|
| `.avatar` | `.author-av` |
| `.cta-row` | `.ctas` |
| `.mentor-block` | нет эквивалента (кастомный блок) |
| `.work-history` | `.timeline` |
| `.work-item` | `.tl-row` |
| `.work-period` | `.tl-year` |
| `.work-role` | `.tl-body` / `.tl-role` |
| `.site-wrap` | `.page` |

**Примечание:** CSS содержит готовый компонент `.timeline` / `.tl-row` / `.tl-year` /
`.tl-role` / `.tl-body` — прямой аналог work-history блока.

---

## companies/index.html 🔴

Страница содержит кастомный `<style>`-блок и использует собственную систему классов,
несовместимую с `style.css`.

| Сломанный класс | Заменить на |
|---|---|
| `.container` | нет эквивалента (кастомный layout) |
| `.card` | нет прямого эквивалента (`.case` — ближайший вариант) |
| `.grid-2` | нет эквивалента (`.courses-grid` — 2 колонки, но семантически другой) |
| `.cta-section` | нет эквивалента |
| `.cta-buttons` | `.ctas` |
| `.btn-secondary` | `.btn-ghost` |
| `.faq` | нет эквивалента |
| `.answer` | нет эквивалента |
| `.cases-ref` | нет эквивалента |
| `.subtitle` | нет эквивалента (использовать `.page-sub` или `.page-lead`) |

**Причина:** страница не перенесена на Swiss Grid. Требует полного редизайна.

---

## career/index.html 🔴

Страница содержит обширный кастомный `<style>`-блок (~400 строк).
Из ~50 используемых классов только 5 совпадают с `style.css`.

Совпадают с CSS: `dot`, `footer`, `footer-center`, `footer-links`, `footer-right`,
`footer-spacer`, `logo`, `logo-mark`, `nav`, `nav-cta`, `nav-links`, `btn-primary`.

Не совпадают (полный список):

| Сломанный класс | Ближайший аналог в CSS |
|---|---|
| `.btn-secondary` | `.btn-ghost` |
| `.subtitle` | `.page-sub` или `.page-lead` |
| `.hero-buttons` | `.ctas` |
| `.container` | нет эквивалента |
| `.sep` | нет эквивалента |
| `.career-strip` | нет эквивалента |
| `.career-badge` | `.chip` |
| `.career-chip` | `.chip` |
| `.card-exec` / `.card-ic` / `.card-results` | нет эквивалента (`.plan` — ближайший) |
| `.directions-grid` | нет эквивалента |
| `.direction-card` / `.direction-title` / `.direction-text` / `.direction-label` / `.direction-bullets` / `.direction-button` / `.direction-spacer` | нет эквивалентов |
| `.solvery-callout` / `.solvery-title` / `.solvery-subtitle` / `.solvery-content` / `.solvery-link` / `.solvery-actions` | нет эквивалентов |
| `.contact-section` / `.contact-intro` / `.contact-buttons` / `.contact-template` / `.contact-template-header` / `.contact-template-row` / `.contact-template-label` / `.contact-disclaimer` | нет эквивалентов |
| `.companies-card` | `.companies` / `.companies-label` (частично) |
| `.copy-template-btn` / `.copy-tooltip` | нет эквивалентов |
| `.examples-table` | нет эквивалента |
| `.when-useful` / `.how-verify` / `.how-verify-title` / `.price-hint` | нет эквивалентов |

**Причина:** `career/index.html` — полностью кастомный дизайн с собственным `<style>`-блоком.
Страница работает, но изолирована от Swiss Grid design system.
Требует либо переноса на Swiss Grid, либо добавления её классов в `style.css`.

---

## Сводка

| Страница | Статус | Сломанных классов |
|---|---|---|
| `cases/index.html` | ✅ Чисто | 0 |
| `courses/index.html` | ⚠️ Требует правок | 12 (генерируется скриптом) |
| `notes/index.html` | ⚠️ Требует правок | 4 |
| `about/index.html` | ⚠️ Требует правок | 8 |
| `companies/index.html` | 🔴 Кастомный дизайн | 10+ |
| `career/index.html` | 🔴 Кастомный дизайн | 38+ |
