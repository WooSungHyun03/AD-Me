import { describe, it, expect } from "vitest";
import {
  assertSourceAllowed,
  pickAllowed,
  policies,
  type SourcePolicy,
} from "../src/lib/ingestion/policy";
const base = policies.owner_self_registration;
describe("D017 source policy gate", () => {
  it("blocks unknown, pending, unreviewed and expired sources", () => {
    expect(() => assertSourceAllowed("instagram_scrape")).toThrow("등록되지");
    expect(() => assertSourceAllowed("youtube_data_api")).toThrow("승인되지");
    expect(() => assertSourceAllowed("tiktok_display_api")).toThrow("승인되지");
    const t: Record<string, SourcePolicy> = {
      x: { ...base, reviewer: null },
      y: { ...base, review_expires_at: "2026-01-01" },
    };
    expect(() => assertSourceAllowed("x", new Date(), t)).toThrow("검토자");
    expect(() => assertSourceAllowed("y", new Date("2026-06-01"), t)).toThrow(
      "만료",
    );
  });
  it("allows approved sources", () => {
    expect(assertSourceAllowed("owner_self_registration").id).toBe(
      "owner_self_registration",
    );
  });
  it("strips fields outside the allowlist", () => {
    expect(
      pickAllowed(base, { name: "a", email: "x@y", phone: "010" }),
    ).toEqual({ name: "a" });
  });
  it("every policy defines retention, purpose and legal basis", () => {
    for (const p of Object.values(policies)) {
      expect(p.retention_days).toBeGreaterThan(0);
      expect(p.purpose.length).toBeGreaterThan(0);
      expect(p.legal_basis.length).toBeGreaterThan(0);
      expect(p.fields.length).toBeGreaterThan(0);
    }
  });
});
