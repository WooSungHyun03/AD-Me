# D084 — decision-retry in CI E2E (2026-11-27)

## Remote CI for 46413fe (run 45994954183)
216 passed / 2 failed (retention ×2, known DEV-B/U001) / 6 skipped. Account recovery passes in real CI.

## Reproduction (ci-e2e, dev server)
- `decision-retry` failed 6/6 (desktop/mobile ×3): the retry click on "요청 취소" timed out waiting for a visible
  button. Snapshot: the card already showed "취소됨" with the lost-response alert still present.
- Cause: the dashboard's `LiveMessages` calls `router.refresh()` 250 ms after the realtime channel reaches
  `SUBSCRIBED`. On the slower dev server that refresh lands after the lost response and renders the settled
  state, so the retry button is gone. The replica runs no realtime container, so it never refreshed there.
- That is correct product behavior (the user sees the real state). The spec now closes the realtime socket for
  both pages (same pattern as `notifications.spec.ts`), so it deterministically exercises the same-key retry path.

## Runs
- ci-e2e: decision-retry ×4 per project, 8 passed; fresh-DB full E2E 216 passed, with retention ×2 and account-email
  recovery ×2 failing only because this local run served the app on :3300 while mail links target CI's :3000
  (the same spec passed on :3000 earlier and in remote CI 45994954183).
- Replica: decision-retry 2 passed. Unit 611, eslint, tsc pass.

Only email-signup stays local-only (confirmation-required signup). Not production-verified.
