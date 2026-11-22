# D056 — Two-sided dashboard and results export (DEV-B · P1)

Status: **DONE (local)**. Not deployed (D088).

## What was built
- `src/lib/pipeline.ts`: a single stage definition used by the dashboard list, its counts and the CSV.
  - Stages:
    - 활성 제안 = pending
    - 진행 중 = accepted + revision_requested
    - 검토 대기 = submitted
    - 완료 = completed
    - 종료 = rejected + cancelled
  - `summarize()` counts with the same `inStage()` filter the list uses.
  - `pipelineCsv()` columns: ID, kind, my role, campaign, stage, status, request date, and the **first recorded** accepted / submitted / completed dates from `proposal_events`, plus the number of submitted deliverables (`messages.kind='deliverable'`).
  - No reach, conversion or revenue column; nothing is estimated.
- Dashboard
  - Stage chips with counts, each a link to `/dashboard?stage=<k>`. The filter lives in the URL, so it survives reload and can be bookmarked.
  - The list shows only that stage, with an empty-state message per stage.
  - "결과 CSV 내보내기" exports the current stage.
  - Note: "상태 변경 기록과 제출된 결과물만 집계…추정하지 않습니다".
- `GET /api/export?type=pipeline[&stage=]`
  - Same RLS-scoped query as the dashboard: the caller is the brand or the creator.
  - An invalid stage returns 400; `private, no-store`.
  - Cells are formula-escaped by the existing `csvCell`.
- The existing shortlist export (`/api/export` without `type`) is unchanged.

## Tests (2026-11-22, local)
- `tests/pipeline.test.ts` (3):
  - Every status in the DB check maps to exactly one stage.
  - For every stage, count equals filtered list length, and the counts sum to the total.
  - CSV: first-reach dates in KST, `=HYPERLINK(...)` campaign title is escaped, role and kind are correct, no estimate columns.
- `tests/e2e/pipeline.spec.ts` (brand and creator × desktop/mobile):
  - "전체 N" equals the proposals the account is a party to, checked against the DB via the service role.
  - For each of the 5 stages: chip count = listed articles = articles after reload = CSV rows for that stage.
  - The full CSV id set equals exactly that account's collaborations, so none from other users.
  - A bad stage returns 400.
  - Local data covers 4 of 5 stages; "검토 대기" was 0 rows in this DB, so it is covered by the unit test.
- Full regression: `bash tests/ci-db.sh` exit 0, covering E2E 66/66, DB tests and the restore drill. Also vitest 127, lint 0, build OK, secret scan PASS.
- Screenshots: `pipeline-{desktop,mobile}.png`, no horizontal scroll. Chip spacing was fixed (the flex badge dropped the whitespace).

## Known limits
- "Results" are in-app facts only: status dates and the deliverable count. External post metrics need the platform data from D054 (DEV-A) and are not shown.
- The dashboard still loads every proposal of the account; there is no pagination yet.
