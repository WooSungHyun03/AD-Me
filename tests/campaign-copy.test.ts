import { describe, expect, it } from "vitest";
import { copyCampaignBrief } from "@/lib/campaign-copy";
const brief = {
  title: "가상 캠페인",
  product: "제품",
  category: "뷰티",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["instagram"],
  budget_krw: 100000,
  target_audience: "성인 고객",
  goal: "제품 소개",
  status: "published",
  owner_id: "intruder",
  attachments: ["secret"],
  messages: ["private"],
  participants: ["private"],
  notes: "private",
};
describe("campaign copy privacy boundary", () => {
  it("copies the validated matching policy without sharing mutable state", () => {
    const policy = { category: "hard", budget: "hard", unknown: "exclude" };
    const copy = copyCampaignBrief(
      { ownerId: "a", isDemo: false, brief: { ...brief, policy } },
      "a",
    );
    expect(copy.policy).toEqual(policy);
    copy.policy!.budget = "soft";
    expect(policy.budget).toBe("hard");
  });
  it("creates only a draft brief, never carries child data or ownership", () => {
    const copy = copyCampaignBrief({ ownerId: "a", isDemo: false, brief }, "a");
    expect(copy.status).toBe("draft");
    expect(copy.title).toBe("가상 캠페인 (복제)");
    expect(Object.keys(copy)).toEqual([
      "title",
      "product",
      "category",
      "vibes",
      "format",
      "platforms",
      "budget_krw",
      "target_audience",
      "goal",
      "status",
    ]);
    copy.vibes.push("다른 값");
    expect(brief.vibes).toEqual(["자연스러움"]);
  });
  it.each([
    ["b", false],
    ["a", true],
    ["", false],
  ])("rejects foreign, demo and absent actors", (actorId, isDemo) => {
    expect(() =>
      copyCampaignBrief(
        { ownerId: "a", isDemo: Boolean(isDemo), brief },
        String(actorId),
      ),
    ).toThrow("FORBIDDEN");
  });
  it("rejects corrupted source and keeps the title within storage bounds", () => {
    expect(() =>
      copyCampaignBrief({ ownerId: "a", isDemo: false, brief: {} }, "a"),
    ).toThrow();
    expect(
      copyCampaignBrief(
        {
          ownerId: "a",
          isDemo: false,
          brief: { ...brief, title: "가".repeat(120) },
        },
        "a",
      ).title.length,
    ).toBeLessThanOrEqual(120);
  });
});
