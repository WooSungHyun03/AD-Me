# D086 — operator alert drill (2026-11-27, DEV-B)

## Why
- `docs/operations/OBSERVABILITY.md` said there was no safe way to fake an outage in production.
- So the U018 delivery check had no repeatable procedure.

## Changes
- **`scripts/alert-drill.mjs`**
  - Sends exactly one message labelled `[DRILL] 모의 장애 알림입니다. 실제 장애가 아닙니다.` through the server's own `alert()` (`src/lib/observability.ts`).
  - Masking, the https-only rule and the 5-second timeout are the server's.
  - Each run uses a unique dedupe key, so the 10-minute window never hides a drill.
  - Only `ALERT_WEBHOOK_URL` and `SERVICE_MODE` are read from the env file.
  - The report keeps only `channel` (slack/discord/local/other/none) and `result`. The URL, whose path is the secret, is never printed or written.
  - Exit codes: 0 sent, 2 not configured, 3 failed.
- **`docs/operations/OBSERVABILITY.md`:** step 2 of the post-setup check now uses the drill.

## Verification (local only, no external network)
- **`npx vitest run tests/alert-drill.test.ts`: 2/2 PASS.**
  - A local receiver on 127.0.0.1 gets exactly one body, `[AD Me test_demo] [DRILL] …`. Exit 0 with `channel: local`.
  - The output contains neither the secret path marker nor the receiver port.
  - No URL, or a non-https URL: exit 2. The receiver answers 500: exit 3 `failed`.
- Run without configuration: `node scripts/alert-drill.mjs --env /nonexistent` → `not_configured`, exit 2.
- typecheck, eslint and prettier pass.

## Remaining gate (U018)
- The user creates the Slack/Discord webhook and sets `ALERT_WEBHOOK_URL` in Vercel.
- The operator then runs the drill against that URL and keeps the report plus a screenshot of the channel here.
- Until then D086 stays IN_PROGRESS.
