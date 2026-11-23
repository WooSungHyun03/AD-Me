import { defineConfig } from "@playwright/test";
import keyless from "./playwright.keyless.config";
export default defineConfig({
  ...keyless,
  testDir: "./tests",
  testMatch: ["browser/**/*.spec.ts", "local-browser/license-notices.spec.ts"],
  preserveOutput: "always",
  use: { ...keyless.use, channel: "chrome", trace: "off" },
});
