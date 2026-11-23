import { expect, it, vi } from "vitest";
import {
  parseYoutubeDirectory,
  readYoutubeDirectory,
} from "@/lib/youtube-directory";

it("validates public search bounds, duplicates, enums and opaque cursors", () => {
  expect(
    parseYoutubeDirectory(new URLSearchParams("q=  가상  &yt-sort=name")),
  ).toEqual({
    filters: { query: "가상", topic: "", subscribers: "", sort: "name" },
    cursor: null,
  });
  for (const query of [
    "q=a&q=b",
    "yt-sort=secret",
    "subscribers=-1",
    "yt-topic=unknown",
    "yt-cursor=",
    "q=" + "a".repeat(81),
    "yt-cursor=" + "a".repeat(1501),
  ])
    expect(() => parseYoutubeDirectory(new URLSearchParams(query))).toThrow();
});
it("requests only a bounded SQL page and strips unapproved projection fields", async () => {
  const rpc = vi.fn().mockResolvedValue({
    error: null,
    data: {
      version: 1,
      total: 1,
      nextCursor: null,
      items: [
        {
          channel_id: "UC" + "X".repeat(22),
          title: "SYNTHETIC",
          subscriber_count: null,
          fetched_at: "2026-11-23T00:00:00Z",
          videos: [],
          metadata: { avatar: "https://evil.invalid/a", contact: "hidden" },
          owner_id: "private",
        },
      ],
    },
  });
  const page = await readYoutubeDirectory(
    { rpc },
    new URLSearchParams("q=가상&subscribers=under-100k"),
  );
  expect(rpc).toHaveBeenCalledWith("youtube_directory_page", {
    p_filters: {
      query: "가상",
      topic: "",
      subscribers: "under-100k",
      sort: "subscribers",
    },
    p_cursor: null,
    p_limit: 24,
  });
  expect(page.items[0]).not.toHaveProperty("owner_id");
  expect(page.items[0].metadata).not.toHaveProperty("contact");
  expect(page.items[0].metadata?.avatar).toBeUndefined();
  expect(page.items[0].subscriber_count).toBeNull();
});
it("fails closed on unavailable or malformed RPC responses", async () => {
  for (const result of [
    { error: { message: "private SQL" }, data: null },
    { error: null, data: { version: 1, total: 3, items: [] } },
  ]) {
    await expect(
      readYoutubeDirectory({ rpc: async () => result }, new URLSearchParams()),
    ).rejects.toThrow("공개 채널을 불러오지 못했습니다.");
  }
});
