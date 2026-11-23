# DEV-A main integration — 2026-11-20

- Base: codex/dev-a-p0-continue 3182ff0; upstream main 65063c8 (6 new commits); work branch codex/dev-a-p0-20261120.
- Preserve both histories and merge YouTube ownership, private operations schema and local worker without rewriting applied migrations.
- Conflict resolution: keep D012 brand/contact settings plus YouTube link; keep D016 grant/MFA and D059 moderation in admin; append both session histories.
- D004 bridge: convert new intelligence routes to apiRoute/strict validation/sanitized database failures; add 54000 -> 429. No provider calls or hosted changes.
- Next reservation: 202611200006_ops_mfa.sql (D016); 202611200007_rate_limits.sql (D076). No concurrent writer in this checkout. SQL CLI pinned supabase@3.2.0; existing CLI workflow retained.
- D016 plan: approved expiring delegated staff, fresh OTP at DB boundary, MFA enrollment for approved delegated accounts, no automatic promotion to profile admin. Preserve private implementations/public invoker wrappers.
- D076 plan: Postgres atomic quotas, direct REST message/report enforcement, queue provider budgets, retry metadata and concurrency tests. Anonymous Auth/IP protection requires a trusted boundary; report any incomplete part explicitly.
- Validation: run local migrations, direct REST negative/concurrency checks, unit, lint/typecheck/build, desktop/mobile browser regressions. Local fixtures are never actual YouTube/LLM/provider verification.
- No push, external deployment, credentials or console changes authorized by this continuation.
- Merge compatibility gates: Node22 lint/typecheck/build PASS; initial unit119/14 files PASS; new D004 targeted19/2 files PASS. Integration security hardening follows in its own ticket commit.

- Final local gates: unit138/16, production builds, local Auth E2E26, keyless4, direct REST28 groups, SQL3 rollback fixtures and both actual USER packet baselines PASS. Full failures/limits: verification.json. Main remained65063c8 at final fetch. Ticket commits recorded separately; no DONE/push/deployment.
