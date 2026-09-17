import type { Database } from "sql.js";
export const tableNames = [
  "customers",
  "products",
  "orders",
  "order_items",
] as const;
export type TableName = (typeof tableNames)[number];
const customers: (string | number | null)[][] = [
  [1, "Alex Chen", "Taipei", "alex@example.test"],
  [2, "Sam Lin", "Taichung", "sam@example.test"],
  [3, "Morgan Wu", "Kaohsiung", "morgan@example.test"],
  [4, "Casey Huang", "Tainan", null],
  [5, "Jamie Liu", "Taipei", "jamie@example.test"],
  [6, "Avery Wang", "Taichung", null],
  [7, "Riley Tsai", "Kaohsiung", "riley@example.test"],
  [8, "Taylor Hsu", "Tainan", "taylor@example.test"],
  [9, "Quinn Lee", "Taipei", "quinn@example.test"],
  [10, "Jordan Yang", "Taichung", null],
  [11, "Rowan Cheng", "Kaohsiung", "rowan@example.test"],
  [12, "Sky Shen", "Tainan", "sky@example.test"],
];
const products: (string | number)[][] = [
  [1, "Linen notebook", "Stationery", 1800],
  [2, "Field tote", "Everyday carry", 3200],
  [3, "Travel mug", "Everyday carry", 2400],
  [4, "Desk light", "Workspace", 6900],
  [5, "Cable kit", "Workspace", 2200],
  [6, "Studio stand", "Workspace", 4800],
  [7, "Weekly planner", "Stationery", 1600],
  [8, "Insulated bottle", "Everyday carry", 3600],
];
export const schemaSql = `
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, email TEXT);
CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0));
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), ordered_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('completed','cancelled')));
CREATE TABLE order_items (order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0), PRIMARY KEY(order_id,product_id));
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
`;
/** All records are deterministic synthetic teaching data; cents are integer USD cents. */
export function seedDatabase(db: Database): void {
  db.run(schemaSql);
  const insertCustomers = db.prepare("INSERT INTO customers VALUES (?,?,?,?)");
  const insertProducts = db.prepare("INSERT INTO products VALUES (?,?,?,?)");
  const insertOrders = db.prepare("INSERT INTO orders VALUES (?,?,?,?)");
  const insertItems = db.prepare("INSERT INTO order_items VALUES (?,?,?,?)");
  try {
    db.run("BEGIN");
    for (const row of customers) insertCustomers.run(row);
    for (const row of products) insertProducts.run(row);
    for (let i = 0; i < 72; i++) {
      const date = new Date(Date.UTC(2026, 0, i + 1))
        .toISOString()
        .slice(0, 10);
      insertOrders.run([
        i + 1,
        (i % 12) + 1,
        date,
        i % 9 === 0 ? "cancelled" : "completed",
      ]);
      const first = (i * 3) % 8;
      const second = (first + 3) % 8;
      insertItems.run([i + 1, first + 1, (i % 3) + 1, products[first][3]]);
      insertItems.run([i + 1, second + 1, (i % 2) + 1, products[second][3]]);
    }
    db.run("COMMIT");
  } finally {
    insertCustomers.free();
    insertProducts.free();
    insertOrders.free();
    insertItems.free();
  }
}
export type SchemaTable = {
  name: TableName;
  count: number;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    primary: boolean;
  }[];
};
export function readSchema(db: Database): SchemaTable[] {
  return tableNames.map((name) => ({
    name,
    count: Number(db.exec(`SELECT COUNT(*) FROM ${name}`)[0].values[0][0]),
    columns: db.exec(`PRAGMA table_info(${name})`)[0].values.map((row) => ({
      name: String(row[1]),
      type: String(row[2]),
      nullable: !row[3] && !row[5],
      primary: !!row[5],
    })),
  }));
}
export const examples = [
  {
    id: "revenue",
    title: "Revenue by category",
    description: "Completed orders · USD cents",
    sql: `-- Revenue from completed orders, grouped by product category\nSELECT\n  p.category,\n  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents,\n  SUM(oi.quantity) AS units_sold\nFROM order_items AS oi\nJOIN products AS p ON p.id = oi.product_id\nJOIN orders AS o ON o.id = oi.order_id\nWHERE o.status = 'completed'\nGROUP BY p.category\nORDER BY revenue_cents DESC;`,
  },
  {
    id: "products",
    title: "Top products",
    description: "Revenue and units · completed orders",
    sql: `SELECT p.name AS product,\n  SUM(oi.quantity) AS units_sold,\n  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents\nFROM order_items oi\nJOIN products p ON p.id = oi.product_id\nJOIN orders o ON o.id = oi.order_id\nWHERE o.status = 'completed'\nGROUP BY p.id, p.name\nORDER BY revenue_cents DESC;`,
  },
  {
    id: "cities",
    title: "City totals",
    description: "Customer geography · USD cents",
    sql: `SELECT c.city,\n  COUNT(DISTINCT o.id) AS completed_orders,\n  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items oi ON oi.order_id = o.id\nWHERE o.status = 'completed'\nGROUP BY c.city\nORDER BY revenue_cents DESC;`,
  },
  {
    id: "join",
    title: "Order detail",
    description: "A four-table join · first 12 lines",
    sql: `SELECT o.id AS order_id, o.ordered_at, c.name AS customer,\n  p.name AS product, oi.quantity,\n  oi.quantity * oi.unit_price_cents AS line_total_cents\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nJOIN order_items oi ON oi.order_id = o.id\nJOIN products p ON p.id = oi.product_id\nWHERE o.status = 'completed'\nORDER BY o.id, p.id\nLIMIT 12;`,
  },
  {
    id: "series",
    title: "Monthly revenue",
    description: "ISO dates · actual month groups",
    sql: `SELECT substr(o.ordered_at, 1, 7) AS month,\n  SUM(oi.quantity * oi.unit_price_cents) AS revenue_cents\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nWHERE o.status = 'completed'\nGROUP BY month\nORDER BY month;`,
  },
  {
    id: "nulls",
    title: "Missing contact details",
    description: "NULL is not an empty string",
    sql: `SELECT name, city, email\nFROM customers\nWHERE email IS NULL\nORDER BY id;`,
  },
] as const;
