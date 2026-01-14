---
title: "Каталог паттернов"
source_html: "/lab/experiments/patterns-catalog.html"
---

[← Назад к курсу экспериментов](./index.html)

# Каталог паттернов

Не кейсы. Формы.

Паттерн — это повторяющаяся механика, которая ведёт метрики одинаково, даже если "фича" разная.

## Как пользоваться каталогом

1
Определи, какой рычаг трогаешь (pressure / time / price / mix / inventory)

2
Выбери паттерн

3
Поставь primary + guardrails

4
Проверь артефакты (окно, каннибализация, рынок)

## Фильтры

All
Pressure
Time
Market/Price
Mix/Quality

## Каталог паттернов

Pressure Step

Pressure

Когда использовать
Увеличиваете давление на инвентарь (частота, плотность, coverage)

Что меняется (механизм)

- Частота показов растёт, особенно в высокоценных сегментах

- Pressure proxy увеличивается, накапливается усталость

- Coverage расширяется, но может вытеснять низкочастотные сегменты

Primary
Revenue index, Volume/shows

Guardrails
Fatigue/pressure proxy (tail/frequency), Retention/satisfaction proxy, Quality/mix proxy

Красные флаги

- Revenue растёт, но guardrails ухудшаются быстрее (перегруз)

- Frequency tail растёт, coverage падает (вытеснение)

Frequency Cap Change

Pressure

Когда использовать
Меняете ограничения частоты показов (caps, лимиты)

Что меняется (механизм)

- Распределение частоты сдвигается (хвост укорачивается или удлиняется)

- Coverage меняется: меньше caps = больше coverage, но выше усталость

- Микс инвентаря перераспределяется между частотными сегментами

Primary
Revenue index, Coverage/fill-like proxy

Guardrails
Frequency tail distribution, Retention/satisfaction proxy, Quality/mix proxy

Красные флаги

- Coverage растёт, но frequency tail ухудшается (перегруз)

- Revenue растёт краткосрочно, но retention падает позже (усталость)

Inventory Reveal

Mix/Quality
Pressure

Когда использовать
Раскрываете скрытый инвентарь (улучшаете delivery, убираете constraints)

Что меняется (механизм)

- Coverage расширяется, eligible-to-show conversion улучшается

- Микс меняется: добавляется низкокачественный или низкочастотный инвентарь

- Pressure может увеличиться, если новый инвентарь конкурирует за внимание

Primary
Volume/shows, Revenue index

Guardrails
Quality/mix proxy, Price index (proxy), Fatigue/pressure proxy

Красные флаги

- Volume растёт, но price падает (низкокачественный микс)

- Coverage улучшается, но quality proxy ухудшается (сдвиг микса)

Placement Reshape

Mix/Quality

Когда использовать
Меняете формат или расположение размещений (внимание, видимость)

Что меняется (механизм)

- CTR меняется (внимание к размещению), engagement proxy меняется

- Микс инвентаря перераспределяется (высококачественные vs низкокачественные сегменты)

- Displacement может произойти: рост в одном месте = падение в другом

Primary
Revenue index, CTR (диагностическая)

Guardrails
Engagement/attention proxy, Quality/mix proxy, Retention/satisfaction proxy

Красные флаги

- CTR растёт, но engagement падает (displacement)

- Revenue растёт, но quality proxy ухудшается (сдвиг в низкокачественный микс)

Price/Floor Move

Market/Price

Когда использовать
Меняете цену или floor (порог минимальной цены)

Что меняется (механизм)

- Price index меняется (рост floor = рост цены, но падение volume)

- Volume меняется обратно (trade-off: цена ↑ = объём ↓)

- Микс меняется: floor отрезает низкоценный хвост, микс становится "чище"

Primary
Revenue index, Price index (proxy)

Guardrails
Volume/shows, Coverage/fill-like proxy, Quality/mix proxy

Красные флаги

- Price растёт, но volume падает сильнее (эластичность достигнута)

- Revenue растёт краткосрочно, но coverage падает (пережатый режим)

Market Shock Guarded

Market/Price
Time

Когда использовать
Тестируете на фоне рыночного сдвига (шок спроса, сезонность, конкуренция)

Что меняется (механизм)

- Рынок меняется независимо от теста (спрос, конкуренция, сезонность)

- Эффект теста смешивается с рыночным эффектом

- Baseline нестабилен, контрольная группа "плавает"

Primary
Revenue index (baseline-adjusted), Price index (proxy)

Guardrails
Baseline stability, Control group stability, Market indicators

Красные флаги

- Naive uplift положительный, но baseline-adjusted около нуля (артефакт рынка)

- Контрольная группа нестабильна, выводы ненадёжны

Lagged Rollout

Time

Когда использовать
Эффект приходит с задержкой (поведенческий лаг, адаптация, накопление)

Что меняется (механизм)

- Ранние сигналы (proxy) меняются раньше, чем итоговая метрика

- Эффект накапливается постепенно (sigmoid-like кривая)

- Короткое окно ловит адаптацию, а не устойчивый эффект

Primary
Revenue index (long window), Early proxy signals

Guardrails
Early proxy vs primary divergence, Late effects window, Risk accumulation

Красные флаги

- Short window показывает рост, long window показывает падение (ложная победа)

- Proxy улучшается, но primary не следует (proxy drift)

Window Sensitivity

Time

Когда использовать
Вывод сильно зависит от выбора окна оценки (короткое vs длинное)

Что меняется (механизм)

- Короткое окно ловит ранние эффекты (адаптация, шум)

- Длинное окно ловит устойчивые эффекты и поздние последствия

- Вывод меняется в зависимости от окна (ранний плюс → поздний минус)

Primary
Revenue index (short vs long window comparison)

Guardrails
Window stability, Late effects indicators, Risk accumulation over time

Красные флаги

- Short window uplift положительный, long window отрицательный (нестабильность)

- Эффект ослабевает со временем без изменения рынка (усталость)

Cannibalization Check

Pressure
Mix/Quality

Когда использовать
Подозреваете переток между сегментами (shared inventory, конкуренция за внимание)

Что меняется (механизм)

- Test segment растёт, но соседние сегменты падают

- Total revenue не меняется или меняется слабо (компенсация)

- Микс перераспределяется между сегментами

Primary
Total revenue index, Test segment revenue

Guardrails
Adjacent segments revenue, Mix composition, Coverage stability

Красные флаги

- Test segment растёт, total revenue не меняется (каннибализация)

- Рост в одном сегменте = падение в соседнем (переток)

Mix Shift

Mix/Quality

Когда использовать
Изменение приводит к сдвигу микса инвентаря (композиционные изменения)

Что меняется (механизм)

- Доли сегментов меняются (высококачественные vs низкокачественные)

- Среднее может не меняться, но распределение меняется

- Coverage может меняться (вытеснение сегментов)

Primary
Revenue index, Quality-weighted revenue

Guardrails
Quality/mix proxy, Distribution tails, Coverage stability

Красные флаги

- Среднее растёт, но хвосты деградируют (distribution shift)

- Revenue растёт, но quality proxy падает (сдвиг в низкокачественный микс)

Proxy Improvement Trap

Mix/Quality
Time

Когда использовать
Ранний сигнал (proxy) улучшается, но итоговая метрика не следует

Что меняется (механизм)

- Proxy улучшается (coverage, showConv, CTR), но revenue не растёт

- Корреляция между proxy и primary ломается (proxy drift)

- Эффект проявляется в proxy раньше, но не доходит до primary

Primary
Revenue index, Proxy vs primary divergence

Guardrails
Proxy-primary correlation, Price/volume decomposition, Quality/mix proxy

Красные флаги

- Proxy улучшается, primary не следует (proxy drift)

- Coverage растёт, но price падает (компенсация через цену)

Local Win / System Loss

Pressure
Time

Когда использовать
Тест "побеждает" в окне оценки, но система проигрывает при выкатке

Что меняется (механизм)

- В тесте revenue растёт, guardrails стабильны

- При выкатке эффект меняется (масштаб, saturation, конкуренция)

- Поздние эффекты проявляются только при полной выкатке (усталость, деградация)

Primary
Revenue index (test vs rollout comparison), System-wide revenue

Guardrails
Late effects indicators, Scale effects, Saturation indicators, Risk accumulation

Красные флаги

- Test uplift положительный, rollout uplift отрицательный (масштабный эффект)

- Guardrails ухудшаются при выкатке, хотя в тесте были стабильны

## Быстрый выбор паттерна

Если вы меняете …
→ начните с паттерна …

Давление (частота, плотность, coverage)
Pressure Step, Frequency Cap Change

Окно/лаг (эффект приходит позже)
Lagged Rollout, Window Sensitivity

Цена/пол (floor, pricing)
Price/Floor Move

Микс (композиция, качество инвентаря)
Mix Shift, Inventory Reveal

Подозрение на переток между сегментами
Cannibalization Check

Улучшили proxy без денег
Proxy Improvement Trap

Название изменения не важно. Важна форма реакции системы.