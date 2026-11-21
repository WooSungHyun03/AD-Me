import { expect, it } from "vitest";
import {
  metricPointSchema,
  metricSeries,
  metricHistorySchema,
  type MetricPoint,
} from "@/lib/metrics";
import {
  emptyCreatorFilters,
  creatorFilterIssues,
  filterCreators,
} from "@/lib/creator-filters";
import { creators } from "@/lib/catalog";
const p = (value: number | null, hour: number): MetricPoint => ({
  name: "views",
  value,
  unit: "count",
  observedAt: `2026-11-20T${String(hour).padStart(2, "0")}:00:00Z`,
  collectedAt: "2026-11-20T23:00:00Z",
  sourceUrl: "https://example.test/fictional",
  policyVersion: "fixture",
  kind: "original",
  formula: null,
  sampleSize: null,
  periodStart: null,
  periodEnd: null,
});
it("keeps actual zero, breaks null and delayed intervals, marks stale independently of historical values", () => {
  const s = metricSeries(
    [p(8, 8), p(0, 0), p(null, 1), p(3, 2)],
    3600,
    "2026-11-21T08:00:00Z",
  )[0];
  expect(s.points.map((p) => p.value)).toEqual([0, null, 3, 8]);
  expect(s.segments.map((s) => s.map((p) => p.value))).toEqual([[0], [3], [8]]);
  expect(s.stale).toBe(true);
  expect(s.availableCount).toBe(3);
});
it("rejects unsupported values and derived metrics without disclosed formula/sample/period", () => {
  for (const value of [NaN, Infinity, -1, 0.5])
    expect(metricPointSchema.safeParse(p(value, 0)).success).toBe(false);
  expect(
    metricPointSchema.safeParse({ ...p(3, 0), kind: "derived" }).success,
  ).toBe(false);
  expect(
    metricPointSchema.safeParse({ ...p(101, 0), unit: "percent" }).success,
  ).toBe(false);
  expect(metricHistorySchema.safeParse({ owner_id: "private" }).success).toBe(
    false,
  );
});
it("rejects a derived period that ends after its observation", () => {
  expect(
    metricPointSchema.safeParse({
      ...p(1, 0),
      kind: "derived",
      formula: "fixture ratio",
      sampleSize: 2,
      periodStart: "2026-11-19T00:00:00Z",
      periodEnd: "2026-11-21T00:00:00Z",
    }).success,
  ).toBe(false);
});
it("permissionless keyless fixtures do not pass an explicit zero engagement threshold", () => {
  const f = { ...emptyCreatorFilters(), minEngagement: "0" };
  expect(creatorFilterIssues(f)).toEqual([]);
  expect(filterCreators(creators, f)).toEqual([]);
  expect(creatorFilterIssues({ ...f, minEngagement: "101" })).toHaveLength(1);
});
