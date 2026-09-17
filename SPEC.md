# Query Lens — Browser SQL studio

This document defines the behavior and acceptance criteria. All demonstration data is synthetic. The demo runs without a login or API key.

## Product and visual design

A crisp midnight blue SQL workbench with schema explorer, substantial query editor, result table and a compact numeric result chart when meaningful. Default useful query against a synthetic orders dataset. Real SQLite execution, never hardcoded query responses.

## Model and rules

SQLite WASM engine in dedicated Web Worker, bundled locally (no runtime CDN dependency). Synthetic customers/products/orders/order_items dataset, dates and integer cents. Only read-only SELECT/WITH and schema inspection through curated UI; enforce actual database read-only/query_only plus statement policy, not a simple prefix check alone. Single statement per run. Input <=20KiB, output<=500 rows, document truncation. Worker query timeout2s by termination/recreation, explicit cancel likewise. Importing arbitrary databases/files out of scope.

## Required behavior

1. Schema list with columns and types; choose at least5 working example queries (revenue, top products, city totals, joins, time series). Editor uses labelled textarea or accessible editor, Ctrl/Cmd+Enter run. Example selection populates editor without executing until explicit Run.
2. Run actual SQL off main thread, busy/error/results states, measured duration from real execution. Error leaves previous results visibly labelled stale/previous or clears them; never imply failed query produced old data.
3. Cancel or timeout terminates active worker, invalidates request IDs, reloads seed DB and is ready to run again. Old responses cannot overwrite newer query results.
4. Result table handles NULL, numbers and escaped strings, bounded rows with explicit truncated badge. Single-statement validation rejects writes/DDL/PRAGMA and multi statements robustly including comments/quoted semicolons. If engine API can authorizer/queryOnly enforce defense in depth.
5. CSV export preserves column order, quotes/newlines/non-ASCII and neutralizes spreadsheet formula injection (document safe export policy).
6. Chart only when result has suitable label and numeric columns; actual values and units (cents vs money) explicit. Accessible table always available, negative/zero values handled.
7. Responsive layout stacks editor/schema/results; contained result scrolling, keyboard flow. Show initialization failures and retry.

## Acceptance tests

- Q1: seeded queries return independently calculated totals/counts/joins, including null behavior.
- Q2: reject destructive/attach/pragma/multiple statements; handle comments, quoted semicolons and read-only CTE correctly. Verify attempted writes do not alter data.
- Q3: row limit/truncation reliable, input bound, syntax error recovery.
- Q4: worker long-running query times out/cancels; immediate next query succeeds; stale messages ignored.
- Q5: CSV quotes/newlines/Unicode/null/formula escaping, exact column order.
- Q6 browser: execute examples and custom query, syntax error, cancel expensive query, run again, download CSV; worker+WASM loads correctly under repository subpath.

## Documentation

Dataset schema/provenance, engine/licensing choice with primary docs, worker lifecycle, SQL/read-only policy, row/timeout limits, CSV safety, deployment asset paths and query walkthrough.

## Completion gate

Implement the behavior and acceptance tests above; document any deliberate limitation. `npm run check` and `npm run test:e2e` must pass. Independently review the code and exercise the production build before release. Verify the public demo at its GitHub repository subpath.

## Refinement contract — 17 September 2026

- Retain up to ten distinct successful SQL texts in session memory, newest first, with measured duration/row-count/truncation summaries. Repeated SQL moves to the front. Rejected, cancelled, timed-out and stale worker replies do not create entries. No result-row copies or persistence.
- Loading history or the SQL behind the visible result replaces editor text only; execution requires Run. Clearing history leaves editor, current result and active worker untouched. Reload starts with empty history.
- Eligible charts offer explicit text-label and finite-numeric metric selectors, identifying columns by position even when aliases repeat. Every new successful result resets chart choices/table view. Editing SQL without executing retains the current result and its chosen chart.
- Existing native SQL policy, read-only protection, limits, epoch fencing, safe CSV and repository-subpath WASM behavior remain mandatory regression checks.
