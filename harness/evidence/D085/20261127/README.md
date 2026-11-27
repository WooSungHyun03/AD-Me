# D085 — fourth clean-DB run (2026-11-27, main 4aff8b0)

Command: `bash tests/ci-db.sh` on Windows, the same script as the CI `migrations` job. It ran on an isolated local Supabase from an empty DB. Full log: `ci-db.txt`.

- **Secret scan:** the log was scanned for secret patterns. The only 2 hits are the false positive `aware_recommendation` in a migration file name; no secret is present.
- **Scope:** this run covers the two new migrations from today:
  - `20261127100000` (D024 numeric views)
  - `20261127110000` (D058 staff search labels)

## Results
| Item | 11-26 (bfa2314) | This run (4aff8b0) |
|---|---|---|
| Migrations | 139 PASS | **141 PASS** |
| E2E (desktop+mobile) | 118 passed / 2 failed / 4 skipped | **136 passed / 2 failed / 4 skipped** |
| DB suites | 29/29 | **29/29** |
| restore_drill | PASS (data RTO 1.3 s) | **PASS** (data RTO 0.92 s, schema 38 s) |

- **E2E failures:** only `retention.spec.ts:26` on desktop and mobile. That is the expected failure from the user's 2026-11-26 decision: U001 approval comes first, then the D079 retention table is restored.
- **New E2E specs:** the increase in E2E specs comes from DEV-A D084 promoting local specs (`6af5eb3`, `fcf3b4b`).
- **Comparison with remote CI:** DEV-A recorded 136/2/4 on attempt 2 of remote CI run 45853997118, and this local run matches it.
- **Flaky test not seen:** the intermittent `service.spec.ts:25` load-more failure did not occur here.
- **Later commits:** `8ddcb58` (alert drill) and `5a6397a` (Resend adapter) came after this run. They change no migration or DB, and they are covered by the full unit suite (100 files, 608 tests).

## Remaining
- retention ×2 → after U001 approval, D079 restores the table and the `migrations` job turns green.
