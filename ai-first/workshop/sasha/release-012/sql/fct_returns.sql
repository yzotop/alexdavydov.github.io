-- Зерно: одна строка на возвращённую позицию.
--
-- Обе даты остаются в витрине: returned_at_utc — когда возврат случился,
-- received_at_utc — когда о нём узнали. Метрика выбирает сама; витрина,
-- оставившая только одну из них, молча выбрала за неё.
select
    r.order_id,
    r.sku,
    f.customer_id,
    f.store_id,
    f.category,
    f.ordered_at_utc,
    r.returned_at_utc,
    r.received_at_utc,
    r.reason,
    r.qty_returned,
    f.qty                                       as qty_sold,
    f.on_promo,
    r.qty_returned * f.unit_price               as returned_value,
    date_diff('day', f.ordered_at_utc, r.returned_at_utc) as days_to_return
from {{ ref('stg_returns') }} r
join {{ ref('fct_order_items') }} f using (order_id, sku)
