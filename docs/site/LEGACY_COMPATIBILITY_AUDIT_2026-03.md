# Legacy Compatibility Audit (2026-03)

Repo: `public/alexdavydov.github.io`  
Дата: 2026-03-16  
Scope: только compatibility-аудит без массовых переносов.

## A. Audit Summary

Проверены legacy-слои:

- `lab/calculators/*`
- `lab/simulators/*`
- `calculators/lab/*`
- index-страницы с потенциальным дублированием роли.

Ключевые выводы:

1. `/calculators/lab/*` реально используется как compatibility слой для части карточек в `calculators/index.html`.
2. `/lab/calculators/*` уже работает как redirect-слой на `/calculators/lab/*`.
3. `/lab/simulators/*` не используется как полноценный runtime-хаб, но продолжает жить в `lab/_manifest.json` и registry как nested hub.
4. На главной и в `lab/index.html` используются канонические входы `/simulators/` и `/calculators/`.
5. В `assets/search-index.json` и `assets/redirects.json` эти legacy-пути не зафиксированы как активные redirect-правила.

## Link-Usage Table

| legacy_path | target_section | referenced_in | count | risk | recommendation |
| --- | --- | --- | ---: | --- | --- |
| `/lab/calculators/*` | calculators legacy alias | `docs/site/ARCHITECTURE_MODEL_DAVYDOVMY.md`, `docs/site/ENTITY_REGISTRY_CANONICAL_2026-03.md` | 3 | low | оставить как compatibility-only, без runtime-расширения |
| `/lab/simulators/*` | simulators legacy secondary hub | `ENTITY_REGISTRY_CANONICAL_2026-03.md`, `lab/_manifest.json`, `simulators/ad-auction/docs/README.md`, docs/site/* | 5 | medium | трактовать как legacy secondary; не продвигать как canonical |
| `/calculators/lab/*` | calculators nested legacy | `lab/calculators/*.html` (redirect pages), `lab/_manifest.json`, docs/site/* | 23 | medium | оставить для совместимости; планировать поэтапное схлопывание позже |
| `calculators/index.html -> ./lab/*.html` | runtime alias links into `calculators/lab/*` | `calculators/index.html` | 8 | medium | short-term оставить; mid-term перевести карточки на canonical surfaces без удаления alias |

## B. Проверка ключевых entry-файлов

- `index.html` -> использует canonical `/simulators/` и `/calculators/`.
- `calculators/index.html` -> часть карточек ведёт на `./lab/*.html` (legacy alias).
- `simulators/index.html` -> канонический simulator hub.
- `courses/index.html` -> каталог, подтягивает `lab/_manifest.json` (current-state).
- `lab/index.html` -> tools hub, ссылки на canonical `/simulators/` и `/calculators/`.
- `assets/redirects.json` -> не содержит явной матрицы для legacy calculator/simulator слоев.
- `assets/search-index.json` -> не содержит legacy-узлов `lab/calculators`, `lab/simulators`, `calculators/lab`.
- `lab/_manifest.json` -> содержит `simulators` (public) и `calculators` (archived, redirect note).

## C. Dry-Run Plan

### SAFE NOW

1. Документально закрепить compatibility-статус legacy-слоев.
2. Синхронизировать статус `lab/simulators hub` в root registry как `legacy`.
3. Обновить архитектурную навигацию в `README.md` ссылкой на этот аудит.

### SAFE WITH COMPATIBILITY

1. Добавить явные redirects для legacy-alias URL в `assets/redirects.json` (только после отдельной проверки конфликтов).
2. Мягко поменять карточки `calculators/index.html` с `./lab/*.html` на canonical `./ad-monetization/` + целевые canonical pages (если они существуют для всех карточек).

### DO NOT AUTO-EXECUTE

1. Массовые переносы из `lab/*` в `courses/*`.
2. Удаление `calculators/lab/*`.
3. Любые изменения, требующие массовой переработки `assets/search-index.json`.

## D. Внесённые safe изменения

См. изменения в:

- `ENTITY_REGISTRY_DAVYDOVMY.md` (legacy status sync)
- `README.md` (добавлена ссылка на этот аудит)

## E. Stage-1 Migration Update (calculators only)

- Выполнено: в `calculators/index.html` relative `./lab/*` ссылки для 4 legacy calculators заменены на absolute `/calculators/lab/*`.
- Это behavior-preserving изменение: фактические runtime targets не изменились.
- На момент Stage-1 LT flattening на `/calculators/<slug>/` для `revenue`, `rollout`, `rollout-compare`, `funnel-sensitivity` ещё не выполнялся.

## F. Stage-2A Applied (rollout only)

- Для `rollout` создан flat canonical surface:
  - `/calculators/rollout/`
  - `/calculators/rollout/about/`
- Legacy/nested surface сохранён для совместимости:
  - `/calculators/lab/rollout.html`
  - `/calculators/lab/rollout/about/`
- Shared assets сознательно не переносились и продолжают обслуживаться из `/calculators/lab/assets/*`.

## G. Stage-2B Applied (rollout-compare only)

- Для `rollout-compare` создан flat canonical surface:
  - `/calculators/rollout-compare/`
  - `/calculators/rollout-compare/about/`
- Legacy/nested surface сохранён для совместимости:
  - `/calculators/lab/rollout-compare.html`
  - `/calculators/lab/rollout-compare/about/`
- Shared assets сознательно не переносились и продолжают обслуживаться из `/calculators/lab/assets/*`.
- Stage-2A `rollout` migration сохранён без изменений.

## H. Stage-2C Applied (revenue only)

- Для `revenue` создан flat canonical surface:
  - `/calculators/revenue/`
  - `/calculators/revenue/about/`
- Legacy/nested surface сохранён для совместимости:
  - `/calculators/lab/revenue.html`
  - `/calculators/lab/revenue/about/`
- Shared assets сознательно не переносились и продолжают обслуживаться из `/calculators/lab/assets/*`.
- Path-sensitive зависимость `links.css` переведена на стабильный путь `/lab/assets/css/links.css`.
- Glossary anchors `/lab/glossary/#...` сохранены без изменений.
- Stage-2A `rollout` и Stage-2B `rollout-compare` migrations сохранены без изменений.

## I. Stage-2D Applied (funnel-sensitivity only)

- Для `funnel-sensitivity` создан flat canonical surface:
  - `/calculators/funnel-sensitivity/`
  - `/calculators/funnel-sensitivity/about/`
- Legacy/nested surface сохранён для совместимости:
  - `/calculators/lab/funnel-sensitivity.html`
  - `/calculators/lab/funnel-sensitivity/about/`
- Shared assets сознательно не переносились и продолжают обслуживаться из `/calculators/lab/assets/*`.
- DOM-heavy и inline-style секции сохранены с минимальным path rewiring без изменений business logic.
- Stage-2A `rollout`, Stage-2B `rollout-compare` и Stage-2C `revenue` migrations сохранены без изменений.

## J. Stage-3A Applied (lab calculator aliases only)

- Обновлены только legacy alias pages в `lab/calculators/`:
  - `revenue.html`
  - `rollout.html`
  - `rollout-compare.html`
  - `funnel-sensitivity.html`
- Эти страницы теперь редиректят напрямую на flat canonical URLs в `/calculators/<slug>/`.
- Промежуточный hop через `/calculators/lab/<slug>.html` для этих 4 alias удалён.
- `assets/redirects.json` уже содержал direct canonical targets и оставлен консистентным.
- `calculators/lab/*`, `calculators/lab/*/about/`, `calculators/lab/assets/*` не менялись.

## K. Stage-3B Applied (heavy compatibility pages -> thin stubs)

- Заменены 8 heavy compatibility pages в `calculators/lab/` на thin redirect stubs:
  - main: `revenue.html`, `rollout.html`, `rollout-compare.html`, `funnel-sensitivity.html`
  - about: `revenue/about/index.html`, `rollout/about/index.html`, `rollout-compare/about/index.html`, `funnel-sensitivity/about/index.html`
- Для каждого URL сохранён прежний путь, но целевой redirect теперь ведёт на соответствующий flat canonical `/calculators/<slug>/` и `/calculators/<slug>/about/`.
- `calculators/lab/assets/*` сохранён как активный shared asset layer.
- `calculators/lab/index.html` намеренно не изменялся в этом шаге.

## L. Stage-3C Applied (legacy hub entry normalization)

- `calculators/lab/index.html` переведён из legacy nested hub в thin redirect stub к `/calculators/`.
- `lab/calculators/index.html` синхронизирован и также ведёт на `/calculators/`.
- В `assets/redirects.json` hub-rules для `/lab/calculators/` и `/lab/calculators/index.html` обновлены на direct target `/calculators/`.
- Redirect loop не обнаружен: `/calculators/lab/` и `/lab/calculators/` корректно резолвятся в `/calculators/`.
- `calculators/lab/assets/*` и compatibility stubs `calculators/lab/*.html`, `calculators/lab/*/about/` не изменялись.

## M. Simulators docs-first alignment (2026-03-16)

- Зафиксировано архитектурное правило: `/simulators/` — единственный canonical simulator hub.
- Canonical runtime simulator surfaces: `/simulators/<slug>/`.
- `lab/simulators/*` трактуется как legacy/compatibility layer и не должен конкурировать с canonical hub.
- `lab/simulators/scenario-planning/*` зафиксирован как compatibility bridge к `/calculators/scenario-planning/*`.
- Варианты `*-live`, `*-mvp`, `*-pressure` трактуются как variant/legacy branches, не как second canonical hubs.

## N. Simulators hub cleanup applied (2026-03-16)

- `lab/simulators/index.html` заменён на thin redirect stub с canonical target `/simulators/`.
- Добавлены hub-level redirect rules для консистентности:
  - `/lab/simulators/` -> `/simulators/`
  - `/lab/simulators/index.html` -> `/simulators/`
- Redirect loop не обнаружен; canonical simulator runtime surfaces в `/simulators/*` не менялись.
- `lab/simulators/scenario-planning/*` и variant simulator pages не затрагивались.

## O. Courses-lab docs-only IA alignment (2026-03-16)

- `/courses/` зафиксирован как public catalog hub (не canonical runtime home курсов).
- Canonical course content currently lives in `lab/<course-slug>/*`.
- `lab/index.html` зафиксирован как tools hub.
- `lab/glossary` зафиксирован как glossary/knowledge-like node, не курс.
- `lab/calculators/*` и `lab/simulators/*` зафиксированы как legacy/compatibility layers.
- `lab/_manifest.json` зафиксирован как mixed registry feed (не courses-only manifest).
- Manifest governance и course navigation policy документированы; runtime изменения в этом шаге не выполнялись.
