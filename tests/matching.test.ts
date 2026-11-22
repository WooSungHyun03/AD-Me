import { describe, it, expect } from "vitest";
import {
  match,
  rank,
  creators,
  campaigns,
  categories,
  vibes,
  WEIGHTS,
} from "../src/lib/catalog";
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
      { ...creators[0], is_available: true },
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
  it("only the initiator can cancel, and only while pending", () => {
    expect(canTransition("proposal", "pending", "cancelled", "brand")).toBe(
      true,
    );
    expect(canTransition("proposal", "pending", "cancelled", "creator")).toBe(
      false,
    );
    expect(
      canTransition("application", "pending", "cancelled", "creator"),
    ).toBe(true);
    expect(
      canTransition("application", "accepted", "cancelled", "creator"),
    ).toBe(false);
    expect(canTransition("proposal", "cancelled", "accepted", "creator")).toBe(
      false,
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
    for (const k of [undefined, "live_ck_x", "live_gck_x", "bad"])
      expect(() => assertTestClient(k)).toThrow();
    expect(assertTestClient("test_ck_example")).toContain("test_");
    expect(() => assertTestSecret("live_sk_x")).toThrow();
    expect(assertTestSecret("test_sk_example")).toContain("test_");
  });
  it("refuses widget keys that do not pair with payment()", () => {
    expect(() => assertTestClient("test_gck_example")).toThrow();
    expect(() => assertTestSecret("test_gsk_example")).toThrow();
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

describe("D026 profile contract", () => {
  const base = {
    name: "본인 크리에이터",
    bio: "",
    categories: [categories[0]],
    vibes: [vibes[0]],
    formats: ["숏폼"],
    platforms: ["youtube"],
    price_min_krw: 100000,
    price_max_krw: 200000,
    is_available: true,
    published: false,
  };
  it("accepts unknown quote and unknown availability as null, not 0/false", () => {
    const r = profileSchema.safeParse({
      ...base,
      price_min_krw: null,
      price_max_krw: null,
      is_available: null,
    });
    expect(r.success && r.data.price_min_krw).toBe(null);
    expect(r.success && r.data.is_available).toBe(null);
  });
  it("rejects half-unknown quotes, off-taxonomy tags, duplicates and too many", () => {
    expect(
      profileSchema.safeParse({ ...base, price_max_krw: null }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, categories: ["<script>"] }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, platforms: ["youtube", "youtube"] })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, platforms: ["facebook"] }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, categories: categories.slice(0, 6) })
        .success,
    ).toBe(false);
  });
  it("strips server-owned fields a client might smuggle in", () => {
    const r = profileSchema.safeParse({
      ...base,
      is_demo: true,
      followers: 9e9,
      owner_id: "x",
    });
    expect(r.success && Object.keys(r.data)).not.toContain("is_demo");
    expect(r.success && Object.keys(r.data)).not.toContain("owner_id");
  });
  it("treats unknown quote as missing data in matching, not a cheap match", () => {
    const c = {
      ...creators[0],
      price_min_krw: null,
      price_max_krw: null,
      is_available: true,
    };
    const m = match(
      {
        category: c.categories[0],
        vibes: c.vibes,
        format: c.formats[0],
        budget_krw: 100000,
      },
      c,
    );
    expect(m.missing).toContain("예산");
    expect(m.eligible).toBe(true);
    // Unknown availability is a gate, not a score.
    expect(
      match(
        { category: "", vibes: [], format: "", budget_krw: 0 },
        { ...c, is_available: null },
      ).eligible,
    ).toBe(false);
  });
});

describe("D044 hard gates, missing data and score contract", () => {
  const avail = creators.map((c) => ({ ...c, is_available: true }));
  const c0 = avail[0];
  const brief = {
    category: c0.categories[0],
    vibes: c0.vibes,
    format: c0.formats[0],
    budget_krw: c0.price_min_krw!,
  };
  it("weights sum to 100 and every factor appears once", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    const m = match(brief, c0);
    expect(m.breakdown.map((b) => b.weight).reduce((a, b) => a + b, 0)).toBe(
      100,
    );
  });
  it("evaluates gates before scoring: excluded creators carry no score", () => {
    const m = match({ ...brief, platforms: ["nonexistent"] }, c0);
    expect([m.status, m.score, m.breakdown.length]).toEqual([
      "excluded",
      null,
      0,
    ]);
    expect(m.reasons).toContain("플랫폼 불일치");
  });
  it("category: soft scores a mismatch, hard excludes it", () => {
    const other = categories.find((x) => !c0.categories.includes(x))!;
    expect(match({ ...brief, category: other }, c0).status).toBe("eligible");
    const hard = match(
      { ...brief, category: other, policy: { category: "hard" } },
      c0,
    );
    expect([hard.status, hard.reasons]).toEqual([
      "excluded",
      ["분야 불일치(필수)"],
    ]);
  });
  it("budget: boundary is inclusive under hard policy", () => {
    const p = { budget: "hard" as const };
    expect(
      match({ ...brief, budget_krw: c0.price_min_krw!, policy: p }, c0).status,
    ).toBe("eligible");
    expect(
      match({ ...brief, budget_krw: c0.price_min_krw! - 1, policy: p }, c0)
        .status,
    ).toBe("excluded");
    expect(
      match({ ...brief, budget_krw: c0.price_min_krw! - 1 }, c0).status,
    ).toBe("eligible"); // soft
  });
  it("unknown data under a hard policy is held or excluded per policy, never scored as a fit", () => {
    const unknown = {
      ...c0,
      price_min_krw: null,
      price_max_krw: null,
      categories: [],
    };
    const held = match(
      {
        ...brief,
        policy: { budget: "hard", category: "hard", unknown: "hold" },
      },
      unknown,
    );
    expect(held.status).toBe("hold");
    expect(held.reasons).toEqual(["분야 미확인", "견적 미확인"]);
    expect(held.missing).toEqual(
      expect.arrayContaining(["콘텐츠 분야", "예산"]),
    );
    expect(
      match(
        { ...brief, policy: { budget: "hard", unknown: "exclude" } },
        unknown,
      ).status,
    ).toBe("excluded");
  });
  it("held candidates rank after every confirmed candidate regardless of score", () => {
    const list = [
      { ...c0, seed_id: "z-held", price_min_krw: null },
      ...avail.slice(1, 6),
    ];
    const ranked = rank({ ...brief, policy: { budget: "hard" } }, list);
    const firstHold = ranked.findIndex((r) => r.status === "hold");
    expect(firstHold).toBeGreaterThanOrEqual(0);
    expect(ranked.slice(firstHold).every((r) => r.status === "hold")).toBe(
      true,
    );
  });
  it("zero denominators: 0원 quote and 0 budget do not divide by zero", () => {
    const free = match(brief, { ...c0, price_min_krw: 0 });
    expect(free.breakdown.find((b) => b.factor === "예산")!.value).toBe(1);
    expect(match({ ...brief, budget_krw: 0 }, c0).missing).toContain("예산");
    for (const r of rank(brief, avail))
      expect(Number.isFinite(r.score)).toBe(true);
  });
  it("renormalizes over known weights: coverage is the known-weight share", () => {
    const m = match({ ...brief, format: "" }, c0); // format + audience missing
    expect(m.coverage).toBe(100 - WEIGHTS.audience - WEIGHTS.format);
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });
  it("fixed dataset snapshot and input-order independence", () => {
    const r = rank(campaigns[0], avail);
    expect(rank(campaigns[0], [...avail].reverse())).toEqual(r);
    expect(
      r.slice(0, 5).map((x) => [x.creatorId, x.score, x.coverage]),
    ).toMatchSnapshot();
  });
});
