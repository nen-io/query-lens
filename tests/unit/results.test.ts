import { describe, expect, it } from "vitest";
import { chartData, csvCell, toCsv } from "../../src/domain/results";
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
