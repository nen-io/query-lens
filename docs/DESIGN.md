# Query Lens visual design

Query Lens is a midnight-blue SQL workbench with ice-blue accents and a quietly editorial heading. A warm SQL editor gives code enough space; a dense but readable table is the main output. A small horizontal bar chart appears only for meaningful label/numeric results, with actual values and units. No fabricated performance metric or fake query result is shown.

Desktop: compact identity/status bar; heading and an explicit dataset provenance badge; slim schema explorer with native expandable tables; main editor, examples and run controls; result panel with table/chart and CSV export. Unlike a dashboard, the editor and actual rows drive the page. The default SQL is a useful grouped revenue query over synthetic orders, using integer cents.

Primary journey: inspect a table's columns; choose an example, which only edits SQL; explicitly Run or press Ctrl/Cmd+Enter; inspect measured execution time, row count, units and table; optionally see the matching bar chart and download safe CSV. Syntax/policy errors retain previous output only with a prominent previous-result marker. Editing after a successful run marks it as belonging to the earlier SQL.

Worker initialization has a clear loading state and retry action. Running exposes Cancel. Cancellation and the two-second deadline terminate the worker, fence the old request and initialize a fresh seeded database. The main thread stays responsive; no query progress or throughput is invented. Bounded/truncated results are labelled. Empty results remain a successful empty table, not an error.

Phones stack the schema, editor and results. Only the result table owns horizontal overflow; the document must fit 320px. The SQL textarea is labelled, supports normal keyboard editing, and never intercepts Tab. Run uses a visible keyboard shortcut; all schema and example controls are native buttons. Focus is bright and visible. Text and values wrap, NULL has an explicit label, and reduced motion disables decorative transitions. No external assets, fonts, trackers or CDN-loaded engine.
