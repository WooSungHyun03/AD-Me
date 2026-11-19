import { expect, it } from "vitest";
import {
  creatorIdentitySchema,
  creatorPublicIdentity,
  metricObservationSchema,
  providerKeySchema,
} from "@/lib/ingestion/creator-contract";

const fixture = creatorIdentitySchema.parse({
  id: "34102fbe-b278-41d2-8f57-0542ed4783fd",
  provider: "youtube",
  externalId: "fixture-id",
  handle: "old",
  displayName: "계약 테스트",
  canonicalUrl: "https://www.youtube.com/@fixture",
  observedAt: "2026-11-19T00:00:00Z",
  claimStatus: "claimed",
  ownerId: "6d92f9ff-b84b-462b-9152-4f9bc87a0da8",
  ownerConsent: true,
  publicationStatus: "published",
  moderationStatus: "allowed",
  isDemo: false,
});

it("keeps the provider key stable when a handle changes", () => {
  expect(providerKeySchema.parse(fixture)).toEqual(
    providerKeySchema.parse({ ...fixture, handle: "new" }),
  );
});

it("keeps null separate from zero and omits private identity fields", () => {
  const input = {
    name: "followers",
    unit: "count",
    observedAt: fixture.observedAt,
    sourceUrl: fixture.canonicalUrl,
    policyVersion: "contract-fixture",
    kind: "original",
  };
  const metrics = [null, 0].map((value) =>
    metricObservationSchema.parse({ ...input, value }),
  );
  const published = creatorPublicIdentity(fixture, metrics);
  expect(published?.metrics.map((metric) => metric.value)).toEqual([null, 0]);
  expect(published?.canRequestCollaboration).toBe(true);
  expect(published).not.toHaveProperty("ownerId");
  expect(published).not.toHaveProperty("externalId");
  expect(published).not.toHaveProperty("ownerConsent");
});

it("rejects private or restricted identities and leaves demo collaboration off", () => {
  expect(
    creatorPublicIdentity({ ...fixture, publicationStatus: "private" }, []),
  ).toBeNull();
  expect(
    creatorPublicIdentity({ ...fixture, moderationStatus: "restricted" }, []),
  ).toBeNull();
  expect(
    creatorPublicIdentity({ ...fixture, isDemo: true }, [])
      ?.canRequestCollaboration,
  ).toBe(false);
  expect(
    creatorPublicIdentity({ ...fixture, claimStatus: "unclaimed" }, [])
      ?.canRequestCollaboration,
  ).toBe(false);
});
