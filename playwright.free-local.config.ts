import { defineConfig } from "@playwright/test";
import local from "./playwright.local.config";
process.env.ADME_QA_FREE = "1";
export default defineConfig({
  ...local,
  testMatch: ["local-browser/campaign-terms.spec.ts"],
  webServer: {
    command: "node scripts/serve-local-qa.mjs",
    url: "https://127.0.0.1:3143",
    ignoreHTTPSErrors: true,
    timeout: 120000,
    env: { ADME_QA_MODE: "free_beta" },
  },
});
