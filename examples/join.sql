SELECT o.id AS order_id, o.ordered_at, c.name AS customer,
  p.name AS product, oi.quantity,
  oi.quantity * oi.unit_price_cents AS line_total_cents
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'completed'
ORDER BY o.id, p.id
LIMIT 12;
