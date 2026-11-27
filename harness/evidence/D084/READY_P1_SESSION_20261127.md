# D084 — ready-p1 and session-lifecycle in CI E2E; replica admin specs restored (2026-11-27)

## Causes found
1. `tests/support/discovery-fixture.mjs` read the replica accounts file directly → on CI the admin id was wrong.
   Now uses `localAccounts()`.
2. On the replica, `review_decide` returned "approved recent MFA required": the fictional QA admin's
   `administrator_grants.expires_at` had passed (2026-11-26 07:15 UTC), so `is_admin_provisioned()` was false. This
   also caused the replica-only admin failures in entitlement-boundary, p0-consent-accessibility and reviews.
   Replica (d002-replica, DEV-A local) grant extended 7 days; no code change. Owner stack untouched.
3. The fixture threw before returning `cleanup`, leaking 3 fixture publication policies, creators/users and an enabled
   `adme_review.policy` (later runs then saw the engagement filter enabled → ready-p1 `toBeDisabled` failure).
   Setup failures now run the same cleanup and rethrow. Replica leaks removed; review policy reset to column defaults.
4. CI runtime had no `JWT_SECRET`, so `localJwt` failed ("key argument … undefined"; also the earlier
   session-lifecycle blocker). `ciRuntime()` now reads `GOTRUE_JWT_SECRET` from the local stack's auth container,
   lazily and cached. The value is never printed or written.

## Moved to tests/e2e/
ready-p1, session-lifecycle.

## Runs
- Replica: ready-p1 4 passed (0 leaked policies after); entitlement-boundary + reviews + p0-consent-accessibility
  12 passed; session-lifecycle 2 passed.
- ci-e2e: ready-p1 4 passed; session-lifecycle 2 passed.
- ci-e2e fresh DB full E2E: 206 passed / 2 failed (retention ×2, known DEV-B/U001) / 4 skipped.
- Remote CI 45941535538 (6158a53, load-more fix): 200 passed / retention ×2 only — service:25 no longer fails.
- Unit 101 files / 611 tests, eslint, `tsc --noEmit` pass.

Still local-only: ops, p0 (replica-only staff/adminEnrollment), account-email, email-signup (mail templates),
decision-retry (cause unconfirmed). Not production-verified.
