-- Заказы, приведённые к UTC и обрезанные курсором.
--
-- Staging делает ровно две вещи: чинит шкалу времени и применяет отсечку.
-- Он НЕ фильтрует отменённые и НЕ выбрасывает гостевые — это решения
-- метрики, а не слоя. Слой, который решает за метрику, потом нельзя
-- переубедить, не переписав его.
with cur as (select ts from {{ source('raw', 'world_cursor') }})

select
    o.order_id,
    o.customer_id,
    o.store_id,
    o.status,
    z.utc_offset_hours,
    o.ordered_at                                            as ordered_at_local,
    o.ordered_at  - interval (z.utc_offset_hours) hour      as ordered_at_utc,
    o.received_at - interval (z.utc_offset_hours) hour      as received_at_utc,
    o.customer_id is null                                   as is_guest_order
from {{ source('raw', 'orders') }} o
join {{ source('raw', 'store_timezones') }} z using (store_id)
where o.received_at - interval (z.utc_offset_hours) hour <= (select ts from cur)
