# D084 · 2026-11-25 CI `security` DB suite restore (new; prior D084 evidence unchanged)

Base: origin/main `daab107`. Scope: disposable `ci-e2e` local stack (fresh migrations, same order as `tests/ci-db.sh`). No hosted resource.

## Reproduction (before)
CI run 45612225124 (`9284d87`) and `ci-e2e` locally: `tests/security.mjs:93 assert.ok(p)` — the suite needed a
**completed** brand proposal, which only exists when E2E `service.spec.ts:89` gets past the D049 accept gate
(self-registered creator profiles are `claim_status='unclaimed'`; gate requires `verified` → DEV-B decision).
Past line 93 it would still fail: merge `50f6aa7` dropped the report-request fixture (`r` undefined), and the admin
call ran password-only although `is_admin()` now requires recent MFA (aal2).

## Change (`tests/security.mjs` only)
- Proposal isolation uses any brand proposal (pending is the stronger case: only authorization blocks the accept).
- Restored the fresh reporter signup (now with `qaSignupConsent`, D073 consent gate) + `submit_report`, and the
  "brand cannot moderate" denial (`admin_review_report` → error).
- Admin moderation: password-only is asserted denied, then TOTP `challengeAndVerify` (same as `tests/analytics.mjs`), then succeeds.

## Results
| Check | Result |
|---|---|
| `ci-e2e` before | FAIL `security.mjs:93` |
| `ci-e2e` after, run twice | PASS ×2 (unique reporter email per run) |
| eslint / prettier on the file | PASS |

## Remaining
- E2E `service.spec.ts:89/253` accept gate (unclaimed self-registered profile) and the 17 other DB suite failures map to DEV-B tickets (D025/D026/D043/D049/D058/D062/D063/D068/D069/D070/D074/D079/D086/D006/D046/D053/D061).
- Remote CI confirmation pending on this push.
