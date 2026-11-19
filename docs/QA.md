# Quality Assurance / Acceptance Matrix

## Hard gates (ALL must pass for P0 release-ready)
- [ ] `npm run lint` exit 0
- [ ] `npm run typecheck` exit 0 (strict TS)
- [ ] `npm run test` exit 0 (matcher, proposal machine, order state machine)
- [ ] `npm run build` exit 0
- [ ] `npm run test:e2e` exit 0 for P0 golden paths (if external test checkout unavailable, test unit with simulated gateway; mark external as blocked)
- [ ] Auth: anonymous cannot read private campaigns/proposals/orders
- [ ] Auth: brand A cannot update brand B's campaigns or access orders
- [ ] Auth: creator cannot accept other's proposal
- [ ] Admin: no unauthenticated or normal user can call moderation ops
- [ ] Matching: eligibility filters, weighted score, missing metric normalization, deterministic reruns
- [ ] Matching: HOT promotion never changes organic score
- [ ] Payments: order amount tampering blocked, duplicate confirmation no double grant, failed confirmation no grant
- [ ] Payments: only test keys and user-supplied (not invented) secret
- [ ] Analytics: invented metrics absent or labeled DEMO
- [ ] Safety: fictitious sample issues visibly labeled, reliable source required for real-public display
- [ ] Data: FKs, RLS on all private tables, no private assets publicly exposed
- [ ] UI: 390/768/1440 viewport, focus, empty/loading/error states, branding
- [ ] Docs: local setup, seed, tests, architecture, separate deployment runbook

## Production deployment QA (TEST-mode)
- [ ] Actual Vercel URL loads with stable HTTPS
- [ ] Supabase migrations applied, RLS enforced on live demo instance
- [ ] Brand-to-creator proposal persists after reload on deployed site
- [ ] Payment controls use Toss TEST keys only; missing keys explicitly blocked
- [ ] Vercel/GitHub environment secrets absent from public source and browser bundle
- [ ] Post-deploy smoke screenshots, deployment ID, Git commit and rollback guide recorded

## Golden user journeys
1. **Brand**: create account/login -> create skincare campaign -> set tags/category/format/budget -> get matches -> inspect breakdown -> shortlist 3 -> compare -> send proposal.
2. **Creator**: login -> edit vibe/price/platform -> see new proposal -> accept or reject -> see state update -> register deliverable.
3. **Brand follow-up**: refresh; proposal status persists; completed state and campaign view correct.
4. **Creator apply**: creator browses public campaign -> submits application -> brand reviews -> accepts/declines.
5. **Payments**: choose Pro -> create order -> actual Toss v2 *test* checkout -> confirm on server -> entitlement -> billing history. Same for HOT -> PROMOTED badge separate from organic ranking.
6. **Moderation**: admin sees report, hides incorrectly sourced data, audit log generated; non-admin denied.
7. **Security abuse**: direct API call to other brand/campaign/order rejected; payment amount/client params cannot grant access.

## Testing contract
- `data-testid="creator-search"`, `creator-card`, `campaign-create-form`, `match-result`, `match-breakdown`, `compare-table`, `proposal-send`, `proposal-accept`, `pricing-plan`, `checkout-widget`, `demo-label`.
- Unit tests for matcher pure function, deal state machine, quota check, product/amount validation.
- Integration tests for DB RLS, ownership, entitlements. If Supabase cannot run locally, CI gate explicitly `BLOCKED` until executed against an isolated test database, not fabricated success.
- Playwright must not rely on hardcoded user credentials in public repository. Use `.env.test.local` or secure CI secrets.

## Definition of Done
A task has: (1) tested production code (2) persisted DB path if needed (3) user-facing UI (4) expected errors (5) tests + evidence (6) docs updated. Tasks are not done because screenshots look good.

## Executed evidence — 2026-11-19

- `npm run lint`, `npm run typecheck`, `npm test` (12), `python3 harness/selftest.py` (5), `npm run build`: passed.
- Local Playwright desktop+mobile: 6 passed in 57.5 seconds.
- Initial deployed suite: 4 passed in 48.5 seconds. Expanded deployed suite exposed a mobile logout-test race: navigation to dashboard cancelled the unfinished server action. Test now waits for home navigation before checking the protected dashboard; see final session log for rerun outcome.
- `node tests/security.mjs`: actual Supabase RBAC/RLS/privilege escalation/foreign data/forged entitlement/admin audit/malformed JSON checks passed.
- Database-only finalized test order in a rolled-back transaction: idempotency, different key and amount rejection, HOT and expiry passed. No real or provider TEST charge was completed.
- Synthetic seed replay leaves exactly 48 DEMO creators and 8 DEMO campaigns.
- Screenshots: `output/playwright/` (local, ignored); traces and QA credentials remain outside Git.
- `python3 harness/secret_scan.py`: passed; public source contains no configured secret patterns or private account/env files.
