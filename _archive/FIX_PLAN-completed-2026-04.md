> **АРХИВНЫЙ ДОКУМЕНТ. План выполнен.**
> Все 5 пунктов плана отработаны (по состоянию на 28 апреля 2026,
> подтверждено grep'ом по файлам и аудитом классов).
> Документ сохранён как лог проделанной работы.
>
> ---
>
> # FIX_PLAN.md — план исправления страниц davydov.my (выполнен)

Прочитай `docs/site/CSS_CLASSES.md` и `docs/site/PAGES_AUDIT.md` перед началом.
Делай строго по порядку. После каждого пункта — отдельный коммит.

---

## Пункт 1 — notes/index.html (⚠️ 4 класса)

Замени классы по таблице:

| Было | Стало |
|---|---|
| `.note-item` | `.note` |
| `.site-wrap` | `.page` |
| `.note-desc` | удалить тег, оставить текст внутри `.note-cat` |
| `.muted` (счётчик) | заменить на `<span style="color:var(--muted)">` |

Структура одной заметки:
```html
<a class="note" href="/notes/slug/">
  <span class="note-date">апр 2026</span>
  <span class="note-cat">Категория</span>
  <span class="note-title">Заголовок заметки</span>
  <span class="note-read">4 мин</span>
  <span class="note-arrow">↗</span>
</a>
```

Коммит: `fix: notes index — correct CSS classes`

---

## Пункт 2 — about/index.html (⚠️ 8 классов)

Замени классы по таблице:

| Было | Стало |
|---|---|
| `.avatar` | `.author-av` |
| `.cta-row` | `.ctas` |
| `.work-history` | `.timeline` |
| `.work-item` | `.tl-row` |
| `.work-period` | `.tl-year` |
| `.work-role` | `.tl-body` + `.tl-role` |
| `.site-wrap` | `.page` |
| `.mentor-block` | `.prose` с `<p>` |

Коммит: `fix: about — correct CSS classes`

---

## Пункт 3 — courses/index.html (через скрипт)

Редактировать только `scripts/render_courses_hub.py`, затем запустить его.

Коммит: `fix: courses — update render script to Swiss Grid classes`

---

## Пункт 4 — companies/index.html (полный редизайн)

Удалить `<style>`-блок, переписать на классы из style.css.

Коммит: `fix: companies — full Swiss Grid rewrite`

---

## Пункт 5 — career/index.html (вынести стили)

Создать `career/career.css`, перенести туда `<style>`-блок, обновить nav/footer.

Коммит: `fix: career — extract inline styles to career.css`
