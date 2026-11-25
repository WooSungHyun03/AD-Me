# D075/D057 · 2026-11-25 admin report review + duplicate report race (new; earlier evidence unchanged)

Base: origin/main `1d31c9b`. Migration `20261125120000_report_review_queue_contract.sql`, applied only to the isolated loopback replica `d002-replica`. No hosted DB, deployment, payment or provider action.

## Reproduction (before)
- R1 Admin `/admin` → 이전 접수 신고 → "검토 완료" → `/api/admin` → `admin_review_report('reviewed')` → `23514 reports_status_check`. `report_queue` (100011) had removed `reviewed` and migrated old rows to `resolved`; the report stayed `pending` (`GUARD_20261125.md`).
- R2 `submit_report` `duplicate_open` was check-then-insert: 8 concurrent same-reporter/target/kind calls left 5 open duplicates, reproduced 3/3 (`SUITES_20261125.md`).

## Change (smallest compatible)
- `admin_review_report` keeps its signature, grants, admin check, status enum (`reviewed`/`dismissed`) and support audit. It now delegates to the queue transition `review_report(id, reviewed→resolved, reason)`, so row lock, allowed transitions, `response`, `decided_by/at`, `report_events` and `audit_log` come from one place. The API and UI are unchanged.
- `submit_report` takes `pg_advisory_xact_lock` per reporter/target/kind before the duplicate check. It is patched in place with a STOP guard, like 065. No unique index is added, so existing hosted duplicates cannot fail the upgrade.
- The queue's `review_report` contract (in_review, interim hide, appeals; `tests/reports.mjs`, `retention.mjs`) is intentionally unchanged. A terminal decision without a response is still refused (`response_required`).

## Results
| Check | Result |
|---|---|
| `local-admin-support-security` | PASS 4 (was FAIL): reviewed → `resolved`, response = reason, decided_by = admin, support_audit row, support role denied |
| `local-rate-security` | PASS 8: same-target race → exactly 1 open, rest `duplicate_open`; distinct targets → 5 ok, rest `PT429` |
| All 38 local suites | 34 PASS / 188 cases (`suites-fix-20261125.json`); only the 4 Windows-pinned historical `*-upgrade` suites not run |
| lint / typecheck / `npm test` | PASS / PASS / 571 |
| Desktop 1440 / mobile 390 (`admin_review_screens_20261125.mjs`) | PASS: AAL2 admin (password + TOTP) → search → "검토 완료" → screen and DB `resolved`, no error, no horizontal overflow; `screens_20261125/` |
| Migration fingerprint | `13fc6e600e27c90fd3552053cac60eeb256744004204461e4242ba8b711b33f2` |

## Remaining gates
- **Operator:** production deploys are held by `scripts/production-schema.mjs` until this migration is applied to production and the fingerprint above is approved (`ADME_PRODUCTION_SCHEMA_SHA256`). Before applying, confirm the hosted `submit_report` matches main (the STOP guard aborts otherwise).
- DEV-B D060: shared support-search/audit contract unchanged; review this mapping on integration (D085).
- `tests/reports.mjs` / `retention.mjs` need owner `.env.local`; not run here.
