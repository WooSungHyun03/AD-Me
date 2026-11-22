import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MARKETING_VERSION } from "@/lib/consent";
it("marketing notice version matches the database", () => {
  const sql = readFileSync(
    "supabase/migrations/202611190018_preferences_consent.sql",
    "utf8",
  );
  expect(sql).toContain(`select '${MARKETING_VERSION}'`);
  expect(sql).toMatch(/marketing_email boolean not null default false/);
});
