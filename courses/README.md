# Courses Architecture

## Structure

`/courses/` is a **public catalog hub**.
Canonical course runtime content currently lives in `/lab/<course-slug>/`.

Current canonical course homes:

```text
lab/
├── monetization/        # 01 — Математика монетизации рекламы
├── ab-decisions/        # 02 — A/B-тестирование: принятие решений
├── product-analytics/   # 03 — Аналитика продукта
├── ab-stat-os/          # 04 — Статистика A/B-тестирования
└── quasi-experiments/   # 05 — Квазиэксперименты и причинная идентификация
```

`/courses/` contains:

- `index.html` — course listing page with links to `/lab/*`
- `README.md` — this file

No course logic, modules, simulators, or content should be placed in `/courses/`.

## Manifest semantics

`/courses/index.html` reads data from `/lab/_manifest.json`.
This manifest is a **mixed registry feed** (not courses-only) and can contain:

- `course`
- `glossary`
- `simulator`
- `calculator`

For IA semantics:

- only `course` entries are course entities;
- `glossary`, `simulator`, `calculator` entries are not courses;
- non-course visibility inside `/courses/` must be explicitly documented as cross-navigation behavior.

## Course navigation policy

- Desired back-link behavior for course pages: return to `/courses/`.
- Current inconsistency across existing course pages is known technical debt.
- No runtime changes are performed in this docs step.

## Adding a new course

1. Create a directory inside `/lab/<course-slug>/`
2. Add an entry to `/lab/_manifest.json` with `slug`, `type`, `status`, `entry`, and description
3. Ensure the course appears correctly in `/courses/` catalog behavior
4. Update architecture docs/registry when introducing new non-course manifest entries
