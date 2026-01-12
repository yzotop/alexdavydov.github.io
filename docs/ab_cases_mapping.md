# A/B course — internal case mapping

⚠️ Внутренний файл.  
Не публикуется на сайте и не используется в пользовательском интерфейсе.

Назначение:
- хранить соответствие между реальными внутренними экспериментами
- и публичными, обезличенными паттернами, используемыми в курсе
«A/B-тестирование: принятие решений на практике».

---

## Module 1 — Effect decomposition  
**Модуль 1. Декомпозиция эффекта**

| Internal case | Public pattern name (EN) | Публичное название (RU, из курса) |
|--------------|--------------------------|-----------------------------------|
| 001 CPM ↑, revenue ↓ | Price up, volume down | Цена растёт — выручка падает |
| 002 Revenue ↑ without CPM ↑ | Revenue growth without price growth | Рост выручки без роста цены |
| 008 Lazy Load — funnel uplift | Funnel-driven effect | Эффект через воронку, а не через цену |
| 009 Visibility ↑ without pressure ↑ | Availability without pressure | Рост доступности без роста давления |
| 010 More impressions — less money | Volume with negative marginal return | Увеличение объёма с отрицательной отдачей |

---

## Module 2 — Scaling & system effects  
**Модуль 2. Масштабирование и системный эффект**

| Internal case | Public pattern name (EN) | Публичное название (RU, из курса) |
|--------------|--------------------------|-----------------------------------|
| 005 Simpson segments | Conflicting segment effects | Противоречивые эффекты по сегментам |
| 007 Local win, system loss | Local win, system loss | Локальная победа, системный проигрыш |
| 011 Adaptive pressure by segment | Differentiated segment impact | Дифференцированное воздействие по сегментам |
| 012 Engagement without money | Engagement without monetization | Рост вовлечённости без роста денег |

---

## Module 3 — Trusting the effect  
**Модуль 3. Доверие к эффекту**

| Internal case | Public pattern name (EN) | Публичное название (RU, из курса) |
|--------------|--------------------------|-----------------------------------|
| 003 Stat sig, no business effect | Statistical effect without business impact | Статистический эффект без бизнес-результата |
| 004 Nothing happened | No effect as valid outcome | Отсутствие эффекта как валидный результат |
| 006 Window changes conclusion | Window-dependent conclusion | Вывод меняется при смене окна наблюдения |

---

## Module 4 — Decision layer  
**Модуль 4. Управленческое решение**

| Internal case | Public pattern name (EN) | Публичное название (RU, из курса) |
|--------------|--------------------------|-----------------------------------|
| 004 Nothing happened | Stop or restart | Отсутствие эффекта: остановка или перезапуск |
| 010 More impressions — less money | Metrics growth without value | Рост метрик без роста ценности |

---

## Notes

- Русские названия **должны полностью совпадать** с формулировками в курсе.
- Номера экспериментов, названия фич и внутренние термины **не публикуются**.
- Все новые кейсы добавлять сразу в формате:
  internal case → public pattern (EN) → публичное название (RU).