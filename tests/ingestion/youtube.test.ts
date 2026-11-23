import { describe, it, expect, vi } from "vitest";
import fixture from "./fixtures/youtube.json";
import { fetchChannels, YouTubeError } from "../../src/lib/ingestion/youtube";
import { policies, type SourcePolicy } from "../../src/lib/ingestion/policy";

const approved: Record<string, SourcePolicy> = {
  ...policies,
  youtube_data_api: {
    ...policies.youtube_data_api,
    status: "approved",
    reviewer: "test",
    terms_version: "test-fixture",
  },
};
const VISIBLE = "UCaaaaaaaaaaaaaaaaaaaaaa";
const HIDDEN = "UCbbbbbbbbbbbbbbbbbbbbbb";
const GONE = "UCcccccccccccccccccccccc";
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });
const err = (status: number, reason: string) =>
  new Response(JSON.stringify({ error: { errors: [{ reason }] } }), { status });
function fakeFetch() {
  return vi.fn(async (u: URL | RequestInfo) => {
    const path = new URL(String(u)).pathname.split("/").pop()!;
    return ok((fixture as Record<string, unknown>)[path]);
  });
}

describe("D019 YouTube adapter contract", () => {
  it("is blocked by policy before any fetch while the source is pending", async () => {
    const f = fakeFetch();
    await expect(
      fetchChannels([VISIBLE], { apiKey: "k", fetchImpl: f }),
    ).rejects.toThrow("승인되지");
    expect(f).not.toHaveBeenCalled();
  });
  it("requires a server key and valid channel IDs", async () => {
    const f = fakeFetch();
    await expect(
      fetchChannels([VISIBLE], {
        apiKey: "",
        fetchImpl: f,
        policyTable: approved,
      }),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      fetchChannels(["@handle"], {
        apiKey: "k",
        fetchImpl: f,
        policyTable: approved,
      }),
    ).rejects.toMatchObject({ kind: "bad_request" });
    expect(f).not.toHaveBeenCalled();
  });
  it("maps provided fields, keeps hidden counts null and marks missing channels not_found", async () => {
    const f = fakeFetch();
    const r = await fetchChannels([VISIBLE, HIDDEN, GONE, VISIBLE], {
      apiKey: "k",
      fetchImpl: f,
      policyTable: approved,
    });
    expect(r.map((x) => x.status)).toEqual(["ok", "ok", "not_found"]);
    const [v, h] = r as Extract<(typeof r)[number], { status: "ok" }>[];
    expect(v.profile).toMatchObject({
      subscriber_count: 345,
      view_count: 1200,
      hidden_subscriber_count: false,
    });
    expect(v.source_url).toBe(`https://www.youtube.com/channel/${VISIBLE}`);
    expect(h.profile).toMatchObject({
      subscriber_count: null,
      hidden_subscriber_count: true,
    });
    expect(h.videos).toEqual([]);
    expect(v.videos[1]).toMatchObject({
      video_view_count: 50,
      video_like_count: null,
      video_comment_count: null,
    });
    // Only cheap endpoints, never search.list; the key is sent server-side only.
    const paths = f.mock.calls.map(([u]) =>
      new URL(String(u)).pathname.split("/").pop(),
    );
    expect(paths).not.toContain("search");
    expect(new Set(paths)).toEqual(
      new Set(["channels", "playlistItems", "videos"]),
    );
  });
  it("distinguishes quota, rate limit and key errors", async () => {
    for (const [status, reason, kind] of [
      [403, "quotaExceeded", "quota"],
      [403, "rateLimitExceeded", "rate"],
      [429, "", "rate"],
      [403, "forbidden", "auth"],
      [500, "backendError", "upstream"],
    ] as const) {
      const f = vi.fn(async () => err(status, reason));
      const e = await fetchChannels([VISIBLE], {
        apiKey: "k",
        fetchImpl: f,
        policyTable: approved,
      }).catch((x) => x);
      expect(e).toBeInstanceOf(YouTubeError);
      expect(e.kind).toBe(kind);
    }
  });
});
