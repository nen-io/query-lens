import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4308",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:4308",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && node scripts/serve-dist.mjs",
      url: "http://127.0.0.1:4408/query-lens/",
      reuseExistingServer: false,
    },
  ],
  workers: 1,
});
