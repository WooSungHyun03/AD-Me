# D084 — product-condition submit race (PR-001 UI), ops/p0 specs in CI E2E (2026-11-27)

## product-condition-workflow failed on remote CI 45944353872 (b1c0fb2, desktop)
- Retry click found "상품 조건 추출 요청" disabled (`data !== null`).
- Cause: the workbench fetches the stored request on mount; on a slow dev server that GET can finish after the
  user's first POST was processed, so the new request appears and locks the form mid-retry. Probe with the initial
  GET delayed 2.5 s: 1 of 5 runs failed.
- Fix (`src/components/product-condition-workbench.tsx`): the extract button stays disabled until the stored
  request is loaded (or the load fails, keeping the existing manual path). Probe + real spec ×6 each: 12 passed.

## ops and p0 promoted
- ops: no longer uses the replica-only shared `staff` account or rewrites its TOTP secret into the accounts file.
  Each run creates a fictional staff user (`adme_ops.provision_staff`, 1 h), enrolls TOTP, asserts the same
  delegated-access/403 checks, then deletes the staff row, audit rows and the Auth user.
- p0: reads accounts through `localAccounts()` (its enrollment admin was already created per run).

## Replica environment (not code)
- The replica's local TLS certificate (`output/dev-a-db/tls.local.crt`, 2-day validity) expired 2026-11-27 05:32 UTC,
  so the app could not reach the replica API ("요청 한도를 확인하지 못했습니다" on login). Regenerated with the same
  OpenSSL parameters as `scripts/setup-local-qa.mjs` (ignored path; valid to 2026-11-29 06:54 UTC).

## Runs
- ci-e2e: ops + p0 8 passed. Fresh DB full E2E: 214 passed / 2 failed (retention ×2, known DEV-B/U001) / 4 skipped.
- Replica: ops + p0 + product-condition-workflow 10 passed; no QA staff/enrollment users left by these runs.
- Unit 101 files / 611 tests, eslint, `tsc --noEmit` pass.

Still local-only: account-email, email-signup (token-hash mail templates), decision-retry (cause unconfirmed).
Not production-verified.
