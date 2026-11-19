import { describe, expect, it } from "vitest";
import { brandAccountSchema, publicBrandDTO } from "@/lib/brand-profile";
const fixture = {
  brandName: "가상 검증 브랜드",
  industry: "교육",
  introduction: "가상 fixture",
  published: true,
  contactName: "QA 담당자",
  contactEmail: "qa@example.test",
  contactVisibility: "private",
};
describe("brand public and private boundary", () => {
  it("accepts a brand without business registration and private optional contacts", () => {
    expect(
      brandAccountSchema.safeParse({
        ...fixture,
        contactName: "",
        contactEmail: "",
      }).success,
    ).toBe(true);
  });
  it("requires explicit valid contact details for collaborator sharing", () => {
    expect(
      brandAccountSchema.safeParse({
        ...fixture,
        contactVisibility: "collaborators",
        contactEmail: "",
      }).success,
    ).toBe(false);
    expect(
      brandAccountSchema.safeParse({
        ...fixture,
        contactVisibility: "collaborators",
      }).success,
    ).toBe(true);
  });
  it.each([
    { logoUploadId: "https://evil.example/logo" },
    { owner_id: "someone" },
    { businessVerified: true },
  ])("rejects unsupported identity or upload fields %j", (extra) => {
    expect(brandAccountSchema.safeParse({ ...fixture, ...extra }).success).toBe(
      false,
    );
  });
  it("projects only allowlisted public fields and does not expose a hidden brand", () => {
    const row = {
      id: "fixture",
      brand_name: "QA",
      industry: "교육",
      introduction: "fixture",
      published: true,
      owner_id: "private",
      contact_email: "private@example.test",
      internal: "private",
    };
    expect(publicBrandDTO(row)).toEqual({
      version: 1,
      id: "fixture",
      brandName: "QA",
      industry: "교육",
      introduction: "fixture",
      logo: null,
    });
    expect(publicBrandDTO({ ...row, published: false })).toBeNull();
  });
});
