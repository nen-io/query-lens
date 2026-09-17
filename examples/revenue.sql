-- Revenue from completed orders, grouped by product category
SELECT
  p.category,
  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents,
  SUM(oi.quantity) AS units_sold
FROM order_items AS oi
JOIN products AS p ON p.id = oi.product_id
JOIN orders AS o ON o.id = oi.order_id
WHERE o.status = 'completed'
GROUP BY p.category
ORDER BY revenue_cents DESC;
