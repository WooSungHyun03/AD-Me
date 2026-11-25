import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/support/e2e-auth-budget.ts",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    actionTimeout: process.env.CI ? 15000 : 0,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
        // Existing E2E exercises the labeled TEST demo; free_beta is covered by unit tests.
        env: { SERVICE_MODE: process.env.SERVICE_MODE ?? "test_demo" },
      },
});
