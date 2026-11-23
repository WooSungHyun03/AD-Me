import { defineConfig } from "vitest/config";
import base from "./vitest.config";
// Explicit isolated DB suite; normal unit CI never needs credentials or Docker.
export default defineConfig({
  ...base,
  test: { include: ["tests/local-db-contract/**/*.spec.ts"] },
});
