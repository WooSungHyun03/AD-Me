# D061 — Safety checklist and selection approval (DEV-B · P1)

Status: **DONE (local)**. Not deployed (D088). Migration 0023 is local only; hosted DB push is still pending.

## What was built
- `supabase/migrations/202611190023_selection_review.sql`
  - `review_checklist_items`: the brand's own checklist, at most 10 items.
    - RLS: owner only.
    - Insert requires the brand role.
  - `creator_reviews`: one row per campaign × creator.
    - Holds the checked item ids, a private memo (≤1000), `approved`, `reviewed_by` and `reviewed_at`.
    - Clients can only select their own rows. There are no client writes; all writes go through `set_creator_review()`.
  - `set_creator_review()` (definer)
    - The caller must own the campaign, and it must not be a demo campaign.
    - Ids that aren't the caller's own items are dropped.
    - Approval is refused (`review_incomplete`) unless every current item is checked.
  - `selection_gate` trigger on `proposals`
    - Applies when the brand has a checklist and an application goes pending → accepted.
    - That transition requires `review_approved()`, which checks the approval covers **all current** items, so adding an item re-opens the review.
    - It is a trigger, so it holds on every path (RPC, direct SQL), not only in the API.
  - Brands without a checklist are unaffected (gate inactive).
- API
  - `POST /api/notes/review` (Zod; maps `review_incomplete` → 409).
  - `POST`/`DELETE /api/notes/checklist`.
  - `review_required` maps to a Korean message in `recruitingErrors`, so the existing accept button shows why selection was refused.
- UI: the campaign page, owner only and non-demo, shows "선정 검토 (비공개)".
  - Checklist editor.
  - Per-candidate form for pending applicants and shortlist members: checkboxes, private memo, 저장, and 선정 승인, which stays disabled until every item is checked.
  - The page states that this is not shown to creators, other brands or the public profile, and is not used as reputation data.
- Privacy export (`src/lib/privacy.ts`): the brand's own checklist labels and reviews are included. `reviewed_by` is already a forbidden export key.

## Boundary: memo is not reputation data
- No public table, view or RPC reads `creator_reviews`. `search_creators` and the public profile only read `creators`.
- Admin REST reads return nothing; the admin role has no policy.
- The memo is never copied into creator, profile or matching data.

## Tests (2026-11-22, local isolated Supabase)
- `tests/selection-review.mjs` (direct REST, added to `tests/ci-db.sh`)
  - Creator and anon cannot create items. A brand cannot write items for another brand.
  - Another brand, the creator, the admin and anon read 0 items or reviews. Another brand's delete has no effect. The 11th item is refused.
  - Accepting without approval is refused via `transition_proposal` and via direct `UPDATE` (`review_required`).
  - Direct `creator_reviews` insert is refused. The creator and another brand calling the RPC are refused. A partial approval is refused; foreign item ids are dropped.
  - After a full approval, adding an item re-blocks acceptance. Re-approval allows it.
  - The memo does not appear in any `creators.profile`.
- `tests/e2e/selection-review.spec.ts` (desktop + mobile; a fresh brand per run so its checklist never gates other specs)
  - Add an item in the UI → accepting returns 409 with the checklist message.
  - "선정 승인" is disabled until checked. Check + memo → approve → "승인됨" persists after reload → accepting returns 200.
  - The creator's campaign page, public creator page and dashboard contain neither the memo nor the review section. The creator calling `/api/notes/review` gets 403.
- Full regression: `bash tests/ci-db.sh` exit 0, covering migrations from scratch, E2E 68/68, DB tests and the restore drill. Also vitest 127, lint 0, build OK, secret scan PASS, `migration_check` 23 PASS.
- Screenshots: `review-{desktop,mobile}.png`, no horizontal scroll.
  - The candidate shows its public id because the local QA creator profile is unpublished, so RLS hides its name from the brand (intended).

## Known limits
- The gate covers **applications** (brand selects). A brand-initiated proposal is accepted by the creator, so there is no brand selection step to gate.
- There is one reviewer per brand account; no multi-person approval or team roles. `reviewed_by` stores the account.
