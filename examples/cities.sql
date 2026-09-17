SELECT c.city,
  COUNT(DISTINCT o.id) AS completed_orders,
  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY c.city
ORDER BY revenue_cents DESC;
