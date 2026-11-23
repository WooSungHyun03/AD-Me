# D068 — TEST cancellation and entitlement revocation after cancel (DEV-B · P2)

Status: **BLOCKED (real Toss TEST cancel)**, with the keyless parts done locally.
- Blocker: no `test_ck_`/`test_sk_` keys (same as D066) and no deployed Edge Function. A real TEST cancel, a duplicate cancel at the provider and the provider state sync haven't run.
- Migration 0027 is local only.

## Design
- `202611190027_test_cancellation.sql`
  - `payment_cancellations`: owner/admin read, no client writes, unique idempotency key, **at most one live (requested/done) cancellation per order**. Retrying after a failure is allowed.
  - Service-only `begin_test_cancel(order, owner, reason, key)`:
    - The order must belong to the caller and be `paid`.
    - Same key → returns the same row (replay). A different key while one is in progress → `cancel_in_progress`.
    - Errors: `already_cancelled`, `not_cancellable` (not paid), `idempotency_conflict` (same key used by another user or order).
    - Credits rule: an in-flight reservation → `credits_in_use`; **any credit already used (finalized) → `credits_used`, cancellation refused**. Partial refunds aren't supported.
  - Service-only `finish_test_cancel(id, ok, provider_status, error)`, idempotent:
    - On success: order `cancelled`, entitlement revoked immediately (`revoked_at`, credits 0, in-flight reservations released), `credit_ledger` revoke row, audit `order:cancelled`.
    - On failure: `failed` plus the provider error code. The order and entitlement stay.
- Edge Function `payment-confirm`, `action:"cancel"` branch:
  1. Checks the `test_sk_` secret first, so no orphan rows are created without a key.
  2. `begin`.
  3. Calls Toss `POST /v1/payments/{paymentKey}/cancel` with `cancelReason` and the **same `Idempotency-Key`**. Toss returns the first response for 15 days.
  4. On failure, reconciles with `GET /v1/payments/{paymentKey}`: `CANCELED` counts as success, which covers `ALREADY_CANCELED_PAYMENT`.
  5. On 5xx, timeout or `IDEMPOTENT_REQUEST_PROCESSING`, the row stays `requested`; retrying with the same key resumes it.
- **The client never sends a paymentKey**. The server uses only the stored payment key of an order the caller owns, so another user who knows the key can't cancel. Extra fields such as `paymentKey` are rejected with 400.
- `POST /api/billing/cancel`: origin check, test_demo only, login required, Zod validation, then forwards to the Edge Function.
  - If the function isn't deployed: "TEST 결제 취소 서버(Edge Function)가 연결되지 않았습니다. 주문은 그대로 유지됩니다."
- Dashboard order history:
  - TEST status labels (TEST 결제 대기/완료/실패, TEST 취소·회수됨).
  - A "TEST 취소" form on paid orders only. The idempotency key is fixed for the lifetime of the form, so a double click can't cancel twice.
- Webhook (`PAYMENT_STATUS_CHANGED`): **not used.** Recovery relies on the GET reconciliation above.
  - The official verification method is HMAC with the `tosspayments-webhook-signature` header using a "보안 키" (security key). The procedure for obtaining that key is unconfirmed, so it's left for after unblocking.

## Tests (2026-11-23, local)
- `tests/test-cancel.mjs` (direct REST, in `ci-db.sh`). Paid orders are **simulated** with `finalize_test_order` and a fake key; this is not provider verification.
  - Owner, other user and anon can't run begin/finish or insert cancellation rows.
  - Another user's uid → `not_found`.
  - Same key → same row; a different key → `cancel_in_progress`; same key from another user → `idempotency_conflict`.
  - Success: order cancelled, entitlement revoked, credits 0, ledger `revoke|-20|0`, two audit rows; finish is idempotent; replay returns `done`; a new key → `already_cancelled`.
  - Provider refusal (`NOT_CANCELABLE_PAYMENT`): order stays paid, entitlement stays, error code recorded, retry allowed.
  - Credits: in-flight reservation → `credits_in_use`; after finalize → `credits_used`. Pending order → `not_cancellable`.
  - RLS: owner sees own rows; other user and anon see 0; admin sees all.
- `tests/e2e/billing-cancel.spec.ts` (desktop + mobile)
  - Anonymous → 401. A paid order shows "TEST 결제 완료".
  - A request with `paymentKey` → 400.
  - Clicking cancel → the Edge Function-not-connected alert; the order stays `paid` and no cancellation rows are created.
- Screenshots: `D068-orders-{desktop,mobile}.png`. No page-level horizontal scroll; the table scrolls inside its container.

## To unblock (user)
1. Connect the `test_ck_`/`test_sk_` keys (D066) and deploy the `payment-confirm` Edge Function.
2. TEST purchase → cancel from the dashboard → confirm the status in the Toss developer centre.
3. Click again with the same form (duplicate) → `duplicate`, no second cancel.
4. Check the order, entitlement and `payment_cancellations` rows with the reconciliation SQL in D066.

## 전체 회귀 (2026-11-23)
`tests/ci-db.sh` exit 0 (test-cancel PASS 포함), **E2E 82/82**, vitest 142, lint 0, secret_scan PASS, migration_check 27 PASS.
