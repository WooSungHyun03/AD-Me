# Two-sided application and chat flows

## Advertiser job creation
- Brand saves draft with brief, category, expected deliverables, review schedule, budget range, application window, optional eligibility; validates brand ownership and safe text.
- Preview displays notice: posting costs one JOB_POST credit; no refund by simply closing a live post, unless platform failure/explicit refund policy.
- On paid publish, atomic gate; `published_at`, `expires_at`, status and `published_by` recorded. Public read limited to published approved jobs.
- Filters: new, category, budget, due date, verified brand, content format, preferred creator channel scale only if permitted/valid data.

## Creator paid application
- Must have verified owner claim and active/available creator profile, not blocked. Cannot apply to employer's own jobs or submit twice.
- UI shows application cost and non-refundable conditions, short pitch, proposed scope/quote and work sample links. `Apply` checks credit/TEST checkout then records exactly once.
- Brand can `shortlist`, `accept`, `reject` with status history; creator sees own status. Accepting opens/activates related conversation.
- Late job expiry or concurrent close must fail atomically with no debit. Support creator appeal/admin correction.

## Chat
- Supabase Realtime/Postgres. Room created between specific brand and claimed creator on a proposal/application or accepted direct inquiry. Explicit consent and anti-spam (new chats rate limited). Roles determine membership.
- Members only can read messages; no unverified directory channel inbox. Typing/read receipts optional, persisted last-read markers; timestamps Asia/Seoul in UI, UTC in DB.
- Features: text, verified YouTube link previews (safe metadata), attachments as P1 via secured Storage, unread counts, notifications, message deletion/retention rules, report and block, consented contact exchange.
- Admin cannot browse private messages arbitrarily; report-led scoped review, audit, only specifically authorized moderators.
- Avoid auto-DM from AI, cold outreach blasts and harvested emails.

## Tests
- Two brands/creators separated, wrong-room read/write denied, blocked user cannot send, messages stay after reload, simultaneous replies reorder correctly, one chat per logical relationship if same proposal, rejected application doesn't accidentally grant chat access.
