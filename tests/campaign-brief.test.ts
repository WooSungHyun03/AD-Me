import { expect, it } from "vitest";
import { campaignBriefTermsSchema } from "@/lib/campaign-brief";

const fixture = {
  version: 2,
  recruitment: { start: "2026-11-19T00:15", end: "2026-11-20T20:00" },
  production: { start: "2026-11-20T08:00", end: "2026-11-25T20:00" },
  posting: { start: "2026-11-25T21:00", end: "2026-12-01T00:00" },
  compensation: {
    mode: "declared",
    cash: { minimumKrw: 10000, maximumKrw: 20000 },
  },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "캠페인 채널 30일",
      exclusivity: null,
    },
  ],
};

it("converts KST midnight to the previous UTC date and permits adjacent phases to overlap", () => {
  expect(campaignBriefTermsSchema.parse(fixture).recruitment.start).toBe(
    "2026-11-18T15:15:00.000Z",
  );
});

it.each([
  { recruitment: { start: "2026-02-30T09:00", end: "2026-03-10T18:00" } },
  { posting: { start: "2026-11-18T00:00", end: "2026-11-20T20:00" } },
  {
    compensation: {
      mode: "declared",
      cash: { minimumKrw: -1, maximumKrw: 10 },
    },
  },
  {
    compensation: { mode: "declared", cash: { minimumKrw: 5, maximumKrw: 3 } },
  },
  {
    compensation: {
      mode: "declared",
      cash: { minimumKrw: 1.5, maximumKrw: 4 },
    },
  },
  { deliverables: [] },
])("rejects malformed terms %j", (override) => {
  expect(
    campaignBriefTermsSchema.safeParse({ ...fixture, ...override }).success,
  ).toBe(false);
});

it("keeps unknown compensation and product-only offers as separate valid inputs", () => {
  expect(
    campaignBriefTermsSchema.safeParse({
      ...fixture,
      compensation: { mode: "unknown" },
    }).success,
  ).toBe(true);
  expect(
    campaignBriefTermsSchema.safeParse({
      ...fixture,
      compensation: {
        mode: "declared",
        product: { description: "검증용 제품", quantity: 1 },
      },
    }).success,
  ).toBe(true);
});
