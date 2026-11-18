-- Возвраты. Своего store_id не несут — шкала достаётся через заказ.
-- Нормализовать returns в одиночку нельзя, и это не дефект схемы,
-- а то, как выглядят реальные выгрузки.
with cur as (select ts from {{ source('raw', 'world_cursor') }})

select
    r.order_id,
    r.sku,
    r.qty                                                   as qty_returned,
    r.reason,
    r.returned_at - interval (z.utc_offset_hours) hour      as returned_at_utc,
    r.received_at - interval (z.utc_offset_hours) hour      as received_at_utc
from {{ source('raw', 'returns') }} r
join {{ source('raw', 'orders') }} o using (order_id)
join {{ source('raw', 'store_timezones') }} z using (store_id)
where r.received_at - interval (z.utc_offset_hours) hour <= (select ts from cur)
