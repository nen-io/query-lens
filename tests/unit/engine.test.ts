import { afterAll, beforeAll, describe, expect, it } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { createDatabase, executeQuery } from "../../src/domain/query-engine";
import { examples } from "../../src/domain/dataset";
let db: Database;
beforeAll(async () => {
  const SQL = await initSqlJs();
  db = createDatabase(SQL).db;
});
afterAll(() => db.close());
const run = (sql: string) => executeQuery(db, sql);
describe("real SQLite seed queries, independently calculated expectations", () => {
  it("contains exact declared table counts", () => {
    expect(
      run(
        "SELECT (SELECT COUNT(*) FROM customers), (SELECT COUNT(*) FROM products), (SELECT COUNT(*) FROM orders), (SELECT COUNT(*) FROM order_items)",
      ).rows,
    ).toEqual([[12, 8, 72, 144]]);
  });
  it("sums completed revenue and units by category", () => {
    expect(run(examples[0].sql).rows).toEqual([
      ["Workspace", 365100, 83],
      ["Everyday carry", 249200, 83],
      ["Stationery", 112200, 66],
    ]);
  });
  it("returns independently calculated top products", () => {
    expect(run(examples[1].sql).rows).toEqual([
      ["Desk light", 25, 172500],
      ["Studio stand", 25, 120000],
      ["Insulated bottle", 25, 90000],
      ["Field tote", 25, 80000],
      ["Travel mug", 33, 79200],
      ["Cable kit", 33, 72600],
      ["Linen notebook", 33, 59400],
      ["Weekly planner", 33, 52800],
    ]);
  });
  it("aggregates city revenue without multiplying the distinct order count", () => {
    expect(run(examples[2].sql).rows).toEqual([
      ["Taichung", 16, 242500],
      ["Tainan", 16, 200000],
      ["Taipei", 16, 152000],
      ["Kaohsiung", 16, 132000],
    ]);
  });
  it("joins order two to real customer/product quantities", () => {
    expect(run(examples[3].sql).rows.slice(0, 2)).toEqual([
      [2, "2026-01-02", "Sam Lin", "Desk light", 2, 13800],
      [2, "2026-01-02", "Sam Lin", "Weekly planner", 2, 3200],
    ]);
  });
  it("groups ISO dates into actual calendar months", () => {
    expect(run(examples[4].sql).rows).toEqual([
      ["2026-01", 303400],
      ["2026-02", 283100],
      ["2026-03", 140000],
    ]);
  });
  it("preserves NULL and null filtering", () => {
    expect(run(examples[5].sql).rows).toEqual([
      ["Casey Huang", "Tainan", null],
      ["Avery Wang", "Taichung", null],
      ["Jordan Yang", "Taichung", null],
    ]);
    expect(
      run("SELECT COUNT(*) AS missing FROM customers WHERE email = NULL").rows,
    ).toEqual([[0]]);
  });
  it("executes arbitrary real aggregation instead of preset responses", () => {
    expect(
      run(
        "SELECT SUM(oi.quantity * oi.unit_price_cents) AS cents FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='completed'",
      ).rows,
    ).toEqual([[726500]]);
  });
});
describe("native parser plus read-only defenses", () => {
  it.each([
    "DELETE FROM orders",
    "DROP TABLE orders",
    "PRAGMA query_only=OFF",
    'ATTACH DATABASE ":memory:" AS other',
    "VACUUM",
    "CREATE TEMP TABLE x(a)",
    "WITH c AS (SELECT 1) DELETE FROM orders RETURNING id",
    "SELECT * FROM pragma_table_info('orders')",
    'SELECT * FROM "pragma_query_only"',
    "SELECT load_extension('x')",
  ])("rejects %s", (sql) => {
    expect(() => run(sql)).toThrow();
    expect(run("SELECT COUNT(*) FROM orders").rows).toEqual([[72]]);
  });
  it("native query_only rejects writes even when text policy is bypassed", () => {
    expect(() => db.run("DELETE FROM orders")).toThrow(/readonly|read.only/i);
    expect(() => db.run("UPDATE products SET price_cents=0")).toThrow(
      /readonly|read.only/i,
    );
    expect(db.exec("SELECT COUNT(*) FROM orders")[0].values).toEqual([[72]]);
  });
  it.each([
    "SELECT * FROM 'pragma_table_info'('orders')",
    "SELECT * FROM 'pragma_query_only'",
    "SELECT * FROM main.'pragma_query_only'",
    "SELECT * FROM 'main'.'pragma_query_only'",
    "SELECT * FROM ('pragma_query_only')",
    "SELECT * FROM (main.'pragma_query_only')",
    "SELECT * FROM ((('pragma_query_only')))",
    "SELECT p.* FROM orders o, 'pragma_query_only' p LIMIT 1",
    "SELECT p.* FROM orders o JOIN 'pragma_query_only' p ON 1 LIMIT 1",
    "SELECT p.* FROM (orders o, (main.'pragma_query_only') p) LIMIT 1",
    "WITH p AS (SELECT * FROM 'pragma_query_only') SELECT * FROM p",
    "SELECT * FROM (SELECT * FROM 'pragma_table_info'('orders'))",
    "SELECT * FROM 'pragma_table_info' WHERE arg='orders'",
    "SELECT 1 IN 'pragma_query_only'",
    "SELECT 1 IN main.'pragma_query_only'",
    "SELECT * FROM /* comment */ 'PrAgMa_QuErY_OnLy' -- tail",
  ])("rejects single-quoted native table identifiers: %s", (sql) => {
    // Prove each adversarial form is accepted by this exact SQLite build before
    // asserting the application rejects it. A syntax error is not a policy test.
    expect(db.exec(sql)[0].values.length).toBeGreaterThan(0);
    expect(() => run(sql)).toThrow(/only appear as string values/);
    expect(run("SELECT COUNT(*) FROM orders").rows).toEqual([[72]]);
  });
  it.each([
    ["SELECT 'pragma_table_info'", [["pragma_table_info"]]],
    [
      "SELECT 'pragma_query_only' AS literal FROM orders LIMIT 1",
      [["pragma_query_only"]],
    ],
    ["SELECT printf('%s','pragma_query_only')", [["pragma_query_only"]]],
    [
      "WITH v(value) AS (VALUES ('pragma_query_only')) SELECT value FROM v",
      [["pragma_query_only"]],
    ],
    [
      "SELECT CASE WHEN 1 THEN 'pragma_query_only' ELSE 'readfile' END",
      [["pragma_query_only"]],
    ],
    [
      "SELECT 'pragma_query_only', 'load_extension', 'READFILE'",
      [["pragma_query_only", "load_extension", "READFILE"]],
    ],
    [
      "SELECT 1 WHERE 'pragma_query_only' IN ('pragma_query_only', 'other')",
      [[1]],
    ],
    [
      "SELECT 'pragma_query_only' || ';' || 'it''s a value'",
      [["pragma_query_only;it's a value"]],
    ],
    ["SELECT 7 /* FROM 'pragma_query_only' */ -- JOIN 'readfile'\n", [[7]]],
  ])("preserves ordinary sensitive-looking string values: %s", (sql, rows) => {
    const result = run(sql);
    expect(result.rows).toEqual(rows);
    expect(result.sql).toBe(sql);
  });
  it("validates quoted values without executing or allowing multiple statements", () => {
    expect(() => run("SELECT 'pragma_query_only'; SELECT 2")).toThrow(
      "one SQL statement",
    );
    expect(
      run("SELECT 'pragma_query_only'; /* trailing statement */ ;").rows,
    ).toEqual([["pragma_query_only"]]);
  });
  it("accepts comments, semicolons in strings/identifiers and escaped quotes", () => {
    expect(
      run(
        "/* header; DROP TABLE x */ -- comment;\nSELECT 'a; b' AS \"semi;column\", 'it''s okay', ';DELETE' --tail\n;",
      ).rows,
    ).toEqual([["a; b", "it's okay", ";DELETE"]]);
  });
  it("rejects multiple native statements after comments", () => {
    expect(() => run("SELECT 1; /*separator*/ SELECT 2;")).toThrow(
      "one SQL statement",
    );
  });
  it("does not mistake quoted semicolons for statement separators", () => {
    expect(
      run(
        "WITH sample(value) AS (SELECT 'semi;colon') SELECT value FROM sample;",
      ).rows,
    ).toEqual([["semi;colon"]]);
  });
  it("accepts readonly recursive CTE and case expression", () => {
    expect(
      run(
        "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<5) SELECT SUM(x),CASE WHEN MAX(x)=5 THEN 'ok' ELSE 'bad' END FROM n",
      ).rows,
    ).toEqual([[15, "ok"]]);
  });
  it("rejects a NUL rather than allowing native truncation", () =>
    expect(() => run("SELECT 1\0;SELECT 2")).toThrow("NUL"));
  it("allows trailing empty statements and comments as a single statement", () =>
    expect(run("SELECT 42;; -- done").rows).toEqual([[42]]));
  it("recovers from syntax failure with a new valid query", () => {
    expect(() => run("SELECT FROM nope")).toThrow();
    expect(run("SELECT 42").rows).toEqual([[42]]);
  });
});
describe("bounded and exact result conversion", () => {
  it("retains 500 rows and detects a 501st without materializing the whole result", () => {
    const result = run(
      "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<700) SELECT x FROM n",
    );
    expect(result.rows).toHaveLength(500);
    expect(result.rows.at(-1)).toEqual([500]);
    expect(result.truncated).toBe(true);
  });
  it("does not call exactly 500 rows truncated", () => {
    const result = run(
      "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<500) SELECT x FROM n",
    );
    expect(result.rows).toHaveLength(500);
    expect(result.truncated).toBe(false);
  });
  it("returns empty result column metadata", () => {
    expect(run("SELECT name FROM customers WHERE id=-1")).toMatchObject({
      columns: ["name"],
      rows: [],
      truncated: false,
    });
  });
  it("preserves unsafe SQLite integers as exact decimal strings", () =>
    expect(
      run(
        "SELECT 9223372036854775807 AS big, -9223372036854775808 AS negative",
      ),
    ).toMatchObject({
      rows: [["9223372036854775807", "-9223372036854775808"]],
      exactIntegersAsText: true,
    }));
  it("rejects nonfinite numeric results", () =>
    expect(() => run("SELECT 9e999")).toThrow("nonfinite"));
  it("bounds UTF-8 input, output columns and cells", () => {
    expect(() => run("SELECT 1 --" + "é".repeat(11000))).toThrow("20 KiB");
    expect(() =>
      run(
        "SELECT " +
          Array.from({ length: 41 }, (_, i) => `${i} AS c${i}`).join(","),
      ),
    ).toThrow("40 columns");
    expect(() => run("SELECT printf('%.*c',20000,'x')")).toThrow("16 KiB");
  });
  it("bounds BLOB output and converts small blobs to hex", () => {
    expect(run("SELECT x'00ff'").rows).toEqual([["0x00ff"]]);
    expect(() => run("SELECT zeroblob(9000)")).toThrow("8 KiB");
  });
  it("bounds aggregate result bytes", () =>
    expect(() =>
      run(
        "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<100) SELECT printf('%.*c',16000,'x') FROM n",
      ),
    ).toThrow("1 MiB"));
  it("records measured elapsed duration, never a fabricated constant", () => {
    let time = 20;
    const result = executeQuery(db, "SELECT 1", () => {
      time += 3;
      return time;
    });
    expect(result.durationMs).toBe(3);
  });
});

it("supports the readonly REPLACE string function while native query_only blocks mutation form", () => {
  expect(run("SELECT replace('Taipei', 'pei', 'nan')").rows).toEqual([
    ["Tainan"],
  ]);
  expect(() =>
    run(
      "WITH one AS (SELECT 1) REPLACE INTO products VALUES(1, 'x', 'x', 0) RETURNING id",
    ),
  ).toThrow(/readonly|read.only/i);
  expect(run("SELECT price_cents FROM products WHERE id=1").rows).toEqual([
    [1800],
  ]);
});

it("native SQLite heap guard rejects an oversized allocation and engine remains usable", () => {
  expect(() => run("SELECT zeroblob(67108864)")).toThrow(/memory/i);
  expect(run("SELECT COUNT(*) FROM orders").rows).toEqual([[72]]);
});
