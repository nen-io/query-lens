# Security model

## Assets and trust boundaries

The browser holds a fixed synthetic dataset, editor text, a bounded last result and explicit CSV downloads. There are no credentials, accounts, real customer records, remote query service, database upload or analytics. Untrusted input is user-authored SQL and its generated result strings. A malicious query may attempt mutation, administrative statements, excessive CPU/memory use, HTML injection or spreadsheet formula execution after export.

The dedicated worker is an interruption/responsiveness boundary, not a complete hostile-code sandbox. Same-origin application code, the installed browser/extensions, the static hosting account and npm/build supply chain remain trusted. This demo does not defend a compromised device or a replaced bundle.

| Threat                                 | Implemented mitigation                                                                                                                                  | Evidence                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Data mutation                          | Native SQLite `PRAGMA query_only=ON`, checked after startup; conservative SELECT/WITH command policy                                                    | Actual engine tests bypass text policy and prove DELETE/UPDATE fail; subsequent row count remains 72          |
| Administrative SQL / attach / pragma   | Token-aware command/function restrictions, including quoted PRAGMA function names; no arbitrary DB import                                               | Real-engine destructive, attach, pragma and extension tests                                                   |
| Multiple statements / parser confusion | SQLite's native iterator parses every statement before any execution; exactly one required; scanner respects quotes/comments and rejects NUL truncation | CTE, comments, quoted/doubled strings, quoted semicolon and multi-statement tests                             |
| CPU exhaustion                         | Main-thread two-second watchdog terminates the blocked worker; cancel does likewise                                                                     | Browser runs a genuinely expensive recursive query, observes timeout/cancel and executes a fresh seeded query |
| Memory/output exhaustion               | 20 KiB SQL; SQLite 32 MiB native allocation limit; 500 rows; 40 columns; 16 KiB text cells; 8 KiB BLOBs; 1 MiB serialized result budget                 | Real-engine input/column/cell/BLOB/result bounds and native heap rejection tests                              |
| Stale worker response                  | Monotonic request IDs plus worker epochs; running-state check; timer cleanup                                                                            | Fake-port race tests and real timeout/cancel recovery journeys                                                |
| HTML injection                         | React text-only rendering for cells/errors/SQL; no unsafe HTML                                                                                          | Browser returns an img/onerror-like string and confirms no element is created                                 |
| Numeric corruption                     | Native BigInt retrieval; unsafe integers preserved as text; nonfinite results rejected                                                                  | Actual SQLite maximum/minimum integer and `9e999` tests                                                       |
| Spreadsheet formula injection          | Quote every field, escape quotes and prepend apostrophe to risky text/header prefixes including leading whitespace/control characters                   | CSV quote/newline/Unicode/null/formula tests and browser download verification                                |

## Defense boundaries

The pinned sql.js public API has no authorizer/stmt-readonly wrapper; this implementation does not claim one. `query_only` is an actual engine setting, not a UI label. It prevents database writes, but alone is insufficient for all administrative commands, so the policy independently rejects PRAGMA/ATTACH/DDL and extension/filesystem/PRAGMA functions. Trusted schema queries occur only during initialization over known table names. No user-defined SQL functions, callbacks, extension loader or filesystem bridge are registered.

The statement scanner provides a conservative envelope, not a complete SQL grammar. SQLite remains the parser. User statements are never passed to `db.exec`, which can execute several statements. Prepared statements are released in `finally`; the validation iterator is fully drained to release its native allocations.

Single quotes are not assumed to guarantee literal values: SQLite accepts them as table identifiers in compatibility syntax. Sensitive single-quoted names are replaced with expression-only parameters in a validation copy that SQLite prepares but never steps. Identifier positions then fail native parsing, including nested/qualified tables, comma joins, CTEs and `IN table` syntax. Normal values in SELECT, function arguments, CASE and VALUES expressions remain unchanged in the actual query. Sensitive quoted aliases are conservatively outside the supported subset. Actual-engine tests first prove the adversarial forms execute when the application policy is bypassed, then verify policy rejection and unchanged seed data. PRAGMA table functions are read-only; this guard enforces the promised schema-inspection policy rather than claiming their previous availability demonstrated a data mutation.

The 32 MiB hard heap limit bounds SQLite allocator use within one worker/module. It does not bound JavaScript heap, WASM module baseline, rendering, browser process memory or all transient message copies. The source database is fixed and small. Native allocation failure is tested for recovery; an actual worker crash switches to visible initialization failure/retry. Timers can be delayed by a throttled main thread; two seconds is the intended deadline, not real-time scheduling certification.

## CSV policy and residual risks

String/header cells whose leading whitespace/control prefix is followed by `=`, `+`, `-` or `@` receive a leading apostrophe. Leading tab/CR/LF text is also prefixed. Numeric negative cells remain numeric. Every field is quoted; quotes are doubled; Unicode/newlines preserve their text; CRLF separates records. SQL NULL and empty string both export as empty CSV fields, since CSV has no portable typed NULL representation.

The apostrophe is an intentional data transformation for spreadsheet safety. CSV clients differ; an exported cell is not guaranteed safe after users re-edit/remove prefixes or another tool rewrites it. This is not a universal spreadsheet sandbox. Full-fidelity typed archival export is outside scope.

## Browser policy and privacy

Production document meta CSP is:

`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`

`wasm-unsafe-eval` permits WASM compilation, not arbitrary JavaScript eval. Same-origin connect permits fetching the bundled binary. No third-party origin is allowlisted. Inline styles are needed by chart widths. Development omits CSP for Vite HMR. A meta policy governs the document; worker response-header policy and `frame-ancestors` require hosting headers and are not claimed here. The application worker itself has no network behavior beyond local WASM loading. Static-host HTTPS/account security is an external responsibility.

No localStorage, IndexedDB, cookies or service worker persistence exists. SQL/results stay in memory; reload clears them. CSV download is explicit. Nothing is uploaded. Do not put secrets in custom SQL if screenshots or exports will be public.

## Dependencies and reporting

sql.js and its WASM are pinned from npm, with a lockfile; SQLite is public domain and sql.js is MIT licensed. Use `npm ci`, review updates and rerun the policy/engine suite. Install-time audit found no known vulnerabilities; that is not a security audit or a future guarantee. No penetration test or fuzz campaign is claimed.

Use repository private vulnerability reporting when available, or contact the owner through their public GitHub profile to arrange a private channel. Share an affected revision and minimal synthetic reproducer, not sensitive SQL or exploit details in a public issue. No reporting address is invented.

## Refinement boundary

Recent-query history is memory-only, capped at ten distinct already-validated successful SQL strings (each ≤20KiB) plus small summaries. It contains no result rows and is not sent or saved anywhere. Clear removes history references without claiming secure erasure of JavaScript memory; active/result SQL remains visible separately. Cancelled/stale worker replies cannot populate it. Loading history/source SQL requires a separate Run before execution and still passes the unchanged native SQL policy. History/source views render text through React. Chart choices accept only validated column positions with finite numeric rows; they add no HTML or SQL execution path.

## Refinement boundary

Sorting reads existing typed cells and renders through React text nodes; it never builds or executes SQL. CSV still passes every cell and header through formula-safe escaping. The original worker read-only gates, response bounds and termination watchdog are unchanged. Fixed public GitHub links carry no SQL or result parameters and use noreferrer.
