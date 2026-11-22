# D046 — Recommendation feedback and evaluation dataset (DEV-B · P1)

Status: **DONE (local isolated Supabase)**. Not applied to hosted DB, not deployed (D088 pending user deploy).

## What was built
- Migration `202611190020_matching_feedback.sql`
  - `matching_feedback`: campaign, creator, rater, `model_version` (scorer, e.g. `adme-1.1`), shown `rank_position`/`score`, `verdict` fit/unfit, `reason` code (DB check: reason must belong to the verdict), one row per rater × campaign × creator.
  - No free text. Rater reads own rows only. **Clients have no insert/update/delete grant**. Writes go through `/api/matching-feedback` only.
  - `matching_feedback_dataset()` (admin/service only): no rater id, campaign shown only as a 12-char hash key. The split is decided per campaign (`md5(campaign)` byte % 5 = 0 → test), so one brief never spans train and test. `accepted` = later proposal outcome (accepted/submitted/revision/completed), a **label only**. `size_bucket` small/mid/large comes from demo follower counts; real profiles are `unknown`, because their audience size isn't verified.
- `POST /api/matching-feedback`
  - Checks origin, login and Zod input.
  - Only the owner of a non-demo campaign may rate.
  - Recomputes `rank()` on the server, using the same top 6 as the page, and stores the position, score and version the server actually showed. Creators not in the shown list get 409.
- `src/lib/matching-eval.ts`
  - Reason codes.
  - `evaluate()`: precision@3 and accept-rate@3 on the held-out split, plus fit rate by size bucket. The bias flag fires on a gap of 20 points or more between buckets that each have at least 10 labels.
  - `compareVersions()`: regression check that is only valid when both versions have enough data.
  - Below 30 labels or 10 campaigns it reports "데이터 부족 — 성능 주장 불가". Even with enough data the statement says it is rater feedback, not proof of model quality or campaign results.
- UI
  - Campaign page: per recommendation, a fit/unfit select, a reason select and save. The saved value shows on reload.
  - `/admin`: "추천 피드백 (오프라인 평가)" summary with the leakage-free split note and "‘적합’ 클릭 수는 모델 성능의 증거가 아닙니다".
- `/matches` still redirects to `/campaigns`; recommendations live on the campaign page.

## Boundary
"맞음 클릭만으로 모델 성능이 증명됐다고 보고하지 않는다":
- The admin view and `evaluate().statement` refuse a performance claim on sparse data, and always disclaim it otherwise.
- The current local data (3 labels, 1 campaign) is reported as insufficient. No performance number is claimed anywhere.

## Tests (2026-11-22, local)
- `tests/feedback.mjs` (direct REST, in `tests/ci-db.sh`):
  - Owner and other-user direct inserts are denied, and client updates have no effect.
  - A reason/verdict mismatch is rejected.
  - Rows are readable by the rater only (admin, creator and anon see nothing).
  - The dataset is denied to anon, brand and creator.
  - The output contains no rater id or raw campaign id, every campaign sits in exactly one split, and the accept label comes from proposals.
- `tests/matching-eval.test.ts`: sparse-data refusal, split/version filtering, size-bias flag, regression comparability, and reason codes matching the SQL check.
- `tests/e2e/match-feedback.spec.ts` (desktop + mobile):
  - The owner rates and the value persists after reload.
  - Not-shown creators get 409 and bad reasons get 400.
  - Another account sees no controls and gets 403.
  - The admin sees "성능 주장 불가".
- `tests/e2e/service.spec.ts`: the proposal status locator is scoped, because the page now has more than one `role=status`.
- Full regression: `bash tests/ci-db.sh` exit 0, covering 20 migrations, E2E 58/58, 18 DB tests and the restore drill. Also vitest 112/112, lint 0, typecheck 0, build OK, secret scan PASS.
- Screenshots: `rating-{desktop,mobile}.png` and `admin-eval-{desktop,mobile}.png`, no horizontal scroll.

## Known limits
- Size buckets exist only for demo profiles; real follower counts aren't verified.
- There is no rater-agreement measure: each brand rates its own campaign only.
- The rank is recomputed at save time. If a profile changed between page view and save, the stored position is the current one, or a 409 if the creator dropped out.
- Feedback has no retention cleanup yet. It cascades on campaign, creator and account deletion.
