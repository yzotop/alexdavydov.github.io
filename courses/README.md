# Courses Architecture

## Structure

All course content physically lives in `/lab/`:

```
lab/
├── monetization/        # 01 — Математика монетизации рекламы
├── experiments/         # 02 — Математика экспериментов в монетизации
├── ab-decisions/        # 03 — A/B-тестирование: принятие решений
├── product-analytics/   # 04 — Аналитика продукта
└── ab-stat-os/          # 05 — Статистика A/B-тестирования
```

`/courses/` is **only a navigation/catalog layer**. It contains:

- `index.html` — course listing page with links to `/lab/*`
- `README.md` — this file

No course logic, modules, simulators, or content should be placed in `/courses/`.

## Adding a new course

1. Create a directory inside `/lab/<course-slug>/`
2. Add an entry to `/courses/index.html`
