# D069 — TEST entitlement expiry, usage and credits (DEV-B · P1)

Status: **DONE (local, ledger and admin issuance)**. Not deployed (D088). Migration 0025 is local only.
Dependency: D067 (DEV-A) is not done. The real Toss TEST payment is BLOCKED (D066), so purchases were verified only through the `finalize_test_order` DB path.

## Design (`supabase/migrations/202611190025_usage_ledger.sql`)
- `entitlements.credits` is the available balance. Every change is recorded in `credit_ledger` (kind, delta, balance ≥ 0, reservation, actor, note) in the same transaction.
  - A purchase writes its opening grant row via a trigger.
- Using credits: `credit_reserve(owner, amount, request_key)` → `credit_settle(reservation, finalize|release)`. Service role only.
  - Reserve locks the owner's entitlement rows (`for update`), so concurrent requests are serialised.
  - It deducts from the **earliest-expiring active** entitlement first.
  - The same `request_key` returns the existing reservation, so a request is never charged twice; reusing a key with a different amount is refused.
  - Finalize and release are idempotent. Finalize after release (or the reverse) is refused.
  - The reservation lease is 10 minutes; `release_stale_reservations()` returns expired leases.
- Expiry uses the **DB clock** (`now()`), via `entitlement_active()`.
  - Finalize is refused if the reservation or entitlement has expired.
  - Release does not refund into an expired or revoked entitlement (logged as not refunded).
  - The `entitlement_guard` trigger blocks clearing a revocation, extending the period, and adding credits to an inactive entitlement.
- `admin_grant_entitlement()`: admin only; product role must match member role; 1–90 days, 0–1000 credits; **reason ≥ 5 chars required**. Records `grant_reason=admin_grant`, the note, the granting admin, the ledger and audit_log.
- `revoke_entitlement()` (cancel/recover): admin plus reason.
  - Sets the balance to 0, closes open reservations without refund, sets the linked TEST order to `cancelled`, and writes the ledger and audit entries.
  - It cannot be revoked twice.
- Clients can only read their own entitlements, orders and ledger; insert/update/delete grants are revoked.
- `active_hot_creators()` now excludes revoked entitlements. Admin-granted HOT counts as active.
- Separation from real service access: only TEST billing reads entitlements. Free-beta access never uses them, and the admin screen says so.

## UI and API
- `POST /api/admin/entitlements` (Zod; grant or revoke).
- Admin "이용권·HOT 운영":
  - Owner, status (유효/만료/회수됨), credits, and source (payment, or manual grant with its reason).
  - Revoke requires a reason; the button is disabled until 5 characters are entered.
  - A "이용권 수동 발급 (사유 필수)" form. SKUs come from the DB `products` table.
- The dashboard shows only unrevoked, unexpired entitlements.
- The personal export includes entitlement status and the own ledger. The admin actor id is excluded.

## Tests (2026-11-22, local)
- `tests/usage-ledger.mjs` (direct REST, in `ci-db.sh`)
  - Brand, creator and anon cannot reserve or sweep, and cannot insert or update entitlements (no effect).
  - **10 concurrent reserves of 3 against 20 credits → exactly 6 succeed**, 4 `insufficient_credits`, balance 2, never negative.
  - **5 concurrent requests with the same key → one reservation, charged once**. Reusing a key with a different amount is refused. Ledger `sum(delta)` equals the balance.
  - Finalize ×2 is idempotent; release after finalize is refused; release refunds.
  - A stale lease → finalize is refused, and the sweeper releases it.
  - Forged grants: brand/creator → forbidden; no reason, role mismatch or 365 days → refused. A valid grant is recorded with reason, admin and audit.
  - Expiry boundary (the 1-day grant shortened to 1 second): it is used first; after expiry, finalize is refused, release gives no refund, extending or adding credits is refused, and the next reserve skips it.
  - Revoke: non-admin and missing reason are refused. It sets the balance to 0, closes the reservation, cancels the order, refuses later finalize and reserve, refuses un-revoke, and refuses a second revoke.
  - Others cannot read the ledger.
- `tests/e2e/entitlements.spec.ts` (desktop + mobile)
  - Admin issues via the form; a missing reason returns 400 from the API.
  - The member's dashboard shows the credits; the member self-granting gets 403.
  - Revoke requires a reason → "회수됨, 크레딧 0" → the member's dashboard no longer shows it.

- Full regression (2026-11-22): `bash tests/ci-db.sh` exit 0, covering migrations 0001–0025 from scratch, E2E 74/74, DB tests and the restore drill. Also vitest 129, lint 0, build OK, secret scan PASS, `migration_check` 25 PASS.

## Known limits
- No actual credit consumer is connected yet. The AI LLM provider isn't configured (D048 BLOCKED), and the template path is free.
  - shortcut: once a provider is connected, put reserve → finalize/release around the `/api/ai/draft` LLM call.
- `release_stale_reservations()` has no cron yet; it is a manual/service call. It's harmless because a stale reservation can't be finalized.
