# D066 — Real Toss SDK v2 TEST run (DEV-B · P1)

Status: **BLOCKED: no Toss TEST key** (`NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` absent locally; U015/U019 user action, D065 DEV-A).
No successful payment was simulated and none is claimed as passing. Only the keyless compatibility check and fixes are done.

## Official compatibility check (docs.tosspayments.com, checked 2026-11-22)
| Item | Official standard | Code | Result |
|---|---|---|---|
| SDK | v2 `loadTossPayments(clientKey)` | `@tosspayments/tosspayments-sdk ^2.10.0`, `checkout.tsx` | OK |
| Product | `payment()` = payment window (API 개별 연동). "결제창(구버전)… API 개별 연동 키를 사용하세요" | `toss.payment({customerKey}).requestPayment({method:"CARD", …})` | OK |
| Client key | API 개별 연동 = `test_ck_`. Widget keys are `test_gck_` | Accepted `test_ck_` **and `test_gck_`** | **Fixed**: `test_ck_` only |
| Secret key | Same set as the client key: `test_sk_`. "세트가 아닌 키를 사용하거나… `INVALID_API_KEY`" | Edge Function accepted `test_sk_` **and `test_gsk_`** | **Fixed**: `test_sk_` only (`billing.ts`, Edge Function, manifest, `.env.example`) |
| Confirm API | `POST /v1/payments/confirm`, Basic `secret:`, `{paymentKey, orderId, amount}` | Edge Function (Idempotency-Key = order id, re-reads `GET /v1/payments/{paymentKey}` on failure, requires `DONE` with matching orderId/amount/paymentKey) | OK |
| successUrl | `amount`, `orderId`, `paymentKey` are appended | `/billing/success` reads all three and confirms on the server after checking ownership and amount | OK |
| failUrl | Error code and message are appended | Previously **ignored** | **Fixed**: `PAY_PROCESS_CANCELED` (user cancel), `PAY_PROCESS_ABORTED`, `REJECT_CARD_COMPANY` mapped. The message is length-limited and rendered as text |
| Origin | success/fail = `location.origin` + path | It follows the deployed origin. Register the production URL's origin in the developer centre if required | Check with the user |

## Tests (local)
- `tests/matching.test.ts`: refuses `test_gck_` and `test_gsk_`; accepts the `test_ck_`/`test_sk_` set; refuses live keys.
- `tests/e2e/billing-fail.spec.ts` (desktop + mobile):
  - The cancel code shows "직접 취소"; the card-company rejection is shown.
  - An `<img onerror>` message is shown as text (no element, no dialog).
  - A malformed code falls back to the generic message.
- No mocked successful payment exists, and none would be accepted as evidence.

## Unblock steps (user)
1. Toss developer centre → test keys → copy the **API 개별 연동 key** set (`test_ck_…`, `test_sk_…`). Not the widget keys.
2. Set `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_…` in Vercel (test_demo environment) and `.env.local`. Set Supabase `supabase secrets set TOSS_SECRET_KEY=test_sk_…` and deploy the Edge Function `payment-confirm`.
3. U019: in TEST mode, run three flows: **success**, **failure** (e.g. a rejected test card), and **user cancel** (close the payment window).
4. The agent then reconciles each order: developer centre transaction (orderId, paymentKey, status, amount) vs the DB:
   ```sql
   select o.id, o.sku, o.amount, o.status, o.paid_at, e.sku ent_sku, e.expires_at
   from orders o left join entitlements e on e.order_id = o.id
   where o.created_at > now() - interval '1 day' order by o.created_at;
   ```
   - Success = DONE in Toss, order `paid`, one entitlement for 30 days.
   - Failure or cancel = no DONE transaction, order not `paid`, no entitlement.
