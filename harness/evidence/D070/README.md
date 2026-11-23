# D070 — Separate HOT slot and ad disclosure (DEV-B · P1)

Status: **DONE (local)**. Not deployed (D088). Migration 0026 is local only. The real Toss TEST purchase of HOT is still BLOCKED (D066); HOT entitlements were created through the D069 admin grant.

## What was built
- `supabase/migrations/202611190026_promotion_slots.sql`
  - `serve_promotion_slots(record)`, service only.
    - Serves up to **3** slots, one per creator, earliest-starting active `creator_hot` entitlement first.
    - Eligibility: the creator must be published and owner-verified. The entitlement must be active by the DB clock and not revoked, and must be either a paid TEST order or an admin grant.
    - **Minimal DTO**: `slot, creator_id, name, category, starts_at, expires_at`. The full profile JSON is not returned.
    - With `record=true`, each serve adds one impression per slot to `promotion_impressions` (day × entitlement).
  - `promotion_impressions`: the owner reads via their entitlement; the admin reads all; no client writes.
  - The old `active_hot_creators()` returned the whole profile JSON to anon. Client execute is now revoked.
- `src/lib/promotions.ts`
  - The only slot source. It returns `[]` unless `SERVICE_MODE=test_demo`, so **paid HOT is off in the real free service**.
  - The DTO is re-validated with Zod.
- `GET /api/promotions`: a separate slot API (`enabled`, `label`, `slots`, no-store). It does not count impressions.
- `PromotionSlot` server component on the home page and `/creators`.
  - It is an `aside aria-label="광고"` labelled "광고 · TEST HOT", stating that it is a purchased TEST ad area that doesn't affect organic search, recommendation order or scores.
  - Each slot shows "광고 ~종료일".
- Creator dashboard "HOT 광고 노출 이력 (TEST)": daily impression count, ad period and revoked status (ownership = own profile, via RLS).

## Boundary: HOT cannot change ranking inputs
- Organic retrieval and scoring (`catalog.ts`, `search.ts`, `data.ts`, `/api/creators`, the latest SQL `search_creators`/`count_creators`) never reference entitlements or promotions. A unit test checks this statically.
- HOT owners have no write path to weights, ranking inputs or impressions.

## Tests (2026-11-23, local)
- `tests/promotions.mjs` (direct REST, in `ci-db.sh`)
  - Brand, creator and anon cannot call the slot function or the old RPC.
  - After a HOT grant the creator is slotted with exactly the 6 DTO keys, ≤3 slots.
  - **Organic `search_creators` order is identical before and after HOT for the name, followers and price sorts.**
  - Impressions: 0 → 2 only with `record=true`. The owner and admin read them; another brand and anon read nothing. The owner cannot insert or update them.
  - An unpublished creator is not slotted.
  - Expiry by the DB clock: not served and no more impressions. A revoked entitlement is not served.
- `tests/promotions.test.ts`: static separation check; free_beta returns no slots.
- `tests/e2e/promotion.spec.ts` (desktop + mobile)
  - `/api/creators?sort=followers` is identical before and after HOT.
  - `/api/promotions` has the minimal DTO.
  - `/creators` shows the "광고 · TEST HOT" slot with "광고 ~" and the no-influence notice, and an impression is recorded.
  - The creator's dashboard shows "회 노출 · 광고 기간".

## Known limits
- Impressions count server renders, including bots and reloads. They are a TEST exposure log, not a billing metric.
- Slot order is "earliest start first" with no rotation, so if more than 3 are active, later buyers wait until earlier ones expire.

## Regression and screenshots (2026-11-23)
- Full regression with D083: `tests/ci-db.sh` exit 0, **E2E 78/78** (desktop + mobile), vitest 135, lint 0, secret_scan PASS, migration_check 26 PASS.
  - The first run had 1 notifications failure. Cause: I edited `next.config.ts` mid-run and the dev server restarted ("Found a change in next.config.ts. Restarting"). It passed on the rerun with no edits.
- Screenshots: `D070-slot-{desktop,mobile}.png`, `D070-history-{desktop,mobile}.png`. No horizontal scroll on either.
  - The QA creator had been redacted to "삭제된 크리에이터" with `published=false` by the earlier account-deletion test. For the shot only, I set the name to "QA 테스트 크리에이터" and `published=true`, then restored both. That redacted profile is not served while unpublished (DB test covers this).
