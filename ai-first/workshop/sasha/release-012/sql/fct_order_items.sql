-- Зерно: одна строка на (order_id, sku). Основная витрина проекта.
--
-- Внутренний джойн к stg_orders выбрасывает позиции, чей заказ ещё не
-- доехал (у отменённых заказов строка обновляется в момент отмены, часами
-- позже оплаты). На курсоре таких позиций видно порядка тысячи. Решение
-- сознательное: витрина обязана быть согласованной сама с собой, а
-- «позиция без заказа» — не факт о мире, а артефакт снимка.
--
-- Ни отменённые, ни гостевые здесь не фильтруются. Отменённый заказ —
-- это спрос, который был; выкидывать его на уровне витрины значит
-- лишить метрику выбора.
select
    i.order_id,
    i.sku,
    o.customer_id,
    o.store_id,
    o.status,
    o.is_guest_order,
    o.ordered_at_utc,
    i.received_at_utc,
    p.category,
    i.qty,
    i.unit_price,
    i.discount,
    p.list_price,
    p.cost,
    i.qty * i.unit_price - i.discount   as revenue_gross,
    i.qty * p.cost                      as cost_amount,
    o.status = 'cancelled'              as is_cancelled,
    i.discount > 0                      as on_promo,
    i.unit_price > p.list_price         as price_above_list
from {{ ref('stg_order_items') }} i
join {{ ref('stg_orders') }} o using (order_id)
join {{ ref('stg_products') }} p using (sku)
