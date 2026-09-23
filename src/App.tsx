import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Database,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
} from "lucide-react";
import { examples, type TableName } from "./domain/dataset";
import { Schema } from "./components/Schema";
import { Results } from "./components/Results";
import { QueryHistory } from "./components/QueryHistory";
import {
  QueryClient,
  type ClientState,
  type WorkerPort,
} from "./worker/client";
import { LIMITS } from "./domain/sql-policy";
const initial: ClientState = {
  status: "initializing",
  schema: [],
  sqliteVersion: "",
  error: "",
  notice: "",
  previous: false,
  resultVersion: 0,
  history: [],
};
export default function App() {
  const lineNumbers = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [sql, setSql] = useState<string>(examples[0].sql);
  const [selectedExample, setSelectedExample] = useState("revenue");
  const [state, setState] = useState<ClientState>(initial);
  const [client] = useState(
    () =>
      new QueryClient(
        () =>
          new Worker(new URL("./worker/sql.worker.ts", import.meta.url), {
            type: "module",
          }) as unknown as WorkerPort,
        setState,
      ),
  );
  useEffect(() => {
    client.start();
    return () => client.dispose();
  }, [client]);
  const ready = state.status === "ready";
  const running = state.status === "running";
  const bytes = new TextEncoder().encode(sql).length;
  const stale = !!state.result && (state.previous || state.result.sql !== sql);
  function example(id: string) {
    const next = examples.find((item) => item.id === id);
    if (next) {
      setSelectedExample(id);
      setSql(next.sql);
    }
  }
  function explore(name: TableName) {
    setSelectedExample("custom");
    setSql(`SELECT *\nFROM ${name}\nLIMIT 20;`);
  }
  function loadSql(text: string) {
    setSelectedExample("custom");
    setSql(text);
    editor.current?.focus();
  }
  const totalRows = state.schema.reduce(
    (total, table) => total + table.count,
    0,
  );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="./" className="brand" aria-label="Query Lens home">
          <span className="brand-mark">
            <Code2 size={22} />
          </span>
          query<span className="brand-lens">lens</span>
          <span className="brand-suffix">/ SQL studio</span>
        </a>
        <div className="engine-state">
          <i className={ready ? "ready" : running ? "running" : ""} />
          <span data-testid="engine-status">
            {ready
              ? "SQLite ready"
              : running
                ? "Executing query"
                : state.status === "init-error"
                  ? "Engine unavailable"
                  : "Loading SQLite…"}
          </span>
        </div>
        <span className="local-pill">
          <ShieldCheck size={12} /> LOCAL & READ-ONLY
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              DATA EXPLORATION <ChevronRight size={11} /> BROWSER EDITION
            </div>
            <h1>Find the story in your SQL.</h1>
            <p>A real database. A clear question. A little room to explore.</p>
          </div>
          <div className="dataset-badge">
            <span>
              <Database size={15} /> EVERYDAY GOODS
            </span>
            <small>SYNTHETIC DATASET · USD CENTS</small>
          </div>
        </div>
        <div className="workspace">
          <Schema schema={state.schema} onExplore={explore} />
          <div className="main-column">
            <section className="editor-panel panel" aria-label="SQL editor">
              <div className="editor-heading">
                <div>
                  <span className="section-label">QUERY WORKSPACE</span>
                  <h2>Ask something useful.</h2>
                </div>
                <span className="language-tag">SQLITE</span>
              </div>
              <div className="example-bar">
                <label>
                  Start with a question
                  <select
                    aria-label="Example query"
                    value={selectedExample}
                    onChange={(event) => example(event.target.value)}
                  >
                    <option value="custom" disabled>
                      Custom query
                    </option>
                    {examples.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  <ArrowRight size={12} /> Loads SQL. Run when ready.
                </span>
              </div>
              <div className="code-editor">
                <div
                  ref={lineNumbers}
                  className="line-numbers"
                  aria-hidden="true"
                >
                  {sql
                    .split("\n")
                    .map((_, i) => i + 1)
                    .join("\n")}
                </div>
                <label className="sql-label" htmlFor="sql-query">
                  SQL query
                </label>
                <textarea
                  id="sql-query"
                  ref={editor}
                  aria-label="SQL query"
                  spellCheck={false}
                  onScroll={(event) => {
                    if (lineNumbers.current)
                      lineNumbers.current.scrollTop =
                        event.currentTarget.scrollTop;
                  }}
                  value={sql}
                  onChange={(event) => {
                    setSql(event.target.value);
                    setSelectedExample("custom");
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      if (ready) client.run(sql);
                    }
                  }}
                />
              </div>
              <div className="query-toolbar">
                <div>
                  <span className={bytes > LIMITS.sqlBytes ? "too-large" : ""}>
                    {bytes.toLocaleString()} / 20,480 bytes
                  </span>
                  <span className="keyboard-hint">⌘ / Ctrl + Enter to run</span>
                </div>
                <div className="query-actions">
                  <button
                    className="reset-query"
                    disabled={running}
                    aria-label="Reset example query"
                    onClick={() => example("revenue")}
                  >
                    <RotateCcw size={14} />
                  </button>
                  {running ? (
                    <button
                      className="run-button cancel"
                      onClick={() => client.cancel()}
                    >
                      <Square size={13} /> Cancel query
                    </button>
                  ) : (
                    <button
                      className="run-button"
                      disabled={!ready}
                      onClick={() => client.run(sql)}
                    >
                      <Play size={13} fill="currentColor" /> Run query
                    </button>
                  )}
                </div>
              </div>
              <div className="safety-strip">
                <ShieldCheck size={12} />
                <span>SELECT / WITH only</span>
                <span>500 row cap</span>
                <span>2 second deadline</span>
              </div>
            </section>
            <QueryHistory
              entries={state.history}
              onLoad={loadSql}
              onClear={() => client.clearHistory()}
            />
            {state.error && (
              <div className="error-banner" role="alert">
                <div>
                  <strong>
                    {state.status === "init-error"
                      ? "SQLite could not start"
                      : "Query did not complete"}
                  </strong>
                  <p>{state.error}</p>
                  {state.result && (
                    <small>
                      The result below belongs to your previous successful
                      query.
                    </small>
                  )}
                </div>
                {state.status === "init-error" && (
                  <button onClick={() => client.retry()}>Retry engine</button>
                )}
              </div>
            )}
            {state.notice && (
              <div className="notice" role="status">
                <Check size={12} />
                {state.notice}
              </div>
            )}
            <Results
              key={state.resultVersion}
              result={state.result}
              stale={stale}
              onLoadSql={loadSql}
            />
            <div className="workspace-footer">
              <span>
                <i />{" "}
                {state.sqliteVersion
                  ? `SQLite ${state.sqliteVersion} · WebAssembly worker`
                  : "Engine initializes in a dedicated worker"}
              </span>
              <span>
                {state.schema.length
                  ? `${state.schema.length} tables · ${totalRows} seeded rows`
                  : "No API keys. No network query service."}
              </span>
            </div>
          </div>
        </div>
        <footer>
          <span>QUERY LENS / Curiosity, with a query plan.</span>
          <span>Everything runs here. Nothing is uploaded.</span>
          <nav className="project-links" aria-label="Project resources">
            <a
              href="https://github.com/nen-io/query-lens"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
            <a
              href="https://github.com/nen-io/query-lens/blob/main/docs/REVIEWER_GUIDE.md"
              target="_blank"
              rel="noreferrer"
            >
              Engineering walkthrough
            </a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
