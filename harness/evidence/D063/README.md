# D063 — Statistics, help and contact operations (DEV-B · P1)

Status: **DONE (local)**. Not deployed (D088). Migration 0024 is local only.

## Metric definitions (shown next to each number in /admin)
- **Period**: the last 7/30/90 days up to the time of the query (`/admin?days=`). The server clamps it to 1–90, and the from–to range is shown in KST.
- **Excluded**: two things never count.
  - **Test accounts**: emails on reserved domains (RFC 2606/6761: `example.com/net/org`, `*.test`, `*.example`, `*.invalid`, `*.localhost`) via `is_test_email()`. These domains can never belong to real users. Every local and QA account is on one, so all local activity is 0 by definition.
  - **DEMO campaigns** (`is_demo`), with every proposal linked to them.
  - The excluded counts are displayed.
- **Activity**
  - Signups: accounts created in the period.
  - Active users: accounts with at least one sign-in in the period.
  - Campaigns created (non-demo).
  - Proposals and applications created.
  - Collaborations accepted: distinct proposals with a recorded `accepted` event in `proposal_events`.
- **Reports**
  - Received (all report kinds); closed (resolved or dismissed in the period).
  - Median hours from receipt to decision.
  - Currently open past the due date.
- **Errors**
  - Server errors captured by `onRequestError` → `reportError()` → `record_error()`, counted per day × route × kind.
  - No message, user or request data is stored, so the counts are PII-free by construction. The route must match a strict path pattern; anything else becomes `/other`.
  - Client aborts ("destination stream errored", a navigation mid-render) are logged as warnings and are neither counted nor alerted. In the regression all 16 captured "errors" were this type.
- **Inquiries**: received, answered or closed in the period, and currently open.
- `ops_metrics()` returns counts only and is admin/service only. The test asserts the JSON contains no `@`.

## Help and contact
- `/help` (footer link and the `/about` section)
  - Usage per role.
  - Data limits: DEMO data, self-reported info, the score is not a performance prediction, no estimated reach or revenue, AI drafts need review, TEST payments.
  - Links to /about, /privacy and the report flow.
- Contact form (`POST /api/inquiries`, Zod: category, 10–2000 chars)
  - Signed in: answered in "내 문의" on `/help`.
  - Not signed in: a reply email is required, and the admin replies directly (there is no email provider, U007).
  - The form warns against entering passwords or payment numbers.
  - Writes are server-side only, via `submit_inquiry()` with the service role. Clients have no insert grant.
  - Limits: 5 per account per day; 30 anonymous per hour overall (429).
- Admin "문의 처리"
  - Lists open and answered inquiries. "답변 저장" / "종료" call `answer_inquiry()` (admin checked in the DB, audit_log entry).
- `inquiries` RLS: the owner reads their own and the admin reads all. Included in the personal data export.

## Tests (2026-11-22, local isolated Supabase)
- `tests/ops-metrics.mjs` (direct REST, added to `ci-db.sh`)
  - `is_test_email` cases, including `example.co.kr` and `notexample.com` → not test.
  - Brand, creator and anon cannot call `ops_metrics`, `record_error` or `submit_inquiry`, cannot insert inquiries, and read 0 `ops_errors` rows. The admin cannot read raw `ops_errors` either.
  - One real-domain user plus one `example.com` user: signups +1 and campaigns +1 (the test account's campaign is excluded); inquiries +1 (test account and `.test` reply email excluded); excluded test accounts +1.
  - An anonymous inquiry without an email is refused; the 6th per day returns `rate_limited`.
  - `record_error` with `?email=` in the route or a bad kind is stored as `/other`/`other`, with no `@` or `?` in stored routes. errors.total +2.
  - Period 999 → 90.
  - The answer is admin only; the owner reads it; others read 0; answered +1; audit_log written.
- `tests/observability.test.ts`: a client abort returns "ignored" and is not logged as an error.
- `tests/e2e/help.spec.ts` (desktop + mobile)
  - Footer → /help. An anonymous inquiry with an email is accepted.
  - A creator inquiry shows the email field hidden, then "접수됨" in 내 문의. A short message returns 400. The creator calling the admin answer API gets 403.
  - Admin: the 7-day period is `aria-current`, definitions and the exclusion note are visible, signups shows 0 (all local accounts are test accounts), the anonymous card shows the reply email, and the answer is saved → the creator sees the answer after reload.
- Full regression: `bash tests/ci-db.sh` exit 0, covering E2E 70/70, DB tests and the restore drill. Also vitest 127, lint 0, build OK, secret scan PASS, `migration_check` 24 PASS. `reportError` → `ops_errors` was confirmed with real rows during the run.
- Screenshots: `help-{desktop,mobile}.png`, `admin-metrics-{desktop,mobile}.png`, no horizontal scroll.

## Known limits
- Test accounts are identified by email domain only. A tester on a real domain would count, and there is no admin "mark as test" flag.
- `inquiries` are not yet in `run_retention`.
  - shortcut: add a 1-year deletion of closed inquiries when retention is next redefined.
  - The anonymous reply email is personal data and is kept until the inquiry is deleted.
- Error counts come from the server only (no browser JS errors), and only for errors Next passes to `onRequestError` or that are reported explicitly.
