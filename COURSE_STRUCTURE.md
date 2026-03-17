# Структура курсов (current-state)

Этот документ синхронизирован с IA contract из `docs/site/*` и registry.

## IA contract

- `/courses/` — public catalog hub.
- Canonical course content currently lives in `lab/<course-slug>/*`.
- `lab/index.html` — tools hub (не course hub).
- `lab/_manifest.json` — mixed registry feed (не courses-only manifest).

## Актуальные course homes

- `/lab/monetization/`
- `/lab/ab-decisions/`
- `/lab/product-analytics/`
- `/lab/ab-stat-os/` (draft)
- `/lab/quasi-experiments/`

## Роль `/courses/`

- `courses/index.html` = каталог курсов.
- Каталог читает entries из `lab/_manifest.json`.
- С точки зрения IA, только entries с `type=course` являются курсами.
- `glossary`, `simulator`, `calculator` entries в manifest не считаются course entities.

## Навигационная политика (docs)

- Desired behavior для course pages: back-link в `/courses/`.
- Текущее расхождение back-link'ов между курсами — known technical debt.
- Этот документ фиксирует policy, но не меняет runtime.

## Historical context (previous-state)

- Ранее в проекте существовали отдельные курсные/мини-курсные ветки и страницы (`/lab/experiments/`, `/lab/graphs-analytics/` и др.).
- Часть этих путей сейчас удалена или переведена в исторический контекст и не должна интерпретироваться как current canonical course homes.
- Для исторических деталей используйте audit/registry документы, а не этот current-state summary.
