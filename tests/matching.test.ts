import { describe, it, expect } from "vitest";
import { match, rank, creators, campaigns } from "../src/lib/catalog";
import {
  canTransition,
  campaignSchema,
  profileSchema,
} from "../src/lib/schemas";
import {
  assertTestClient,
  assertTestSecret,
  validateConfirmation,
  activeEntitlement,
} from "../src/lib/billing";
describe("explainable matching", () => {
  it("renormalizes missing audience data and is deterministic", () => {
    const c = { ...creators[0], is_available: true };
    const b = {
      category: c.categories[0],
      vibes: c.vibes,
      format: c.formats[0],
      budget_krw: c.price_max_krw,
    };
    const r = match(b, c);
    expect(r.score).toBe(100);
    expect(r.coverage).toBe(80);
    expect(r.missing).toContain("타깃 고객");
    expect(match(b, c)).toEqual(r);
  });
  it("excludes unavailable creators and obeys platform hard filter", () => {
    const ranked = rank({ ...campaigns[0], platforms: ["youtube"] });
    expect(
      ranked.every(
        (r) =>
          r.creator.is_available && r.creator.platforms.includes("youtube"),
      ),
    ).toBe(true);
  });
  it("does not let paid promotion affect organic ranking", () => {
    const base = rank(campaigns[0]);
    const paid = rank(
      campaigns[0],
      creators.map((c) => ({ ...c, hot: true })),
    );
    expect(paid.map((r) => [r.creatorId, r.score])).toEqual(
      base.map((r) => [r.creatorId, r.score]),
    );
  });
  it("returns zero coverage when no factor is known", () => {
    const r = match(
      { category: "", vibes: [], format: "", budget_krw: 0 },
      creators[0],
    );
    expect(r.coverage).toBe(0);
    expect(r.score).toBe(0);
  });
  it("uses stable tie order", () =>
    expect(rank(campaigns[0])).toEqual(
      rank(campaigns[0], [...creators].reverse()),
    ));
});
describe("workflow permissions", () => {
  it("only the recipient can accept", () => {
    expect(canTransition("proposal", "pending", "accepted", "creator")).toBe(
      true,
    );
    expect(canTransition("proposal", "pending", "accepted", "brand")).toBe(
      false,
    );
    expect(canTransition("application", "pending", "accepted", "brand")).toBe(
      true,
    );
  });
  it("guards deliverable review and final state", () => {
    expect(canTransition("proposal", "accepted", "submitted", "creator")).toBe(
      true,
    );
    expect(canTransition("proposal", "submitted", "completed", "creator")).toBe(
      false,
    );
    expect(canTransition("proposal", "completed", "accepted", "brand")).toBe(
      false,
    );
  });
  it("rejects malformed budgets and quotes", () => {
    expect(
      campaignSchema.safeParse({ ...campaigns[0], budget_krw: -1 }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...creators[0], price_max_krw: -1 }).success,
    ).toBe(false);
  });
});
describe("test-only billing", () => {
  it("refuses absent and live keys", () => {
    for (const k of [undefined, "live_ck_x", "live_gck_x", "test_gck_x", "bad"])
      expect(() => assertTestClient(k)).toThrow();
    expect(assertTestClient("test_ck_example")).toContain("test_");
    expect(() => assertTestSecret("live_sk_x")).toThrow();
  });
  it("guards owner, amount and payment replay", () => {
    const o = { owner_id: "a", amount: 49000, status: "pending" };
    expect(() => validateConfirmation(o, "b", 49000, "pk")).toThrow();
    expect(() => validateConfirmation(o, "a", 1, "pk")).toThrow();
    expect(() =>
      validateConfirmation(
        { ...o, status: "paid", payment_key: "other" },
        "a",
        49000,
        "pk",
      ),
    ).toThrow();
    expect(() =>
      validateConfirmation(
        { ...o, status: "paid", payment_key: "pk" },
        "a",
        49000,
        "pk",
      ),
    ).not.toThrow();
  });
  it("expires at the exact boundary", () => {
    const e = {
      starts_at: "2026-11-01T00:00:00Z",
      expires_at: "2026-12-01T00:00:00Z",
    };
    expect(activeEntitlement(e, new Date(e.starts_at))).toBe(true);
    expect(activeEntitlement(e, new Date(e.expires_at))).toBe(false);
  });
});
import { csvCell, toCsv } from "../src/lib/csv";
describe("safe exports", () => {
  it("neutralizes spreadsheet formulas and escapes quotes", () => {
    expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
    expect(csvCell(" @SUM(1)")).toContain("'");
    expect(toCsv([["한글", "a,b"]])).toContain("\uFEFF");
  });
});
