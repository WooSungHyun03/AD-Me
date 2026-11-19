# Architecture / Modules

## Runtime
```
Browser (App Router + React + shadcn/ui)
    ↕ SSR / Server Actions / route handlers (Zod validation + RBAC)
Supabase Auth ── Supabase Postgres (RLS) ── Supabase Storage (policies)
    ├── Creator Catalog / Ads / Provenance
    ├── Campaign + Applications + Proposals
    ├── MatchingEngine (pure TypeScript)
    ├── PaymentsAdapter (Toss SDK v2 server-confirm)
    └── AIAdapter (opt-in, cost-capped, fallback)
```

## Module/Directory convention
```
src/app/                  App Router pages, layout, route handlers
src/components/           shared UI and design system
src/features/creators/    CRUD, filters, provenance, profile
src/features/campaigns/   campaign CRUD, candidate shortlist, applications
src/features/matching/    matcher.ts (pure fn), scoreBreakdown.ts, tests
src/features/proposals/   status machine, messaging, deliverables
src/features/billing/     orders, test checkout/confirm, entitlements
src/features/safety/      source-based reviews, reports, admin workflow
src/features/admin/       moderation and audit
src/lib/supabase/         typed server/browser clients
src/lib/ai/               provider interfaces, disabled/no-key fallback
src/lib/errors/           typed errors, redacted logging
supabase/migrations/      SQL and policies
supabase/seed.sql         only permitted synthetic data
```

## Feature seams
### MatchingEngine (server, deterministic)
Inputs: CampaignBrief, CreatorProfile, SocialMetricsWithProvenance, TagTaxonomy.
Output: `{creatorId,score,confidence,breakdown:[{factor,score,evidence,missing}],eligibility,exclusions,generatedAt}`.
Initial weights: vibe 0.28, category 0.25, audience 0.20, budget 0.15, format 0.12. Apply hard ineligibility first. Only known factors contribute; normalized weighted mean among known weights. Show coverage=sum known weights. Missing metrics ≠ zero. Opt-in LLM may rewrite the explanation only, not authoritative numbers. Audit scorer version and weights.

### Creator safety
Do not create a defamation score for real persons; safety review is structured `(topic,sourceUrl,articleDate,reviewStatus,subjectResponseUrl,lastReviewedAt)` and human approval. Records with no verified reliable source are excluded from public display. Synthetic demo incidents must carry `is_demo`.

### Provenance/consent
Every metric has `sourceType`, `sourceUrl`, `fetchedAt`, `verifiedAt`, `isDemo`; every media asset has rights/owner consent metadata. Unknown claims do not appear as factual analytics. No unapproved large-scale scraping.

### Payment
See `PAYMENTS.md`. `NEXT_PUBLIC_TOSS_CLIENT_KEY` browser only; `TOSS_SECRET_KEY` server only; verify DB order/amount/ownership before approval; update entitlement in transaction after confirmed success; replay safely.

### Role policy
- Public: published creator profiles, published campaigns and sample data only.
- Brand: own campaigns/shortlists/proposals, received applications, billing.
- Creator: own profile, applications, received proposals and public campaigns, own billing.
- Admin: moderation queue and supported audit operations; use explicitly permission-checked server-only service client.

### Analytics
Reports never invent third-party ROI or audience percentages. Sample values shown only when clearly `DEMO`, user-supplied, or API-derived. Default event logs avoid personal identifiers in analytics.
