import { describe, expect, it } from "vitest";
import { assessPilot, type PilotSample } from "@/lib/pilot-quality";

const now = "2026-11-26T00:00:00.000Z";
let n = 0;
const sample = (over: Partial<PilotSample> = {}): PilotSample => ({
  ref: `ref${n}`,
  validId: true,
  titleHash: `t${n++}`,
  subscriberCount: 1000,
  videoCount: 5,
  hasViews: true,
  fetchedAt: "2026-11-25T00:00:00.000Z",
  expiresAt: "2026-12-20T00:00:00.000Z",
  policy: "youtube-v1",
  policyEnabled: true,
  policyIsolated: false,
  ownerVerified: false,
  tombstoned: false,
  ...over,
});
const approved = { approved: true, refreshDays: 30 };
const input = (samples: PilotSample[], activeTombstones = 0) => ({
  generatedAt: now,
  samples,
  activeTombstones,
});

describe("D024 pilot quality gate", () => {
  it("never counts isolated fixtures as pilot profiles", () => {
    const r = assessPilot(
      input(Array.from({ length: 60 }, () => sample({ policyIsolated: true }))),
      approved,
    );
    expect(r).toMatchObject({
      stored: 60,
      isolatedFixtures: 60,
      candidates: 0,
      passing: 0,
      failureRate: null,
      gate: "NOT_MET",
    });
    expect(r.samples).toEqual([]);
  });

  it("without an approved source only verified, consenting owners have a basis", () => {
    const r = assessPilot(input([sample(), sample({ ownerVerified: true })]), {
      approved: false,
      refreshDays: 30,
    });
    expect(r.samples.map((s) => [s.basis, s.issues])).toEqual([
      ["none", ["no_basis"]],
      ["owner", []],
    ]);
    expect(r.ownerVerified).toBe(1);
    expect(r.sourceApproved).toBe(false);
  });

  it("flags stale, missing, duplicate and deleted-but-stored samples", () => {
    const r = assessPilot(
      input([
        sample({ expiresAt: "2026-11-25T00:00:00.000Z" }),
        sample({ fetchedAt: "2026-10-01T00:00:00.000Z" }),
        sample({
          titleHash: null,
          subscriberCount: null,
          videoCount: 0,
          hasViews: false,
        }),
        sample({ titleHash: "same" }),
        sample({ titleHash: "same" }),
        sample({ tombstoned: true }),
        sample({ validId: false }),
      ]),
      approved,
    );
    expect(r.issues).toMatchObject({
      stale: 2,
      missing_title: 1,
      missing_subscribers: 1,
      missing_videos: 1,
      missing_views: 1,
      duplicate: 2,
      deleted_but_stored: 1,
      invalid_id: 1,
      no_basis: 0,
    });
    expect(r.passing).toBe(0);
    expect(r.failureRate).toBe(1);
  });

  it("treats a missing or unreadable cache timestamp as stale, never fresh", () => {
    const r = assessPilot(
      input([
        sample({ expiresAt: null }),
        sample({ expiresAt: "not-a-date" }),
        sample({ fetchedAt: "" }),
      ]),
      approved,
    );
    expect(r.samples.map((s) => s.issues)).toEqual([
      ["stale"],
      ["stale"],
      ["stale"],
    ]);
    expect(r.passing).toBe(0);
  });

  it("reports the counted number and meets the gate only at the minimum", () => {
    const pass49 = Array.from({ length: 49 }, () => sample());
    const below = assessPilot(
      input([...pass49, sample({ tombstoned: true })]),
      approved,
    );
    expect(below).toMatchObject({
      candidates: 50,
      passing: 49,
      gate: "NOT_MET",
    });
    expect(below.failureRate).toBe(0.02);
    const met = assessPilot(input([...pass49, sample()]), approved);
    expect(met).toMatchObject({ passing: 50, gate: "MET" });
  });

  it("exposes only opaque refs per sample, never title hashes", () => {
    const r = assessPilot(
      input([sample({ titleHash: "secret-title-hash" })]),
      approved,
    );
    expect(JSON.stringify(r)).not.toContain("secret-title-hash");
    expect(Object.keys(r.samples[0])).toEqual(["ref", "basis", "issues"]);
  });
});
