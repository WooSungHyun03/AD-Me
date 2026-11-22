# Release manifest: DB migrations, environment, user deployment checklist (D085)

Current as of 2026-11-22. `harness/migration_check.py` checks that every migration file appears in the table below exactly once, and that any migration containing destructive SQL is marked contract.

## State (kept separate per environment)
| Environment | State | Basis |
|---|---|---|
| Local isolated Supabase (Docker) | 0001–0016 applied, full regression PASS | Agent ran it 2026-11-22 (`harness/evidence/D079`, `D085`) |
| Hosted Supabase (`ivtdfioypmzknlhinstg`) | **Only 0001–0003 applied** (per the `docs/DEPLOYMENT.md` record). 0004–0027 not applied | Not re-checked this session (needs user consent / access token) |
| Vercel production URL | Previous deployment. **No verification of the new features** | D088 re-verifies after the user deploys |

Local PASS does not mean hosted or production PASS. After deploying, update the second and third rows only with evidence.

## Migrations: phases and compatibility
Phases: expand (additions only, old app unaffected), backfill (transforms existing data), switch (replaces policy/function behaviour), contract (removes things the old app may use).

| Version | Phase | Change | Old-app impact / rollback (forward fix) |
|---|---|---|---|
| `202611190001` | expand | Core tables, RLS, roles | Already applied |
| `202611190002` | expand | HOT DTO, operations functions | Already applied |
| `202611190003` | expand | JSON DTO check constraints | Already applied |
| `202611190004` | expand+backfill+switch | Claims, claim_status backfill, proposals_insert policy replaced | Compatible. Rollback = fix the policy in a new migration |
| `202611190005` | expand+switch | Price/availability null, moderation_lock, moderate_entity redefined | Old app's profile save may fail on the new constraints. Deploy the app immediately |
| `202611190006` | expand | pg_trgm, search RPC | None |
| `202611190007` | expand+switch | Recruiting deadline/capacity, proposals_insert replaced | Compatible |
| `202611190008` | contract | saved_lists added, saved_creators migrated then **dropped** | **Old app's saved favourites break**. Deploy the app straight after the DB. Rollback: no restore possible after the drop, so back up first |
| `202611190009` | expand+switch | Proposal state machine and events, status constraint widened, messages_insert replaced (fixes the hosted messages.kind policy bug) | Compatible |
| `202611190010` | expand | Notifications and cursors | None |
| `202611190011` | contract | Report queue, reports constraints replaced and backfilled, **`review_report(uuid,text)` signature dropped** | **Old admin review breaks**. Deploy the app straight after the DB |
| `202611190012` | expand | Personal data export | None |
| `202611190013` | expand+switch | private-uploads bucket, unused portfolios bucket's direct upload/delete policies removed | Old app has no upload UI, so no impact |
| `202611190014` | expand+switch | Blocks/contact restrictions/rate limits, report kind constraint widened, submit_report and transition_proposal redefined | Compatible (constraint only widens) |
| `202611190015` | expand+backfill+switch | Tombstones and retention, **suppressed_sources keys converted to hashes (irreversible)**, guard compares hashes | Old app doesn't read it, so no impact. Rollback: originals can't be restored after hashing (intended) |
| `202611190016` | expand | Admin-only operations stats `ops_stats()` (sizes/counts only) | None |
| `202611190017` | expand | Pseudonymous activation funnel events `product_events` (triggers, dedupe key), `profiles.analytics_opt_out`, admin `product_funnel()`; `run_retention` deletes events after 400 days | None (new column defaults to false) |
| `202611190018` | expand | Separated service email / marketing consent (version, time) / interests on `profiles`, `consent_log` history, `email_outbox` (withdrawal cancels queued mail), `set_preferences()`, `enqueue_marketing()` | None (service on, marketing off by default) |
| `202611190019` | expand | Private `creator_notes` (owner-only RLS, separate from messages) and `compare_reports` (2–3 creators, private/link share with server-minted token), `shared_compare()` returns title + ids only | None |
| `202611190020` | expand | `matching_feedback` (campaign-owner rating, reason codes, scorer version, shown rank/score) and admin `matching_feedback_dataset()` (no rater id, campaign-grouped split, accept outcome as label) | None |
| `202611190021` | expand | `ai_usage` daily per-user counts (no prompt/output stored), service-only `reserve_ai_call()` (per-user + global daily cap, serialized) and `record_ai_tokens()` | None |
| `202611190022` | expand+switch | `email_outbox` delivery state (channel, template+version, attempts/backoff, lease, dead-letter), idempotency key changed to event+recipient+channel (same rows), enqueue functions set template version, `email_secret` + one-click `unsubscribe_email()`, service-only `claim_emails()`/`finish_email()`, admin `email_outbox_stats()` | None: table is server-only and had no sender. Old unique replaced by a stricter-equivalent one |
| `202611190023` | expand | Brand-private `review_checklist_items` (max 10) and `creator_reviews` (checked items, memo, manual approval, reviewer), `set_creator_review()`, `selection_gate` trigger: with a checklist, accepting an application needs an approval covering all current items | None for brands without a checklist (gate inactive) |
| `202611190024` | expand | `is_test_email()` (reserved test domains), PII-free `ops_errors` + service-only `record_error()`, `inquiries` (own/admin read, service-only `submit_inquiry()` with limits, admin `answer_inquiry()`), admin `ops_metrics(days)` excluding test accounts and demo campaigns | None |
| `202611190025` | expand+switch | Usage ledger: `entitlements` gains grant reason/note/granter, revoke fields, credits ≥ 0, `order_id` nullable for admin grants, guard trigger (no re-activation or extension); `credit_reservations` + `credit_ledger`; service-only `credit_reserve()`/`credit_settle()`/`release_stale_reservations()`; admin `admin_grant_entitlement()` (reason required) and `revoke_entitlement()`; `active_hot_creators()` excludes revoked | Compatible: existing rows become `purchase`. Client write grants on orders/entitlements revoked (RLS already denied them) |
| `202611190026` | expand+switch | `promotion_impressions` (per day × entitlement, owner/admin read), service-only `serve_promotion_slots(record)` (≤3 TEST HOT slots, minimal DTO, counts impressions); client execute on `active_hot_creators()` revoked | Old app: the HOT strip on /creators disappears (TEST-only feature). Deploy the app right after |
| `202611190027` | expand | TEST payment cancellation: `payment_cancellations` (owner/admin read, one live per order, idempotency key), service-only `begin_test_cancel()` (owner + paid + no used/in-flight credits) and `finish_test_cancel()` (order cancelled, entitlement revoked, ledger + audit) | None (new table/functions) |

Order: apply DB migrations (single CLI run, each file in its own transaction) → deploy the app **immediately** → verify the URL (D088). Because of 0008 and 0011 the old app will partly fail for a few minutes in between. This is a TEST service, so a short maintenance window is acceptable.

Rollback policy:
- **App**: switch to a previously verified deployment with `vercel rollback`. The new DB stays as is.
  - Note: reverting to the old app against the new DB means saved favourites and admin review don't work, so the old app is only for emergency read-only use.
- **DB**: no automatic rollback (Supabase migrations are forward-only).
  - Before commit: a failing file leaves no trace, because each file runs in one transaction. Verified locally with `migration_check.py --rollback-sim`.
  - After commit: preferably a **forward-fix migration**. For data loss, restore a backup (D087), then re-apply deletions (D079 `reapply`).
  - Never delete payment/order (TEST) records as a rollback strategy.

## Environment settings
| Name | Where | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Yes | Public value |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Yes | Public value |
| `NEXT_PUBLIC_APP_URL` | Vercel | Yes | Basis for Toss success/fail redirects and auth emails |
| `SERVICE_MODE` | Vercel | Yes | `free_beta` (default) or `test_demo` |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | For uploads, retention, ledger | Without it: uploads 503, retention 503. Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | Vercel | For payment TEST | `test_ck_` only (API 개별 연동 key, not the widget `test_gck_`). Without it payment is BLOCKED |
| `TOSS_SECRET_KEY` | Supabase Edge Function secret | For payment TEST | `test_sk_` only (API 개별 연동 set with `test_ck_`; widget `test_gsk_` keys don't match `payment()`). Edge Function refuses anything else |
| `YOUTUBE_API_KEY` | Vercel (server only) | For collection | Collection stays blocked until policy approval |
| Supabase Auth redirect URLs | Supabase console | Yes | Production URL `/auth/callback`, `/login/reset` |
| SMTP (Auth emails) | Supabase console | For real email delivery | Default sending limits apply (U007) |

## User deployment checklist (in order)
1. [ ] Back up the hosted DB first (dashboard backup or the D087 procedure). Store it locally.
2. [ ] Check local gates PASS: `npm run lint && npm run typecheck && npm test && npm run build`, `python3 harness/secret_scan.py --all`, `python3 harness/migration_check.py`.
3. [ ] Supabase CLI `supabase link` → `supabase db push` (0004–0027). On failure that file is rolled back. Don't apply the rest; ask for a forward fix.
4. [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (server only) to Vercel env and check the remaining variables.
5. [ ] Deploy production on Vercel (straight after step 3).
6. [ ] Hand the agent the deployment URL, commit and environment, and have it run D088 verification (public URL E2E, headers, permission denials, mobile).
7. [ ] After verification, update the "State" table above and `docs/DEPLOYMENT.md` with the evidence.
8. [ ] If there's a problem: app → `vercel rollback`; DB → forward-fix migration. Never delete payment records.

## CI
- `.github/workflows/ci.yml`: **validation only** (no deployment workflow; deployment needs user approval).
  - `checks` job: secret scan, harness self-tests, migration static check, lint/typecheck/unit/build.
  - `migrations` job: applies every migration from scratch on a disposable local Supabase and runs the DB permission tests.
