import { ArrowDownToLine, BarChart3, Table2 } from "lucide-react";
import { useRef, useState } from "react";
import type { QueryResult } from "../domain/query-engine";
import {
  sortedRows,
  type ResultSort,
  chartColumns,
  chartData,
  toCsv,
  type ChartSelection,
} from "../domain/results";
export function Results({
  result,
  stale,
  onLoadSql,
}: {
  result?: QueryResult;
  stale: boolean;
  onLoadSql: (sql: string) => void;
}) {
  const columnButtons = useRef(new Map<number, HTMLButtonElement>());
  const tableButton = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"table" | "chart">("table");
  const [selection, setSelection] = useState<ChartSelection | undefined>();
  const [sort, setSort] = useState<ResultSort | undefined>();
  const rows = result ? sortedRows(result, sort) : [];
  const displayed = result ? { ...result, rows } : undefined;
  const chart = displayed ? chartData(displayed, selection) : null;
  function sortColumn(column: number) {
    setSort((current) =>
      current?.column !== column
        ? { column, direction: "ascending" }
        : current.direction === "ascending"
          ? { column, direction: "descending" }
          : undefined,
    );
  }
  const columns = result ? chartColumns(result) : { labels: [], values: [] };
  const labelIndex = selection?.labelIndex ?? columns.labels[0];
  const valueIndex =
    selection?.valueIndex ??
    columns.values.find((i) => result?.columns[i].endsWith("_cents")) ??
    columns.values[0];
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([toCsv({ ...result, rows })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "query-lens-results.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="results-panel panel" aria-label="Query results">
      <div className="results-heading">
        <div>
          <span className="section-label">RESULT SET</span>
          <h2>
            {result ? "Your data, in focus." : "A good question starts here."}
          </h2>
        </div>
        <button disabled={!result} onClick={download}>
          <ArrowDownToLine size={13} /> Export CSV
        </button>
      </div>
      {result ? (
        <>
          <div
            className={`result-summary ${stale ? "stale" : ""}`}
            role="status"
          >
            <span className="result-state">
              <i />
              {stale
                ? "Previous result · run the current query to update"
                : "Query completed"}
            </span>
            <div>
              <span data-testid="result-row-count">
                {result.rows.length} {result.rows.length === 1 ? "row" : "rows"}
              </span>
              <span>
                {result.columns.length}{" "}
                {result.columns.length === 1 ? "column" : "columns"}
              </span>
              <span data-testid="query-duration">
                {result.durationMs.toFixed(2)} ms
              </span>
              {result.truncated && <strong>Truncated at 500 rows</strong>}
            </div>
          </div>
          <div className="result-controls">
            <div className="result-views">
              <button
                ref={tableButton}
                aria-pressed={view === "table" || !chart}
                onClick={() => setView("table")}
              >
                <Table2 size={13} /> Table
              </button>
              <button
                disabled={!chart}
                aria-pressed={view === "chart" && !!chart}
                onClick={() => setView("chart")}
                title={
                  chart
                    ? "Chart returned rows"
                    : "Chart needs 2–20 rows, a text label and a finite numeric column"
                }
              >
                <BarChart3 size={13} /> Chart
              </button>
            </div>
            <span>
              {chart
                ? `Chart available · ${chart.unit}`
                : "Table is the complete result view"}
            </span>
          </div>
          <div className="sort-summary" aria-live="polite">
            <span>
              {sort
                ? `Sorted by ${result.columns[sort.column]} · column ${sort.column + 1} · ${sort.direction}`
                : "Original result order · select a column heading to sort"}
            </span>
            {sort && (
              <button
                onClick={() => {
                  const target =
                    columnButtons.current.get(sort.column) ??
                    tableButton.current;
                  setSort(undefined);
                  target?.focus();
                }}
              >
                Original order
              </button>
            )}
            <small>
              Sorts retained rows only. Charts and CSV follow this order; NULL
              stays last. Text sorts lexically.
            </small>
          </div>
          <details className="result-source">
            <summary>SQL behind this result</summary>
            <pre>{result.sql}</pre>
            <button onClick={() => onLoadSql(result.sql)}>
              Load result SQL
            </button>
            <span>Loads the editor without running a query.</span>
          </details>
          {view === "chart" && chart ? (
            <>
              <div className="chart-selectors">
                <label>
                  Chart labels
                  <select
                    value={labelIndex}
                    onChange={(event) =>
                      setSelection({
                        labelIndex: Number(event.target.value),
                        valueIndex,
                      })
                    }
                  >
                    {columns.labels.map((i) => (
                      <option key={i} value={i}>
                        {result.columns[i]} · column {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Chart metric
                  <select
                    value={valueIndex}
                    onChange={(event) =>
                      setSelection({
                        labelIndex,
                        valueIndex: Number(event.target.value),
                      })
                    }
                  >
                    {columns.values.map((i) => (
                      <option key={i} value={i}>
                        {result.columns[i]} · column {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div
                className="result-chart"
                role="img"
                aria-label={`Bar chart of ${chart.valueColumn} by ${chart.labelColumn}. Open Exact chart values below for a text table, or choose Table for the complete result.`}
              >
                <div className="chart-caption">
                  <strong>{chart.valueColumn.replaceAll("_", " ")}</strong>
                  <span>{chart.unit}</span>
                </div>
                {(() => {
                  const maximum = Math.max(
                    1,
                    ...chart.points.map((point) => Math.abs(point.value)),
                  );
                  return chart.points.map((point, index) => (
                    <div className="chart-row" key={index}>
                      <span>{point.label}</span>
                      <div className="chart-bar-track">
                        <i
                          className={`chart-bar ${point.value < 0 ? "negative" : ""}`}
                          style={{
                            width: `${(Math.abs(point.value) / maximum) * 100}%`,
                          }}
                        />
                      </div>
                      <strong>{point.value.toLocaleString()}</strong>
                    </div>
                  ));
                })()}
                <p>
                  Bars show magnitude. Negative values are marked with a minus
                  sign and amber fill; zero stays zero.
                </p>
              </div>
              <details className="chart-values">
                <summary>Exact chart values</summary>
                <div
                  className="chart-values-scroll"
                  role="region"
                  aria-label="Chart values, scrollable"
                  tabIndex={0}
                >
                  <table>
                    <caption>
                      Chart values: {chart.valueColumn} by {chart.labelColumn} (
                      {chart.unit})
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{chart.labelColumn}</th>
                        <th scope="col">{chart.valueColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chart.points.map((point, index) => (
                        <tr key={index}>
                          <td>{point.label}</td>
                          <td>{String(point.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <div
              className="result-table-scroll"
              role="region"
              aria-label="Result table, horizontally scrollable"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Query result: {result.rows.length} rows and{" "}
                  {result.columns.length} columns. Select a column heading to
                  sort retained rows.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-number">
                      #
                    </th>
                    {result.columns.map((column, index) => (
                      <th
                        scope="col"
                        key={index}
                        aria-sort={
                          sort?.column === index ? sort.direction : undefined
                        }
                      >
                        <button
                          className="column-sort"
                          ref={(element) => {
                            if (element)
                              columnButtons.current.set(index, element);
                            else columnButtons.current.delete(index);
                          }}
                          aria-label={`Sort ${column}, column ${index + 1}`}
                          onClick={() => sortColumn(index)}
                        >
                          {column}{" "}
                          <span aria-hidden="true">
                            {sort?.column === index
                              ? sort.direction === "ascending"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td className="row-number">
                        {String(index + 1).padStart(2, "0")}
                      </td>
                      {row.map((value, column) => (
                        <td
                          key={column}
                          className={typeof value === "number" ? "numeric" : ""}
                        >
                          {value === null ? (
                            <span className="null-cell">NULL</span>
                          ) : value === "" ? (
                            <span className="empty-string">empty string</span>
                          ) : (
                            String(value)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length === 0 && (
                <p className="empty-rows">Query succeeded. No rows matched.</p>
              )}
            </div>
          )}
          <div className="result-footnote">
            <span>
              {result.truncated
                ? "Only the first 500 rows are retained and exported."
                : "All returned rows are retained."}
            </span>
            <span>CSV uses formula-safe text escaping.</span>
          </div>
          {result.exactIntegersAsText && (
            <p className="integer-note">
              Integers outside JavaScript's safe range are shown as exact
              decimal text. Sorting treats these as text, not numeric values.
            </p>
          )}
        </>
      ) : (
        <div className="results-empty">
          <span>
            <Table2 size={26} />
          </span>
          <h3>Ready when you are.</h3>
          <p>
            Choose an example or write a SELECT query.
            <br />
            Results appear only after you press Run.
          </p>
        </div>
      )}
    </section>
  );
}
