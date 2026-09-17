# Scalability and resource envelope

## Implemented limits

A single disposable worker owns one seeded in-memory SQLite database. The dataset has 236 total rows across four tables. Only one query is admitted at a time. SQL is capped at 20 KiB before dispatch and again in the worker. The client starts a two-second deadline for each query, separate from a ten-second initialization deadline. Cancel/deadline terminates and recreates the worker; it does not queue more jobs behind a blocked SQLite step.

At most 500 rows and 40 columns are retained. One additional `step()` detects truncation. Text cells are limited to 16 KiB UTF-8; BLOBs to 8 KiB before hex conversion; serialized result content to 1 MiB. Crossing a cell/byte/column limit fails explicitly rather than silently shortening values. A truncated row set is labelled and only retained rows export. Native `hard_heap_limit` is 32 MiB for SQLite's allocator, not a total browser/JS/WASM memory cap.

No throughput or latency benchmark was conducted. Displayed query duration is measured for that individual execution; it is not a capacity claim or a fabricated constant. Development, device and browser conditions affect it.

## Cost model and bottlenecks

Let S be SQL bytes, R retained rows, C columns and B retained serialized bytes.

- Safety scanning is O(S); native parse/prepare cost depends on SQLite grammar and query complexity, not merely text size.
- SQLite execution complexity depends on the chosen plan: scans, joins, sorting and recursive CTEs can be far more expensive than output size. A 500-row output cap does not limit work done inside an aggregate/sort/recursion, which is why a separate worker deadline is required.
- Result conversion is O(R×C + B). The engine checks one extra row and stops; it never intentionally materializes all rows into a `db.exec()` result.
- Transfer uses structured cloning of a bounded result, followed by O(R×C) React table cells. At maximum 20,000 cells this can still affect low-end devices; virtualization would be a measured next improvement.
- Chart mode limits itself to 2–20 rows and a finite numeric series. CSV generation is O(B), plus escaping and browser download allocation.
- Startup downloads/caches one bundled WASM asset, initializes SQLite and inserts a fixed small seed. Worker replacement repeats module/database initialization; it trades startup cost for reliable interruption and state reset.

No server cache, queue, database pool or persistent store exists. Browser asset caching may reduce transfer after worker replacement, but no guaranteed warm-start latency is claimed. SQL text/result content is never reused as a cached answer.

## Proposed 10× path — not implemented

For a dataset an order of magnitude larger, benchmark production builds with documented query fixtures, browser/hardware and cold/warm worker conditions. Inspect real query plans and add justified indexes. Cache the immutable seeded database bytes inside the app if it meaningfully reduces restart cost; recreate workers with a transferred/copied snapshot and preserve the read-only setup after reopening. Do not rely on exported SQLite state preserving PRAGMA values.

Virtualize table rows and defer CSV generation to a worker if measured main-thread costs warrant it. Add byte-aware result paging rather than increasing the current cap invisibly. A server-side cursor is irrelevant in the current local model; local paging must clearly identify whether it recomputes a query or reads a retained result. Maintain request IDs and epoch fencing across page/worker transitions.

Before admitting larger custom files, add validated DB import, size/format checks, explicit privacy expectations and schema-based trust boundaries. None is implemented today. Never describe the native allocation limit as a comprehensive browser sandbox.

## Proposed 100× / service path — not implemented

A multiuser SQL platform needs a different architecture: authenticated query APIs, per-tenant datasets and authorization, isolated restricted database roles, statement timeouts, admission quotas, resource-bounded workers and auditable job/result identities. Web Worker isolation in an end-user browser is not a replacement for server authorization.

Use a bounded job queue only when asynchronous execution becomes a product need; apply backpressure and expose queued/cancelled/timed-out states rather than hiding overload. Separate query idempotency (re-running a read) from result snapshot consistency (what revision was read). Tag caches by immutable dataset revision and normalized query/parameters; do not serve a prior snapshot as current without disclosure. Apply retention controls and encrypt sensitive results at rest as required by the actual service threat model.

## Consistency now

Every successful query carries captured SQL and request identity. Editor changes do not rewrite those results; the UI marks them previous until an explicit matching run succeeds. Old worker epochs cannot overwrite a new worker. All cancellations/restarts return to the same seed. No durable writes, transaction history, multiuser consistency or server guarantees are implied.
