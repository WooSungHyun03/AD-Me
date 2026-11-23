import { describe, expect, it } from "vitest";
import { creators, similarCreators, type Creator } from "@/lib/catalog";
import { safeNext } from "@/lib/auth-links";

const demo = creators as unknown as Creator[];
const real = (over: Partial<Creator>): Creator => ({
  ...demo[0],
  is_demo: false,
  owner_id: "u",
  ...over,
});

describe("similar profiles (D032)", () => {
  const target = demo[0];
  it("is deterministic, excludes self, and every reason is a tag both profiles list", () => {
    const a = similarCreators(target, demo),
      b = similarCreators(target, [...demo].reverse());
    expect(a.map((r) => r.creator.seed_id)).toEqual(
      b.map((r) => r.creator.seed_id),
    );
    expect(a.length).toBeGreaterThan(0);
    for (const r of a) {
      expect(r.creator.seed_id).not.toBe(target.seed_id);
      for (const reason of r.reasons) {
        const tag = reason.split(" ").slice(1).join(" ");
        const both = (k: keyof Creator) =>
          (target[k] as string[]).includes(tag) &&
          (r.creator[k] as string[]).includes(tag);
        expect(
          both("categories") ||
            both("vibes") ||
            both("formats") ||
            both("platforms"),
        ).toBe(true);
      }
      expect(r.reasons.join(" ")).not.toMatch(/팔로워|원|나이|성별|지역/);
    }
  });
  it("never mixes fictional and real profiles", () => {
    const r1 = real({ seed_id: "real-1" }),
      r2 = real({ seed_id: "real-2" });
    const forReal = similarCreators(r1, [...demo, r2]);
    expect(forReal.map((r) => r.creator.seed_id)).toEqual(["real-2"]);
    expect(
      similarCreators(target, [...demo, r2]).every((r) => r.creator.is_demo),
    ).toBe(true);
  });
  it("excludes unpublished and deleted candidates, and platform-only overlap", () => {
    const base = real({ seed_id: "t" });
    const list = [
      real({ seed_id: "hidden", published: false }),
      real({ seed_id: "deleted", name: "삭제된 프로필" }),
      real({ seed_id: "removed", data_source: "owner_removed" }),
      real({
        seed_id: "platform-only",
        categories: ["없는분야"],
        vibes: [],
        formats: [],
      }),
    ];
    expect(similarCreators(base, list)).toEqual([]);
  });
});

describe("safeNext keeps only well-formed request links", () => {
  it.each([
    ["/reports/new?creator=demo-01", "/reports/new?creator=demo-01"],
    [
      "/reports/new?creator=yt-a_1&kind=deletion",
      "/reports/new?creator=yt-a_1&kind=deletion",
    ],
    ["/reports/new?creator=x&kind=admin", "/dashboard"],
    ["/reports/new?creator=//evil.com", "/dashboard"],
    ["/reports/new?creator=a&next=https://evil.com", "/dashboard"],
    ["https://evil.com/reports/new?creator=a", "/dashboard"],
  ])("%s → %s", (input, out) => expect(safeNext(input)).toBe(out));
});
