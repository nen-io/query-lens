SELECT substr(o.ordered_at, 1, 7) AS month,
  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY month
ORDER BY month;
