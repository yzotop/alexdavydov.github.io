# Анализ структуры (current-state snapshot)

Этот файл обновлён как внутренний snapshot и согласован с актуальным IA contract.

## Current-state: courses vs lab

- `/courses/` = public catalog hub.
- Canonical course homes сейчас:  
  - `/lab/monetization/`  
  - `/lab/ab-decisions/`  
  - `/lab/product-analytics/`  
  - `/lab/ab-stat-os/` (draft)  
  - `/lab/quasi-experiments/`
- `lab/index.html` = tools hub.
- `lab/glossary` = glossary/knowledge-like node (не курс).

## Current-state: compatibility layers inside lab

- `lab/calculators/*` = legacy compatibility layer for calculators domain.
- `lab/simulators/*` = legacy compatibility layer for simulators domain.
- Эти слои не являются course homes.

## Current-state: manifest semantics

- `lab/_manifest.json` используется каталогом `/courses/`.
- Это mixed registry feed, включающий типы: `course`, `glossary`, `simulator`, `calculator`.
- Не-course типы в manifest не должны интерпретироваться как курсы.

## Historical context

- Предыдущие ревизии этого файла содержали старые активные paths (`/lab/experiments/`, `/lab/graphs-analytics/`, др.).
- Эти записи сохраняют историческую ценность, но не отражают текущую каноническую IA-модель.
- Для migration и compatibility решений ориентироваться на `docs/site/*` и `ENTITY_REGISTRY_DAVYDOVMY.md`.
