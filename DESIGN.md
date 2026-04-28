# DESIGN.md — davydov.my

Дизайн-система сайта. Канонический документ. Опирается на текущий
/style.css и /main.js — при расхождениях правда в коде.

---

## 1. Стиль

Swiss-минимализм:

- Один акцент: красный (`--accent`).
- Без скруглений, теней, градиентов.
- Без декоративных анимаций. Только базовые hover-переходы цвета.
- Без тёмной темы.
- Жёсткая сетка, тонкие линии.

## 2. Типографика

Два шрифта:

- **Space Grotesk** — основной текст, заголовки.
- **Geist Mono** — служебные надписи (метки, теги, цифры в стат-блоках).

Подключение в `<head>`:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
```

Конкретные размеры элементов — в `/style.css` (источник правды) и
в `/design-system.md` (документация).

## 3. CSS-переменные

```css
:root{
    --bg:#ffffff;
    --ink:#0a0a0a;
    --muted:#737373;
    --mute2:#a3a3a3;
    --line:#e5e5e5;
    --line-d:#d4d4d4;
    --soft:#f5f5f5;
    --soft2:#fafafa;
    --accent:#e63946;
    --accent-d:#c92a37;
    --sans:"Space Grotesk", system-ui, sans-serif;
    --mono:"Geist Mono", ui-monospace, monospace;
  }
```

Прочее (классы, отступы, состояния, медиа-запросы) — в `/style.css` и `/design-system.md`.

## 4. Структура страниц

- Витрины (главная, /about/, /courses/, /cases/, /career/,
  /companies/, /notes/) — единый CSS из `/style.css`, единая
  навигация (`<nav class="nav">`) и подвал (`<footer class="footer">`).
- Курсы (`/lab/*`) — собственные дизайн-системы у разных курсов
  (старые, март 2026). Отдельная задача, не трогать сейчас.
- Заметки (`/notes/*/index.html`) — используют тот же `/style.css`,
  что и витрины.

Конкретные классы и компоненты — в `/design-system.md`.

## 5. Что НЕ используем

- `box-shadow`.
- Линейные градиенты.
- Тёмная тема, переключатель тем.
- Нестандартные шрифты помимо Space Grotesk и Geist Mono.

## 6. Связанные файлы

- `/style.css` — единый CSS витрин. Источник правды по реальным значениям.
- `/main.js` — JS витрин. Сейчас содержит: scroll-reveal через IntersectionObserver, логику nav drawer (открытие/закрытие бургер-меню). Тёмной темы нет.
- `/design-system.md` — детальная документация компонентов: классы, отступы, состояния, inconsistency-список.
- `/working-protocol.md` — рабочий протокол при правках сайта.
- `/_archive/REDESIGN-original-plan-2026-04.md` — изначальный план редизайна (исторический, не применяется).

---

Этот документ — карта местности, не чертёж. Он не содержит
конкретных значений `padding`, `font-size`, `breakpoint`, `gap`.
Эти значения живут в `/style.css` и документируются в
`/design-system.md`. Если значения в этих файлах меняются —
DESIGN.md обновлять не требуется.
