# DEV-A main integration review — 2026-11-22

User request: review the existing A branch and merge it into main without an immediate production deployment. This is development integration; unresolved release/ticket gates remain in force.

## Deployment hold

`vercel.json` now sets `git.deploymentEnabled.main=false` and `git.deploymentEnabled["codex/dev-a-p0-continue"]=false`. This prevents Vercel Git-triggered deployments of main and this A branch; other branches retain their default behavior. The matching CI check rejects drift, including wildcard rules that could override the hold.

Source checked on 2026-11-22: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled), and the live `https://openapi.vercel.sh/vercel.json` schema. Vercel documents unspecified branches as enabled and any matching true rule as overriding false rules.

This is a repository deployment hold, not a claim that Vercel console Git integration is disconnected. Manual CLI/dashboard deployments and external deploy hooks are outside this guard. No cloud setting, deployment, key or database is changed by this review. The repository's only GitHub workflow runs validation and has no deployment or SQL-application step. `npm run build` only runs `next build`.

## Reviewed source and integration result

- Baseline `origin/main`: `65063c8`; reviewed A implementation head: `f04736af66911731ac14b761a2833cfab2568edc`. Main is an ancestor; 99 existing ticket/evidence commits can be preserved without conflict or squashing.
- Main has 8 SQL migrations; A has 67. All 8 main migration files are unchanged; 59 are additive. Integration does not apply them to a cloud database.
- Inspected mandatory Auth budget/account-access RPC paths, creator filtered read contracts, server-only admin key use, deletion receipt/quarantine scope, operator recent-MFA/role checks, support-search purpose/audit SQL and feature defaults. These paths fail closed; a cloud database still on the old schema cannot safely run this application version.
- Reused exact-source evidence rather than claiming a fresh cloud/provider verification: `harness/evidence/DEV-A-READY-20261122/verification.json` (257 unit tests, actual local DB/Auth/Storage contracts, 138 local security groups and desktop/mobile regressions) and `harness/evidence/D007/VERIFY_SUPPLEMENT_20261122.json` (later license-only source, Windows/Linux builds and 12 affected browser checks). Earlier full-browser failures and their targeted fixes remain disclosed in that evidence.
- Latest implementation CI run before this configuration change: [44924792924](https://github.com/WooSungHyun03/AD-Me/actions/runs/44924792924), success on exact head `f04736a`.
- Deployment hold, secret scan and diff whitespace are checked locally; the new configuration commit must also pass GitHub CI before merge. Respect main branch protection and required reviews; do not use an admin bypass or force push.

Development integration is acceptable with the deployment hold and normal required checks/reviews. This is not an independent DEV-B acceptance of every ticket, nor production release approval. No ticket or USER action is promoted to DONE by merging.

## Gates retained for a later coordinated release

Confirm actual cloud migration history, select the matching reviewed incremental USER SQL packets, apply in order and verify hosted Auth/search/admin flows. The latest 60→67 packet requires the exact 60 baseline; it is not an 8→67 shortcut. USER config/DB/release actions and DEV-B release/migration coordination remain outstanding. Policy approval, actual permanent deletion/retention, provider/SMTP verification and license-rights review are not completed by this integration. See the runtime ledger and `docs/handoff/DEV-A_PREREQUISITES_20261122.md`.
