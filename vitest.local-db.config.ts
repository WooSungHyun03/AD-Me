import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";
// Explicit opt-in: these tests require the marked, disposable loopback DB.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["tests/local-db-contract/**/*.spec.ts"],
      testTimeout: 30000,
    },
  }),
);
