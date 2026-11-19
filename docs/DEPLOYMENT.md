# AD Me — Agent-operated deployment runbook

**User authorization:** The user now explicitly requests ChatGPT Desktop to carry out implementation, cloud deployment and public URL verification directly. Old no-deploy instructions are superseded. This is a TEST-only university project; no revenue or live payment.

## Stack
- Vercel: Next.js App Router and server functions.
- Supabase: PostgreSQL, Auth, Storage, RLS, migrations.
- GitHub: public repository after secret/privacy checks (ask only for OAuth/connect if required).
- Toss Payments: test client and secret keys ONLY; 30-day pass via one-time TEST payment. Real recurring billing requires separate approval/API.

## Agent execution (not a manual user tutorial)
1. Inspect current git, status, build scripts, tests, and connected accounts/tools; keep all changes reproducible.
2. Install dependencies and run lint, typecheck, unit/integration, build, Playwright; repair real issues.
3. Check `.gitignore` and secret scanner; never commit `.env.local`, tokens, service-role key, test passwords or private data.
4. Create/connect GitHub repository and push verified code. If external account/OAuth consent necessary, ask for that exact action once.
5. Create/connect Supabase project. Configure schema migrations, RLS, auth callback origins, storage policies, DB seed (demo clearly labeled).
6. Create/connect Vercel project. Register only approved public env and private server-side secrets via official secret/env UI/API. Never print secrets in chat or command logs.
7. Deploy actual site to Vercel, verify build logs, open the URL in a real browser.
8. Execute deployed-site smoke tests: anonymous, brand, creator, admin denied path, matching, proposals, payments UI. Confirm read/write persists across refresh. Review desktop/mobile screenshots.
9. Test Toss SDK with real **test keys** if available, check backend confirmation, idempotency and entitlement. Without keys or provider permission, report actual provider checkout UNVERIFIED/BLOCKED, not success.
10. Iterate fixes and redeploy. Record final URL, commit, deployment ID, test evidence and rollback instructions.

## Stop conditions
- Never switch to live payment, charge actual cards, sign up for paid infra, publish third-party confidential/personal data, or bypass account permissions.
- When a new account login/2FA/API key approval is required, stop only that integration, request user action, continue independent work.
- Never invent a successful URL or make a sample UI a substitute for database-backed workflows.

## Env inventory (actual names follow installed SDK versions)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or newer publishable key as required
- `SUPABASE_SERVICE_ROLE_KEY` when strictly necessary, server only
- `NEXT_PUBLIC_TOSS_CLIENT_KEY` (TEST only)
- `TOSS_SECRET_KEY` (TEST only, server only)
- `NEXT_PUBLIC_APP_URL`
- Optional LLM API keys, server only

## Hosting notes
- For a noncommercial demonstration, review eligibility of Vercel Hobby and Supabase limits.
- Public repository does not waive OSS license duties, photography rights, API terms, or privacy obligations.
- All external payment outcomes need provider verification; deployment health and payment integration test are separate exit gates.
