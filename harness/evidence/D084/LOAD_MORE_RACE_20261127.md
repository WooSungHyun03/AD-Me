# D084 — catalog "더 보기" race fixed; three more local specs in CI E2E (2026-11-27)

## Load-more race (service.spec.ts:25 failed in 2 of the last 3 main CI runs)
- Symptom (CI 45853997118 attempt 1, 45936906214): after "다음 후보 더 불러오기", cards went 0 → 24 instead of 48.
- Reproduction (ci-e2e, `next dev`, chunk delay 0–2500 ms, click right after SSR cards appear, desktop ×16):
  2 failed with the same 0 → 24 trace.
- Cause: `src/components/catalog.tsx` had `useEffect(() => () => store.cancel(), [store])`. React StrictMode (dev) runs
  that cleanup once on mount; a click replayed at hydration was in flight, `cancel()` aborted it and marked the page not
  loaded, and the filter effect then reloaded page 1 over it. The store is external, so a late response after a real
  unmount has no subscriber; the cleanup is removed.
- After fix: the same probe ×32 passed. Unit 101 files / 611 tests pass.

## Spec promotion
- deadline-reminders, schedule-history: fixture copied `where not is_demo` campaigns; a fresh CI DB has only demo
  campaigns, so 0 rows were inserted (notifications 0, schedule section missing). Now `order by is_demo, created_at`
  (inserted copy stays `is_demo=false`). Moved to `tests/e2e/`.
- p0-finish: its mobile failure was the same load-more assertion; moved to `tests/e2e/`.

## Runs
- ci-e2e fresh DB full E2E (fix + 3 moved): 200 passed / 2 failed (retention ×2, known DEV-B/U001) / 4 skipped.
  The preceding run without the catalog fix and p0-finish: 196 passed / retention ×2.
- Replica: deadline-reminders + schedule-history 4 passed; p0-finish + catalog-filters + search-proposal-scope 12 passed.
- prettier, eslint, `tsc --noEmit` pass.

Remote CI for eaa30e2 (before this fix): 191 passed / retention ×2 / service:25 desktop. Not production-verified.
Still local-only: ready-p1 (fixture decision fails on both stacks), ops and p0 (replica-only staff/adminEnrollment),
account-email, email-signup, session-lifecycle, decision-retry.
