export type InsightWindow = { days: 7 | 30 | 90 } | { latest: 10 | 20 };
export type AnalyticsSource =
  | { kind: "youtube_raw"; label: string }
  | {
      kind: "licensed" | "creator_reported" | "youtube_analytics";
      label: string;
      authorizationRef: string;
    };
type Video = {
  id: string;
  publishedAt: string;
  views?: number | null;
  format?: "short" | "long";
};
type SnapshotPair = { id: string; first: number; last: number };

const day = 86_400_000;
const validCount = (value: number | undefined | null): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function insightAvailable(source: AnalyticsSource) {
  return (
    source.kind !== "youtube_raw" &&
    Boolean(source.authorizationRef.trim() && source.label.trim())
  );
}

export function selectVideoWindow<
  T extends { id: string; publishedAt: string },
>(videos: readonly T[], window: InsightWindow, asOf: number): T[] {
  const start = "days" in window ? asOf - day * window.days : -Infinity;
  const ordered = videos
    .flatMap((video) => {
      const published = Date.parse(video.publishedAt);
      return published >= start && published <= asOf
        ? [{ video, published }]
        : [];
    })
    .sort(
      (a, b) =>
        b.published - a.published || a.video.id.localeCompare(b.video.id),
    );
  const seen = new Set<string>();
  const unique = ordered.flatMap(({ video }) => {
    if (seen.has(video.id)) return [];
    seen.add(video.id);
    return [video];
  });
  return "latest" in window ? unique.slice(0, window.latest) : unique;
}

export function averageVideoViews(
  source: AnalyticsSource,
  videos: readonly Video[],
  window: InsightWindow,
  asOf: number,
  format?: Video["format"],
) {
  if (!insightAvailable(source)) return null;
  const selected = selectVideoWindow(
    format ? videos.filter((v) => v.format === format) : videos,
    window,
    asOf,
  );
  const samples = selected.flatMap((v) =>
    validCount(v.views) ? [v.views] : [],
  );
  return {
    average: samples.length
      ? samples.reduce((sum, n) => sum + n, 0) / samples.length
      : null,
    sampleSize: samples.length,
    missing: selected.length - samples.length,
    window,
    asOf,
    source: source.label,
    shorts: format ?? "구분 가능한 영상만 형식별 집계",
  };
}

export function viewChange(
  source: AnalyticsSource,
  pairs: readonly SnapshotPair[],
) {
  if (!insightAvailable(source)) return null;
  const seen = new Set<string>();
  let total = 0;
  for (const pair of pairs) {
    if (seen.has(pair.id) || !validCount(pair.first) || !validCount(pair.last))
      continue;
    seen.add(pair.id);
    total += pair.last - pair.first;
  }
  return {
    difference: seen.size ? total : null,
    sampleSize: seen.size,
    source: source.label,
  };
}

export function parseVideoWindow(
  value: string | string[] | undefined,
): InsightWindow | undefined {
  if (value === "7") return { days: 7 };
  if (value === "30") return { days: 30 };
  if (value === "90") return { days: 90 };
  if (value === "latest-10") return { latest: 10 };
  if (value === "latest-20") return { latest: 20 };
}
