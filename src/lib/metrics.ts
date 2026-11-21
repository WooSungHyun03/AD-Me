import { z } from "zod";
import { safeHttpsLink } from "./social-links";
const at = z.iso.datetime({ offset: true }),
  url = z
    .string()
    .max(2000)
    .refine((v) => !!safeHttpsLink(v));
export const metricPointSchema = z
  .strictObject({
    name: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
    value: z.number().finite().nonnegative().nullable(),
    unit: z.enum(["count", "percent", "ratio"]),
    observedAt: at,
    collectedAt: at,
    sourceUrl: url,
    policyVersion: z.string().min(1).max(80),
    kind: z.enum(["original", "derived"]),
    formula: z.string().min(1).max(500).nullable(),
    sampleSize: z.number().int().positive().nullable(),
    periodStart: at.nullable(),
    periodEnd: at.nullable(),
  })
  .superRefine((v, c) => {
    if (
      (v.unit === "count" &&
        v.value !== null &&
        !Number.isSafeInteger(v.value)) ||
      (v.unit === "percent" && v.value !== null && v.value > 100) ||
      (v.periodStart === null) !== (v.periodEnd === null) ||
      (v.periodStart &&
        v.periodEnd &&
        Date.parse(v.periodStart) > Date.parse(v.periodEnd)) ||
      (v.kind === "derived" &&
        v.periodEnd !== null &&
        Date.parse(v.periodEnd) > Date.parse(v.observedAt)) ||
      (v.kind === "derived" && (!v.formula || !v.sampleSize || !v.periodStart))
    )
      c.addIssue({ code: "custom", message: "Invalid metric metadata" });
  });
export const metricHistorySchema = z.strictObject({
  version: z.literal(1),
  creatorId: z.string().min(1).max(100),
  days: z.number().int().min(1).max(90),
  asOf: at,
  truncated: z.boolean(),
  identities: z
    .array(
      z
        .strictObject({
          id: z.uuid(),
          provider: z.enum(["youtube", "instagram", "tiktok", "approved_web"]),
          displayName: z.string().min(1).max(160),
          canonicalUrl: url,
          isDemo: z.boolean(),
          sourceType: z.enum([
            "official_api",
            "owner_submission",
            "approved_web",
            "synthetic_demo",
          ]),
          policyVersion: z.string().min(1).max(80),
          ttlSeconds: z.number().int().min(60).max(2592000),
          historyWindowSeconds: z.number().int().min(3600).max(2592000),
          points: z.array(metricPointSchema).max(200),
          pointsTruncated: z.boolean(),
        })
        .superRefine((i, c) => {
          if (
            i.provider === "youtube" &&
            i.points.some((p) => p.kind === "derived")
          )
            c.addIssue({
              code: "custom",
              message: "YouTube derived metrics unavailable",
            });
        }),
    )
    .max(10),
});
export type MetricPoint = z.infer<typeof metricPointSchema>;
export const metricLabels: Record<string, string> = {
  followers: "팔로워",
  subscriber_count: "구독자",
  subscribers: "구독자",
  views: "조회 수",
  view_count: "조회 수",
  video_count: "영상 수",
  likes: "좋아요",
  like_count: "좋아요",
  comments: "댓글",
  comment_count: "댓글",
  engagement_rate: "참여율",
};
export function metricSeries(
  points: MetricPoint[],
  ttlSeconds: number,
  asOf: string,
) {
  const groups = new Map<string, MetricPoint[]>();
  for (const p of points) {
    const key = `${p.name}:${p.kind}:${p.unit}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups].map(([key, list]) => {
    const ordered = list.toSorted(
      (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt),
    );
    const segments: MetricPoint[][] = [];
    let current: MetricPoint[] = [];
    for (const p of ordered) {
      if (
        p.value === null ||
        (current.length &&
          Date.parse(p.observedAt) - Date.parse(current.at(-1)!.observedAt) >
            ttlSeconds * 1000)
      ) {
        if (current.length) segments.push(current);
        current = [];
      }
      if (p.value !== null) current.push(p);
    }
    if (current.length) segments.push(current);
    const latest = ordered.at(-1)!;
    return {
      key,
      name: latest.name,
      kind: latest.kind,
      unit: latest.unit,
      points: ordered,
      segments,
      latest,
      availableCount: ordered.filter((p) => p.value !== null).length,
      stale:
        Date.parse(asOf) - Date.parse(latest.observedAt) > ttlSeconds * 1000,
    };
  });
}
