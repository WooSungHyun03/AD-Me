# Observability, alerts, health (D086)

## What is observed
| Item | How | Who sees it |
|---|---|---|
| Availability | `GET /api/health` → `{"status":"ok"\|"down"}` (200/503). One tiny anonymous DB read, 4-second timeout | Public (status only) |
| Connection details | Same URL from an admin session: DB latency, mode, region, commit, whether each key is configured (true/false), migration version, row counts | Admins only |
| Server errors | `src/instrumentation.ts` `onRequestError`: every server error (render, route, action, proxy) is logged as JSON and alerted | Vercel logs, alert channel |
| Main failures | Payment confirm connection failure, retention job failure, upload cleanup failure → `reportError` | Same |
| Free-plan limits | `ops_stats()` (admin/service only): DB size, storage size, 30-day active users → compared with `FREE_LIMITS`, **alert at 80%** | Admin page "서비스 상태", alert |
| API quota | YouTube uses only 1-unit endpoints; quota exceeded maps to `YouTubeError("quota")` | Ingestion not wired to a route yet (policy approval pending). Hook `reportError` in when it is |

Free-plan limits (DB 500MB, Storage 1GB, MAU 50,000) are **reference values**. Check the actual limits on the Supabase console's Usage page.

## Logs and personal data
- Every log goes through `mask()`:
  - Emails, phone numbers, card numbers, business registration numbers, JWTs, API keys and URL token/code values are masked.
  - Fields named password, token, secret, authorization, cookie, email, phone, body, brief or reason are replaced wholesale.
- Request tracing uses only a request ID (`x-vercel-id` or a random UUID) — no user identifiers.
- The app has no other logging; existing responses return only fixed messages (D078).

## Alert routing (to align with U018)
- `ALERT_WEBHOOK_URL` (server only): Slack/Discord-compatible incoming webhook. Body is `{"text": "..."}`.
- Only https is allowed (plus localhost for local tests). The same alert goes out at most once per 10 minutes per server instance.
- **Your part (U018)**:
  1. Create a Slack (or Discord) incoming webhook.
  2. Set `ALERT_WEBHOOK_URL` in Vercel env (server only).
  3. Point an external uptime monitor (e.g. UptimeRobot's free plan) at `https://<production-url>/api/health` every 5 minutes. An outage then produces both an alert and the monitor's own notification.
  4. Set cost/usage alerts in the Supabase and Vercel consoles (spend cap or usage-alert email).
- Until it's set up, alerts are recorded only in the server log as `event:"alert"`. On the admin page, "알림 수신 미설정" (alerts not configured) shows.

## Checking after it's set up (with D088)
1. Signed in as admin, `GET /api/health` → check `configured.alert_webhook: true`.
2. Confirm a real message arrives in the channel. There's no safe way to fake an outage in production, so after deploying, temporarily point the admin `ALERT_WEBHOOK_URL` at a test channel and check any one alert arrives. Leave the evidence in `harness/evidence/D086`.
