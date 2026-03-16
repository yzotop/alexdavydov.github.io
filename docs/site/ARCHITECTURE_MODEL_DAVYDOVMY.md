# Архитектурная модель davydov.my

Дата: 2026-03-16

Этот документ фиксирует **текущее каноническое состояние** и **целевую модель** без рискованных массовых переносов URL.

## 1) Ключевые принципы

1. Одна сущность -> один канонический URL и один канонический filesystem root.
2. Раздел верхнего уровня отражает роль в IA сайта, а не историю разработки.
3. Legacy-слои допустимы только как alias, redirect или landing.
4. Любой перенос канонического URL делается только через compatibility plan (redirects + search-index + sitemap-like проверки).
5. `public` репозиторий хранит publish-ready слой, а не сырой data pipeline.

## 2) Каноничность разделов (current-state)

| Раздел | Роль | Canonical сейчас | Комментарий |
| --- | --- | --- | --- |
| `/cases/*` | кейсы | yes | Чистый и устойчивый root для case-entity. |
| `/simulators/*` | интерактивные симуляции | yes | Канонический root для live simulation surfaces. |
| `/calculators/*` | параметрические калькуляторы | yes | Канонический root для calculator surfaces. |
| `/knowledge/*` | knowledge hub | yes | Контентный раздел базы знаний. |
| `/courses/` | каталог/витрина | yes (как hub) | Сейчас это каталог, данные о курсах подтягиваются из `lab/_manifest.json`. |
| `/lab/*` | tools + course-content + compatibility | partial | Содержит канонические курсы и часть legacy/hub-слоев. |

## 3) Разделы с неоднозначной ownership

### 3.1 `courses/` vs `lab/` (курс-слой)

- Сейчас `courses/` выполняет роль витрины.
- Канонические страницы курсов фактически лежат в `lab/*`.
- Это допустимо как current-state, но требует явной фиксации в правилах добавления новых курсов.

### 3.2 `calculators/` vs `lab/calculators/` и `calculators/lab/`

- `calculators/` - канонический tools-root.
- `lab/calculators/*` - redirect/compatibility слой на `calculators/lab/*`.
- `calculators/lab/*` - legacy nested hub (исторический слой внутри calculators).
- Нельзя считать оба (`calculators/*` и `calculators/lab/*`) равноправно каноническими.

### 3.3 `lab/simulators/`

- Существует как nested hub, но не должен конкурировать с `/simulators/` как канонический root.

## 4) Target-state (без автоматического массового переноса)

### 4.1 Что считаем canonical

- Cases: `/cases/*`
- Simulators: `/simulators/*`
- Calculators: `/calculators/*`
- Knowledge: `/knowledge/*`
- Courses:
  - short-term: `/lab/<course-slug>/` остаётся каноникой для course pages
  - `/courses/` остаётся официальным каталогом

### 4.2 Что считаем legacy/compatibility

- `/lab/calculators/*` -> compatibility redirects/aliases
- `/lab/simulators/*` -> compatibility or lab-hub, но не второй canonical root
- `/calculators/lab/*` -> legacy nested layer (кандидат на поэтапное схлопывание)

### 4.3 Stage-1 calculators migration (2026-03-16)

- Выполнен behavior-preserving switch в `calculators/index.html`:
  - relative `./lab/*` links -> absolute `/calculators/lab/*` links.
- Публичное поведение не менялось: runtime targets остались прежними (`/calculators/lab/*`).
- Long-term flattening для волны `revenue`, `rollout`, `rollout-compare`, `funnel-sensitivity` выполнен поэтапно (Stage-2A..2D).
- `calculators/lab/*` остаётся рабочим nested runtime layer до отдельной migration-задачи.

### 4.4 Stage-2A rollout migration (2026-03-16)

- Выполнен точечный flattening только для `rollout`:
  - canonical surface: `/calculators/rollout/`
  - about surface: `/calculators/rollout/about/`
- Совместимость сохранена через redirects с `/calculators/lab/rollout.html` и `/lab/calculators/rollout.html`.
- Shared assets осознанно оставлены в `/calculators/lab/assets/*` (без копирования на этом этапе).

### 4.5 Stage-2B rollout-compare migration (2026-03-16)

- Выполнен точечный flattening только для `rollout-compare`:
  - canonical surface: `/calculators/rollout-compare/`
  - about surface: `/calculators/rollout-compare/about/`
- Совместимость сохранена через redirects с `/calculators/lab/rollout-compare.html` и `/lab/calculators/rollout-compare.html`.
- Shared assets осознанно оставлены в `/calculators/lab/assets/*` (без копирования на этом этапе).
- Stage-2A `rollout` migration остаётся без изменений.

### 4.6 Stage-2C revenue migration (2026-03-16)

- Выполнен точечный flattening только для `revenue`:
  - canonical surface: `/calculators/revenue/`
  - about surface: `/calculators/revenue/about/`
- Совместимость сохранена через redirects с `/calculators/lab/revenue.html` и `/lab/calculators/revenue.html`.
- Shared assets осознанно оставлены в `/calculators/lab/assets/*` (без копирования на этом этапе).
- Для path-sensitive зависимости `links.css` применён стабильный путь: `/lab/assets/css/links.css`.
- Glossary anchors `/lab/glossary/#...` сохранены без изменений.
- Stage-2A `rollout` и Stage-2B `rollout-compare` остаются без изменений.

### 4.7 Stage-2D funnel-sensitivity migration (2026-03-16)

- Выполнен точечный flattening только для `funnel-sensitivity`:
  - canonical surface: `/calculators/funnel-sensitivity/`
  - about surface: `/calculators/funnel-sensitivity/about/`
- Совместимость сохранена через redirects с `/calculators/lab/funnel-sensitivity.html` и `/lab/calculators/funnel-sensitivity.html`.
- Shared assets осознанно оставлены в `/calculators/lab/assets/*` (без копирования на этом этапе).
- Path-sensitive DOM-heavy и inline-style блоки сохранены без изменения логики.
- Stage-2A `rollout`, Stage-2B `rollout-compare` и Stage-2C `revenue` остаются без изменений.
- Для calculator-domain не осталось nested-runtime calculators: legacy nested слой используется только как compatibility redirect surface.

### 4.8 Stage-3A lab aliases cleanup (2026-03-16)

- Обновлён только слой `lab/calculators/*.html` для 4 legacy aliases (`revenue`, `rollout`, `rollout-compare`, `funnel-sensitivity`).
- Redirect targets в этих alias pages направлены напрямую на `/calculators/<slug>/`.
- Промежуточный redirect hop через `/calculators/lab/<slug>.html` для этих 4 alias убран.
- Слой `calculators/lab/*` сохранён без изменений как compatibility + shared-assets layer.

### 4.9 Stage-3B calculators/lab thin stubs (2026-03-16)

- Выполнена замена 8 heavy compatibility pages в `calculators/lab/` на thin redirect stubs (4 main + 4 about).
- URL-совместимость сохранена: legacy `calculators/lab/*` surfaces остаются доступны как redirect endpoints.
- Канонические flat calculators `/calculators/<slug>/` и `/calculators/<slug>/about/` не менялись.
- `calculators/lab/assets/*` сохранён как активный dependency layer.
- `calculators/lab/index.html` намеренно оставлен без изменений.

### 4.10 Stage-3C calculators/lab hub normalization (2026-03-16)

- `calculators/lab/index.html` больше не используется как legacy nested hub и теперь резолвится в `/calculators/`.
- `lab/calculators/index.html` синхронизирован с тем же target `/calculators/`.
- Hub-level compatibility для старых входов `/lab/calculators/` и `/lab/calculators/index.html` упрощена до direct target `/calculators/`.
- Роль `calculators/lab/` теперь честная: compatibility entry + shared asset layer.
- `calculators/lab/assets/*` сохранён без изменений.

## 5) Правила добавления новых сущностей

1. Перед публикацией новой сущности определить canonical URL в `ENTITY_REGISTRY_DAVYDOVMY.md`.
2. Если есть alias, явно зафиксировать его в `assets/redirects.json`.
3. Не создавать одновременно две канонические поверхности для одной сущности (например, и в `/simulators/*`, и в `/calculators/*`).
4. Для курсов:
   - карточка в `/courses/` (catalog),
   - canonical page в текущем agreed root (сейчас `lab/*`),
   - запись в registry.
5. Любой перенос canonical URL делается отдельной migration-задачей с dry-run и совместимостью.

## 6) Что не делать автоматически

- Массово переносить `lab/*` курсы в `courses/*`.
- Удалять `calculators/lab/*` без миграционной карты.
- Резко менять URL в карточках/поиске без compatibility слоя.
