import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import { readSchema, seedDatabase, type SchemaTable } from "./dataset";
import {
  assertQueryPolicy,
  LIMITS,
  literalValidationSql,
  QueryError,
} from "./sql-policy";
export type Cell = string | number | null;
export type QueryResult = {
  columns: string[];
  rows: Cell[][];
  truncated: boolean;
  durationMs: number;
  sql: string;
  exactIntegersAsText: boolean;
};
export function createDatabase(SQL: SqlJsStatic): {
  db: Database;
  schema: SchemaTable[];
  sqliteVersion: string;
} {
  const db = new SQL.Database();
  try {
    seedDatabase(db);
    const schema = readSchema(db);
    const sqliteVersion = String(
      db.exec("SELECT sqlite_version()")[0].values[0][0],
    );
    db.run(
      `PRAGMA trusted_schema=OFF; PRAGMA hard_heap_limit=${LIMITS.sqliteHeapBytes}; PRAGMA query_only=ON;`,
    );
    if (db.exec("PRAGMA query_only")[0]?.values[0]?.[0] !== 1)
      throw new QueryError(
        "Database read-only protection could not be enabled.",
      );
    return { db, schema, sqliteVersion };
  } catch (error) {
    db.close();
    throw error;
  }
}
/** Native SQLite preparation counts complete statements before any user statement is stepped. */
export function executeQuery(
  db: Database,
  sql: unknown,
  now: () => number = () => performance.now(),
): QueryResult {
  assertQueryPolicy(sql);
  const start = now();
  const validationSql = literalValidationSql(sql);
  if (validationSql !== null) {
    try {
      // The iterator frees every previous statement and its SQL allocation even
      // on a preparation error. This copy is prepared only: never bind or step it.
      const validationStatements = db.iterateStatements(validationSql);
      while (!validationStatements.next().done) {
        // Fully drain: next() releases the previously prepared statement.
      }
    } catch {
      throw new QueryError(
        "Extension, filesystem and PRAGMA names may only appear as string values, not quoted identifiers.",
      );
    }
  }
  let firstSql = "";
  let count = 0;
  // Drain the iterator: its documented next() lifecycle frees the previous statement and SQL allocation.
  for (const statement of db.iterateStatements(sql)) {
    count++;
    if (count === 1) firstSql = statement.getSQL();
  }
  if (count !== 1)
    throw new QueryError("Run exactly one SQL statement at a time.");
  const statement = db.prepare(firstSql);
  try {
    const columns = statement.getColumnNames();
    if (columns.length > LIMITS.columns)
      throw new QueryError("Result exceeds 40 columns. Select fewer columns.");
    if (!columns.length) throw new QueryError("Query must return columns.");
    const rows: Cell[][] = [];
    let truncated = false;
    let size = new TextEncoder().encode(JSON.stringify(columns)).length;
    let exactIntegersAsText = false;
    while (statement.step()) {
      if (rows.length >= LIMITS.rows) {
        truncated = true;
        break;
      }
      // sql.js supports useBigInt; its separate type package does not yet describe the option.
      const values = (
        statement.get as (
          params?: null,
          config?: { useBigInt: boolean },
        ) => (SqlValue | bigint)[]
      )(null, { useBigInt: true });
      const row = values.map((value): Cell => {
        if (value === null) return null;
        if (typeof value === "bigint") {
          if (
            value <= BigInt(Number.MAX_SAFE_INTEGER) &&
            value >= BigInt(Number.MIN_SAFE_INTEGER)
          )
            return Number(value);
          exactIntegersAsText = true;
          return value.toString();
        }
        if (typeof value === "number") {
          if (!Number.isFinite(value))
            throw new QueryError(
              "Result contains a nonfinite number. Restrict the numeric expression.",
            );
          return value;
        }
        if (value instanceof Uint8Array) {
          if (value.byteLength > LIMITS.cellBytes / 2)
            throw new QueryError("A result BLOB exceeds the 8 KiB limit.");
          return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
        }
        if (new TextEncoder().encode(value).length > LIMITS.cellBytes)
          throw new QueryError("A result cell exceeds the 16 KiB limit.");
        return value;
      });
      size += new TextEncoder().encode(JSON.stringify(row)).length;
      if (size > LIMITS.resultBytes)
        throw new QueryError(
          "Result exceeds 1 MiB. Select fewer or smaller values.",
        );
      rows.push(row);
    }
    return {
      columns,
      rows,
      truncated,
      durationMs: Math.max(0, now() - start),
      sql,
      exactIntegersAsText,
    };
  } finally {
    statement.free();
  }
}
