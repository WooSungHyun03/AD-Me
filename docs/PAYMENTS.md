# Toss Payments TEST Integration Specification

Official reference:
- https://docs.tosspayments.com/guides/v2/payment-widget/integration
- https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference
- https://docs.tosspayments.com/guides/v2/billing
- https://docs.tosspayments.com/blog/how-to-test-toss-payments

## Scope
- **MVP: One-time test payments** for 30-day Brand Pro pass, Agency pass, Creator HOT pass, and AI Credits (where configured).
- Plan names may say '30일 이용권'. **Do not present as automatically recurring subscriptions.** Billing-key card auto-renewal requires a distinct SDK/API flow and contract; P2 only.
- No actual money or payouts. Test UI prominently states `테스트 결제 / 실제 청구 없음`. Never switch to `live_` keys.

## Environment
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`: official test client key (browser)
- `TOSS_SECRET_KEY`: official test secret key (server only)
- `NEXT_PUBLIC_APP_URL`: local base origin
- User obtains keys from Toss Developer Center. Never commit `.env.local`.

## Checkout flow (non-billing)
1. Authenticated brand/creator selects a **server-defined** SKU.
2. Server validates user role & product availability and inserts `orders` with `PENDING`, UUID-like `orderId`, DB-authoritative integer amount. Stores `owner_id`, `sku`, `amount_krw`.
3. Client initializes **Toss SDK v2**; render `widgets().setAmount()`, `renderPaymentMethods()`, `renderAgreement()`; requestPayment with success/fail URLs and order id.
4. On redirect to `/payments/success`, authenticated owner calls server endpoint. **Never grant entitlement based on URL redirect alone.**
5. Server re-loads order, verifies owner, non-expired pending state, matching `orderId` and `amount`, key test mode. Initiates provider confirmation `POST https://api.tosspayments.com/v1/payments/confirm` with Basic Auth secret key (server only), required `{paymentKey,orderId,amount}`.
6. Validate provider response `status= DONE` (as applicable), order id, amount; in DB transaction record payment, mark order PAID, grant entitlement once. Duplicate callbacks/retries respond with consistent existing state and never grant twice.
7. Failed confirmations mark failed or retryable state; do not grant entitlements. Appropriate error UI and reconciliation action.
8. Cancellations/refunds P1: use provider response and rollback entitlement rules carefully.

## Failure/misuse tests
- Missing keys (no fake `PAID`)
- Modified client amount compared to DB
- Replayed success URL / repeated confirm
- Different user's order
- Invalid order id/payment key
- Provider timeout: order remains unresolved, no entitlements
- `failUrl` path, user cancel
- Wrong role purchasing role-specific pass
- Expiry after 30 days and HOT label disappearing
- `live_` key accidentally configured: fail startup in demo build

## Safety/operational
- Server-only secrets and server-side auth; avoid logging payload containing card details.
- Use Toss test header/error simulation when available and appropriate.
- If user has not provided API keys, implement the screens, backend contracts, and mocked provider **for unit tests only**. Label live external payment verification BLOCKED; do not claim E2E Toss completion.
