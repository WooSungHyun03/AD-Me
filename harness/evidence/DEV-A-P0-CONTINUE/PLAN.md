# DEV-A P0 continuation — 2026-11-19 KST

Baseline: root checkout HEAD 4437eb1, branch codex/dev-a-p0-continue. Existing dirty files and dev-a-local independent checkout are preserved; earlier d1b2aa5 evidence is historical.

Execution boundary: local source/migrations/tests/browser/package only. No remote console changes, credentials, push, or deployment.

Planned sequence: restore exact lockfile toolchain; rerun D003/D004/D008/D009/D065 keyless gates; D007 reproducible installed-license inventory; implement D016 database + API MFA/recent-auth and separately provisioned administrator grant; implement D059 owner publication versus moderation lock and direct SQL/REST regression; advance ready independent P0 contracts with evidence. No ticket is DONE before its complete acceptance and external/cross-review gates pass.

Shared interface change proposal: additive migration 202611190004_admin_security.sql reserved for D016; 202611190005_moderation_locks.sql for D059. is_admin() keeps its boolean signature, now requires active provision + AAL2/recent MFA. Existing role-only administrators must be provisioned by USER before access. Legacy moderation RPC remains callable with original 3 args; published=false applies lock, true releases lock without changing owner's publication choice. DEV-B review required before application.

Expected checks: lint, typecheck, Vitest; production build; keyless desktop/mobile Playwright; isolated DB role/JWT/policy checks and direct PostgREST denials when local runtime is available. Fixtures are explicitly fictional. No actual provider verification is inferred.

D012 reservation: 202611190006_brand_profiles.sql. Public BrandPublicDTO v1 deliberately excludes contacts and owner_id. Private/collaborators contacts use separate RLS; D027 logo attachment remains unavailable. Legacy name-only PATCH is retained. D011 onboarding cross-review remains pending.
