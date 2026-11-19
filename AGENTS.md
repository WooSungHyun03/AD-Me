# AD Me — Agent operating contract (always read first)

## Priorities
1. Correctness/security > actual end-to-end workflow > coherent visual design > breadth > fanciness.
2. P0 tasks define 14-day baseline. P1 stretch; P2 backlog. Never mark a mock as full implementation.
3. One task at a time unless independently parallel and no shared migration conflict.
4. Deployment is explicitly authorized for this university TEST-only project: implement, test, deploy to Vercel + Supabase and verify the reachable URL. Never perform real payment, create paid subscriptions, or expose secrets. If account connection/consent is required, request only that action; continue independent tasks.
5. Never touch real payment keys. Only Toss test keys, never real money and never charge anything unrequested.
6. Do not scrape platforms contrary to their terms or remove security gates. OSS license obligations apply even for non-commercial/open source.

## Stack
- Next.js App Router (current stable), TypeScript strict, React, Tailwind, shadcn/ui, Lucide.
- Supabase Postgres/Auth/Storage, `@supabase/ssr` current supported API. SQL migrations in `supabase/migrations/`; RLS on every private table.
- Zod forms/inputs, Vitest for unit integration, Playwright for E2E, npm scripts lint/typecheck/test/test:e2e/build.
- Toss Payments v2 JS SDK one-time **test** checkout; 30-day non-renewing access pass. True recurring billing is P2, separate API.
- Vercel frontend/server functions + Supabase database. No persistent local SQLite/file storage for deployed production state.
- Optional LLM provider behind an adapter with deterministic fallback; never make an expensive or uncontrolled number of calls.

## Files & conventions
- Domain modules: auth, creators, campaigns, matching, proposals, risk-reviews, billing, analytics, admin.
- Data provenance fields: source_type, source_url, verified_at, owner_consent, is_demo.
- Server-only secrets; client only `NEXT_PUBLIC_` publishable values. Row-level security required, service role never sent to client.
- Use user-provided `public/brand/ad-me-logo.png`; on a light background for dark letters. No replacement via random emoji/icon.
- Korean UI, modern editorial B2B: charcoal #111312, lime #D7FF45, warm off-white #F5F5F0, near-black text, spacious responsive layout. Use token values; ensure contrast.
- Demo dataset fictional (48 creators, 8 campaigns) and visibly labeled; no real brand accusations.

## Before each task
- Read `harness/tasks.json`, `harness/session_log.md`, relevant docs.
- `python3 harness/loop.py next` to select; `start <ID>`; document intended tests.
- Make code and tests together. Refuse to 'complete' with unresolved build errors.
- Run relevant automated tests; inspect page in browser where available (mobile + desktop).
- Log evidence, then `complete <ID> --evidence "..."` (this records a claim, not automatic proof). If blocked, use `block` with reason.

## Deployment gates
- Agent performs GitHub repository setup/push, Supabase project setup/migrations/RLS, Vercel deployment and post-deploy smoke tests when tools and credentials are available.
- The user is not expected to run terminal commands manually; the agent executes them.
- Cloud service OAuth, missing provider credentials and paid upgrades require user participation/approval. Never claim deployed without checking an actual URL.
- Toss test checkout ONLY; production URL may be public but payments are TEST, demo records labeled.

## Exit gates
- Gold path passes two-role E2E; opposite-role permissions are denied; admin screens gated.
- Auth, DB migrations, seeded data, Stripe-like fake flow NOT accepted for Toss integration: actual Toss SDK test-key + backend confirmation required (if keys provided); without keys mark external checkout BLOCKED rather than pretend pass.
- Zero hardcoded secrets, no insecure demo auth enabled in public build, no fake statistics presented as factual.
- `npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e` pass, or report exact blocker with evidence.

## Autonomous loop limits
- Do not silently enter an infinite shell loop. A session can stop; persistent task JSON lets the next session resume.
- Maximum 3 iterations on identical blocker, then triage root cause and proceed with independent tasks. Never bypass tests by skipping them.
- Preserve earlier user files and avoid destructive actions without explicit reason.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
