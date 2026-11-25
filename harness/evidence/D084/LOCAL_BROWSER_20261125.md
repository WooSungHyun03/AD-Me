# D084 · 2026-11-25 local-browser full run on isolated replica (new; earlier evidence unchanged)

Base: origin/main `77fd552` + this slice. Scope: loopback replica `d002-replica` (API 56321, DB 56322, Mailpit 56324) only.
No hosted DB, deployment, live payment, real mail provider or YouTube network call (embed requests are intercepted).

## Reproduction (before)
`npx playwright test --config playwright.local.config.ts tests/local-browser` → 76 passed / 22 failed.

| Group | Cause | Kind |
|---|---|---|
| p0-consent-accessibility, independent-tickets (axe) | `--muted #706c82` = 4.3:1 on lavender `#f1eaff` (< WCAG AA 4.5) | product (DEV-B theme) |
| p0-finish | home lost D081 real counts (`creator_home_summary`) in redesign `d662a3d` | product regression |
| public-embed-recovery | CSP `frame-src` allowed only Toss, so the consented `youtube-nocookie.com` player was blocked before any request | product (D028) |
| independent-tickets | query used non-YouTube wording while sentence search is YouTube-only | stale spec |
| youtube-campaign, conversation | assumed the shared creator account owns a published profile; `p0.spec` leaves a tombstone | fixture order |
| campaign-terms | asserted 0 DEMO cards; TEST demo catalog legitimately shows labeled DEMO | spec assumed free mode |
| account-email ×2, email-signup | inbox hard-coded to `:54324` (another local stack); replica lacked auth templates | environment |
| conversation, reviews (reruns) | message/review submit quotas are not refunded by deleting the report → 429 on reruns within the hour | fixture cleanup |
| free demo-boundary | inserted a second profile for the shared creator (`owner_id` unique) | fixture order |

## Change
- `src/app/figma-theme.css`: `--muted #68647a` (≥4.86:1 on `#f1eaff`, `#fff`, `#faf9fd`, `#fcecf6`). **DEV-B shared file — handoff.**
- `src/app/page.tsx`: server-renders the actual `creator_home_summary` counts / KST time / free-beta limit, or an explicit "확인 중" fallback (no estimates).
- `next.config.ts`: `frame-src` adds only `https://www.youtube-nocookie.com`; `tests/web-security.test.ts` pins the exact list.
- Tests: `ensureCreatorProfile`/`dropCreatorProfile` (snapshot + exact restore), quota cleanup in conversation/reviews, own fictional owner in free demo-boundary, DEMO assertion only in free mode, `MAILPIT_URL` override (same as `tests/ci-db.sh`), YouTube-only query.
- Replica only (not committed): Mailpit enabled, QA auth templates applied as `scripts/setup-local-qa.mjs` does; 8 leaked fictional `auth.users` rows with NULL tokens (from earlier failed runs of the D002 role check / privacy suite) removed because they broke Auth admin `listUsers`.

## Results
| Check | Result |
|---|---|
| `npx playwright test --config playwright.local.config.ts tests/local-browser` (MAILPIT_URL=:56324) | PASS 98/98 (desktop+mobile) |
| `npx playwright test --config playwright.free-local.config.ts` | PASS 12/12 |
| conversation ×3, reviews ×2 consecutive reruns | PASS (quota/profile restored: 0 windows, tombstone back) |
| `npm run test:e2e:keyless` | PASS 18/18 |
| `npm run lint` / `npm run typecheck` | PASS |
| `npm test` | PASS 96 files / 571 tests |

Role/retry covered by the run: brand/creator/admin(TOTP)/staff flows, lost-acknowledgement retries (conversation, publication save, deletion), stale replay denial, quota 429 then clean rerun, mailbox-proof reuse denial.

Desktop 1440 / mobile 390: `local_browser_20261125/home-*.png` (actual counts 48 total · 0 registered · 48 DEMO, KST time, no overflow), `conversation-*.png`.

## Remaining gates
- Owner-env `npm run test:e2e` (needs owner `.env.local`), real mail/provider/Toss TEST, remote CI: not run.
- Production: CSP change and home counts reach production only via the ordinary main deployment; migration `20261125120000` still awaits operator apply + fingerprint approval.
