import { useRef, useState } from "react";
import type { QueryHistoryEntry } from "../worker/client";

export function QueryHistory({
  entries,
  onLoad,
  onClear,
}: {
  entries: readonly QueryHistoryEntry[];
  onLoad: (sql: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <section className="query-history panel">
      <div className="history-heading">
        <button
          ref={toggle}
          aria-expanded={open}
          aria-controls="query-history-list"
          onClick={() => setOpen(!open)}
        >
          Recent queries <span>{entries.length} / 10</span>
        </button>
        <span>Successful SQL · this session only</span>
      </div>
      {open && (
        <div
          id="query-history-list"
          role="region"
          aria-label="Recent successful queries"
        >
          <div className="history-help">
            <p>Loading changes the editor only. Press Run when ready.</p>
            <button
              disabled={!entries.length}
              onClick={() => {
                onClear();
                toggle.current?.focus();
              }}
            >
              Clear query history
            </button>
          </div>
          {entries.length ? (
            <ol>
              {entries.map((entry) => (
                <li key={entry.sql}>
                  <div>
                    <code>{entry.sql}</code>
                    <small>
                      {entry.rowCount}
                      {entry.truncated ? "+" : ""}{" "}
                      {entry.rowCount === 1 ? "row" : "rows"} ·{" "}
                      {entry.durationMs.toFixed(2)} ms
                    </small>
                  </div>
                  <button onClick={() => onLoad(entry.sql)}>
                    Load query into editor
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="history-empty">
              Run a query to start your session history.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
