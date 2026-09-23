import { describe, expect, it } from "vitest";
import {
  chartData,
  csvCell,
  sortedRows,
  toCsv,
} from "../../src/domain/results";
import type { QueryResult } from "../../src/domain/query-engine";
const result: QueryResult = {
  columns: ["city", "revenue_cents"],
  rows: [
    ["Taipei", 100],
    ["Tainan", -50],
    ["Taichung", 0],
  ],
  durationMs: 1,
  sql: "SELECT...",
  truncated: false,
  exactIntegersAsText: false,
};
describe("safe CSV", () => {
  it("preserves header order, quotes, newlines, Unicode, null and numeric signs", () => {
    expect(
      toCsv({
        columns: ["second", "first"],
        rows: [
          ['a,"b"', "臺北\nline"],
          [null, -12],
        ],
      }),
    ).toBe('"second","first"\r\n"a,""b""","臺北\nline"\r\n"","-12"\r\n');
  });
  it.each([
    "=1+1",
    "+cmd",
    "-cmd",
    "@SUM(1,2)",
    "  =1",
    "\t+cmd",
    "\r@cmd",
    "\n-1",
    "\u0000=1",
    "\u000b=1",
  ])("neutralizes risky text %j", (value) =>
    expect(csvCell(value)).toBe(`"'${value}"`),
  );
  it("also protects malicious column headers", () =>
    expect(toCsv({ columns: ["=cmd"], rows: [[1]] })).toBe(
      '"\'=cmd"\r\n"1"\r\n',
    ));
  it("does not prepend apostrophe to real negative numbers", () =>
    expect(csvCell(-2)).toBe('"-2"'));
});
describe("chart eligibility", () => {
  it("uses real numeric values including negative/zero and explicit cents unit", () =>
    expect(chartData(result)).toMatchObject({
      labelColumn: "city",
      valueColumn: "revenue_cents",
      unit: "cents (raw values; no currency inferred)",
      points: [
        { label: "Taipei", value: 100 },
        { label: "Tainan", value: -50 },
        { label: "Taichung", value: 0 },
      ],
    }));
  it("requires a text label and finite numeric column", () => {
    expect(
      chartData({ ...result, columns: ["a"], rows: [[1], [2]] }),
    ).toBeNull();
    expect(
      chartData({
        ...result,
        rows: [
          ["a", NaN],
          ["b", 1],
        ],
      }),
    ).toBeNull();
  });
  it("rejects truncated, too many and single-row charts", () => {
    expect(chartData({ ...result, truncated: true })).toBeNull();
    expect(chartData({ ...result, rows: [["a", 1]] })).toBeNull();
    expect(
      chartData({
        ...result,
        rows: Array.from({ length: 21 }, () => ["a", 1]),
      }),
    ).toBeNull();
  });
});

it("charts the chosen numeric column by position, including duplicate aliases", () => {
  const chosen = chartData(
    {
      ...result,
      columns: ["city", "value", "value"],
      rows: [
        ["Taipei", 100, -4],
        ["Tainan", 200, 0],
      ],
    },
    { labelIndex: 0, valueIndex: 2 },
  );
  expect(chosen?.points).toEqual([
    { label: "Taipei", value: -4 },
    { label: "Tainan", value: 0 },
  ]);
});

it("rejects invalid chart choices instead of coercing text, NULL or a missing column", () => {
  expect(chartData(result, { labelIndex: 0, valueIndex: 0 })).toBeNull();
  expect(chartData(result, { labelIndex: 1, valueIndex: 1 })).toBeNull();
  expect(chartData(result, { labelIndex: 0, valueIndex: 20 })).toBeNull();
  expect(
    chartData(
      {
        ...result,
        rows: [
          ["a", null],
          ["b", 2],
        ],
      },
      { labelIndex: 0, valueIndex: 1 },
    ),
  ).toBeNull();
});

describe("retained row sorting", () => {
  it("sorts numbers numerically, leaves NULL last in both directions and preserves equal rows", () => {
    const input = {
      columns: ["label", "value"],
      rows: [
        ["ten", 10],
        ["two", 2],
        ["null", null],
        ["same", 2],
      ],
    } satisfies Pick<QueryResult, "columns" | "rows">;
    const snapshot = structuredClone(input);
    expect(
      sortedRows(input, { column: 1, direction: "ascending" }).map((r) => r[0]),
    ).toEqual(["two", "same", "ten", "null"]);
    expect(
      sortedRows(input, { column: 1, direction: "descending" }).map(
        (r) => r[0],
      ),
    ).toEqual(["ten", "two", "same", "null"]);
    expect(input).toEqual(snapshot);
    expect(sortedRows(input)).toBe(input.rows);
  });
  it("does not coerce text, handles empty strings and indexes duplicate aliases", () => {
    const input = {
      columns: ["value", "value"],
      rows: [
        ["z", "2"],
        ["a", 10],
        ["b", "10"],
        ["c", ""],
        ["d", null],
      ],
    } satisfies Pick<QueryResult, "columns" | "rows">;
    expect(
      sortedRows(input, { column: 1, direction: "ascending" }).map((r) => r[1]),
    ).toEqual([10, "", "10", "2", null]);
    expect(
      sortedRows(input, { column: 0, direction: "ascending" }).map((r) => r[0]),
    ).toEqual(["a", "b", "c", "d", "z"]);
  });
  it("keeps exact integer text intact and ignores invalid column choices", () => {
    const input = {
      columns: ["integer"],
      rows: [["9223372036854775807"], ["9007199254740992"]],
    };
    expect(sortedRows(input, { column: 0, direction: "ascending" })).toEqual([
      ["9007199254740992"],
      ["9223372036854775807"],
    ]);
    for (const column of [-1, 1, 0.5, NaN])
      expect(sortedRows(input, { column, direction: "ascending" })).toBe(
        input.rows,
      );
  });
});
