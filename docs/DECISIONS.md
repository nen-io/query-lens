# Architectural decision records

## ADR 1 — Real SQLite WASM in a disposable worker

**Context.** A SQL portfolio demo should execute arbitrary supported SQL accurately without freezing its interface or requiring a remote database.

**Alternatives.** Hardcoded preset responses, an ad hoc SQL evaluator, main-thread sql.js, a backend service or a dedicated browser worker.

**Decision.** Use pinned sql.js 1.14.2 and its npm WASM binary in a Vite module worker. Native SQL handles queries; React only sends commands and presents results. Bundle assets locally with relative paths.

**Consequences.** Genuine SQL behavior and a reproducible no-key demo. WASM startup costs and browser support requirements exist. Workers are an interruption boundary, not a blanket sandbox/security claim.

**Revisit when.** Real multiuser/private datasets or durable queries are required. Design authenticated service authorization rather than stretching this public local demo.

## ADR 2 — Native read-only protection plus conservative policy and parsing

**Context.** A simple SELECT prefix check can be bypassed with comments, CTEs or multiple statements; `query_only` alone permits some non-write administrative behaviors.

**Alternatives.** Regex alone; private WASM authorizer/statement pointers; full custom SQL parser; public native query_only plus native statement parsing and a small lexical envelope.

**Decision.** Set and verify SQLite `query_only`, turn off trusted schema and set native heap limit. Accept SELECT/WITH only, reject administrative/filesystem/extension functions, use native `iterateStatements` before stepping, and require exactly one prepared statement. Do not depend on unavailable public authorizer/stmt-readonly wrappers or minified private fields.

For SQLite's single-quoted identifier compatibility, prepare a validation-only copy replacing sensitive quoted names with expression-only parameters. Never step that copy; retain the original SQL for execution and results. Native parsing distinguishes table identifiers from ordinary literal values across nested/qualified joins and CTEs. This avoids fragile FROM/JOIN token-context heuristics. Sensitive names used as quoted aliases can be rejected conservatively.

**Consequences.** Actual engine protection is independently testable, and SQLite owns grammar. Some otherwise valid SQLite text is conservatively rejected. The readonly replace() function is allowed, while CTE REPLACE writes are prevented by native query_only/no-result guards. This boundary is documented rather than marketed as a complete SQL firewall.

**Revisit when.** A supported binding exposes a stable authorizer/readonly API or schema extensibility becomes necessary. Preserve defense in depth and test bypass cases against the actual engine.

## ADR 3 — Terminate on cancel/deadline, then reseed

**Context.** Synchronous SQLite execution blocks its worker event loop. A cancel message alone cannot interrupt a long-running native step.

**Alternatives.** Ignore expensive queries, post an ineffective cancel event, depend on internal interrupt pointers, or terminate/recreate the worker.

**Decision.** A main-thread two-second timer calls terminate, invalidates epoch/request identity and starts a fresh seeded worker. Initialization has its own deadline and Retry state. New runs wait for the current worker's ready message.

**Consequences.** Real cancellation and predictable immutable seed recovery. Startup work repeats; timer throttling means the deadline is not hard real-time. User results are not durable jobs, and no progress estimate is invented.

**Revisit when.** Long valid analytic queries are a goal. Add explicitly scoped longer budgets, public interrupt support or authenticated job infrastructure with admission control, while retaining stale-response fencing.

## ADR 4 — Exact, bounded result values before convenience

**Context.** Query output can be huge or numerically misleading. JavaScript numbers cannot exactly hold every SQLite 64-bit integer, and a row cap does not bound a single enormous value.

**Alternatives.** Convert everything to ordinary numbers/strings, silently truncate cells, or explicitly bound and preserve types/precision.

**Decision.** Retrieve integers as BigInt, convert safe values to numbers and larger values to exact decimal text. Reject nonfinite numbers and oversized cells/BLOBs/results. Retain 500 rows with one extra-step truncation check and a 40-column cap. Chart only small suitable untruncated results, keeping cents unconverted and no inferred currency.

**Consequences.** Users can trust displayed exact values within documented bounds. Some valid queries fail on resource limits; charts are intentionally unavailable for unsuitable outputs. Native heap limit and JS/result limits cover different allocations.

**Revisit when.** Result paging/typed downloads or larger analytical data are required. Measure actual costs and add explicit paging/streaming semantics instead of lifting caps invisibly.

## ADR 5 — CSV is a safe spreadsheet view, not a typed archive

**Context.** Exported SQL text can become a spreadsheet formula even when HTML rendering is safe. CSV also has no portable distinction between NULL and empty string.

**Alternatives.** Raw CSV, quoted CSV only, spreadsheet-safe text prefixes, or a richer typed format.

**Decision.** Quote all fields, double embedded quotes, preserve column order/Unicode/newlines and prefix risky text/header cells with an apostrophe before quoting. Preserve numeric negative cells. Document NULL/empty-string collapse and client-dependent residual risk.

**Consequences.** Formula-oriented text is deliberately transformed, making export useful for common spreadsheet inspection. It is not guaranteed safe after re-editing or rewriting by another tool, and is not a lossless typed backup.

**Revisit when.** Users need exact typed interchange. Add a separately named JSON/Arrow/Parquet format with its own validation and compatibility contract.

## ADR 6 — Bounded session history with explicit reload

**Context.** Switching examples made earlier successful SQL hard to recover, and a previous-result badge did not expose the SQL that produced the visible rows.

**Decision.** Keep ten distinct successful SQL texts with lightweight summaries in client memory, after request/epoch validation. Show a source-SQL disclosure on each result. Loading either source changes only the editor; it never runs. Clear affects only history. No storage, automatic rerun or copied result cache is introduced.

**Alternatives.** Persisting SQL without explicit consent creates a new privacy/storage boundary. Keeping ten full results could retain10MiB of serialized rows. Auto-running a selected entry conflates navigation with execution. Recording rejected/cancelled input complicates the meaning of a successful-query history.

**Consequences.** Recoverable exploration with bounded memory and unambiguous output provenance. Reload clears history; unsent drafts are not guaranteed recovery. Request fencing remains authoritative, so stale workers cannot resurrect cleared entries. A currently running valid query can add its eventual success after Clear.

## ADR 7 — Position-based chart choices scoped to result identity

**Context.** Inferring a metric by cents preference hid other useful numeric columns such as units. Duplicate SQL aliases make name-based selection ambiguous.

**Decision.** Expose eligible label/metric columns by index, keep the existing default heuristic and validate every pair. Reset chart controls via an accepted-result version; preserve choices when only editor text changes.

**Consequences.** Deliberate charts retain signed/zero values and finite geometry. NULL/mixed columns remain ineligible. A new result starts with the complete table, avoiding stale index choices after schema changes. CSV and table keep their original positional order.

## September 23 refinement

Sorting is a derived view over the accepted bounded result, indexed by column position. It shares order across table, chart and CSV so export is predictable. NULL is always last, numeric cells compare numerically and strings use deterministic case-sensitive UTF-16 order. Exact integer text is intentionally not coerced, and this does not claim SQLite collation parity. Stable ties preserve the original captured order; Original order restores it without executing SQL. Existing result-version remounts reset sorting only after a new accepted success.

## Focus follows intent, not every render

The accessibility pass uses native links, buttons, inputs, details and semantic tables. Refs move focus only after an explicit navigation/recovery action or a guarded error completion. Status changes remain announcements rather than unconditional focus movement. Supporting text has a 12px floor and flow labels use normal layout where text can grow. These choices preserve predictable keyboard order without adding a UI library, global shortcut registry or focus trap. [ACCESSIBILITY.md](ACCESSIBILITY.md) records behavior, evidence and limits.
