import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
