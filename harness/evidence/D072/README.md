# D072 — Assumed fee calculation and payment history (DEV-B · P2)

Status: **DONE (local)**.

## Implementation
- `src/lib/fees.ts` `estimateFee(price, rate)`:
  - Integer amount 0–100,000,000 won, assumed rate 0–30%; anything outside is an error message.
  - Fee is rounded to the won; net = amount − fee.
- `src/components/fee-simulator.tsx`, at the bottom of `/pricing` (both free_beta and test_demo):
  - Badge: "가정 계산 · 실제 수납·정산 없음".
  - Notice: AD Me doesn't collect or settle collaboration payments or charge fees; results are not stored or aggregated and are not real charges, receivables or revenue.
  - **No API calls, storage or analytics events.** Inputs never leave the browser.
- Payment history: dashboard order table with the "TEST 금액" header and TEST status labels (shared with D068). It is `owner_id = me` plus RLS.
- No real collection or settlement is wired up.

## Tests (2026-11-23)
- `tests/fees.test.ts` (2): calculation and rounding, bounds (−1, the maximum + 1, decimal amount, NaN, rate −0.1/30.1/NaN).
- `tests/e2e/fees.spec.ts` (desktop + mobile):
  - assumption badge and disclaimer;
  - 2,500,000 won × 12% → 300,000 / 2,200,000 won;
  - 31% and −5 won show errors;
  - **0 `/api/` requests during input**.
- Other users' orders are blocked: covered by the existing `tests/security.mjs` (another user's `orders` read = empty) and the D068 RLS checks.
- Screenshots: `D072-simulator-{desktop,mobile}.png`, no horizontal scroll.

## 전체 회귀 (2026-11-23)
`tests/ci-db.sh` exit 0 (test-cancel PASS 포함), **E2E 82/82**, vitest 142, lint 0, secret_scan PASS, migration_check 27 PASS.
