# D058 — coexistence adopted, staff search labels (2026-11-27, DEV-B)

## Decision
- On 2026-11-27 the user decided to implement the recommended option (coexistence) of `docs/handoff/D058_D057_REPORT_CONTRACT_20261125.md` without waiting further for DEV-A's reply.
  - D057 evidence review and the D058 request queue stay side by side. No absorption migration.
- The intake, my-requests list, appeal and public-reference resolution were already implemented and verified on 11-26 (`42db7fd`, `harness/evidence/D058/20261126/`).
- This round closes the remaining gap from that record: operations search showed every request as the fixed label "이전 접수 신고" with no type or deadline.

## Changes
- **`supabase/migrations/20261127110000_d058_admin_report_search_labels.sql`**
  - STOP-guarded in-place edit of only the `reports` branch of `adme_ops.support_search`.
  - Label: `<ticket_no> · <request kind>`, so the ticket number is searchable.
  - Details carry only `ticketNo`, `requestKind`, `dueAt` and `interimHidden`.
  - Reason text, reporter and target ids are not returned.
  - Roles, quota, audit, paging and grants are unchanged. Verified locally: anon has no execute, `search_path=""` is kept.
- **`src/domains/operations/support.ts`**
  - The strict DTO accepts only those 4 keys; any other key gets a 503.
  - Scope label changed: "이전 접수 신고" → "신고·정정·삭제 요청".
- **`src/components/admin-search.tsx`**
  - Shows the deadline (KST), "기한 초과" for open requests and "임시 비공개 조치 중".
  - Overdue is judged against when the result was fetched, which avoids an impure render.

## Verification (local isolated Supabase)
- **`tests/reports.mjs`: PASS.** New checks:
  - The requester cannot use staff search.
  - The admin finds exactly one request by ticket number.
  - Label `<ticket> · 삭제 요청`; details keys are exactly the 4 above.
  - `interimHidden` is true and the deadline matches.
  - The reason text and target id are not exposed.
- **Unit tests:**
  - `tests/admin-support.test.ts` + `tests/reviews.test.ts`: 11/11. New: report row DTO accepted; extra key or unknown type → 503 with no leak.
  - Full `npm run test`: 99 files, 602 tests passed.
- **E2E:** `tests/e2e/reports.spec.ts` + `tests/e2e/safety.spec.ts`, desktop and mobile, **6/6**.
  - reports: the admin searches by ticket number, then checks the heading `<ticket> · 정보 정정` and the deadline.
- **Shared gates:**
  - `harness/migration_check.py`: 141 PASS.
  - typecheck and `npm run build` pass.
  - eslint: 0 errors for the repository. The local agent copy `.claude/worktrees/` is excluded; it is not part of the repository.

## Remaining
- U004: apply `20261125240000` and `20261127110000` to the production DB, after the app deployment.
  - An old app would reject the new details with 503 on the reports scope only.
  - The production fingerprint must also be re-registered.
- DEV-A is informed through the decision note in the contract document.
