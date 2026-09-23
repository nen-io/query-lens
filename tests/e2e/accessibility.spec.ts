import { expect, test } from "@playwright/test";

const expensive =
  "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT SUM(x) FROM n;";

test("keyboard first use skips schema and table preview loads then focuses the editor", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to SQL editor" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("SQL query")).toBeFocused();
  await page
    .getByRole("button", { name: "Preview orders table", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("SQL query")).toBeFocused();
  await expect(page.getByLabel("SQL query")).toHaveValue(
    "SELECT *\nFROM orders\nLIMIT 20;",
  );
  await expect(
    page.getByRole("heading", { name: "Ready when you are." }),
  ).toBeVisible();
});

test("query error describes the current editor and keyboard cancellation returns there", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  const editor = page.getByLabel("SQL query");
  await editor.fill("SELECT FROM bad");
  await page.getByRole("button", { name: "Run query", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveAttribute("aria-invalid", "true");
  await expect(editor).toHaveAccessibleDescription(/syntax error/);
  await editor.fill(expensive);
  await expect(editor).toHaveAttribute("aria-invalid", "false");
  await editor.press("Control+Enter");
  await page.getByRole("button", { name: "Cancel query" }).focus();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
});

test("resetting sorting restores stable focus and chart values have a semantic table alternative", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  const sort = page.getByRole("button", { name: /Sort revenue_cents, column/ });
  await expect(sort).toBeVisible();
  await sort.click();
  await page
    .getByRole("button", { name: "Original order", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(sort).toBeFocused();
  await page.getByRole("button", { name: "Chart", exact: true }).click();
  await page.getByText("Exact chart values", { exact: true }).focus();
  await page.keyboard.press("Enter");
  const table = page.getByRole("table", { name: /Chart values/ });
  await expect(table).toBeVisible();
  await expect(
    table.getByRole("cell", { name: "365100", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page
    .locator(".results-panel")
    .screenshot({ path: "docs/screenshots/accessible-chart.png" });
});

test("320px enlarged text and forced colors preserve controls and scrollable results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:4408/query-lens/");
  await expect(page.getByTestId("engine-status")).toHaveText("SQLite ready");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByTestId("result-row-count")).toHaveText("3 rows");
  await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(
        "button,input,textarea,select,p,label,h1,h2,h3,strong,small,span",
      ),
    ];
    const sizes = elements.map((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    elements.forEach((element, index) => {
      element.style.fontSize = `${sizes[index] * 2}px`;
    });
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const region = page.getByRole("region", {
    name: "Result table, horizontally scrollable",
  });
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect(region).toBeFocused();
  expect(
    await region.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
});
