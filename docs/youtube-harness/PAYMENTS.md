# Toss Payments TEST — functional billing architecture

## Scope / explicit disclaimer
Test only, simulated KRW, no financial revenue. Four monetized SKUs: `SEARCH_RUN`, `JOB_POST`, `JOB_APPLICATION`, `SPONSORED_30D`. Admin-configurable price versions and complimentary credits. `Brand Pro` and `Creator HOT` can be admin-managed 30-day non-renewing passes; automatic billing is **not included** without separate Toss billing authorization/contract.

## End-to-end flow (every SKU)
1. Client chooses product; posts `sku` and intended related resource `campaignId|jobId|creatorId`. **No client-supplied price can be trusted.**
2. Server validates user role, source record ownership, existing entitlement and whether action already occurred; creates `orders` with unique external orderId, catalog price/version, state=`checkout_pending`.
3. Client invokes Toss Payments SDK v2 with **test client key only**. Use official docs for correct flow.
4. On success callback, server checks `paymentKey`, `orderId`, amount against **persisted** order and user, validates expected status and sends secret-key server confirm `POST /v1/payments/confirm` (TEST).
5. Store actual provider response without secrets, set approved and grant a **single** entitlement ledger record in an atomic DB transaction (idempotent on orderId).
6. Feature use separately spends granted credit in one transaction with successful resource write. Sponsored entitlement activates once with a precise end date. **Do not spend search credit on repeated retrieval of same successful search session.**
7. Failure/cancel leaves order unapproved; no credits. If gateway approved but DB write fails, reconciliation job retries idempotent grant. No silently lost paid rights.

## Rules by SKU
- `SEARCH_RUN`: token per new `(brand,campaign,normalizedFilterHash)` successful result. Cached same session accessible without charge. New params require clear fee notice and confirmation.
- `JOB_POST`: draft unlimited free; one post credit when `published`; editing does not charge; republishing expired post depends on admin policy explicitly displayed.
- `JOB_APPLICATION`: only verified channel owner can apply; one per job; separate payment/credit; editing submitted pitch free, repeated attempt no charge. If posting removed before any brand review due to operator fault, refund policy can grant credit.
- `SPONSORED_30D`: starts at grant; owner-verified channel only; ends exactly 30x24h later, admin-supported scheduling and extension rules. **AD LABEL ALWAYS**.
- Admin comp/refund adjustments tracked in immutable ledger and `admin_audit_logs` with reason; never falsify payment gateway status.

## Failure/attack scenarios
- Callback amount tampering, cross-account orderId, client retries, double click, concurrent callbacks, replay of paid search, intentional model timeout, DB failure after approval, user gets suspended, job closes mid-checkout, creator loses claim, coupon abuse, refund of used credit, test/live key mismatch, invalid secret in public JS.
- Need real Toss sandbox payment key/confirm response to mark provider test **PASS**. Simulated checkout is not sufficient.
- Keep cancellation/refund API TEST only, consistent ledger reversal and audit. Payment status is an event/state machine, never computed from a UI toast.

## Suggested test products (purely hypothetical)
| Code | Test price | Entitlement |
|---|---:|---|
| SEARCH_RUN | ₩3,000 | one AI candidate search |
| JOB_POST | ₩5,000 | publish one recruitment job |
| JOB_APPLICATION | ₩1,000 | submit one application |
| SPONSORED_30D | ₩9,900 | 30-day labelled sponsored slot |

Actual auto-renew subscriptions: Toss billing key/approval and possible merchant prerequisites, separate P2; do not describe a one-time pass as automatic monthly recurring billing.

## UX requirements
- Show price and fee clearly before charge; TEST mode banner on every payment and result screen.
- Credit balance and history show precise source/expiration; payment failure recovery, refund policies, status and confirmation receipt.
- Avoid wallet with unregulated real stored value; credits in this prototype are non-cash, non-transferable entitlements.

## Official docs
- https://docs.tosspayments.com/guides/v2/payment-widget/integration
- https://docs.tosspayments.com/reference
- https://docs.tosspayments.com/guides/v2/billing
