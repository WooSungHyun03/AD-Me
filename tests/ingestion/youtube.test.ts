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
  it("rejects a malformed hidden-subscriber flag instead of treating it as public", async () => {
    const f = vi.fn(async () =>
      ok({
        items: fixture.channels.items.map((c) => ({
          ...c,
          statistics: { ...c.statistics, hiddenSubscriberCount: "true" },
        })),
      }),
    );
    await expect(
      fetchChannels([VISIBLE, HIDDEN], {
        apiKey: "fictional",
        fetchImpl: f,
        policyTable: approved,
      }),
    ).rejects.toMatchObject({ kind: "upstream" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  const run = (f: typeof fetch, extra: Record<string, unknown> = {}) =>
    fetchChannels([VISIBLE, HIDDEN], {
      apiKey: "fictional-key",
      fetchImpl: f,
      policyTable: approved,
      ...extra,
    });
  it.each([-1, 1.5, 51, NaN, Infinity])(
    "rejects invalid video limit %s before fetch",
    async (maxVideos) => {
      const f = fakeFetch();
      await expect(run(f, { maxVideos })).rejects.toMatchObject({
        kind: "bad_request",
      });
      expect(f).not.toHaveBeenCalled();
    },
  );
  it("bounds seeds and supports empty/metadata-only reads without follow-up spend", async () => {
    const f = fakeFetch();
    await expect(
      fetchChannels(Array(26).fill(VISIBLE), {
        apiKey: "fictional",
        fetchImpl: f,
        policyTable: approved,
      }),
    ).rejects.toMatchObject({ kind: "bad_request" });
    expect(
      await fetchChannels([], {
        apiKey: "",
        fetchImpl: f,
        policyTable: approved,
      }),
    ).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    const result = await run(f, { maxVideos: 0 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(
      result.every((r) => r.status === "not_found" || r.videos.length === 0),
    ).toBe(true);
  });
  it.each(["foreign", "duplicate", "malformed"])(
    "rejects %s channel attribution before follow-up calls",
    async (mode) => {
      const data = structuredClone(fixture.channels);
      if (mode === "foreign") data.items[0].id = GONE;
      if (mode === "duplicate") data.items[1].id = VISIBLE;
      const f = vi.fn(async () =>
        ok(mode === "malformed" ? { items: null } : data),
      );
      await expect(run(f)).rejects.toMatchObject({ kind: "upstream" });
      expect(f).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["foreign", "duplicate", "owner"])(
    "rejects %s video attribution",
    async (mode) => {
      const data = structuredClone(fixture.videos);
      if (mode === "foreign") data.items[0].id = "foreign0001";
      if (mode === "duplicate") data.items[1].id = data.items[0].id;
      if (mode === "owner") data.items[0].snippet.channelId = HIDDEN;
      const f = vi.fn(async (u: URL | RequestInfo) =>
        new URL(String(u)).pathname.endsWith("/videos")
          ? ok(data)
          : ok(
              (fixture as Record<string, unknown>)[
                new URL(String(u)).pathname.split("/").pop()!
              ],
            ),
      );
      await expect(run(f)).rejects.toMatchObject({ kind: "upstream" });
    },
  );
  it("excludes private/unlisted or unknown visibility videos and preserves zero versus unsafe counts", async () => {
    const data = structuredClone(fixture.videos);
    data.items[0].status.privacyStatus = "private";
    data.items[1].statistics.viewCount = "0";
    const f = vi.fn(async (u: URL | RequestInfo) =>
      new URL(String(u)).pathname.endsWith("/videos")
        ? ok(data)
        : ok(
            (fixture as Record<string, unknown>)[
              new URL(String(u)).pathname.split("/").pop()!
            ],
          ),
    );
    const result = await run(f);
    expect(result[0].status === "ok" && result[0].videos).toMatchObject([
      { video_id: "fictional02", video_view_count: 0, video_like_count: null },
    ]);
    data.items[1].statistics.viewCount = "9007199254740992";
    const next = await run(f);
    expect(
      next[0].status === "ok" && next[0].videos[0].video_view_count,
    ).toBeNull();
  });
  it("distinguishes missing resources from malformed responses and never returns credential-bearing exceptions", async () => {
    const missing = await run(
      vi.fn(async () => new Response("private", { status: 404 })),
    );
    expect(missing.every((r) => r.status === "not_found")).toBe(true);
    for (const f of [
      vi.fn(async () => {
        throw Error("PRIVATE_KEY_CANARY");
      }),
      vi.fn(async () => new Response("PRIVATE_KEY_CANARY", { status: 200 })),
      vi.fn(async () => new Response("PRIVATE_KEY_CANARY", { status: 429 })),
    ]) {
      const e = await run(f).catch((x) => x);
      expect(e).toBeInstanceOf(YouTubeError);
      expect(e.message).not.toContain("PRIVATE_KEY_CANARY");
    }
  });
  it("bounds actual response bytes even with a false declared size and forbids redirects", async () => {
    const f = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      return new Response("x".repeat(2 * 1024 * 1024 + 1), {
        headers: { "content-length": "1" },
      });
    });
    await expect(run(f)).rejects.toMatchObject({ kind: "upstream" });
  });
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
