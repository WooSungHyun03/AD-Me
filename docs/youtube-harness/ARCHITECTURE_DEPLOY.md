# Architecture, deployment, desktop operations, incident runbook

## Target graph
```
User browser (Korean web app)
    |
    v
Vercel — existing Next.js App Router
    |          |                \
    v          v                 v
Supabase Auth/Postgres/RLS   Toss Payments TEST SDK + server approval
    |
    +--- Realtime (only chat members)
    +--- Storage (owner-uploaded content, private attachments)
    +--- Cron: every day 04:00 KST enqueue jobs
    +--- jobs tables / pgmq if available
                 ^
                 | authenticated pull, lease, ack
Local/Remote persistent worker (Docker/systemd, GPU where present)
    |--- YouTube Data API v3 discovery / daily sync
    |--- Ollama/open-weight LLM + embedding
    |--- data freshness and provider-policy gates
```

## Why no direct public GPU endpoint
Local server may be behind NAT/firewall and can be offline. Pull-worker queue with backoff avoids public model port and decouples web responsiveness. No GPU process on Vercel. Website displays queued/processing/failed and ready snapshots. For low latency, optionally add authenticated HTTPS gateway after verifying security and availability.

## App stack
Keep existing dependencies and upgrade only when necessary. Next.js + TS strict + Tailwind/shadcn/ui + Zod, Supabase `@supabase/ssr` Auth/Postgres/RLS/Realtime/Cron + optional pgvector, Toss SDK v2, worker in TypeScript or Python (only if AI libraries justify). Tests Vitest + Playwright, GitHub Actions. Pin lockfiles. Avoid extra microservices/Redis unless measured necessity.

## Development through ChatGPT Desktop Work
Desktop handles GUI, shell and connected service interfaces; user only handles credentials/2FA/approval when provider requires. Agent can run server, inspect webpages, keep task checkpoint. Do not embed ChatGPT API requests in app/harness to imitate desktop automation. If remote server unavailable, code/test queue and local adapter, report actual provider blocker.

## GitHub/main
- Inspect working tree, remote and branch protection; fetch origin main; preserve uncommitted work.
- At each vertical slice verify tests+diff secrets and commit/push regular to `origin/main` if permitted. Never force push; avoid posting secrets and production credentials.
- Verify remote SHA; keep exact tests/evidence and deploy commit. CI should fail for missing tests/lint or SQL policy violations.

## Deployment sequence
1. Configure Supabase/Auth redirect domains, migrations, RLS policies, indexes, realtime publications and cron queue schema. Test two-role isolation before public deployment.
2. Configure YouTube API and Google OAuth quotas/scopes + policy acceptance; enable only verified capabilities. Test one real channel and sync, then bounded daily queue.
3. Deploy persistent local worker, healthy startup, model load and GPU concurrency caps. Ensure restart system and connection to Supabase are working.
4. Configure Toss TEST keys and server secret (never public). Confirm TEST order and entitlement. Test refund TEST when authorized.
5. Deploy Next.js on Vercel with safe env vars; ensure that Hobby terms allow actual usage. Smoke-test domain 390/1440, auth, search, job, application, chat, sponsored, admin, query stats policy flags.
6. Record deployment URL/commit/time, system status and known blockers. If account approval unavailable, stage and report BLOCKED rather than claim deployed.

## Monitoring and failure paths
- YouTube quota exhausted: queue paused until documented reset, show stale-data indicator. Never bypass by scraping.
- LLM unavailable: structured search with authorized first-party tags still works; AI summary queued/error. No charge for unsuccessful paid run.
- Toss approved but DB grant transient failure: reconciliation job idempotently grants once, status `reconciling`, not fake success.
- Cron down: job for that date enqueued on recovery with duplicate prevention.
- Queue flood: max running concurrent, exponential backoff and dead letter; admin dashboard alert.
- Chat abuse: rate limit, report, block, moderator scoped visibility.
- RLS security incident: disable exposed route, retain audit, fix migration and add regression test.

## Rollback
Use git revert migration-safe process and Vercel rollback; for destructive DB migration require backup and owner approval. Stop ingestion via feature flag before rolling back worker-dependent schema. No deleting real user records to 'fix the demo'.
