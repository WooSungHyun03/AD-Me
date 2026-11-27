# Email: two separate paths (D053)

| | Account/security mail | App notification mail |
|---|---|---|
| Examples | Signup confirmation, password reset, email change | Proposal status changed, new message, deliverable submitted, marketing news |
| Sent by | **Supabase Auth**, via the SMTP set in the Supabase console (Auth → SMTP) | **App worker** (`src/lib/notifications/email.ts` → `runOutbox`) via a sender adapter |
| Queue | None (Auth sends directly) | `email_outbox` (server only) |
| Consent | Always sent (needed for the account) | `service_email` (default on) / `marketing_email` (default off, versioned consent) |
| Unsubscribe | Not possible (security mail) | One-click link + `List-Unsubscribe` headers (RFC 8058), or the settings screen |
| Status | Resend SMTP connected in the Supabase console (U007, 2026-11-19) | Resend API adapter implemented (2026-11-27). **Inactive until `RESEND_API_KEY` and `ADME_MAIL_FROM` are set; no real delivery has happened** |

Setting the Auth SMTP does **not** make app notification mail work, and vice versa. Each needs its own provider setup and its own delivery check.

## Outbox lifecycle
1. **Enqueue**
   - `notifications` insert → trigger → a `service` row with template `notification_<kind>` v1, if `service_email` is on.
   - `enqueue_marketing()` (service role) → rows only for users with marketing consent now.
   - Idempotency key = event (`source_key`) + recipient + channel. A repeat enqueue is a no-op.
2. **Claim**
   - `claim_emails(n)` takes due rows with `skip locked`, so parallel workers never get the same row.
   - It re-checks consent first; withdrawn rows are `cancelled`, never sent.
   - Each claimed row gets a 5-minute lease; a crashed worker's row becomes claimable again.
3. **Send**
   - Render the versioned template with an unsubscribe link and an idempotency key (`adme-<source_key>-<id>`) for the provider.
   - Bodies point to the signed-in app; no message content or personal data goes in mail.
4. **Finish**
   - `finish_email(id, ok, error)`: `sent`, or `failed` with a backoff of 2^attempts minutes.
   - The 5th failure becomes `dead`: kept for inspection, never retried.
   - Only an error code is stored.
5. **Unsubscribe**
   - The token `<user>.<purpose>.<hmac>` is verified in the DB (secret never leaves it).
   - Turns that purpose off, logs to `consent_log` (version `unsubscribe-link`) and cancels pending rows.
   - Opening the link (GET) does nothing; only the button or the mail client's POST unsubscribes.

## Turning delivery on (user, U007)
1. In Resend, use a sending key limited to `mail.be-celeb.org`. Set it as the **server-only** Vercel variable `RESEND_API_KEY`.
2. Set `ADME_MAIL_FROM`, e.g. `AD Me <noreply@mail.be-celeb.org>` (one line, on the verified domain).
3. Redeploy. Admin → "알림 메일 outbox" should then say "발송 공급자 연결됨".
4. Run `/api/admin/email-outbox` (admin) or a scheduled job.
5. Verify one real delivery to a test inbox: the unsubscribe link works and the headers are present.
6. Only after step 5 may delivery be reported as working. Admin → "알림 메일 outbox" shows counts by status.

Adapter behaviour (`resendSender`):
- **Request:** `POST https://api.resend.com/emails` with `from`, `to`, `subject`, `text` and the unsubscribe `headers`.
- **No double sends:** the `Idempotency-Key` header is `adme-<source_key>-<id>`. Resend keeps keys for 24 hours, so a retried row is not sent twice.
- **Failures:**
  - Only `resend_<status>[_<error name>]` (or `resend_network`) is stored; the response body never is.
  - A 429 or 5xx row follows the outbox backoff, and the 5th failure is dead-lettered.

Not done: a scheduled worker, outbox retention cleanup, bounce/complaint webhooks.
