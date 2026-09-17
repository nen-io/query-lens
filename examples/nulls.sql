SELECT name, city, email
FROM customers
WHERE email IS NULL
ORDER BY id;
