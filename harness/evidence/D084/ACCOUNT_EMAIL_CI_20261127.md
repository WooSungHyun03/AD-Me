# D084 — account-email in CI E2E, Auth mail templates on local stacks (2026-11-27)

## Remote CI for a5829d9 (run 45956532924)
214 passed / 2 failed (retention ×2, known DEV-B/U001) / 4 skipped — same as the local fresh run.

## Change
- `supabase/config.toml`: the confirmation, recovery and email-change templates (`supabase/templates/*`, already
  used by the replica setup) are now configured for every local stack, so CI mail carries token-hash links to the
  app's `/auth/confirm`. No CI spec read mail links before; production Auth config is not touched.
- `tests/support/local-qa.mjs`: `isCi()` (shared by `localAccounts`) and `localAppOrigin()` — CI `site_url`
  `http://localhost:3000`, replica `https://127.0.0.1:3143`. `local-auth-mail.ts` checks mail-link origin against it.
- `account-email.spec.ts` moved to `tests/e2e/`:
  - recovery (expired/reused proof, another role's session, refresh revocation) runs in CI;
  - the double email-change proof is skipped in CI only: CI Auth runs with `enable_confirmations=false`
    (`MAILER_AUTOCONFIRM=true`), and one proof then completes the change. About 10 CI specs and both provisioning
    scripts rely on that autoconfirm, so it stays. The replica (autoconfirm off) still runs it via
    `playwright.local.config.ts`, which includes `tests/e2e`.
  - the email-form status check now filters by its message (settings has 4 status regions; strict-mode violation).

## Runs
- ci-e2e (app on :3000 like CI): account-email 2 passed / 2 skipped; fresh-DB full E2E 216 passed / 2 failed
  (retention) / 6 skipped.
- Replica: account-email (email change + recovery) and email-signup 6 passed.

email-signup stays local-only (needs confirmation-required signup); decision-retry remains. Not production-verified.
