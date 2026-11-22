import { describe, it, expect } from "vitest";
import { onboardingSteps } from "../src/lib/onboarding";
describe("D011 onboarding", () => {
  it("brand needs a name and a first campaign", () => {
    const s = onboardingSteps({
      role: "brand",
      name: "새 사용자",
      campaigns: 0,
      creatorProfile: null,
    });
    expect(s.map((x) => x.done)).toEqual([false, false]);
    expect(
      onboardingSteps({
        role: "brand",
        name: "브랜드A",
        campaigns: 1,
        creatorProfile: null,
      }).every((x) => x.done),
    ).toBe(true);
  });
  it("creator resumes at the first incomplete step after re-login", () => {
    const s = onboardingSteps({
      role: "creator",
      name: "하린",
      campaigns: 0,
      creatorProfile: { published: false },
    });
    expect(s.find((x) => !x.done)?.label).toBe("프로필 공개");
  });
  it("offers no self-service path for admin or tampered roles", () => {
    for (const role of ["admin", "superuser", undefined])
      expect(
        onboardingSteps({
          role,
          name: "x",
          campaigns: 0,
          creatorProfile: null,
        }),
      ).toEqual([]);
  });
});
