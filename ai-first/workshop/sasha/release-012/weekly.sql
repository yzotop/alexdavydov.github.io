-- Event-time week, common receipt cutoff supplied by the pinned world_cursor/staging.
SELECT count(DISTINCT order_id) AS completed_orders,count(*) AS sale_lines,
       coalesce(sum(qty),0) AS sold_units,coalesce(sum(revenue_gross),0) AS sales_amount
FROM main.fct_order_items WHERE status='completed' AND ordered_at_utc>=? AND ordered_at_utc<?;
SELECT count(*) AS return_events,coalesce(sum(qty_returned),0) AS returned_units,
       coalesce(sum(returned_value),0) AS returns_amount
FROM main.fct_returns r JOIN main.stg_orders o USING(order_id)
WHERE o.status='completed' AND r.returned_at_utc>=? AND r.returned_at_utc<?;
