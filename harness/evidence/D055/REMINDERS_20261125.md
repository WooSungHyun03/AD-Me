# D055 · 2026-11-25 in-app deadline reminders (new; earlier calendar evidence unchanged)

Base: origin/main `9284d87`. Scope: loopback replica `d002-replica` only. No hosted DB, deployment, email or provider call.

## Reproduction (before)
Replica: `notifications.kind` allowed `status|message|deliverable|saved_search`, no reminder job in `cron.job`. The
D055 calendar download existed (2026-11-22) but nothing told either side that a production/posting end was near.

## Change
- Migration `20261125170000_d055_deadline_reminders.sql` (expand/switch; manifest + pending packet row #24, also row #23
  for DEV-B `20261125160000` which had a detail row only):
  - `notifications` kind `deadline` + `due_at`; subject check: deadline rows need a proposal, a milestone
    (`production|posting`) and `due_at`; existing proposal/saved-search rows unchanged. D015 service-email trigger
    skips `deadline` (email waits for D053).
  - `adme_ops.scan_deadline_reminders(p_now)` (service-only, no client grant), pg_cron `adme-deadline-reminders` hourly:
    accepted/submitted/revision_requested proposals on non-demo campaigns, milestone end in `(now, now+24h]` → one
    reminder for the brand and one for the creator. `source_key` includes the due time: reruns never duplicate, a
    changed deadline reminds once for the new time. Job-level advisory lock. Terms timestamps are DB-validated
    (`valid_campaign_terms`), so the cast cannot fail on stored rows.
- `src/lib/notifications.ts`: "제작|게시 마감이 24시간 안에 다가옵니다 · M월 D일 HH:MM (KST)" (UTC stored, KST shown);
  link reuses the proposal anchor `/dashboard#proposal-…`.

## Results
| Check | Result |
|---|---|
| `tests/local-deadline-reminders.mjs` | PASS 9 groups: client roles cannot run the job + cron registered; inactive proposals (pending/rejected/cancelled/completed) get none; brand+creator one each, posting waits; RLS each side 1, unrelated 0; no email row; hourly reruns no duplicates; +24h included / due-now excluded; changed deadline reminds once more; concurrent lock 0 then 2; delete cascades |
| Mutation (`>` → `>=` boundary in replica) | suite FAILS (`actual 2, expected 0`); restored → PASS |
| `tests/local-saved-search-alerts.mjs` (D037 shares the table) | PASS 8 groups |
| `local-conversation-security`, `local-delivery-security` | PASS |
| `tests/local-browser/deadline-reminders.spec.ts` + D037 spec | desktop+mobile 4/4 PASS |
| `scripts/audit-local-permissions.mjs` → `permissions-20261125.json` | PASS (107 tables, 426 functions) |
| migration_check / migration_check_test | PASS 128 / OK |
| unit `tests/saved-searches.test.ts` (KST date-crossing text) | PASS |

Desktop 1440 / mobile 390: `screens_20261125/d055-deadline-*.png` (unread, KST time, no horizontal overflow).

## Not done / remaining
- Campaign-level recruitment-end reminder for the brand (no proposal subject) and a dashboard deadline filter: not built.
- Email/push reminders: D053 (DEV-B) + U007. Hosted: migration + fingerprint approval (packet row #24), pg_cron job must exist.
