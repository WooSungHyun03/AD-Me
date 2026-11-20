# D076 — partial distributed quotas, 2026-11-20

- Baseline integrated main65063c8. Reserved additive202611200007; no earlier migration changed. Application SQL is delivered for USER, not executed remotely.
- Atomic PostgreSQL UPSERT counters with DB-chosen scopes/subjects and fixed UTC windows. No in-memory limit or caller-supplied user/IP accepted.
- Direct REST enforcement: messages20/min+200/day, reports5/hour+10/day; owner-bound draft status polling120/min. PostgreSQL exceptions return429 + exact Retry-After; app preserves sanitized v1 errors/request ID.
- Existing3 drafts/hour, global active30, manual YouTube20/day, claims3/account/hour+30/global/day remain. Added10 drafts/account/day,5 claims/account/day,10 manual channels/account/day.
- Worker reserves conservative YouTube units1000/global UTC day (daily130, single channel3, claim1) and30 local model attempts/day before returning any lease. Retries consume again; budgets never refund on provider failure. Existing maximum3 attempts, lease6min, skip-locked selection and local model650-token/2048-context/160sec bounds retained. Excess budget postpones job without incrementing attempts; bounded queue scan avoids starving the other provider.
- DB resource controls default-off, direct enqueue blocked, disabled queued jobs not leased, discovery disabled on application/pause. Explicit local-only fixture opt-in. Never enable hosted collection/model work from this session.
- Retention: private RLS counter table, no readable tokens/IP/prompts, 2-day cleanup via local/USER-applied cron. Fixed counters store only opaque account UUID/job/provider keys. Burst may span adjacent fixed windows.
- Evidence: tests/local-rate-security.mjs8 groups PASS, including25 concurrent inserts ->20 admitted;125 concurrent polls ->120; worker6-way race ->1 remaining lease; SQL natural window expiry; safe Retry-After; pause/recovery. Local fixtures/synthetic JWTs only, zero real provider calls. Vitest138/16 PASS, strict typecheck/lint PASS; integrated browser/final packet evidence follows.
- IN_PROGRESS, not DONE: anonymous signup/login trusted IP+account controls/CAPTCHA and provider Auth direct-API configuration are not verified; legacy full-table creator catalog remains outside the upcoming D033 search boundary. YouTube directory quota is joined by D059's next migration. No claim of complete bot prevention or production provider quota validation. D051 full message UX remains separate.
- Reference for direct DB429/headers: https://docs.postgrest.org/en/stable/references/errors.html#add-http-headers-with-raise . Old54000 limits return a conservative60s Retry-After through app; new atomic quotas return exact remaining windows.

- Final shared verification: DEV-A-MAIN-20261120/verification.json. App draft polling uses the shared atomic quota, but direct ops_draft_get RPC polling and the legacy creator catalog still need DB/search-boundary coverage; ticket intentionally remains IN_PROGRESS. Signup/login trusted IP/account and real Auth console limits also remain.

## 2026-11-20B — direct draft getter enforcement
- Additive202611200011 moves the account120/min quota into the real private getter. Its public invoker wrapper is volatile, so direct GET fails closed; POST RPC cannot omit the quota. Legacy draft_poll stays separate to avoid double-charging old app clients.
- App GET makes exactly one protected RPC; rate-limit.ts validates status, removes private error metadata and preserves sanitized429/Retry-After/no-store.
- Actual isolated REST:3 groups PASS,125 concurrent direct getter calls ->120 admitted+5429; owner/foreign/anonymous, GET denial, old-client compatibility and recovery checked. Unit API/limiter20 PASS; strict typecheck PASS.
- D076 still IN_PROGRESS: trusted signup/login IP/account/Auth controls and legacy catalog search remain. This closes the previously documented direct draft_get bypass; no external/provider calls or deployment.
