# YouTube: actual channels, daily discovery + synchronization

## Fundamental distinction
- YouTube discovery can find real channels; it **cannot** turn them into registered, verified AD Me creators or grant consent to receive campaigns.
- YouTube Data API v3 is primary. No unauthorized HTML scraping, no account automation to bypass API quotas, no private contact mining, no captions/video downloads without separate rights.
- Terms may change. Re-check official docs and quota console before enabling production operations.

## Official inputs / update frequency
| API | For | Frequency | Notes |
|---|---|---|---|
| `search.list` | discover *new* channels by topic/keyword | daily small quota budget | current official defaults: 100 separate search queries/day, 1 unit each; monitor quota bucket |
| `channels.list` | basic channel title/description/handle, counts, uploads list ID | daily by known channel ID | batch IDs where supported; 1 quota unit/call currently |
| `playlistItems.list` | list recent uploads from uploads playlist | daily when channel active | don't use search.list to track recent uploads |
| `videos.list` | recent video metadata/viewCount etc | daily or staggered | batch up to documented limits, 1 quota unit/call currently |

**Important:** YouTube API public non-authorized metadata generally must be refreshed/deleted within 30 calendar days; public stat counts not retained beyond authorized time absent relevant acceptance/permission. YouTube 2026 additional derived-metrics amendment requires distinct eligibility and acceptance. Hold API-based computed averages, engagement-derived scores, AI categories and suitability matches as `pending_policy_review` until verified allowed. The approved extended retention is NOT assumed by default.

## Schedule
- `Asia/Seoul` 04:00 daily: emit `discover` + `sync-known` jobs, staggering expensive work; schedule uses explicit timezone calculations and checks DST only if needed for other regions.
- Supabase Cron (pg_cron/Edge Function) only **enqueues** jobs. Persistent local worker pulls jobs and processes within quotas/limits.
- 04:00 KST = 19:00 UTC previous day; cron implementation must account for deployment timezone. Test calendar rollover.
- Lease with expiration, 3 retries/backoff, dead-letter and admin retry. Cron disabled flag, manual rerun, per-day quota limits, pause on 403/quota or authorization issues.

## Discovery algorithm
1. Admin-managed keywords per category: 뷰티, 패션, 기술, 게임, 여행, 푸드, 운동, 라이프스타일, 교육 etc. No Instagram/TikTok.
2. `search.list` query channel candidates; dedupe by canonical `channel.id`; maintain provenance; `regionCode=KR` helps locale search but does **not** establish a creator's nationality.
3. Query `channels.list` for metadata; classify eligible for listing only after checks, not auto 'registered'.
4. Optional owner claim via Google/YouTube OAuth with minimal scopes; verify specific user can manage claimed channel. Admin manual review for conflicts. OAuth secrets server only.
5. Approved public channel listing uses YouTube attribution and freshness date. If creator is unclaimed, show `발견된 공개 채널 · AD Me 미가입` and disable apply/paid promotion/direct contact.

## Sync algorithm
1. known channel IDs, stale-first priority; channel metadata refresh from `channels.list`.
2. Identify uploads playlist, fetch most recent videos with `playlistItems.list`; `videos.list` refresh stats/public status.
3. Upsert by YouTube video id, sanitize and assign `metadata_as_of`. Reflect renamed, private/deleted/unavailable content. Do not keep stale media metadata indefinitely.
4. Enqueue AI analysis only for new/changed consented/policy-eligible metadata with content hash and model_version.
5. Record per endpoint quota buckets, latency, error category, retryAt, source timestamps, traceId.
6. Deletion/consent revocation triggers purge/refresh handling and halts background work for revoked private data.

## Average view filter (critical policy gate)
- Product must provide this **if and only if derived-metrics conditions are accepted** or user supplies independent, permissioned metrics. Otherwise mark unavailable and show approval-specific explanation; don't spoof/derive API counts in JS and hide it.
- UI choices: recent 10 public uploads, recent 20, uploads in last 30 days, last 90 days. Definition `sum(valid_public_video_view_counts)/count(valid_public_video_view_counts)`, return null on 0 sample, display `N videos`, as-of time, mixed formats caveat.
- Be careful: upload date period means views accrued over video lifetimes, not views generated *within* past 30 days. Do not call it "최근 30일간 발생한 조회수". Say "최근 30일 업로드 영상의 현재 조회수 평균".
- Separate Shorts/longform only if the type can be established reliably; otherwise say `영상 전체`, with sample source. No subscriber audience demographics from public API.
- Metadata-backed topics/hashtags are AD Me additions, never display as YouTube official category; check derived-policy approval before enabling API-derived AI tags.

## Contact / privacy
- Do not extract personal email from video descriptions or YouTube About pages. `creator_contact_methods` must originate from voluntarily supplied and verified information with a disclosure consent; unclaimed listings have no private contact.
- Directory and claimed profile deletion/correction flow; record source. Avoid automated mass marketing or solicitation.

## Operational dashboards
- Discovered count vs claimed/verified count, per-day sync success, 30-day stale queue, quota remaining by bucket, blocked policy metrics count, AI jobs queue, channels with privacy complaints and deletion requests.

## Official links
- https://developers.google.com/youtube/data/reference/rest/v3/search/list
- https://developers.google.com/youtube/data/reference/rest/v3/channels/list
- https://developers.google.com/youtube/data/reference/rest/v3/playlistItems/list
- https://developers.google.com/youtube/data/reference/rest/v3/videos/list
- https://developers.google.com/youtube/data/determine_quota_cost
- https://developers.google.com/youtube/terms/developer-policies/
- https://developers.google.com/youtube/terms/derived-metrics-policy
