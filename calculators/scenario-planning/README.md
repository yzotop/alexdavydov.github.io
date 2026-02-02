# Scenario Planning & P&L Forecast Calculator

Status: active  
Audience: аналитик/финансы/закупки/операции  
Goal: превратить историю продаж и закупочные/логистические ограничения в прогноз продаж + P&L и набор управленческих решений в сценариях.

---

## 1) What this simulator does

Этот калькулятор строит:
1) **Прогноз продаж** (Revenue, Units) по времени и разрезам (категория/страна/клиентский сегмент).
2) **Сценарное P&L**: Gross Profit, Opex, EBITDA (упрощённо), влияние FX и логистики.
3) **Decision outputs**: закупки (buy plan), оборотка/кассовый разрыв (working capital proxy), сервис-уровень и риск out-of-stock.

---

## 2) Data inputs (from theory / typical enterprise systems)

### 2.1 Internal data (ERP/1C analog)
Минимально достаточно 6 таблиц:

1) `sales_fact` (история продаж/отгрузок)
- date, client_id, sku_id, category, country, units, revenue, price
2) `purchase_fact` (закупки/ввоз)
- date, supplier_id, sku_id, country, units, cost_local, currency
3) `inventory_snapshot` (остатки)
- date, sku_id, on_hand_units
4) `catalog` (справочник)
- sku_id, category, shelf_life_flag, import_flag
5) `clients` (справочник клиентов)
- client_id, segment (retail chain / marketplace / other)
6) `logistics_params`
- country, lead_time_days, freight_cost_per_unit (or % of COGS)

### 2.2 External data (optional enrichment)
- FX rates (currency -> local)
- Category market index (Nielsen/GfK analog): seasonality/trend signals
- Macro (inflation) for price/volume elasticity assumptions

---

## 3) Forecast model (baseline + extensions)

### 3.1 Baseline: seasonal time series per segment
На практике стартуем с устойчивого baseline:
- агрегируем продажи на уровень (category x country x client_segment) по неделям или месяцам
- прогнозируем `units` и/или `revenue` через seasonal smoothing (Holt-Winters) или seasonal naive baseline
- price строим отдельно (price = revenue / units) и сценарно двигаем

### 3.2 Scenario drivers (what we change)
Сценарий задаёт шоки/изменения:
- Demand growth (% to units) по категориям/странам/сегментам
- Price change (%)
- FX change (%)
- Freight / logistics change (% or per-unit)
- Lead time change (days)
- Opex (% of revenue) и/или fixed opex
- Service level target (e.g., 95%) и safety stock policy

---

## 4) P&L logic (simplified but interview-grade)

Для периода t:
- `Revenue_t = Units_t * Price_t`
- `COGS_t = Units_t * UnitCost_t`
- `GrossProfit_t = Revenue_t - COGS_t`
- `Freight_t = Units_t * FreightPerUnit_t` (или `COGS_t * freight_pct`)
- `Opex_t = BaseOpex + OpexPct * Revenue_t` (упрощение)
- `EBITDA_t = GrossProfit_t - Freight_t - Opex_t`

FX эффект:
- если закупки в валюте: `UnitCost_t = UnitCostUSD_t * FX_t` (+ пошлины/логистика, если нужно)

---

## 5) Inventory & service (optional, but valuable)

Мы учитываем, что прогноз продаж нельзя выполнить без товара:
- `AvailableUnits_t = OnHand_t + Arrivals_t - SalesUnits_t`
- если `AvailableUnits_t < 0` -> OOS (lost sales proxy)
- arrivals моделируем через lead time и закупочный план

Safety stock policy:
- `SafetyStock = z * sigma_demand * sqrt(lead_time)`
- где sigma_demand оцениваем по истории (или фиксируем как ввод)

---

## 6) Validation & monitoring (how we know it works)

- Rolling backtest: train on past, test on last N periods
- Metrics: MAPE, Bias
- Baseline comparison: seasonal naive must be beaten
- Drift monitoring: резкие сдвиги в структуре (категории/страны/клиенты)

---

## 7) Outputs (what decision makers get)

1) Forecast dashboard:
- Units/Revenue by time + by segments
2) Scenario comparison:
- Base vs Optimistic vs Pessimistic (delta)
3) P&L table:
- Revenue / COGS / GP / Freight / Opex / EBITDA by period
4) Decisions:
- закупочный план (units & cash)
- потребность в оборотке (proxy)
- риски: OOS, FX sensitivity, lead time sensitivity

---

## 8) Assumptions & limitations

- P&L упрощён (без налогов, амортизации, сложных трансфертных цен)
- Inventory моделирование может быть отключено (если нет данных) — тогда считаем “unconstrained forecast”
- Внешние данные опциональны; сценарии могут быть ручными коэффициентами

---

## 9) How to use

1) Загрузите/сгенерируйте данные (sample dataset)
2) Выберите базовую частоту (week/month)
3) Настройте драйверы сценариев
4) Сравните сценарии и выгрузите отчёт (MD/PDF)

