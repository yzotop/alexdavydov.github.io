# Root Markdown Governance Index

Дата: 2026-03-16

Цель: уменьшить архитектурную неоднозначность, **не меняя публичные URL** и не ломая текущие workflow.

## Текущее состояние

В корне репозитория хранится набор governance/architecture markdown-файлов:

- `ARCHITECTURE_PATTERNS.md`
- `COURSE_EXTRACT.md`
- `DESIGN_PATTERNS.md`
- `GLOSSARY.md`
- `INTERNALS.md`
- `STYLE_GUIDE_CURSOR.md`

Канонический реестр сущностей и структура: `docs/site/ENTITY_REGISTRY_CANONICAL_2026-03.md`, `docs/site/ARCHITECTURE_MODEL_DAVYDOVMY.md`, `docs/site/SITE_MAP_DAVYDOVMY.md`.

Это рабочее состояние, но оно делает root-level менее читаемым как отражение IA сайта.

## Рекомендуемая модель (без auto-move)

Short-term (safe):

1. Считать root-файлы текущим источником совместимости.
2. Держать агрегирующую навигацию в `docs/site/*` и `docs/meta/*`.
3. Новые архитектурные документы добавлять в `docs/` по умолчанию.

Mid-term (manual migration, не auto):

1. Подготовить карту переезда root governance docs в:
   - `docs/architecture/`
   - `docs/site/`
   - `docs/meta/`
2. Перед переносом проверить скрипты и ссылки:
   - `scripts/publish_audit.sh`
   - ссылки из `README.md`
   - внешние/internal bookmarks maintainer-процесса.

## Почему не переносим автоматически

- `scripts/publish_audit.sh` упоминает root docs в отчёте; не требует их наличия.
- В `README.md` есть прямые ссылки на root docs (`ARCHITECTURE_PATTERNS.md`, `STYLE_GUIDE_CURSOR.md`, `DESIGN_PATTERNS.md`).
- Автоматический перенос без полной compatibility-проверки — unnecessary risk для публичного репозитория.
