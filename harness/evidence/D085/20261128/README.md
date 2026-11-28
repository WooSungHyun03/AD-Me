# D085 — fifth clean-DB run (2026-11-28, main 300c8ef)

Command: `bash tests/ci-db.sh` on Windows, the same script as the CI `migrations` job. It ran on an isolated local Supabase from an empty DB, in the DEV-B worktree. The log is not committed; it was scanned for secret patterns, and the only 2 hits are the `aware_recommendation` false positive.

Why this run: DEV-A D084 (`60e350e`..`300c8ef`) moved more local specs into CI E2E and added local Auth mail templates to `supabase/config.toml`. The CI `migrations` job still fails, and its logs require auth, so it was reproduced locally.

## Results
| Item | 11-27 (4aff8b0) | This run (300c8ef) |
|---|---|---|
| Migrations | 141 PASS | **141 PASS** |
| E2E (desktop+mobile) | 136 passed / 2 failed / 4 skipped | **214 passed / 6 failed / 6 skipped** |
| DB suites | 29/29 | **29/29** |
| restore_drill | PASS | **PASS** (data RTO 1.27 s, schema 40 s) |

E2E failures:
- `retention.spec.ts:26` ×2: expected. It waits on U001, after which D079 restores the retention table.
- `account-email.spec.ts:168` ×2 ("Local token-hash email template missing") and `service.spec.ts:93` ×2 (billing confirm took 5.1 s and returned the retryable 503 instead of the missing-secret 503). Both came from the local stack, not from code:
  - Docker Desktop had restarted, so `supabase stop` failed and the old containers came back up without the new `config.toml`.
  - After a proper `supabase stop` / `supabase start`, the Auth container loaded the templates (3 template env entries).
  - Re-running both specs then passed 6/6 tests (log: `e2e-rerun-1128.txt` in the session scratchpad).
  - In that re-run, `service.spec.ts:258` stopped at the admin OTP field only because this run's restore drill had reset the admin TOTP fixture. It passed in the full run above. The QA accounts were re-provisioned afterwards.

So on a correctly started stack, the only remaining failure is retention ×2 (U001). Remote CI starts a fresh stack each run, so its failure is expected to be the same.

## Local-only pitfall (no code change)
A checkout that still holds DEV-A's ignored replica folder `output/dev-a-db/runtime.local.json` makes `tests/support/local-qa.mjs` leave CI mode. It then uses the absent container `supabase_db_dev-a-db`, which produced 88 false failures in a first attempt from the main checkout. Before running `tests/ci-db.sh` locally, move that folder aside, then restore it. This run did exactly that. CI has no such file.

## Remaining
- retention ×2 → U001 approval, then D079 restores the table and the `migrations` job turns green.
- Hosted application of the release packet `docs/handoff/release-20261127/` → U004/U005 (not executed by the agent).
