2.1 Структура калькулятора (страницы/табы)

Tab A — Data & Calibration
	•	Dataset mode: Sample / Upload CSV (позже)
	•	Periodicity: Weekly / Monthly
	•	Segment level:
	•	Level 1: category
	•	Level 2: category × country
	•	Level 3: category × country × client_segment
	•	Calibration slider:
	•	Scale revenue to target (например “нормировать на 200 млрд”) — чисто для правдоподобия, не обязателен

Tab B — Baseline Forecast
	•	Метод: Seasonal naive / Holt-Winters (simple) (можно один, второй позже)
	•	Train window / Holdout window
	•	Outputs:
	•	Forecast units & revenue lines
	•	Backtest MAPE, Bias

Tab C — Scenario Builder
3 пресета: Base / Optimistic / Pessimistic (и кнопка “+Custom”)
Для каждого сценария вводы (по уровням, можно сначала “общие”):
	•	Demand shock (% to units)
	•	Price shock (%)
	•	FX shock (%)
	•	Freight shock (%)
	•	Lead time delta (days)
	•	Opex (% of revenue) и/или fixed opex

Tab D — P&L
Таблица по периодам:
	•	Revenue
	•	COGS
	•	Gross Profit
	•	Freight
	•	Opex
	•	EBITDA
И графики:
	•	Revenue line (3 сценария)
	•	EBITDA line (3 сценария)
	•	Waterfall по сценарию (опционально)

Tab E — Decisions
Минимальный набор (без сложной оптимизации):
	•	“Recommended purchase units” = forecast units * (1 + safety stock pct)
	•	“Cash need proxy” = purchases cost + freight - gross profit (упрощённо)
	•	“FX sensitivity” (tornado): ±5/10/20% FX impact on EBITDA
	•	“Top risk flags”: high lead time, high FX share, high demand variance

Tab F — Export
	•	Export report to markdown (скачать)
	•	Export charts as PNG (позже)

⸻

2.2 Формулы (минимальный набор, чтобы работало без ML)

Пусть базовая частота — недели. Для сегмента s и недели t:
	•	units_hat[t,s] = seasonal_naive(units[t-52,s]) (если weekly сезонность)
	•	если данных мало: units_hat = mean(last_k_weeks)
	•	price_hat[t,s] = median(price last_k_weeks)
	•	revenue_hat = units_hat * price_hat

Сценарные шоки для сценария c:
	•	units_c = units_hat * (1 + demand_shock_c[s])
	•	price_c = price_hat * (1 + price_shock_c[s])
	•	revenue_c = units_c * price_c

COGS:
	•	unit_cost_base[s] из истории закупок или фикс
	•	unit_cost_c = unit_cost_base * (1 + fx_shock_c) * (1 + cost_shock_optional)
	•	cogs_c = units_c * unit_cost_c

Freight:
	•	freight_per_unit_base или % of cogs
	•	freight_c = units_c * freight_per_unit_base * (1 + freight_shock_c)

Opex:
	•	opex_c = fixed_opex + opex_pct * revenue_c

EBITDA:
	•	ebitda_c = revenue_c - cogs_c - freight_c - opex_c

