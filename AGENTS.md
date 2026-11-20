# AD Me — Agent operating contract (always read first)

## Current session authorization — 2026-11-19
The latest user explicitly requested direct execution of all 20 external tickets. This supersedes the earlier USER-only technical-execution restriction for this work: the agent may perform reversible GitHub/Supabase/Vercel configuration, approved TEST integration and deployment using authorized existing accounts. Identity verification, personal consent/legal acceptance, paid upgrades, third-party outreach and final unverified launch claims remain excluded. Never mark an entire U ticket complete from a partial configuration change. Retain earlier handoff instructions as historical policy and record exact evidence and blockers.

## Priorities
1. Correctness/security > actual end-to-end workflow > coherent visual design > breadth > fanciness.
2. Current P0/P1/P2 scope and workload are in docs/REAL_SERVICE_TICKETS.md and harness/service_backlog_v2.json. The old 14-day estimate is historical. Never mark a mock as full implementation.
3. One task at a time unless independently parallel and no shared migration conflict.
4. Current user policy (2026-11-19) supersedes prior autonomous-deployment permission: the USER alone performs deployment-site/account configuration, external console changes, actual cloud deployment/rollback, and API key issuance/registration/rotation. Agents prepare code, migrations, configuration-name lists, tests and instructions; never retrieve/register keys or deploy on the user’s behalf. Read-only verification remains allowed. Free actual-data beta is the release scope; TEST billing stays isolated. Never accept real money or expose secrets.
5. Never touch real payment keys. Only Toss test keys, never real money and never charge anything unrequested.
6. Do not scrape platforms contrary to their terms or remove security gates. OSS license obligations apply even for non-commercial/open source.

## Execution efficiency — user preference 2026-11-21
- Prioritize finishing independently actionable IN_PROGRESS P0 work, then ready OPEN P0 work, then P1/P2. When a prerequisite is external or owned by DEV-B, record the exact remaining gate and continue independent implementation; do not repeatedly revisit an unchanged blocker or relabel it complete.
- Implement related tickets sequentially in one batch, preserving a separate commit and acceptance evidence for each ticket. Run affected unit/API/permission/data-integrity tests after the relevant change. Run shared lint/typecheck/full unit/build/affected desktop-mobile regression once against the final batch source; repeat only checks invalidated by subsequent changes or failures. All required exit gates still apply.
- Reuse the marked disposable QA environment within the batch; serialize operations sharing its database/build output. Inspect logs and changed paths narrowly. Preserve prior evidence and reference it with its tested source instead of repeatedly reproducing unaffected historical results.
- Produce one reviewed USER application packet at batch end when SQL/configuration handoff changed. Keep old artifacts immutable. Avoid repeated ZIP generation, full archive/hash inventories and duplicate prose without a changed artifact or integrity concern. Keep ticket evidence concise, with commands/results/source, actual versus fixture scope, and remaining gates.
- Keep the existing working branch and ticket commits, push the authorized batch, and report actual implementation progress separately from USER application/review/provider gates. Completion criteria, applied migration immutability, permission checks and truthful status reporting are unchanged.

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
- Read `harness/service_backlog_v2.json`, `docs/REAL_SERVICE_TICKETS.md`, historical `harness/tasks.json` and `harness/session_log.md`. New real-service work follows the v2 backlog; preserve old completion evidence.
- For current D/U work, follow docs/handoff/SHARED_EXECUTION_CONTRACT.md and update harness/handoff/runtime-status.json with evidence. harness/loop.py only supports historical T IDs; never use it to complete a D/U ticket.
- Make code and tests together. Refuse to 'complete' with unresolved build errors.
- Run relevant automated tests; inspect page in browser where available (mobile + desktop).
- Log evidence before marking any ticket done. For historical T IDs only, loop.py complete/block remains available; current D/U state and external blockers belong in the handoff runtime ledger.

## Deployment gates
- USER performs external GitHub/Vercel/Supabase configuration and hosted changes/deployments. Agents prepare reviewed artifacts and validate the resulting URLs. Do not push changes that trigger deployment without the user coordinating that deployment.
- Agents execute local development/test commands. USER-only external actions have separate U tickets; provide clear console instructions, never assign manual source editing or package installation to the user.
- Cloud OAuth, provider credentials and external configuration are USER work. Never claim deployed without checking an actual URL. Paid operation is deferred under the current no-business-registration scope.
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
