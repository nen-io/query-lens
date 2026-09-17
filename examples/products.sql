SELECT p.name AS product,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status = 'completed'
GROUP BY p.id, p.name
ORDER BY revenue_cents DESC;
