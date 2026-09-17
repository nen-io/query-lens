# Assets, engine and data provenance

- Interface, CSS, Query Lens wordmark and charts are original for this repository.
- Icons use pinned `lucide-react` under ISC; see [Lucide license](https://lucide.dev/license). System fonts are used; no external font/icon requests occur.
- sql.js 1.14.2 is MIT licensed. SQLite itself is public domain. Its WASM binary is imported from the pinned npm package and emitted by Vite; no CDN fetch or copied opaque third-party binary is used. See [sql.js licensing](https://github.com/sql-js/sql.js) and the installed package license.
- All data is deterministic synthetic teaching content; names, prices, dates and `.test` email addresses are invented. See `docs/DATASET.md` and `src/domain/dataset.ts` for provenance and generation rules. No private source, real customer records, credentials or telemetry were copied.
- `docs/screenshots/desktop.png` and `mobile.png` are actual Playwright captures of the running app after executing real SQL on the synthetic database. They are not mockups or generated images.
- Source is MIT licensed. Dependency licenses remain attached to their respective code/assets.
