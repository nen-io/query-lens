import { ArrowDownToLine, BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import type { QueryResult } from "../domain/query-engine";
import { chartData, toCsv } from "../domain/results";
export function Results({
  result,
  stale,
}: {
  result?: QueryResult;
  stale: boolean;
}) {
  const [view, setView] = useState<"table" | "chart">("table");
  const chart = result ? chartData(result) : null;
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" }),
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
          {view === "chart" && chart ? (
            <div
              className="result-chart"
              role="img"
              aria-label={`Bar chart of ${chart.valueColumn} by ${chart.labelColumn}. The table contains all exact values.`}
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
          ) : (
            <div
              className="result-table-scroll"
              role="region"
              aria-label="Result table, horizontally scrollable"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="row-number">
                      #
                    </th>
                    {result.columns.map((column, index) => (
                      <th scope="col" key={index}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
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
              decimal text.
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
