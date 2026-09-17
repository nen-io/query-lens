import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
const expensive =
  "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT SUM(x) FROM n;";
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
});
async function query(page: import("@playwright/test").Page, sql?: string) {
  if (sql !== undefined) await page.getByLabel("SQL query").fill(sql);
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
}
test("executes actual examples, keeps selection read-only until run, and charts real values", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Ready when you are." }),
  ).toBeVisible();
  await query(page);
  await expect(
    page.getByRole("cell", { name: "365100", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("result-row-count")).toHaveText("3 rows");
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await expect(page.getByRole("img", { name: /Bar chart/ })).toContainText(
    "365,100",
  );
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page
    .getByLabel("Example query", { exact: true })
    .selectOption("cities");
  await expect(
    page.getByRole("status").filter({ hasText: "Previous result" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "365100", exact: true }),
  ).toBeVisible();
  await query(page);
  await expect(
    page.getByRole("cell", { name: "242500", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Example query", { exact: true }).selectOption("nulls");
  await query(page);
  await expect(page.locator(".null-cell")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Chart", exact: true }),
  ).toBeDisabled();
});
test("custom SQL and keyboard shortcut return real results; syntax error labels old data", async ({
  page,
}) => {
  await page
    .getByLabel("SQL query")
    .fill("SELECT '臺北; coffee' AS label, 42 AS answer");
  await page.getByLabel("SQL query").press("Control+Enter");
  await expect(
    page.getByRole("cell", { name: "臺北; coffee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
  await query(page, "SELECT FROM bad");
  await expect(page.getByRole("alert")).toContainText("syntax error");
  await expect(
    page.getByRole("status").filter({ hasText: "Previous result" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
  await query(page, "SELECT COUNT(*) AS orders FROM orders");
  await expect(
    page.getByRole("cell", { name: "72", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("destructive and multiple statements cannot alter the seed", async ({
  page,
}) => {
  for (const sql of [
    "DELETE FROM orders",
    "PRAGMA query_only=OFF",
    "SELECT 1; SELECT 2",
  ]) {
    await query(page, sql);
    await expect(page.getByRole("alert")).toBeVisible();
  }
  await query(page, "SELECT COUNT(*) AS orders FROM orders");
  await expect(
    page.getByRole("cell", { name: "72", exact: true }),
  ).toBeVisible();
  await query(page, "SELECT 9e999");
  await expect(page.getByRole("alert")).toContainText("nonfinite");
  await expect(
    page.getByRole("status").filter({ hasText: "Previous result" }),
  ).toBeVisible();
});
test("actual expensive worker query times out and a freshly seeded worker succeeds", async ({
  page,
}) => {
  await page.getByLabel("SQL query").fill(expensive);
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel query" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("2-second limit", {
    timeout: 6000,
  });
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await query(page, "SELECT COUNT(*) AS total FROM orders");
  await expect(
    page.getByRole("cell", { name: "72", exact: true }),
  ).toBeVisible();
});
test("cancel terminates real execution and next query survives late responses", async ({
  page,
}) => {
  await page.getByLabel("SQL query").fill(expensive);
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await page.getByRole("button", { name: "Cancel query" }).click();
  await expect(page.getByRole("status")).toContainText("Query cancelled");
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await query(page, "SELECT 'after cancel' AS state");
  await expect(
    page.getByRole("cell", { name: "after cancel", exact: true }),
  ).toBeVisible();
});
test("truncation, empty results and safe CSV are explicit", async ({
  page,
}) => {
  await query(
    page,
    "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<600) SELECT x FROM n",
  );
  await expect(page.getByTestId("result-row-count")).toHaveText("500 rows");
  await expect(
    page.getByText("Truncated at 500 rows", { exact: true }),
  ).toBeVisible();
  await query(
    page,
    "SELECT '=1+1' AS formula, '臺北' AS city, NULL AS missing",
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  const csv = await fs.readFile((await download.path())!, "utf8");
  expect(csv).toBe('"formula","city","missing"\r\n"\'=1+1","臺北",""\r\n');
  await query(page, "SELECT name FROM customers WHERE id=-1");
  await expect(
    page.getByText("Query succeeded. No rows matched."),
  ).toBeVisible();
});
test("HTML-like result strings stay text; signed/zero charts show exact values", async ({
  page,
}) => {
  await query(page, "SELECT '<img src=x onerror=alert(1)>' AS html");
  await expect(
    page.getByRole("cell", {
      name: "<img src=x onerror=alert(1)>",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.locator(".result-table-scroll img").count()).toBe(0);
  await query(
    page,
    "SELECT 'positive' AS label, 10 AS score UNION ALL SELECT 'negative', -5 UNION ALL SELECT 'zero', 0",
  );
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await expect(page.getByRole("img", { name: /Bar chart/ })).toContainText(
    "-5",
  );
  await expect(page.locator(".chart-bar.negative")).toHaveCount(1);
  await expect(page.locator(".chart-bar").last()).toHaveAttribute(
    "style",
    "width: 0%;",
  );
});
test("desktop/mobile screenshots show real populated results with contained scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await query(page);
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Table", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Example query", { exact: true }).selectOption("join");
  await query(page);
  await expect(
    page.getByRole("cell", { name: "Sam Lin", exact: true }).first(),
  ).toBeVisible();
});
test("initialization failure offers a real retry", async ({ page }) => {
  await page.route("**/*sql-wasm*.wasm*", (route) => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Retry engine" })).toBeVisible({
    timeout: 12000,
  });
  await expect(page.getByRole("alert")).toContainText("SQLite could not start");
  await page.unroute("**/*sql-wasm*.wasm*");
  await page.getByRole("button", { name: "Retry engine" }).click();
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await query(page, "SELECT 42 AS recovered");
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
});
test("doubled text and reduced motion preserve the workflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        "button,input,select,textarea,p,label,h1,h2,h3,strong,small",
      ),
    ];
    const sizes = elements.map((e) => parseFloat(getComputedStyle(e).fontSize));
    elements.forEach((e, i) => (e.style.fontSize = `${sizes[i] * 2}px`));
  });
  await query(page, "SELECT 7 AS answer");
  await expect(
    page.getByRole("cell", { name: "7", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("production worker and bundled WASM load under a repository subpath with CSP", async ({
  page,
}) => {
  const errors: string[] = [];
  const loaded: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().includes(".wasm")) loaded.push(response.url());
  });
  await page.goto("http://127.0.0.1:4408/query-lens/", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await query(page);
  await expect(
    page.getByRole("cell", { name: "365100", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('meta[http-equiv="Content-Security-Policy"]'),
  ).toHaveAttribute("content", /wasm-unsafe-eval/);
  expect(
    loaded.some(
      (url) =>
        url.startsWith("http://127.0.0.1:4408/query-lens/assets/") &&
        url.endsWith(".wasm"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("editor gutter follows scroll and desktop row numbers stay on one line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByLabel("SQL query")
    .fill(
      Array.from({ length: 100 }, (_, i) => `-- line ${i + 1}`).join("\n") +
        "\nSELECT 1;",
    );
  await page.getByLabel("SQL query").evaluate((element) => {
    element.scrollTop = 180;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  expect(
    await page
      .locator(".line-numbers")
      .evaluate((element) => element.scrollTop),
  ).toBe(180);
  await query(page, "SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3");
  expect(
    await page
      .locator("td.row-number")
      .first()
      .evaluate((element) => getComputedStyle(element).whiteSpace),
  ).toBe("nowrap");
});

test("selects a chart metric and restores recent SQL without executing it", async ({
  page,
}) => {
  await query(page);
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await page.getByLabel("Chart metric").selectOption("2");
  await expect(
    page.getByRole("img", { name: /Bar chart of units_sold/ }),
  ).toBeVisible();
  await expect(page.locator(".chart-row strong")).toHaveText([
    "83",
    "83",
    "66",
  ]);
  await query(page, "SELECT COUNT(*) AS order_count FROM orders");
  await page
    .getByRole("button", { name: "Recent queries", exact: false })
    .click();
  const recent = page.getByRole("region", {
    name: "Recent successful queries",
  });
  await expect(
    recent.getByRole("button", { name: "Load query into editor" }),
  ).toHaveCount(2);
  await page.screenshot({
    path: "docs/screenshots/history-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/history-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await recent
    .getByRole("button", { name: "Load query into editor" })
    .last()
    .click();
  await expect(page.getByLabel("SQL query")).toHaveValue(/revenue_cents/);
  await expect(page.getByTestId("result-row-count")).toHaveText("1 row");
  await expect(
    page.getByText("Previous result · run the current query to update"),
  ).toBeVisible();
  await page.getByText("SQL behind this result", { exact: true }).click();
  await expect(page.locator(".result-source pre")).toHaveText(
    "SELECT COUNT(*) AS order_count FROM orders",
  );
  await page
    .getByRole("button", { name: "Load result SQL", exact: true })
    .click();
  await expect(page.getByLabel("SQL query")).toHaveValue(
    "SELECT COUNT(*) AS order_count FROM orders",
  );
  await expect(
    page.getByText("Query completed", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear query history", exact: true })
    .click();
  await expect(
    recent.getByText("Run a query to start your session history."),
  ).toBeVisible();
  await expect(page.getByTestId("result-row-count")).toHaveText("1 row");
});
