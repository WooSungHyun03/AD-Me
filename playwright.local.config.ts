import { defineConfig, devices } from "@playwright/test";
process.env.ADME_ACCOUNTS_FILE = "output/dev-a-db/accounts.local.json";
process.env.ADME_LOCAL_QA = "1";
export default defineConfig({
  preserveOutput: "always",
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "local-browser/**/*.spec.ts"],
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "https://127.0.0.1:3143",
    channel: "chrome",
    trace: "off",
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/serve-local-qa.mjs",
    url: "https://127.0.0.1:3143",
    ignoreHTTPSErrors: true,
    timeout: 120000,
  },
});
