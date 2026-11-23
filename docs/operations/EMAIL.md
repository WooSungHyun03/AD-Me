# Email: two separate paths (D053)

| | Account/security mail | App notification mail |
|---|---|---|
| Examples | Signup confirmation, password reset, email change | Proposal status changed, new message, deliverable submitted, marketing news |
| Sent by | **Supabase Auth**, via the SMTP set in the Supabase console (Auth → SMTP) | **App worker** (`src/lib/notifications/email.ts` → `runOutbox`) via a sender adapter |
| Queue | None (Auth sends directly) | `email_outbox` (server only) |
| Consent | Always sent (needed for the account) | `service_email` (default on) / `marketing_email` (default off, versioned consent) |
| Unsubscribe | Not possible (security mail) | One-click link + `List-Unsubscribe` headers (RFC 8058), or the settings screen |
| Status | Default Supabase sender with its rate limit until SMTP is set (U007) | **No sender configured. No real delivery has happened** |

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
1. Choose an email API provider and set its key as a **server-only** Vercel variable.
2. The agent implements `configuredSender()` for that provider, mapping `Mail.headers` and `idempotencyKey`.
3. Run `/api/admin/email-outbox` (admin) or a scheduled job.
4. Verify one real delivery to a test inbox: the unsubscribe link works and the headers are present.
5. Only after step 4 may delivery be reported as working. Admin → "알림 메일 outbox" shows counts by status.

Not done: a scheduled worker, outbox retention cleanup, bounce/complaint webhooks.
