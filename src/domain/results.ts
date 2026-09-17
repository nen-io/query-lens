import type { Cell, QueryResult } from "./query-engine";
/** Prefix risky text/headers with apostrophe before CSV quoting; numeric cells remain numeric. */
export function csvCell(value: Cell): string {
  if (value === null) return '""';
  let text = String(value);
  if (
    typeof value === "string" &&
    (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text))
  )
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(result: Pick<QueryResult, "columns" | "rows">): string {
  return (
    [
      result.columns.map(csvCell).join(","),
      ...result.rows.map((row) => row.map(csvCell).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
export type Chart = {
  labelColumn: string;
  valueColumn: string;
  unit: string;
  points: { label: string; value: number }[];
};
export function chartData(result: QueryResult): Chart | null {
  if (result.truncated || result.rows.length < 2 || result.rows.length > 20)
    return null;
  const labelIndex = result.columns.findIndex((_, i) =>
    result.rows.every((row) => typeof row[i] === "string"),
  );
  const numericIndices = result.columns
    .map((_, i) => i)
    .filter((i) =>
      result.rows.every(
        (row) => typeof row[i] === "number" && Number.isFinite(row[i]),
      ),
    );
  const valueIndex =
    numericIndices.find((i) => result.columns[i].endsWith("_cents")) ??
    numericIndices[0];
  if (labelIndex < 0 || valueIndex === undefined) return null;
  const valueColumn = result.columns[valueIndex];
  return {
    labelColumn: result.columns[labelIndex],
    valueColumn,
    unit: valueColumn.endsWith("_cents")
      ? "cents (raw values; no currency inferred)"
      : valueColumn.replaceAll("_", " "),
    points: result.rows.map((row) => ({
      label: String(row[labelIndex]),
      value: row[valueIndex] as number,
    })),
  };
}
