import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assertLedger, RETENTION_RULES } from "../src/lib/privacy-retention";
const h = "h:" + "a".repeat(64);
const ok = {
  subject_kind: "collected_profile",
  subject_id: "qa-1",
  key_hashes: [h],
  requested_at: "2026-11-22T00:00:00Z",
};
describe("D079 tombstone ledger", () => {
  it("accepts ids + hashes only", () => {
    expect(() => assertLedger([ok])).not.toThrow();
    expect(() => assertLedger([])).not.toThrow();
  });
  it("refuses content, raw keys, unknown kinds and malformed input", () => {
    for (const bad of [
      [{ ...ok, name: "원문 이름" }],
      [{ ...ok, key_hashes: ["url:https://example.com/raw"] }],
      [{ ...ok, subject_kind: "message" }],
      [{ ...ok, subject_id: "a b'; drop" }],
      { not: "array" },
    ])
      expect(() => assertLedger(bad)).toThrow("ledger_invalid");
  });
  it("documented periods match the SQL job", () => {
    const sql = readFileSync(
      "supabase/migrations/20261123100015_retention_tombstones.sql",
      "utf8",
    );
    const keep = RETENTION_RULES.map((r) => r.keep).join(" ");
    for (const [doc, period] of [
      ["3년", "3 years"],
      ["180일", "180 days"],
      ["1년", "1 year"],
    ]) {
      expect(keep).toContain(doc);
      expect(sql).toContain(`interval '${period}'`);
    }
  });
});
