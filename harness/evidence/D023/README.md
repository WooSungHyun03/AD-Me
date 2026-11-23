# D023 — TikTok official connection adapter (DEV-B · P2 · conditional)

Status: **BLOCKED**. Prerequisites not met: U013 (TikTok developer app approval, user) and D018 (ingestion storage, DEV-A). No real approved account → no verification of a real connection, scope error, revoke or deletion callback.

## Done
- `docs/data-sources/tiktok-display-api.md`, based on the official docs checked 2026-11-23:
  - Display API OAuth (Login Kit for Web), minimal scopes (`user.info.basic`, `user.info.stats`, `video.list`);
  - token lifetimes (access 2h, refresh 180 days rotating), refresh and revoke (`/v2/oauth/revoke/`);
  - `authorization.removed` deletion callback (signature, at-least-once, idempotent deletion, tombstone);
  - Research API ban and why;
  - unblock order.
- `src/lib/ingestion/tiktok.ts` (pure functions, gated):
  - `authorizeUrl()` passes `assertSourceAllowed("tiktok_display_api")` first, so it **throws immediately while pending**. It enforces a static https redirect and a random state.
  - `parseToken()` turns missing scopes into a scope error, **refuses scopes outside the allowlist (research etc.)**, and caps lifetimes to the documented values.
  - `verifyWebhook()`: HMAC-SHA256 `t.rawBody`, constant-time comparison, 300s tolerance (our choice, marked as a shortcut).
  - `parseDeauthorization()`: open_id and reason.
- `/api/integrations` routes are **intentionally not created**. An OAuth callback without token storage (D018) and deletion processing would be an incomplete connection path.

## Tests (2026-11-23)
- `tests/tiktok.test.ts` (5):
  - blocked while pending;
  - authorize URL and scopes after approval (no research), http, query-string redirect and short state refused;
  - missing scope, unexpected research scope, lifetime cap, token_type;
  - webhook valid, tampered, wrong key, stale, malformed, null;
  - deauth parsing and other events refused.

## 전체 회귀 (2026-11-23)
`tests/ci-db.sh` exit 0 (test-cancel PASS 포함), **E2E 82/82**, vitest 142, lint 0, secret_scan PASS, migration_check 27 PASS.
