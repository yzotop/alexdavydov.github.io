# Структура проекта alexdavydov.github.io

## Общая информация
- **Тип проекта**: Статический сайт (GitHub Pages)
- **Язык**: HTML, CSS, минималистичный дизайн
- **Общее количество HTML страниц**: ~115
- **Структура**: Модульная, тематические разделы

---

## Корневая структура

```
alexdavydov.github.io/
├── index.html                    # Главная страница сайта
├── README.md                     # Описание проекта
├── COURSE_STRUCTURE.md          # Структура курсов
├── courses/                      # Полные курсы
│   └── monetization/
│       └── operating/
└── lab/                          # Лаборатория (основной контент)
    ├── [тематические разделы]
    └── [отдельные страницы]
```

---

## Главная страница (index.html)

**Содержание:**
- Заголовок: "Alex Davydov — Applied Mathematics of Complex Systems"
- Описание проекта
- Сетка курсов и мини-курсов
- Ссылки на основные разделы

**Основные разделы на главной:**
- Графики в аналитике и математических представлениях
- Математика неопределённости
- Другие курсы и материалы

---

## Раздел /lab/ — Лаборатория

### 1. **lab/graphs-as-argument/** — Мини-курс "Графики как аргумент"
**11 файлов:**
- `index.html` — главная страница курса
- `syllabus.html` — программа курса
- `checklist.html` — чек-лист для проверки
- **8 уроков:**
  1. `ab-test-table.html` — Итоговая таблица A/B-теста
  2. `colored-table.html` — Цветная таблица
  3. `pivot-table.html` — Pivot-таблица
  4. `message-title.html` — График без сообщения
  5. `pie-over-time.html` — Доли во времени
  6. `multigroup-lines.html` — Мультигрупп A/B
  7. `honest-time-axis.html` — Ось времени
  8. `kpi-signal.html` — KPI для решения
- `CHECK_REPORT.md` — отчет о проверке

### 2. **lab/ab-practice/** — Практика A/B-тестов
**Структура:**
- `index.html` — главная страница
- `syllabus.html` — программа
- `scenarios/` — сценарии практики (7 файлов)
  - 001-cpm-up-rev-down.html
  - 002-rev-up-no-cpm.html
  - 003-stat-sig-no-impact.html
  - 004-no-effect.html
  - 005-segment-conflict-simpson.html
  - 006-window-changes-conclusion.html
  - 007-local-win-system-loss.html
- `assets/graphs/` — графики и визуализации

### 3. **lab/decision/** — Принятие решений
**5 страниц:**
- `index.html`
- `exploration-vs-exploitation.html`
- `irreversibility.html`
- `regret.html`
- `value-of-information.html`

### 4. **lab/distributions/** — Распределения
**5 страниц:**
- `index.html`
- `bimodal.html`
- `divisors-1-100.html`
- `heavy-tail.html`
- `uniform-1-100.html`

### 5. **lab/equilibrium/** — Равновесие
**5 страниц:**
- `index.html`
- `absorbing-state.html`
- `convergence.html`
- `metastability.html`
- `mixing-time.html`

### 6. **lab/experiments/** — Эксперименты
**9 страниц:**
- `index.html`
- `anatomy-of-experiment.html`
- `checklists-operating.html`
- `metric-conflicts.html`
- `metrics-for-reading.html`
- `patterns-catalog.html`
- `pressure-design.html`
- `role-of-experiment.html`
- `time-and-lags.html`

### 7. **lab/geometry/** — Геометрия решений
**6 страниц:**
- `index.html`
- `curvature-of-decisions.html`
- `feasible-set.html`
- `option-space-collapse.html`
- `reachability-vs-optimality.html`
- `uncertainty-surface.html`

### 8. **lab/monetization/** — Монетизация (большой раздел)
**Структура:**
- `index.html` — главная страница
- `syllabus.html` — программа курса

**Подразделы:**

#### **lab/monetization/experiments/** — Эксперименты в монетизации
- `index.html`
- `anatomy-of-experiment.html`
- `decision-patterns.html`
- `pressure-patterns.html`
- `time-patterns.html`

#### **lab/monetization/inventory/** — Инвентарь
- `index.html`
- `coverage-vs-pressure.html`
- `hidden-inventory.html`
- `inventory-fatigue.html`
- `inventory-metrics.html`
- `inventory-quality.html`

#### **lab/monetization/market/** — Рынок
- `index.html`
- `auction-competition.html`
- `demand-shocks.html`
- `floor-and-constraints.html`
- `price-elasticity.html`
- `price-vs-volume.html`

#### **lab/monetization/metrics/** — Метрики
- `index.html`
- `calculators.html`
- `cpm.html`
- `metric-decomposition.html`
- `revenue.html`
- `show-fill-rate.html`

#### **lab/monetization/operating/** — Операционная работа
- `index.html`
- `alerts.html`
- `cadence.html`
- `dashboard-spec.html`
- `governance.html`
- `incidents.html`
- `playbooks.html`
- `quality.html`
- `signals.html`

#### **lab/monetization/pressure/** — Давление
- `index.html`
- `hidden-saturation.html`
- `intervention.html`
- `pressure-is-not-adload.html`
- `saturation.html`
- `thresholds.html`

#### **lab/monetization/time/** — Время
- `index.html`
- `delayed-effects.html`
- `drift.html`
- `long-silence.html`
- `regime-change.html`
- `windowing.html`

### 9. **lab/pressure/** — Давление (общий раздел)
**5 страниц:**
- `index.html`
- `intervention.html`
- `reshaping.html`
- `saturation.html`
- `threshold.html`

### 10. **lab/time/** — Время (общий раздел)
**6 страниц:**
- `index.html`
- `daily-cycle.html`
- `drift.html`
- `long-silence.html`
- `regime-change.html`
- `waiting-time.html`

### 11. **lab/transitions/** — Переходы
**3 страницы:**
- `index.html`
- `markov-matrix.html`
- `sankey-flows.html`

### 12. **Отдельные страницы в /lab/**
- `graphs-section-content.html`
- `markov-lens.html`
- `mathematics-of-uncertainty.html`

---

## Раздел /courses/ — Полные курсы

```
courses/
└── monetization/
    └── operating/
```

---

## Статистика проекта

### По разделам:
- **lab/graphs-as-argument/**: 11 файлов
- **lab/monetization/**: ~50+ файлов (самый большой раздел)
- **lab/experiments/**: 9 файлов
- **lab/geometry/**: 6 файлов
- **lab/time/**: 6 файлов
- **lab/equilibrium/**: 5 файлов
- **lab/decision/**: 5 файлов
- **lab/distributions/**: 5 файлов
- **lab/pressure/**: 5 файлов
- **lab/transitions/**: 3 файла
- **lab/ab-practice/**: ~10 файлов

### Общая статистика:
- **Всего HTML страниц**: ~115
- **Основных разделов в /lab/**: 12
- **Мини-курсов**: 1 (graphs-as-argument)
- **Полных курсов**: 1+ (monetization)

---

## Особенности структуры

### Навигация:
- Каждый раздел имеет свой `index.html`
- Многие разделы имеют `syllabus.html`
- Единообразная навигация между страницами
- Ссылки "Предыдущий/Следующий урок" в уроках

### Стиль:
- Минималистичный дизайн
- Единый стиль CSS во всех файлах
- Адаптивная верстка
- Фокус на контенте, а не на дизайне

### Организация:
- Модульная структура
- Тематическая группировка
- Логическая иерархия разделов
- Переиспользование компонентов

---

## Основные темы проекта

1. **Аналитика и визуализация данных**
   - Графики как аргумент
   - Представление данных

2. **Математика сложных систем**
   - Равновесие и переходы
   - Распределения
   - Геометрия решений

3. **Эксперименты и A/B-тесты**
   - Анатомия экспериментов
   - Метрики и паттерны
   - Практика A/B-тестов

4. **Монетизация**
   - Метрики монетизации
   - Рынок и инвентарь
   - Операционная работа
   - Давление и насыщение

5. **Время и динамика**
   - Временные паттерны
   - Режимные изменения
   - Задержки эффектов

6. **Принятие решений**
   - Исследование vs эксплуатация
   - Необратимость
   - Ценность информации

---

## Файлы документации

- `README.md` — основное описание проекта
- `COURSE_STRUCTURE.md` — структура курсов
- `lab/graphs-as-argument/CHECK_REPORT.md` — отчет о проверке мини-курса

---

*Последнее обновление: 2024*

