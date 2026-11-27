# D084 — account-dependent local specs promoted to CI E2E (2026-11-27)

## Change
- `tests/support/local-qa.mjs`: `localAccounts()` uses the same switch as `localRuntime()` — replica
  `output/dev-a-db/accounts.local.json`, or the CI stack's provisioned `.accounts.local.json` (same brand/creator/other/admin shape).
- 19 local specs read accounts through `localAccounts()` instead of the replica path.
- Moved to `tests/e2e/` (14): campaign-brief-files, campaign-terms, conversation, deliverables, independent-tickets,
  product-condition-workflow, recommendation-policy, recommendation-snapshots, saved-search-alerts, sequential-dev-a,
  youtube-campaign, entitlement-boundary, p0-consent-accessibility, reviews.
- `youtube-campaign`: earlier specs leave the shared CI creator `claim_status='verified'`, so the expected 409 became 200
  in a full run. The spec now sets `unclaimed` for itself and restores the prior value.
- `playwright.free-local.config.ts` points at `e2e/campaign-terms.spec.ts`.

## Runs
- ci-e2e (fresh DB, trial config over local-browser, 19 specs): 53 passed / 5 failed — the 4 specs below.
- Replica, 19 specs after the change: 46 passed / 12 failed. Baseline on unmodified code for entitlement-boundary,
  p0-consent-accessibility and reviews fails identically (admin MFA `locator.fill` timeout), so pre-existing replica state;
  ready-p1 also fails on both stacks.
- ci-e2e fresh DB full E2E with the 14 moved: 190 passed / 4 failed (retention ×2 known; youtube-campaign ×2 → fixed above)
  / 4 skipped. youtube-campaign after fix on that same dirty DB: 2 passed, claim restored to `verified`.
- Replica: youtube-campaign + campaign-terms 6 passed. prettier, eslint, `tsc --noEmit` pass.

## Still local-only (with reason)
- deadline-reminders (desktop), schedule-history (desktop), p0-finish (mobile): fail on ci-e2e, cause not yet investigated.
- ready-p1: "Fixture decision failed" on both stacks.
- ops, p0: use replica-only `staff` / `adminEnrollment` accounts.
- account-email, email-signup, session-lifecycle, decision-retry: see PROMOTE_LOCAL_SPECS_20261127.md.

Not production-verified. A second fresh full run after the youtube-campaign fix was not done.
