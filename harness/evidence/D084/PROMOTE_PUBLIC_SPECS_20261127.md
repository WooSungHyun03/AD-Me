# D084 — account-free public specs promoted to CI E2E (2026-11-27)

Moved from `tests/local-browser/` to `tests/e2e/` (no content change; each spec already removes its own fixtures):

| spec | covers |
|---|---|
| demo-boundary | D005 labeled DEMO creators/campaigns in the isolated TEST DB, API/compare/sitemap 200 |
| license-notices | shipped notice + supplement byte/sha256 match manifests, axe WCAG 2.1 AA, no overflow |
| main-integration | fictional featured channel renders, expired source data → not-found |
| public-catalog | RSC payload excludes private JSON fields, placeholder followers = 미확보, legacy URL redirect |
| public-embed-recovery | embed opt-in only, offline retry, share without clipboard permission, hidden after withdrawal |

`playwright.notices.config.ts` now matches `e2e/license-notices.spec.ts`.

## Runs (disposable ci-e2e stack at main 4458501 + this change, CI env `SERVICE_MODE=test_demo`)

- Moved specs only, desktop+mobile: 10 passed.
- Fresh DB full E2E: 146 passed / 2 failed (retention ×2, known DEV-B/U001) / 4 skipped.
- Replica d002-replica (`playwright.local.config.ts`): 10 passed.
- prettier, eslint, `tsc --noEmit`: pass. `playwright.notices.config.ts --list` finds the spec (2).

Not production-verified. Account-dependent local specs (21) read `output/dev-a-db/accounts.local.json`; promoting them needs an accounts fallback and is a separate unit.
