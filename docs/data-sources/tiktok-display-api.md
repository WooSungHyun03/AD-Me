# TikTok Display API integration design (D023, P2, conditional)

Status: **BLOCKED**. Waiting on U013 (TikTok developer app review/approval, user) and D018 (ingestion storage, DEV-A). The adapter (`src/lib/ingestion/tiktok.ts`) refuses to run while the policy entry `tiktok_display_api` is `pending`.

Sources: official TikTok for Developers docs, checked 2026-11-23:
- Login Kit for Web
- OAuth user access token management, plus the get, refresh and revoke pages
- Display API overview
- API scopes, and User Info
- Webhooks overview, events and verification
- Research API product page

## Scope
- **Only the account owner's own account**, connected with their consent. Profile basics, stats and public video list only.
- **Research API is never used** (not even as a commercial-search workaround).
  - Its eligibility is limited to non-commercial, public-interest research bodies.
  - It uses a client-credential token without user authorisation, which conflicts with AD Me's commercial matching purpose.
  - Having Research API credentials does not grant search access.
- No searching other people's accounts, no scraping.

## OAuth (Login Kit for Web)
1. Authorize: `https://www.tiktok.com/v2/auth/authorize/` with these parameters:
   - `client_key`
   - `response_type=code`
   - `scope=user.info.basic,user.info.stats,video.list`. Minimal scopes; `user.info.profile` is excluded because bio and links aren't on the allowlist.
   - `redirect_uri`: https, static, no query or fragment, pre-registered.
   - `state`: a random token stored in an httpOnly cookie and compared in the callback.
2. The callback receives `code`, `scopes`, `state`, or `error`/`error_description`.
   - Treat a state mismatch or an error as failure.
   - Treat a scope the user declined as a **scope error**: no partial connection, and an explanation in the UI.
3. Token: POST `https://open.tiktokapis.com/v2/oauth/token/` (form-urlencoded, `grant_type=authorization_code`, server only, `client_secret` stays on the server).
   - Response: `access_token`, `expires_in`, `refresh_token`, `refresh_expires_in`, `open_id`, `scope`, `token_type=Bearer`.
   - `parseToken()` refuses missing scopes and any scope outside the allowlist (e.g. research).

## Token lifetime, refresh, revoke
| Item | Value (official docs) | Handling |
|---|---|---|
| access token | 2 hours | Refresh just before use (no user consent needed) |
| refresh token | 180 days, **rotating**: the old one is invalid immediately after a refresh | Overwrite the newest one atomically. If saving fails, mark the connection for re-consent |
| Revoke | POST `/v2/oauth/revoke/` (`token`), returns `{}` | When the user clicks "disconnect" in AD Me: revoke → delete tokens and collected fields |

Token storage (implemented after D018): server-only table, accessed by service role only, encrypted at rest (Supabase Vault or app-level encryption), never sent to the client.

## Deletion and revoke callback (webhook)
- Event: `authorization.removed`.
  - `reason` codes: 0 unknown, 1 user disconnected, 2 account deleted, 3 age changed, 4 banned, 5 developer revoked.
  - The token is already revoked when this arrives.
- Verification: `TikTok-Signature: t=<unix>,s=<hex>`, HMAC-SHA256(client_secret, `t + "." + rawBody`), constant-time comparison.
  - The timestamp tolerance is our choice of 300s; the official docs give no value.
- Handling:
  - Return 200 immediately.
  - Delivery is at-least-once with retries for 72 hours, so **delete idempotently** by `open_id`: the connection, tokens, and every stored TikTok field (follower count, video titles and view counts).
  - Record a tombstone so the data isn't re-collected (same pattern as D079).
- Retention: allowlisted fields kept for 30 days, re-checked every 30 days (`policy.ts`). Reviewers must re-check the terms against the original.

## Stored fields (policy allowlist)
`open_id, display_name, avatar_url, follower_count, video_id, video_title, video_view_count`. Everything else is dropped by `pickAllowed()`.

## Unblock order
1. U013: register the TikTok developer app, request Login Kit and Display API scopes, register the redirect URI and webhook URL, pass review.
2. The reviewer records `terms_version`, `reviewer`, `status: approved` and an expiry date in `policy.ts`.
3. D018: connection/token storage tables (RLS, service only) and the deletion tombstone.
4. Implement `src/app/api/integrations/tiktok/{start,callback,webhook}`:
   - start: state cookie plus `authorizeUrl`;
   - callback: state check, token exchange, `parseToken`;
   - webhook: `verifyWebhook` plus `parseDeauthorization`, then delete.
5. Validate with a real approved account: connect → scope error (declined scope) → disconnect (revoke) → deletion via the TikTok-side disconnect webhook.

The `/api/integrations` routes are **intentionally not created yet**. An endpoint that accepts a callback without token storage and deletion processing would leave an incomplete connection path.
