// D024: real-data pilot quality gate. Pure assessment of the facts returned by the service-role
// RPC public.pilot_quality_samples(). Isolated fixtures never count as pilot profiles, and the gate
// reports the counted number as-is: it is "MET" only when at least the target minimum passes.
// No imports so the CLI (scripts/pilot-quality-report.mjs) can load this file with Node type stripping.

export type PilotSample = {
  ref: string;
  validId: boolean;
  titleHash: string | null;
  subscriberCount: number | null;
  videoCount: number;
  hasViews: boolean;
  fetchedAt: string;
  expiresAt: string;
  policy: string | null;
  policyEnabled: boolean;
  policyIsolated: boolean;
  ownerVerified: boolean;
  tombstoned: boolean;
};
export type PilotInput = {
  generatedAt: string;
  samples: PilotSample[];
  activeTombstones: number;
};
export type PilotIssue =
  | "invalid_id"
  | "no_basis"
  | "stale"
  | "missing_title"
  | "missing_subscribers"
  | "missing_videos"
  | "missing_views"
  | "duplicate"
  | "deleted_but_stored";
export type SourceApproval = {
  approved: boolean; // assertSourceAllowed("youtube_data_api") passed (U001)
  refreshDays: number | null;
};
export type PilotReport = {
  generatedAt: string;
  target: { min: number; max: number };
  stored: number;
  isolatedFixtures: number;
  candidates: number;
  passing: number;
  ownerVerified: number;
  failureRate: number | null;
  issues: Record<PilotIssue, number>;
  activeTombstones: number;
  sourceApproved: boolean;
  gate: "MET" | "NOT_MET";
  samples: {
    ref: string;
    basis: "source" | "owner" | "none";
    issues: PilotIssue[];
  }[];
};

const DAY = 86_400_000;
const ISSUES: PilotIssue[] = [
  "invalid_id",
  "no_basis",
  "stale",
  "missing_title",
  "missing_subscribers",
  "missing_videos",
  "missing_views",
  "duplicate",
  "deleted_but_stored",
];

export function assessPilot(
  input: PilotInput,
  source: SourceApproval,
  target = { min: 50, max: 100 },
): PilotReport {
  const now = Date.parse(input.generatedAt);
  // Isolated QA policies (review_ref "ISOLATED…") are fixtures, never pilot evidence.
  const real = input.samples.filter((s) => !s.policyIsolated);
  const titles = new Map<string, number>();
  for (const s of real)
    if (s.titleHash)
      titles.set(s.titleHash, (titles.get(s.titleHash) ?? 0) + 1);
  const issues = Object.fromEntries(ISSUES.map((i) => [i, 0])) as Record<
    PilotIssue,
    number
  >;
  const samples = real.map((s) => {
    const basis: "source" | "owner" | "none" = s.ownerVerified
      ? "owner"
      : source.approved && s.policyEnabled
        ? "source"
        : "none";
    const found: PilotIssue[] = [];
    if (!s.validId) found.push("invalid_id");
    if (basis === "none") found.push("no_basis");
    const age = now - Date.parse(s.fetchedAt);
    if (
      Date.parse(s.expiresAt) <= now ||
      (source.refreshDays !== null && age > source.refreshDays * DAY)
    )
      found.push("stale");
    if (!s.titleHash) found.push("missing_title");
    if (s.subscriberCount === null) found.push("missing_subscribers");
    if (s.videoCount === 0) found.push("missing_videos");
    if (!s.hasViews) found.push("missing_views");
    if (s.titleHash && (titles.get(s.titleHash) ?? 0) > 1)
      found.push("duplicate");
    if (s.tombstoned) found.push("deleted_but_stored");
    for (const i of found) issues[i] += 1;
    return { ref: s.ref, basis, issues: found };
  });
  const passing = samples.filter((s) => s.issues.length === 0).length;
  return {
    generatedAt: input.generatedAt,
    target,
    stored: input.samples.length,
    isolatedFixtures: input.samples.length - real.length,
    candidates: real.length,
    passing,
    ownerVerified: samples.filter((s) => s.basis === "owner").length,
    failureRate: real.length
      ? Math.round(((real.length - passing) / real.length) * 1000) / 1000
      : null,
    issues,
    activeTombstones: input.activeTombstones,
    sourceApproved: source.approved,
    gate: passing >= target.min ? "MET" : "NOT_MET",
    samples,
  };
}
