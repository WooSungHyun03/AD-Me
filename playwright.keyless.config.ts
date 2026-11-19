import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: { baseURL, channel: process.env.ADME_BROWSER_CHANNEL },
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
    command: "node scripts/serve-keyless-qa.mjs",
    url: baseURL,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_TOSS_CLIENT_KEY: "",
      ADME_SERVICE_MODE: "free_beta",
      ADME_FEATURE_MAIL: "off",
      ADME_FEATURE_TEST_BILLING: "off",
    },
  },
});
