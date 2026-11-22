import { describe, it, expect } from "vitest";
import { campaignSchema, recruitingError } from "../src/lib/schemas";
const base = {
  title: "모집 테스트",
  product: "QA",
  category: "뷰티",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["youtube"],
  budget_krw: 100000,
  target_audience: "QA 고객",
  goal: "검증",
  status: "published",
};
describe("D043 campaign recruiting contract", () => {
  it("accepts absolute ISO deadline and 1..100 capacity, or none", () => {
    expect(
      campaignSchema.safeParse({
        ...base,
        recruit_until: "2026-12-01T09:00:00.000Z",
        capacity: 3,
      }).success,
    ).toBe(true);
    expect(
      campaignSchema.safeParse({ ...base, recruit_until: null, capacity: null })
        .success,
    ).toBe(true);
    expect(campaignSchema.safeParse(base).success).toBe(true);
  });
  it("rejects malformed deadline and out-of-range capacity", () => {
    expect(
      campaignSchema.safeParse({ ...base, recruit_until: "next week" }).success,
    ).toBe(false);
    expect(campaignSchema.safeParse({ ...base, capacity: 0 }).success).toBe(
      false,
    );
    expect(campaignSchema.safeParse({ ...base, capacity: 101 }).success).toBe(
      false,
    );
    expect(campaignSchema.safeParse({ ...base, capacity: 1.5 }).success).toBe(
      false,
    );
  });
  it("maps DB rule codes to Korean messages and leaves others to generic handling", () => {
    expect(recruitingError('new row ... "capacity_full"')).toMatch(/모두 선정/);
    expect(recruitingError("deadline_passed")).toMatch(/현재 시각 이후/);
    expect(recruitingError("permission denied")).toBeUndefined();
  });
});
