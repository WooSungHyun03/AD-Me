# D053 — Email notification outbox and delivery preferences (DEV-B · P1)

Status: **outbox, retry/dead-letter, consent and unsubscribe DONE (local isolated Supabase). Real delivery BLOCKED (U007)**.
- No email provider or key is configured; the worker refuses to claim and reports BLOCKED.
- No delivery success is claimed.

## What was built
- `docs/operations/EMAIL.md`
  - Auth mail (Supabase Auth SMTP: signup/reset) vs app notification mail (outbox + sender adapter) are separate paths with separate setup and verification.
  - Also documents the lifecycle and the steps to turn delivery on.
- Migration `202611190022_email_outbox_delivery.sql`, extending the D015 outbox:
  - Idempotency key **event (`source_key`) + recipient + channel**.
  - `template` + `template_version`, set by the enqueue functions (`notification_<kind>` v1, `marketing` v1).
  - `attempts`, `next_attempt_at`, `locked_until` lease, `last_error` (code only, ≤ 200), `sent_at`.
  - Statuses: queued / sending / sent / failed / dead / cancelled.
  - `claim_emails(n)` (service only):
    - Re-checks consent at send time, so withdrawn rows are cancelled.
    - Uses `for update skip locked` and a 5-minute lease; expired leases can be reclaimed.
  - `finish_email()` (service only): backoff of 2^attempts minutes; 5th failure → `dead`; a finished row can't be finished again.
  - `email_secret` + stateless unsubscribe token `<user>.<purpose>.<hmac>`.
  - `unsubscribe_email(token)`: anon-callable one-click. Turns that purpose off, writes `consent_log` (version `unsubscribe-link`), cancels pending rows; forged or other-user tokens are refused.
  - Admin `email_outbox_stats()`.
- `src/lib/notifications/email.ts`
  - Versioned templates; bodies carry no message content.
  - `render()` adds the unsubscribe link, `List-Unsubscribe` / `List-Unsubscribe-Post` headers and a provider idempotency key.
  - `Sender` adapter interface; `configuredSender()` returns null (shortcut comment).
  - `runOutbox()` does nothing without a sender.
- `src/lib/notifications.ts` already existed, so the new module is `notifications/email.ts`.
- Routes:
  - `POST /api/admin/email-outbox` (admin only).
  - `POST /api/email/unsubscribe`: POST only, so a GET or prefetch can't unsubscribe; accepts the RFC 8058 one-click form post.
- Pages:
  - `/unsubscribe` page with a button. It notes that account-security mail is still sent.
  - Admin "알림 메일 outbox": counts by status, "발송 공급자 미설정 — 실제 메일은 발송되지 않습니다", and the Auth SMTP separation note.
- Preferences UI and consent stay as built in D015 (settings → 알림·관심 분야).

## Tests (2026-11-22, local)
- `tests/email-outbox.mjs` (direct REST, in ci-db):
  - Client access denied: anon/brand cannot claim, finish, mint tokens, read the outbox or read the secret; brand cannot read stats; admin can.
  - Dedupe and enqueue: duplicate event+recipient+channel is rejected; the notification trigger enqueues once with `notification_message` v1.
  - Claims: two parallel claims have no overlap and cover all due rows; each claimed row carries an email and an unsubscribe token.
  - Failure path: backoff of more than 60 s after the first failure → dead after 5 → dead rows are not retried.
  - Lease: a leased row is held, and is reclaimed (attempts=2) after expiry.
  - Consent withdrawn after enqueue → cancelled at claim time.
  - Unsubscribe: forged, other-user, malformed and purpose-swapped tokens are refused. A valid token turns mail off (version cleared), logs consent, cancels the queue; a repeat click is harmless.
- `tests/email.test.ts` (4): render headers, link and idempotency key; unknown template throws; every DB notification kind has copy; no sender → no RPC calls; per-row success/failure is reported to `finish_email`.
- `tests/e2e/unsubscribe.spec.ts` (desktop+mobile):
  - Opening the link changes nothing; the button turns marketing off; the one-click form POST turns service off.
  - Bad or missing token messages.
  - Admin sees "발송 공급자 미설정"; the admin run returns BLOCKED with `sent: 0`.
- Full regression: `bash tests/ci-db.sh` exit 0, covering 22 migrations, E2E 62/62, 20 DB tests and the restore drill. Also vitest 124, lint 0, build OK, secret scan PASS.
- Screenshots: `unsubscribe-{desktop,mobile}.png` and `admin-outbox-{desktop,mobile}.png`, no horizontal scroll.

## Not verified / remaining
- "설정 후 실제 배달 확인" is **BLOCKED**: it needs a provider and a server-only key (U007). Steps are in `docs/operations/EMAIL.md`.
- No scheduled worker, no outbox retention cleanup, no bounce/complaint webhooks.
- 141 rows are queued locally from test notifications. They would all be attempted on the first real run, so purge or cap them before enabling a sender in a non-test environment.
