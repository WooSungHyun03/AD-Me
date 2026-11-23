import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { consentFieldsSchema, policyDocument } from "@/lib/consent";
import { safeMetricName, safePublicText } from "@/lib/sensitive-data";
import { brandAccountSchema } from "@/lib/brand-profile";
import {
  metricObservationSchema,
  creatorIdentitySchema,
} from "@/lib/ingestion/creator-contract";
it("binds the exact disclosed document to unselected separate required checks and rejects stale versions", () => {
  expect(
    createHash("sha256")
      .update(JSON.stringify(policyDocument.content))
      .digest("hex"),
  ).toBe(policyDocument.documentHash);
  const fields = {
    policyVersion: policyDocument.version,
    policyHash: policyDocument.documentHash,
    termsAccepted: "on",
    privacyAccepted: "on",
    adultConfirmed: "on",
  };
  expect(consentFieldsSchema.safeParse(fields).success).toBe(true);
  for (const field of Object.keys(fields))
    expect(
      consentFieldsSchema.safeParse({ ...fields, [field]: "" }).success,
    ).toBe(false);
  expect(
    consentFieldsSchema.safeParse({ ...fields, policyVersion: "older" })
      .success,
  ).toBe(false);
});
it("excludes structured sensitive inference and obvious contacts while retaining ordinary public text and metrics", () => {
  const brand = {
    brandName: "가상 브랜드",
    industry: "가상 업종",
    introduction: "가상 검증 소개",
    published: true,
    contactName: "가상 담당",
    contactEmail: "person@example.test",
    contactVisibility: "private",
  };
  expect(brandAccountSchema.safeParse(brand).success).toBe(true);
  expect(
    brandAccountSchema.safeParse({
      ...brand,
      introduction: "person@example.test",
    }).success,
  ).toBe(false);
  for (const s of [
    "가상 번호 900101-1234567",
    "０１０－１２３４－５６７８",
    "person@example.test",
    "010 123 4567",
  ])
    expect(safePublicText(s)).toBe(false);
  expect(safePublicText("가상 뷰티 크리에이터입니다.")).toBe(true);
  for (const name of [
    "face_embedding",
    "health_status",
    "political_affiliation",
    "age_estimate",
    "email",
  ])
    expect(safeMetricName(name)).toBe(false);
  expect(safeMetricName("engagement_rate")).toBe(true);
  const metric = {
    name: "view_count",
    value: 0,
    unit: "count",
    observedAt: "2026-11-21T00:00:00Z",
    sourceUrl: "https://www.youtube.com/channel/fixture",
    policyVersion: "fictional",
    kind: "original",
  };
  expect(metricObservationSchema.safeParse(metric).success).toBe(true);
  expect(
    metricObservationSchema.safeParse({ ...metric, faceEmbedding: [1, 2] })
      .success,
  ).toBe(false);
  const identity = {
    id: "00000000-0000-4000-8000-000000000001",
    provider: "youtube",
    externalId: "fictional",
    handle: null,
    displayName: "가상 계약",
    canonicalUrl: "https://www.youtube.com/@fixture",
    observedAt: "2026-11-21T00:00:00Z",
    claimStatus: "unclaimed",
    ownerId: null,
    ownerConsent: false,
    publicationStatus: "private",
    moderationStatus: "allowed",
    isDemo: false,
  };
  expect(creatorIdentitySchema.safeParse(identity).success).toBe(true);
  expect(
    creatorIdentitySchema.safeParse({ ...identity, faceEmbedding: [1] })
      .success,
  ).toBe(false);
});
