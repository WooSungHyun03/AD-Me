import { expect, it } from "vitest";
import {
  campaignBriefTermsSchema,
  campaignBriefTermsStorageSchema,
  campaignTermsFromForm,
  utcToKstInput,
} from "@/lib/campaign-brief";
import { campaignSchema } from "@/lib/schemas";
const local = {
  version: 2,
  recruitment: { start: "2027-01-01T00:15", end: "2027-01-10T18:00" },
  production: { start: "2027-01-11T09:00", end: "2027-01-20T18:00" },
  posting: { start: "2027-01-21T09:00", end: "2027-02-01T18:00" },
  compensation: { mode: "unknown" },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "가상 채널에서30일",
      exclusivity: null,
    },
  ],
};
const legacy = {
  title: "가상 QA 캠페인",
  product: "가상 제품",
  category: "교육",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["instagram"],
  budget_krw: 100000,
  target_audience: "QA 성인",
  goal: "로컬 검증",
  status: "draft",
};
it("stores canonical UTC exactly once, restores KST, and keeps total budget distinct from unknown compensation", () => {
  const terms = campaignBriefTermsSchema.parse(local);
  expect(terms.recruitment.start).toBe("2026-12-31T15:15:00.000Z");
  expect(campaignBriefTermsStorageSchema.parse(terms)).toEqual(terms);
  expect(utcToKstInput(terms.recruitment.start)).toBe(local.recruitment.start);
  expect(campaignSchema.parse({ ...legacy, terms })).toMatchObject({
    budget_krw: 100000,
    terms: { compensation: { mode: "unknown" } },
  });
  expect(campaignSchema.parse(legacy)).not.toHaveProperty("terms");
  expect(campaignBriefTermsStorageSchema.safeParse(local).success).toBe(false);
});
it.each([
  "2027-02-30T09:00:00.000Z",
  "2027-01-01T24:00:00.000Z",
  "0000-01-01T00:00:00.000Z",
  "2027-01-01T00:00:30.000Z",
  "2027-01-01T00:00:00+09:00",
])("rejects noncanonical/invalid stored time %s", (start) => {
  const terms = campaignBriefTermsSchema.parse(local);
  expect(
    campaignBriefTermsStorageSchema.safeParse({
      ...terms,
      recruitment: { ...terms.recruitment, start },
    }).success,
  ).toBe(false);
});
it("does not silently strip unsupported terms fields or unknown-compensation cash", () => {
  const terms = campaignBriefTermsSchema.parse(local);
  for (const extra of [
    { ...terms, privateOwner: "x" },
    {
      ...terms,
      compensation: { mode: "unknown", cash: { minimumKrw: 0, maximumKrw: 0 } },
    },
    {
      ...terms,
      deliverables: [{ ...terms.deliverables[0], privateContact: "x" }],
    },
  ])
    expect(campaignBriefTermsStorageSchema.safeParse(extra).success).toBe(
      false,
    );
});
it("converts dynamic form rows and product-only/mixed/unknown without zero-filling blank amounts", () => {
  const form = new FormData();
  for (const key of ["recruitment", "production", "posting"] as const)
    for (const point of ["start", "end"] as const)
      form.set(`${key}_${point}`, local[key][point]);
  form.set("compensation_mode", "product");
  form.set("product_description", "가상 QA 제품");
  form.set("product_quantity", "2");
  for (let i = 0; i < 2; i++) {
    form.append("deliverable_format", "숏폼");
    form.append("deliverable_quantity", "1");
    form.append("deliverable_rights", "가상 권리 범위");
    form.append("deliverable_exclusivity", i ? "동종 제품7일" : "");
  }
  expect(campaignTermsFromForm(form)).toMatchObject({
    compensation: { mode: "declared", product: { quantity: 2 } },
    deliverables: [{ exclusivity: null }, { exclusivity: "동종 제품7일" }],
  });
  form.set("compensation_mode", "mixed");
  form.set("cash_min", "");
  form.set("cash_max", "10");
  expect(() => campaignTermsFromForm(form)).toThrow();
  form.set("cash_min", "0");
  form.set("cash_max", "0");
  expect(campaignTermsFromForm(form).compensation).toHaveProperty(
    "cash.minimumKrw",
    0,
  );
  form.set("compensation_mode", "unknown");
  expect(campaignTermsFromForm(form).compensation).toEqual({ mode: "unknown" });
});
