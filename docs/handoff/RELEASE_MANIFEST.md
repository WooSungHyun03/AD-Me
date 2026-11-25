# Release manifest: DB migrations, environment, user deployment checklist (D085)

Current as of 2026-11-25 (pending packet below; earlier environment rows are historical). DEV-B migrations were renumbered `202611231000NN` (formerly `2026111900NN`, same suffix) so they apply after DEV-A's main. `harness/migration_check.py` checks that every migration file appears in the table below exactly once, and that any migration containing destructive SQL is marked contract.

## State (kept separate per environment)
| Environment | State | Basis |
|---|---|---|
| Local isolated Supabase (Docker) | 0001–0016 applied, full regression PASS | Agent ran it 2026-11-22 (`harness/evidence/D079`, `D085`) |
| Hosted Supabase (`ivtdfioypmzknlhinstg`) | DEV-A and DEV-B release migrations through repository version `20261123100029` applied | [D088 production ledger mapping](../../harness/evidence/D088/README.md) |
| Vercel production URL | PR #3 and release corrections promoted and checked at be-celeb.org | [D088 production verification](../../harness/evidence/D088/README.md) |

The D088 evidence records checks performed against the hosted database and production URL.

## 2026-11-25 pending hosted application packet (D085)

Prepared from main for operator review (U004 DB, U005 app). **Nothing here has been applied to the hosted database by DEV-B.** Local results and hosted state are recorded separately.

- Repository: 128 migrations. The last version mapped to the hosted ledger is `20261123100029` ([D088 mapping](../../harness/evidence/D088/README.md)); the hosted ledger has 41 rows with different historical version names, and the 2026-11-24 read-only check found the product-condition RPC (`20261124020115`) absent. The 24 files below are therefore treated as pending until the operator confirms each body/grant/call contract against the restored backup.
- Apply strictly in version order, in one reviewed batch per group, after a fresh backup and a restore-upgrade rehearsal (`RELEASE_BASELINE.md` 2026-11-25). No row below is phase `contract`; rollback is forward fix (old app keeps working against expand/switch objects).
- Then register the fingerprint of the exact commit with `node scripts/production-schema.mjs --fingerprint` as `ADME_PRODUCTION_SCHEMA_SHA256`; until then `vercel.json` skips/blocks production builds. A locally computed fingerprint is not approval.
- `20261125120000` contains a STOP guard: it aborts if the hosted `submit_report` body differs from main. Treat an abort as "do not continue", not as a retry.

| # | Version | Phase | Owner | File |
|---|---|---|---|---|
| 1 | `20261123110001` | switch | DEV-A | `20261123110001_youtube_public_boundary.sql` |
| 2 | `20261123112401` | expand/switch | DEV-A | `20261123112401_youtube_directory_pagination.sql` |
| 3 | `20261123113123` | switch | DEV-A | `20261123113123_youtube_directory_cursor_integer.sql` |
| 4 | `20261123114341` | switch | DEV-A | `20261123114341_saved_catalog_list_compatibility.sql` |
| 5 | `20261123114636` | switch | DEV-A | `20261123114636_promotion_public_reference_boundary.sql` |
| 6 | `20261123121526` | expand | DEV-A | `20261123121526_campaign_brief_file_versions.sql` |
| 7 | `20261123122650` | expand | DEV-A | `20261123122650_brief_upload_attestation_snapshot.sql` |
| 8 | `20261123123531` | switch | DEV-A | `20261123123531_brief_account_budget.sql` |
| 9 | `20261123125600` | expand/switch | DEV-A | `20261123125600_policy_aware_recommendation_snapshots.sql` |
| 10 | `20261124020115` | expand/switch | DEV-A | `20261124020115_owned_product_condition_workflow.sql` |
| 11 | `20261124021507` | switch | DEV-A | `20261124021507_validate_minimized_product_source.sql` |
| 12 | `20261124022829` | expand/switch | DEV-A | `20261124022829_explicit_product_job_operation.sql` |
| 13 | `20261124073053` | expand/switch | DEV-B | `20261124073053_free_campaign_marketplace.sql` |
| 14 | `20261124074917` | switch | DEV-B | `20261124074917_test_entitlement_grant_boundary.sql` |
| 15 | `20261124080724` | expand/switch | DEV-B | `20261124080724_demo_catalog_boundary.sql` |
| 16 | `20261124124402` | switch | DEV-B | `20261124124402_privacy_session_reauthentication.sql` |
| 17 | `20261124125948` | expand/switch | DEV-B | `20261124125948_campaign_recruitment_window.sql` |
| 18 | `20261124133155` | expand/switch | DEV-B | `20261124133155_proposal_transition_requests.sql` |
| 19 | `20261124133707` | switch | DEV-B | `20261124133707_proposal_acceptance_eligibility.sql` |
| 20 | `20261125120000` | switch | DEV-A | `20261125120000_report_review_queue_contract.sql` |
| 21 | `20261125130000` | expand | DEV-B | `20261125130000_d036_saved_list_public_refs.sql` |
| 22 | `20261125150000` | expand/switch | DEV-A | `20261125150000_d037_saved_search_alerts.sql` |
| 23 | `20261125160000` | expand | DEV-B | `20261125160000_d038_saved_list_import_refs.sql` |
| 24 | `20261125170000` | expand/switch | DEV-A | `20261125170000_d055_deadline_reminders.sql` |

### CI gate (2026-11-25)
- Every main commit from `1d31c9b` to `59f7eba` failed GitHub validation. The `checks` job failed on `migration_check` because `20261125120000` had no manifest row, which also skipped the DB job; before that, `tests/ci-db.sh` failed. A red `checks` job hides DB/E2E regressions, so run `python3 harness/migration_check.py` before pushing any SQL.
- `harness/migration_check_test.py` (checker rule regressions) now runs in CI.

## Migrations: phases and compatibility
Phases: expand (additions only, old app unaffected), backfill (transforms existing data), switch (replaces policy/function behaviour), contract (removes things the old app may use).

| Version | Phase | Change | Old-app impact / rollback (forward fix) |
|---|---|---|---|
| `202611190001` | expand | Core tables, RLS, roles | Already applied |
| `202611190002` | expand | HOT DTO, operations functions | Already applied |
| `202611190003` | expand | JSON DTO check constraints | Already applied |
| `202611200001` | expand | (DEV-A) intelligence queue/settings in `adme_ops` | Upstream main; likely already applied to hosted, check with `supabase migration list` |
| `202611200002` | expand | (DEV-A) intelligence cron | Same as above |
| `202611200003` | switch | (DEV-A) safe settings update | Same as above |
| `202611200004` | expand | (DEV-A) YouTube channel ownership | Same as above |
| `202611200005` | switch | (DEV-A) private operations functions | Same as above |
| `20261122115249` | expand+switch | (DEV-A) YouTube marketplace: jobs, credit use, `active_hot_creators` redefined, reports nullable creator | Same as above |
| `20261122115930` | expand+switch | (DEV-A) marketplace chat, realtime, `messages_insert`/`proposals_insert` changed | Same as above |
| `20261122224757` | backfill | (DEV-A) featured YouTube directory, **demo creators deleted** | Same as above. Local tests re-insert fictional rows from `seed.sql` (never pushed to hosted) |
| `20261122231018` | expand | (DEV-A) YouTube profile details | Same as above |
| `20261122231403` | expand | (DEV-A) YouTube profile contact | Same as above |
| `20261122231628` | switch | (DEV-A) profile/claim sync | Same as above |
| `20261123100004` | expand+backfill+switch | Claims, claim_status backfill, proposals_insert policy replaced | Compatible. Rollback = fix the policy in a new migration |
| `20261123100005` | expand+switch | Price/availability null, moderation_lock, moderate_entity redefined | Old app's profile save may fail on the new constraints. Deploy the app immediately |
| `20261123100006` | expand | pg_trgm, search RPC | None |
| `20261123100007` | expand+switch | Recruiting deadline/capacity, proposals_insert replaced | Compatible |
| `20261123100008` | contract | saved_lists added, saved_creators migrated then **dropped** | **Old app's saved favourites break**. Deploy the app straight after the DB. Rollback: no restore possible after the drop, so back up first |
| `20261123100009` | expand+switch | Proposal state machine and events, status constraint widened, messages_insert replaced (fixes the hosted messages.kind policy bug) | Compatible |
| `20261123100010` | expand | Notifications and cursors | None |
| `20261123100011` | contract | Report queue, reports constraints replaced and backfilled, **`review_report(uuid,text)` signature dropped** | **Old admin review breaks**. Deploy the app straight after the DB |
| `20261123100012` | expand | Personal data export | None |
| `20261123100013` | expand+switch | private-uploads bucket, unused portfolios bucket's direct upload/delete policies removed | Old app has no upload UI, so no impact |
| `20261123100014` | expand+switch | Blocks/contact restrictions/rate limits, report kind constraint widened, submit_report and transition_proposal redefined | Compatible (constraint only widens) |
| `20261123100015` | expand+backfill+switch | Tombstones and retention, **suppressed_sources keys converted to hashes (irreversible)**, guard compares hashes | Old app doesn't read it, so no impact. Rollback: originals can't be restored after hashing (intended) |
| `20261123100016` | expand | Admin-only operations stats `ops_stats()` (sizes/counts only) | None |
| `20261123100017` | expand | Pseudonymous activation funnel events `product_events` (triggers, dedupe key), `profiles.analytics_opt_out`, admin `product_funnel()`; `run_retention` deletes events after 400 days | None (new column defaults to false) |
| `20261123100018` | expand | Separated service email / marketing consent (version, time) / interests on `profiles`, `consent_log` history, `email_outbox` (withdrawal cancels queued mail), `set_preferences()`, `enqueue_marketing()` | None (service on, marketing off by default) |
| `20261123100019` | expand | Private `creator_notes` (owner-only RLS, separate from messages) and `compare_reports` (2–3 creators, private/link share with server-minted token), `shared_compare()` returns title + ids only | None |
| `20261123100020` | expand | `matching_feedback` (campaign-owner rating, reason codes, scorer version, shown rank/score) and admin `matching_feedback_dataset()` (no rater id, campaign-grouped split, accept outcome as label) | None |
| `20261123100021` | expand | `ai_usage` daily per-user counts (no prompt/output stored), service-only `reserve_ai_call()` (per-user + global daily cap, serialized) and `record_ai_tokens()` | None |
| `20261123100022` | expand+switch | `email_outbox` delivery state (channel, template+version, attempts/backoff, lease, dead-letter), idempotency key changed to event+recipient+channel (same rows), enqueue functions set template version, `email_secret` + one-click `unsubscribe_email()`, service-only `claim_emails()`/`finish_email()`, admin `email_outbox_stats()` | None: table is server-only and had no sender. Old unique replaced by a stricter-equivalent one |
| `20261123100023` | expand | Brand-private `review_checklist_items` (max 10) and `creator_reviews` (checked items, memo, manual approval, reviewer), `set_creator_review()`, `selection_gate` trigger: with a checklist, accepting an application needs an approval covering all current items | None for brands without a checklist (gate inactive) |
| `20261123100024` | expand | `is_test_email()` (reserved test domains), PII-free `ops_errors` + service-only `record_error()`, `inquiries` (own/admin read, service-only `submit_inquiry()` with limits, admin `answer_inquiry()`), admin `ops_metrics(days)` excluding test accounts and demo campaigns | None |
| `20261123100025` | expand+switch | Usage ledger: `entitlements` gains grant reason/note/granter, revoke fields, credits ≥ 0, `order_id` nullable for admin grants, guard trigger (no re-activation or extension); `credit_reservations` + `credit_ledger`; service-only `credit_reserve()`/`credit_settle()`/`release_stale_reservations()`; admin `admin_grant_entitlement()` (reason required) and `revoke_entitlement()`; `active_hot_creators()` excludes revoked | Compatible: existing rows become `purchase`. Client write grants on orders/entitlements revoked (RLS already denied them) |
| `20261123100026` | expand+switch | `promotion_impressions` (per day × entitlement, owner/admin read), service-only `serve_promotion_slots(record)` (≤3 TEST HOT slots, minimal DTO, counts impressions); client execute on `active_hot_creators()` revoked | Old app: the HOT strip on /creators disappears (TEST-only feature). Deploy the app right after |
| `20261123100027` | expand | TEST payment cancellation: `payment_cancellations` (owner/admin read, one live per order, idempotency key), service-only `begin_test_cancel()` (owner + paid + no used/in-flight credits) and `finish_test_cancel()` (order cancelled, entitlement revoked, ledger + audit) | None (new table/functions) |
| `20261123100028` | switch | Merge fix: `proposals_insert` keeps DEV-B rules **and** DEV-A `marketplace_locked`; `messages_insert` keeps DEV-B block/state rules **and** DEV-A `chat_allowed` | Compatible (only adds conditions both apps already expect) |
| `20261123100029` | switch | Preserve the archived creator reference on appeals of historical reports | Compatible. Live creator reports use the existing flow. |


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
3. [ ] Supabase CLI `supabase link` → `supabase db push` (`20261123100004`–`20261123100029`; check `supabase migration list` first). On failure that file is rolled back. Don't apply the rest; ask for a forward fix.
4. [ ] Add `SUPABASE_SERVICE_ROLE_KEY` (server only) to Vercel env and check the remaining variables.
5. [ ] Deploy production on Vercel (straight after step 3).
6. [ ] Hand the agent the deployment URL, commit and environment, and have it run D088 verification (public URL E2E, headers, permission denials, mobile).
7. [ ] After verification, update the "State" table above and `docs/DEPLOYMENT.md` with the evidence.
8. [ ] If there's a problem: app → `vercel rollback`; DB → forward-fix migration. Never delete payment records.

## CI
- `.github/workflows/ci.yml`: **validation only** (no deployment workflow; deployment needs user approval).
  - `checks` job: secret scan, harness self-tests, migration static check, lint/typecheck/unit/build.
  - `migrations` job: applies every migration from scratch on a disposable local Supabase and runs the DB permission tests.


## DEV-A additive migration inventory — integrated 2026-11-23

These rows complete the source inventory; they do not assert any hosted application. Prior environment claims above are historical. Latest local integration has 103 migrations. Source compatibility and USER deployment gates remain required.

| Version | Phase | Change | Old-app impact / rollback |
|---|---|---|---|
| `202611190004` | switch | DEV-A: `202611190004_admin_security.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611190005` | switch | DEV-A: `202611190005_moderation_locks.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611190006` | expand | DEV-A: `202611190006_brand_profiles.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611190007` | expand | DEV-A: `202611190007_brand_projection.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200006` | switch | DEV-A: `202611200006_ops_mfa.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200007` | switch | DEV-A: `202611200007_rate_limits.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200008` | switch | DEV-A: `202611200008_youtube_moderation.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200010` | expand | DEV-A: `202611200010_message_policy.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200011` | switch | DEV-A: `202611200011_draft_read_limits.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200012` | expand | DEV-A: `202611200012_campaign_terms.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200013` | expand | DEV-A: `202611200013_creator_identity.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200014` | switch | DEV-A: `202611200014_creator_read_boundary.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200015` | switch | DEV-A: `202611200015_creator_catalog_quota.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200016` | expand | DEV-A: `202611200016_creator_boundary_activation.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200017` | switch | DEV-A: `202611200017_proposal_visibility.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200018` | expand | DEV-A: `202611200018_conversations.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200019` | expand | DEV-A: `202611200019_review_workflow.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200020` | switch | DEV-A: `202611200020_review_public_boundary.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200021` | switch | DEV-A: `202611200021_ad_history.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200022` | switch | DEV-A: `202611200022_review_withdraw_quota.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200023` | switch | DEV-A: `202611200023_ad_evidence_gate.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200024` | switch | DEV-A: `202611200024_latest_response_consent.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200025` | switch | DEV-A: `202611200025_deliverable_versions.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200026` | expand | DEV-A: `202611200026_recommendation_snapshots.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200027` | switch | DEV-A: `202611200027_recommendation_campaign_delete.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611200028` | expand | DEV-A: `202611200028_recommendation_read_budget.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210035` | expand | DEV-A: `202611210035_home_catalog.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210036` | switch | DEV-A: `202611210036_test_billing_boundary.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210037` | expand | DEV-A: `202611210037_filtered_catalog.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210038` | expand | DEV-A: `202611210038_auth_request_budget.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210039` | expand | DEV-A: `202611210039_private_images.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210040` | expand | DEV-A: `202611210040_brand_logo_projection.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210041` | switch | DEV-A: `202611210041_public_creator_references.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210042` | expand | DEV-A: `202611210042_normalized_public_read.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210043` | expand | DEV-A: `202611210043_image_transport_limit.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210044` | expand | DEV-A: `202611210044_service_budget_usage.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210045` | switch | DEV-A: `202611210045_reference_precedence.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210046` | expand | DEV-A: `202611210046_filter_reference_epoch.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210047` | expand | DEV-A: `202611210047_consent_versions.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210048` | expand | DEV-A: `202611210048_sensitive_boundaries.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210049` | switch | DEV-A: `202611210049_ingestion_recovery.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210050` | expand | DEV-A: `202611210050_source_budget_public_refs.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210051` | expand | DEV-A: `202611210051_brand_public_text.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210052` | expand | DEV-A: `202611210052_checkpoint_quota_reservation.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210053` | expand | DEV-A: `202611210053_withdraw_channel_consent.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210054` | expand | DEV-A: `202611210054_consent_rollout_boundary.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210055` | expand | DEV-A: `202611210055_publication_transactions.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210056` | expand | DEV-A: `202611210056_publication_guard_record.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210057` | expand | DEV-A: `202611210057_global_withdrawal_receipts.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210058` | expand | DEV-A: `202611210058_deletion_quarantine.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210059` | expand | DEV-A: `202611210059_deletion_private_helpers.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611210060` | expand | DEV-A: `202611210060_deletion_owned_jobs.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220061` | expand | DEV-A: `202611220061_ad_timeline.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220062` | expand | DEV-A: `202611220062_metric_history.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220063` | expand | DEV-A: `202611220063_ad_cursor_reference.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220064` | expand | DEV-A: `202611220064_metric_filters.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220065` | switch | DEV-A: `202611220065_admin_support.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220066` | expand | DEV-A: `202611220066_metric_metadata_guard.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220067` | expand | DEV-A: `202611220067_history_permission.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611220068` | expand | DEV-A: `202611220068_saved_searches.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611230075` | switch | DEV-A: `202611230075_main_integration_guards.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611230076` | switch | DEV-A: `202611230076_worker_integration.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `202611230077` | switch | DEV-A: `202611230077_worker_budget_compatibility.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `20261123110001` | switch | DEV-A: `20261123110001_youtube_public_boundary.sql` | Exact integrated local DB tested; hosted state unverified; forward fix only |
| `20261123055918` | expand | Include official public channel topics in the existing directory DTO | Compatible with older and newer public visibility rules. |
| `20261123112401` | expand/switch | DEV-A D033: `20261123112401_youtube_directory_pagination.sql` | Public directory server filtering, safe DTO and bounded keyset pagination; local fixtures only, hosted application pending. |
| `20261123113123` | switch | DEV-A D033: `20261123113123_youtube_directory_cursor_integer.sql` | Forward fix for integer microsecond cursor encoding; must apply together with directory pagination. |
| `20261123114341` | switch | DEV-A D075: `20261123114341_saved_catalog_list_compatibility.sql` | Repair safe default-favorites/CSV gateways after main retires saved_creators; no raw creator read grant. |
| `20261123114636` | switch | DEV-A D075: `20261123114636_promotion_public_reference_boundary.sql` | Preserve B service-only slots with A opaque-reference/publication/source and DB TEST gates. |
| `20261123121526` | expand | DEV-A D042: `20261123121526_campaign_brief_file_versions.sql` | Immutable owner-only files/versions and active pointer. Collection defaults OFF; U001/B D079 activation gates retained. |
| `20261123122650` | expand | DEV-A D042: `20261123122650_brief_upload_attestation_snapshot.sql` | Preserve upload rights attestation and policy reference without inventing consent for existing110 rows. |
| `20261123123531` | switch | DEV-A D042: `20261123123531_brief_account_budget.sql` | Serialize owner writes and cap brief files across the whole account, preserving immutability and default-OFF collection. |
| `20261123125600` | expand/switch | DEV-A D045: `20261123125600_policy_aware_recommendation_snapshots.sql` | Add version1.2 hard/soft/unknown policy snapshots with held counts and explicit demo scope; immutable1.0 results and legacy readers preserved. Reviewed112 baseline only; hosted rollout pending. |
| `20261124020115` | expand/switch | DEV-A PR-001: `20261124020115_owned_product_condition_workflow.sql` | Owner/product-bound requests and decisions on the existing budgeted worker; collection defaults OFF, policy/retention unset; apply reviewed113-to116 packet together. |
| `20261124021507` | switch | DEV-A PR-001: `20261124021507_validate_minimized_product_source.sql` | Reject minimized invalid source before job/quota reservation; forward-only fix. |
| `20261124022829` | expand/switch | DEV-A D075: `20261124022829_explicit_product_job_operation.sql` | Private checked operation field/trigger separates product jobs from legacy plain text; keeps deleted-source lease revocation. Reviewed113-to116 packet only; no hosted application. |
| `20261124073053` | expand/switch | DEV-B: `20261124073053_free_campaign_marketplace.sql` | Existing free campaign RPC migration117; recorded here without changing its SQL. Hosted application remains a separate release gate. |
| `20261124074917` | switch | DEV-B D001: `20261124074917_test_entitlement_grant_boundary.sql` | Existing manual TEST grant signature, audit and MFA preserved; database TEST boundary must be ON. Revocation/history preserved. Local117→118 verification; hosted application requires operator approval. |
| `20261124080724` | expand/switch | DEV-B D005: `20261124080724_demo_catalog_boundary.sql` | Default-OFF owner-only demo publication control, public creator projection/legacy search/count and restrictive public campaign gate. Existing rows/private history preserved; billing independent. Hosted118→119 requires operator approval. |
| `20261124124402` | switch | DEV-B D074: `20261124124402_privacy_session_reauthentication.sql` | Trusted current-session AMR/live-session check and serialized export quota, existing ticket/download/audit contracts preserved. Local119→120 only; hosted application requires operator approval. |
| `20261124125948` | expand/switch | DEV-B D043: `20261124125948_campaign_recruitment_window.sql` | Central application trigger enforces structured/legacy deadlines, capacity and job expiry across RPC/REST; safe board acceptance/count fields added. Existing proposals, publication and idempotent retries preserved. Local120→121 only; hosted application requires operator approval. |
| `20261124133155` | expand/switch | DEV-B D049: `20261124133155_proposal_transition_requests.sql` | Optional request-key acknowledgment RPC for pending accept/reject/cancel with private RLS receipts; delegates existing permission/state/event transaction. Legacy two-argument and delivery RPCs unchanged. Local121→122 only; hosted application requires operator approval. |
| `20261124133707` | switch | DEV-B D049: `20261124133707_proposal_acceptance_eligibility.sql` | Common pending→accepted trigger checks both parties' contact/privacy eligibility and current creator/campaign moderation, including legacy RPC. Existing accepted records retained. Apply reviewed122→123 together; hosted application requires operator approval. |
| `20261125120000` | switch | DEV-A D075/D057: `20261125120000_report_review_queue_contract.sql` | `admin_review_report` keeps signature/grants/audit and delegates reviewed→resolved to the queue `review_report`; `submit_report` duplicate check serialized by advisory lock (STOP guard if hosted body differs; no new index, existing duplicates kept). API/UI unchanged. Hosted application requires operator approval (fingerprint in harness/evidence/D075/REPORT_FIX_20261125.md). |
| `20261125130000` | expand | DEV-B D036: `20261125130000_d036_saved_list_public_refs.sql` | Authenticated-only gateways add/remove/read named groups and campaign shortlists by public creator reference with the catalog visibility gate; retry-safe add, owner-only DTO without internal IDs. Existing saved_lists/items rows, RLS and triggers unchanged. Local125 only; hosted application requires operator approval. |
| `20261125150000` | expand/switch | DEV-A D037: `20261125150000_d037_saved_search_alerts.sql` | Opt-in in-app new-candidate alerts. Adds `saved_conditions.notify/baseline_revision`, private `adme_search.seen_candidates`, and expands D052 `notifications` additively (nullable `proposal_id`, `saved_search_id`, `new_count`, kind `saved_search`; proposal rows/policy semantics unchanged; D015 service-email trigger skips the new kind). pg_cron `adme-saved-search-alerts` every 15 min runs the catalog matcher as each owner. Existing saved conditions default to alerts off. Local126 only; hosted application requires operator approval. |
| `20261125160000` | expand | DEV-B D038: `20261125160000_d038_saved_list_import_refs.sql` | Authenticated-only all-or-nothing CSV import gateway by public creator reference with the catalog visibility gate, owner-only list and hourly quota; replaces direct reads of public.creators that the D075 read boundary denies. Existing tables/RLS unchanged. Local only; hosted application requires operator approval. |
| `20261125170000` | expand/switch | DEV-A D055: `20261125170000_d055_deadline_reminders.sql` | In-app deadline reminders. Expands D052 `notifications` additively (kind `deadline`, `due_at`; subject check keeps proposal/saved-search rows unchanged; D015 service-email trigger skips the kind). Service-only `adme_ops.scan_deadline_reminders()` via pg_cron `adme-deadline-reminders` (hourly) inserts one reminder per side, milestone (production/posting) and due time for accepted/submitted/revision_requested proposals due within 24 h; dedup by `source_key`. Local128 only; hosted application requires operator approval. |
| `20261125180000` | switch | DEV-B D062: `20261125180000_d062_contact_guard_definer_paths.sql` | guard_contact enforces user blocks and admin contact restrictions on SECURITY DEFINER write paths (conversation_send, proposal RPCs) with a signed-in caller; direct REST keeps full contact_check incl. rate limits; guard triggers renamed to run first. Local only; hosted application requires operator approval. |
| `20261125190000` | switch/backfill | DEV-B D049/D026: `20261125190000_d049_owner_registration_claim.sql` | Owner self-registration inserted through SECURITY DEFINER save_publication is marked verified like direct inserts (UPDATE claim rules unchanged); backfills owned rows left `unclaimed` by that gap. Fixes D049 acceptance refusing new creators. Local only; hosted application requires operator approval. |
