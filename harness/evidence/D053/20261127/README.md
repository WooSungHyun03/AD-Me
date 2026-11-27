# D053 — Resend API sender for app notification mail (2026-11-27, DEV-B)

## Why
- `configuredSender()` always returned `null`, so the outbox could never deliver.
- Resend is already the verified provider for `mail.be-celeb.org` (Auth SMTP, U007 2026-11-19, `docs/AUTH_PROVIDER_EXECUTION.md`).
- The app path still lacked an adapter.

## Changes
- **`src/lib/notifications/email.ts`**
  - `resendSender(apiKey, from, fetch)` sends `POST https://api.resend.com/emails` with `from`, `to`, `subject`, `text` and the RFC 8058 unsubscribe `headers`.
  - `Idempotency-Key` is `adme-<source_key>-<id>`, at most 256 characters. Resend keeps keys for 24 hours.
  - Timeout is 10 s.
  - Errors are only `resend_<status>[_<fixed error name>]` or `resend_network`. The response body is never kept, because it can echo the recipient.
  - `configuredSender(env)` returns the sender only when `RESEND_API_KEY` starts with `re_` and `ADME_MAIL_FROM` is a single-line address. A CR/LF header injection yields `null`.
- **Docs and config:**
  - `.env.example` and `docs/handoff/ENVIRONMENT_CONTRACT.md` gain the two server-only names.
  - `docs/operations/EMAIL.md` covers the turn-on steps and the adapter's behaviour.
- The request format was checked against Resend's public docs (send-email, idempotency keys, errors) on 2026-11-27.
- Gaps in those docs: allowed key characters and the exact success status. The adapter treats any 2xx as success.

## Verification
- **Network:** no real network and no real key. The tests use a fetch stub and a fixture key built at runtime.
- **`tests/email.test.ts`: 9/9** (4 new):
  - Request URL, method, `Authorization`, `Idempotency-Key` and exact JSON body.
  - 429 → `resend_429_rate_limit_exceeded`; a non-token error name → `resend_409`; a network error → `resend_network`. No recipient appears in any of them.
  - The outbox stores `resend_500_application_error` for a refused row.
  - Configuration is refused for a missing key, a non-Resend key or a CR/LF sender.
- Full `npm run test`: 100 files / 608 tests. typecheck, eslint and `npm run build` pass.

## Remaining gate (U007/U006)
- The USER sets `RESEND_API_KEY` (a domain-limited sending key) and `ADME_MAIL_FROM` in Vercel and redeploys.
- The operator runs the outbox once and checks one real delivery and the unsubscribe link in a test inbox.
- Until then nothing is reported as sent, and D053 stays IN_PROGRESS.
