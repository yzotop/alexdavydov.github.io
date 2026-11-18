-- Позиции заказа, по одной строке на (order_id, sku).
--
-- Здесь снимаются дубли от ретрая оплаты: копия побайтово совпадает с
-- оригиналом, поэтому берётся первая по received_at. Это единственное
-- место в проекте, где дедупликация вообще происходит — если её делать
-- в витринах, каждая витрина будет решать заново и они разойдутся.
--
-- Смещение магазина достаётся через заказ: у позиции своего store_id нет.
-- Джойн к СЫРЫМ заказам, а не к stg_orders, намеренно: позиция доезжает
-- с оплатой, а строка отменённого заказа — с отменой, часами позже.
-- Инвариант «позиция без заказа» нарушается только на витрине, и это
-- решение витрины, а не потеря данных в staging.
with cur as (select ts from {{ source('raw', 'world_cursor') }})

select
    i.order_id,
    i.sku,
    i.qty,
    i.unit_price,
    i.discount,
    i.received_at - interval (z.utc_offset_hours) hour as received_at_utc
from {{ source('raw', 'order_items') }} i
join {{ source('raw', 'orders') }} o using (order_id)
join {{ source('raw', 'store_timezones') }} z using (store_id)
where i.received_at - interval (z.utc_offset_hours) hour <= (select ts from cur)
qualify row_number() over (partition by i.order_id, i.sku order by i.received_at) = 1
