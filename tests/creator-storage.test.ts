import { expect, it, vi } from "vitest";
import creators from "../fixtures/creators.demo.json";
import {
  creatorIdentitySnapshotSchema,
  legacyCreatorCompatibility,
  readOwnCreatorIdentitySnapshot,
} from "@/lib/ingestion/creator-storage";
import { creatorPublicIdentity } from "@/lib/ingestion/creator-contract";

const snapshot = () => ({
  version: 1,
  creatorId: "34102fbe-b278-41d2-8f57-0542ed4783fd",
  legacyCreatorId: creators[0].seed_id,
  legacyProfile: structuredClone(creators[0]),
  identities: [
    {
      identity: {
        id: "6d92f9ff-b84b-462b-9152-4f9bc87a0da8",
        provider: "youtube",
        externalId: "fictional-qa-only",
        handle: "mutable-handle",
        displayName: "가상 QA",
        canonicalUrl: "https://example.org/fictional",
        observedAt: "2026-11-20T00:00:00+00:00",
        claimStatus: "unclaimed",
        ownerId: null,
        ownerConsent: false,
        publicationStatus: "private",
        moderationStatus: "allowed",
        isDemo: true,
      },
      sourceType: "synthetic_demo",
      policyVersion: "local-fixture-not-approved",
      collectedAt: "2026-11-20T00:01:00+00:00",
      metrics: [null, 0].map((value) => ({
        name: "followers",
        value,
        unit: "count",
        observedAt: "2026-11-20T00:00:00Z",
        sourceUrl: "https://example.org/fictional",
        policyVersion: "local-fixture-not-approved",
        kind: "original",
      })),
      metricsTruncated: false,
    },
  ],
  identitiesTruncated: false,
});

it("preserves every field of all 48 legacy profiles without inventing provider identities", () => {
  for (const profile of creators) {
    const parsed = creatorIdentitySnapshotSchema.parse({
      ...snapshot(),
      legacyProfile: profile,
      identities: [],
    });
    const adapter = legacyCreatorCompatibility(parsed);
    expect(adapter.profile).toEqual(profile);
    expect(adapter.normalized).toEqual([]);
    expect(adapter.truncated).toBe(false);
  }
});

it("preserves missing versus zero observations without substituting legacy follower counts", () => {
  const parsed = creatorIdentitySnapshotSchema.parse(snapshot());
  const adapter = legacyCreatorCompatibility(parsed);
  expect(adapter.normalized[0].metrics.map((m) => m.value)).toEqual([null, 0]);
  expect(adapter.profile.followers).toBe(2500);
  adapter.profile.followers = 123;
  expect(parsed.legacyProfile.followers).toBe(2500);
  expect(
    creatorPublicIdentity(
      parsed.identities[0].identity,
      parsed.identities[0].metrics,
    ),
  ).toBeNull();
});

it("rejects non-finite, negative, imprecise count and out-of-range percent metrics", () => {
  for (const [value, unit] of [
    [NaN, "count"],
    [Infinity, "ratio"],
    [-1, "count"],
    [0.5, "count"],
    [2 ** 53, "count"],
    [101, "percent"],
  ] as const) {
    const body = snapshot();
    body.identities[0].metrics[0] = {
      ...body.identities[0].metrics[0],
      value,
      unit,
    };
    expect(creatorIdentitySnapshotSchema.safeParse(body).success).toBe(false);
  }
});

it("fails closed on fabricated provenance, ownership, duplicate identities and private payload keys", () => {
  const mutations = [
    (s: ReturnType<typeof snapshot>) => {
      s.identities[0].sourceType = "official_api";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.identities[0].identity.publicationStatus = "published";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.identities[0].identity.claimStatus = "claimed";
    },
    (s: ReturnType<typeof snapshot>) => {
      s.identities.push(structuredClone(s.identities[0]));
    },
  ];
  for (const mutate of mutations) {
    const body = snapshot();
    mutate(body);
    expect(creatorIdentitySnapshotSchema.safeParse(body).success).toBe(false);
  }
  const body = snapshot();
  expect(
    creatorIdentitySnapshotSchema.safeParse({ ...body, token: "unexpected" })
      .success,
  ).toBe(false);
  expect(
    creatorIdentitySnapshotSchema.safeParse({
      ...body,
      identities: [{ ...body.identities[0], token: "unexpected" }],
    }).success,
  ).toBe(false);
});

it("surfaces bounded history as truncated rather than claiming a complete timeline", () => {
  const body = snapshot();
  body.identities[0].metricsTruncated = true;
  expect(
    legacyCreatorCompatibility(creatorIdentitySnapshotSchema.parse(body))
      .truncated,
  ).toBe(true);
});

it("queries only the owner-scoped RPC and never falls back to demo data on failure", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: snapshot(), error: null });
  expect((await readOwnCreatorIdentitySnapshot({ rpc }))?.version).toBe(1);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("my_creator_identity_snapshot");
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await readOwnCreatorIdentitySnapshot({ rpc })).toBeNull();
  rpc.mockResolvedValue({
    data: null,
    error: { message: "PRIVATE_DATABASE_DETAIL" },
  });
  await expect(readOwnCreatorIdentitySnapshot({ rpc })).rejects.toThrow(
    "크리에이터 식별 정보를 불러오지 못했습니다.",
  );
  rpc.mockResolvedValue({ data: { private: "bad-shape" }, error: null });
  await expect(readOwnCreatorIdentitySnapshot({ rpc })).rejects.toThrow("형식");
});
