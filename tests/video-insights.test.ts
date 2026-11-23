import { describe, expect, it } from "vitest";
import {
  averageVideoViews,
  parseVideoWindow,
  selectVideoWindow,
  viewChange,
} from "../src/lib/video-insights";
import { publishedTopicMatch } from "../src/lib/public-youtube-topics";

const asOf = Date.parse("2026-11-23T02:00:00Z");
const authorized = {
  kind: "creator_reported" as const,
  label: "소유자가 제공한 테스트 자료",
  authorizationRef: "QA-fixture",
};
const raw = { kind: "youtube_raw" as const, label: "YouTube Data API" };
const videos = [
  {
    id: "a",
    publishedAt: "2026-11-23T01:00:00Z",
    views: 10,
    format: "short" as const,
  },
  {
    id: "a",
    publishedAt: "2026-11-22T00:00:00Z",
    views: 99,
    format: "short" as const,
  },
  {
    id: "b",
    publishedAt: "2026-11-21T00:00:00Z",
    views: 0,
    format: "long" as const,
  },
  { id: "c", publishedAt: "2026-11-05T00:00:00Z", views: 30 },
  { id: "d", publishedAt: "2026-11-23T01:30:00Z", views: null },
  { id: "future", publishedAt: "2026-11-24T00:00:00Z", views: 1000 },
];

describe("video analytics", () => {
  it("keeps raw YouTube filtering available without calculating derived statistics", () => {
    expect(
      selectVideoWindow(videos, { days: 7 }, asOf).map((v) => v.id),
    ).toEqual(["d", "a", "b"]);
    expect(averageVideoViews(raw, videos, { days: 30 }, asOf)).toBeNull();
    expect(viewChange(raw, [{ id: "a", first: 20, last: 30 }])).toBeNull();
    expect(
      averageVideoViews(
        { ...authorized, authorizationRef: "" },
        videos,
        { days: 30 },
        asOf,
      ),
    ).toBeNull();
  });
  it("uses only known, uniquely identified observations and keeps zero", () => {
    expect(
      averageVideoViews(authorized, videos, { days: 7 }, asOf),
    ).toMatchObject({ average: 5, sampleSize: 2, missing: 1 });
    expect(
      averageVideoViews(authorized, videos, { days: 30 }, asOf)?.average,
    ).toEqual(40 / 3);
    expect(
      averageVideoViews(authorized, videos, { latest: 10 }, asOf, "short"),
    ).toMatchObject({ average: 10, sampleSize: 1 });
    expect(averageVideoViews(authorized, [], { days: 90 }, asOf)).toMatchObject(
      { average: null, sampleSize: 0 },
    );
    expect(parseVideoWindow("60")).toBeUndefined();
  });
  it("computes changes only for paired snapshots and distinguishes missing pairs", () => {
    expect(
      viewChange(authorized, [
        { id: "a", first: 20, last: 30 },
        { id: "a", first: 20, last: 30 },
        { id: "b", first: 100, last: 98 },
      ]),
    ).toMatchObject({ difference: 8, sampleSize: 2 });
    expect(viewChange(authorized, [])).toMatchObject({
      difference: null,
      sampleSize: 0,
    });
  });
  it("filters published YouTube topic labels without inferring creator traits", () => {
    expect(
      publishedTopicMatch(["https://en.wikipedia.org/wiki/Food"], "음식"),
    ).toBe(true);
    expect(
      publishedTopicMatch(["https://en.wikipedia.org/wiki/Food"], "테크·게임"),
    ).toBe(false);
  });
});
