# Verification and test map

Verified locally on 17 September 2026 with the pinned npm dependencies, Node 24 and Playwright Chromium. The test harness executes the actual bundled SQLite engine; it does not substitute canned query results.

## Commands and observed results

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npx prettier --check src tests scripts
```

| Check                                    | Observed result                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Strict TypeScript (`npm run typecheck`)  | Passed                                                                        |
| Vitest (`npm test`)                      | 90 tests passed across 3 files                                                |
| Production compilation (`npm run build`) | Passed; local worker and WASM emitted                                         |
| Chromium journeys (`npm run test:e2e`)   | 13 tests passed                                                               |
| Source/test/script formatting            | Passed with pinned Prettier                                                   |
| Independent browser review               | No uncaught page errors or document overflow at 1440, 720, 390 and 320 pixels |
| Independent axe WCAG 2/2.1 AA scan       | Zero reported violations in the reviewed ready state                          |

Automated accessibility checks do not establish complete accessibility conformance. The separate review also exercised populated results, HTML-like strings, CSV export, statement rejection and independent aggregate queries.

## Contract coverage

| Contract                           | Evidence                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1: real seed results              | `tests/unit/engine.test.ts`: hardcoded, independently calculated category/city/month/product totals, first completed order join, counts and NULL customers                                                                                                    |
| Q2: read-only and single statement | Actual-engine tests for writes, DDL, ATTACH, PRAGMA, comments, quoted semicolons, CTEs and multi-statements; direct `db.run` bypasses lexical policy to prove native `query_only` rejects writes                                                              |
| Q3: bounds and recovery            | Tests for 500 versus 501 rows, SQL byte/NUL bounds, columns, cells, BLOBs, total output bytes, syntax errors and native allocation failure followed by a successful query                                                                                     |
| Q4: lifecycle and races            | `tests/unit/client.test.ts`: controlled watchdog, cancellation, old epochs, wrong request IDs, duplicate replies, initialization retry and disposal; browser runs a truly expensive recursive query for timeout/cancel, then queries the regenerated database |
| Q5: CSV                            | `tests/unit/results.test.ts`: positional columns, quotes, newlines, Unicode, NULL, malicious headers, whitespace/control-prefixed formula strings and genuine negative numbers; browser downloads and inspects actual CSV                                     |
| Q6: usable deployed workbench      | `tests/e2e/query-lens.spec.ts`: explicit example execution, custom SQL, Ctrl/Cmd+Enter path, visible syntax error/prior result, chart/table, truncation, empty result, retry and production subpath worker/WASM loading                                       |
| Numeric presentation               | Actual SQLite Infinity is rejected, unsafe 64-bit integers remain exact decimal text, finite negative/zero chart values stay signed and correctly sized                                                                                                       |
| Safe presentation                  | HTML-like result stays text, no injected image element; chart uses only finite numbers; stale output is labelled after failed/edited SQL                                                                                                                      |
| Responsive/editor behavior         | 390/320-pixel contained scrolling, doubled text at 720 pixels, reduced motion, real long-query gutter scrolling and desktop row-number nowrap                                                                                                                 |

The dataset expectations are intentionally not computed by the query under test. A separate arithmetic calculation from the documented seed rules established expected totals: 72 orders, 144 line items, 8 cancelled orders, and 726,500 cents/232 units from completed orders. All order items, including cancelled orders, contain 252 units. See [dataset provenance and expected outputs](DATASET.md).

## Browser harness and screenshots

Playwright starts or reuses the development server at port 4308 and starts a separate production fixture server at `http://127.0.0.1:4408/query-lens/`. That second server builds the real production bundle, verifies a successful WASM response under the repository asset prefix, runs actual SQL and checks CSP startup. It does not stand in for live GitHub Pages verification.

The screenshot journey captures representative populated states directly from the app:

- [Desktop, 1440 pixels](screenshots/desktop.png): executed category revenue query, real-value chart and schema.
- [Mobile, 390 pixels](screenshots/mobile.png): the same executed query in the accessible table view.

No screenshot is a mockup or generated illustration. Query duration displayed in a screenshot is one observed run, not a benchmark.

## Practical limits

Tests run in desktop Chromium, including emulated narrow viewports; they do not certify Safari, Firefox, real iOS/Android hardware, assistive technologies or spreadsheet applications. No load benchmark, formal security audit or broad fuzzing claim is made. Watchdog tests prove worker replacement/recovery in this environment; browser suspension can delay timers. The native SQLite allocation test proves its own heap guard, not a bound on all browser/WASM/JavaScript memory. CSV defenses reduce known formula execution risks but spreadsheet import behavior varies.

Publication, live URL verification and clean-clone verification are separate release checks. Those are not inferred from a passing local test suite.

## Refinement regression evidence

Before implementation, the actual chart-domain test ignored a requested second numeric column and the client had no recoverable history; both assertions failed. After implementation,90 unit/integration tests and13 Chromium journeys pass. New cases verify duplicate-alias column indices, invalid/NULL/text metric rejection, ten-entry eviction, exact-SQL deduplication, no result copies, error/cancel/stale exclusion, and clear preserving the visible result. The browser changes revenue to units, executes a second query, loads earlier SQL without changing rows, inspects/restores result source and clears history without clearing output.

All native SQLite policy/read-only/resource/cancellation and production-subpath tests remain in the suite. The screenshot journey now captures the history disclosure and chart selectors. `screenshots/query-lens-refinement-before.png` records the earlier real UI for comparison. No new persistence or network dependency was added.

The history workflow additionally captures [expanded desktop history](screenshots/history-desktop.png) and [expanded mobile history](screenshots/history-mobile.png), checks390px overflow, and performs source/history restoration on the mobile layout.

## September 23, 2026 iteration

Fresh locked `npm ci` succeeded on Node 24.19.0. `npm run check` passed strict TypeScript, all domain/integration checks and the production build. Full browser suite: **93 unit tests and 15 Chromium journeys (including production worker/WASM/CSP)** in total.

The sorting acceptance case failed on the absent real column control before implementation. Browser checks now verify numeric and NULL ordering, stable ties, keyboard activation/aria-sort, CSV matching displayed order, preserving sort on query failure, reset on a new accepted result, chart order, duplicate aliases by column index and exact source/walkthrough links at 320px. Unit tests cover mixed types, empty strings, exact integer text, stable ties, non-mutation and invalid column indices. Existing actual SQLite read-only policy, resource limits, timeout/reseed and cancellation checks still pass.

New real browser captures: `screenshots/sorting-desktop.png` at 1440px and `screenshots/sorting-mobile.png` at 390px. Existing desktop/mobile screenshots were refreshed by their unchanged journeys. These screenshots were visually inspected; a palette mismatch in the initial Query Lens sort controls was caught and corrected before final capture. Existing browser/platform/scale limitations above still apply. Public deployment and exact-commit verification are separate publishing checks.

Current official references consulted: [React state structure](https://react.dev/learn/choosing-the-state-structure), [Playwright assertions](https://playwright.dev/docs/test-assertions) and [SQLite query_only](https://www.sqlite.org/pragma.html#pragma_query_only). No dependencies were added or upgraded for this refinement.
