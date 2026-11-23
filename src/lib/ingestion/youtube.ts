import {
  assertSourceAllowed,
  pickAllowed,
  policies,
  type SourcePolicy,
} from "./policy";
// Low-cost endpoints only (1 quota unit each): channels.list, playlistItems.list, videos.list.
// search.list (100 units) is deliberately not used; input is an allowlisted channel-ID seed.
const API = "https://www.googleapis.com/youtube/v3";
export type YouTubeErrorKind =
  "quota" | "rate" | "auth" | "bad_request" | "upstream";
export class YouTubeError extends Error {
  constructor(
    public kind: YouTubeErrorKind,
    message: string,
  ) {
    super(message);
  }
}
type Fetch = typeof fetch;
type Opts = {
  apiKey?: string;
  fetchImpl?: Fetch;
  policyTable?: Record<string, SourcePolicy>;
  maxVideos?: number;
};
const num = (v: unknown) =>
  typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null;
const CHANNEL_ID = /^UC[\w-]{22}$/;
// Only the response fields this adapter reads (YouTube Data API v3 resource shapes).
type Stats = Record<string, string | boolean | undefined>;
type ApiChannel = {
  id: string;
  snippet?: Record<string, string | undefined>;
  statistics?: Stats;
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
};
type ApiVideo = {
  id: string;
  snippet?: Record<string, string | undefined>;
  statistics?: Stats;
};
type ApiList<T> = { items?: T[] };

async function call(
  path: string,
  params: Record<string, string>,
  key: string,
  f: Fetch,
) {
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const res = await f(url, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return body;
  const reason: string = body?.error?.errors?.[0]?.reason ?? "";
  if (["quotaExceeded", "dailyLimitExceeded"].includes(reason))
    throw new YouTubeError("quota", "YouTube API 일일 할당량 초과");
  if (
    res.status === 429 ||
    ["rateLimitExceeded", "userRateLimitExceeded"].includes(reason)
  )
    throw new YouTubeError("rate", "YouTube API 속도 제한");
  if (res.status === 401 || res.status === 403)
    throw new YouTubeError("auth", "YouTube API 키 권한 오류");
  if (res.status === 400)
    throw new YouTubeError("bad_request", "잘못된 YouTube API 요청");
  throw new YouTubeError("upstream", `YouTube API 오류 ${res.status}`);
}

export type ChannelResult =
  | { channel_id: string; status: "not_found" } // deleted, terminated or wrong ID: API does not distinguish
  | {
      channel_id: string;
      status: "ok";
      source_type: "youtube_data_api";
      source_url: string;
      fetched_at: string;
      profile: Record<string, unknown>;
      videos: Record<string, unknown>[];
    };

export async function fetchChannels(
  seed: string[],
  opts: Opts = {},
): Promise<ChannelResult[]> {
  // Policy gate before any network call or key lookup.
  const policy = assertSourceAllowed(
    "youtube_data_api",
    new Date(),
    opts.policyTable ?? policies,
  );
  const key = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("auth", "YOUTUBE_API_KEY 미설정");
  const f = opts.fetchImpl ?? fetch;
  const ids = [...new Set(seed)];
  const bad = ids.filter((id) => !CHANNEL_ID.test(id));
  if (bad.length)
    throw new YouTubeError(
      "bad_request",
      `허용되지 않은 채널 ID 형식: ${bad.join(",")}`,
    );
  const out: ChannelResult[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await call(
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        id: batch.join(","),
        maxResults: "50",
      },
      key,
      f,
    );
    const byId = new Map(
      ((data as ApiList<ApiChannel>).items ?? []).map((c) => [c.id, c]),
    );
    for (const id of batch) {
      const c = byId.get(id);
      if (!c) {
        out.push({ channel_id: id, status: "not_found" });
        continue;
      }
      const hidden = c.statistics?.hiddenSubscriberCount === true;
      const profile = pickAllowed(policy, {
        channel_id: id,
        title: c.snippet?.title ?? null,
        description: c.snippet?.description ?? null,
        custom_url: c.snippet?.customUrl ?? null,
        published_at: c.snippet?.publishedAt ?? null,
        country: c.snippet?.country ?? null,
        // Hidden counts stay null: never estimated or back-filled.
        subscriber_count: hidden ? null : num(c.statistics?.subscriberCount),
        hidden_subscriber_count: hidden,
        video_count: num(c.statistics?.videoCount),
        view_count: num(c.statistics?.viewCount),
      });
      const uploads = c.contentDetails?.relatedPlaylists?.uploads;
      const videos = uploads
        ? await recentVideos(uploads, key, f, policy, opts.maxVideos ?? 10)
        : [];
      out.push({
        channel_id: id,
        status: "ok",
        source_type: "youtube_data_api",
        source_url: `https://www.youtube.com/channel/${id}`,
        fetched_at: new Date().toISOString(),
        profile,
        videos,
      });
    }
  }
  return out;
}

async function recentVideos(
  playlist: string,
  key: string,
  f: Fetch,
  policy: SourcePolicy,
  max: number,
) {
  const list = await call(
    "playlistItems",
    {
      part: "contentDetails",
      playlistId: playlist,
      maxResults: String(Math.min(max, 50)),
    },
    key,
    f,
  ).catch((e) => {
    if (e instanceof YouTubeError && e.kind === "bad_request")
      return { items: [] };
    throw e;
  });
  const ids = (
    (list as ApiList<{ contentDetails?: { videoId?: string } }>).items ?? []
  )
    .map((x) => x.contentDetails?.videoId)
    .filter((x): x is string => Boolean(x));
  if (!ids.length) return [];
  const v = await call(
    "videos",
    { part: "snippet,statistics", id: ids.join(",") },
    key,
    f,
  );
  return ((v as ApiList<ApiVideo>).items ?? []).map((x) =>
    pickAllowed(policy, {
      video_id: x.id,
      video_title: x.snippet?.title ?? null,
      video_published_at: x.snippet?.publishedAt ?? null,
      video_view_count: num(x.statistics?.viewCount),
      // likeCount/commentCount are absent when hidden or disabled → null, not 0.
      video_like_count: num(x.statistics?.likeCount),
      video_comment_count: num(x.statistics?.commentCount),
    }),
  );
}
