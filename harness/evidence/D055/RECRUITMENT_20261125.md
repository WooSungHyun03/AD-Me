# D055 · 2026-11-25 brand recruitment-close reminder (new; earlier D055 evidence unchanged)

Base: origin/main `6c25a24`. Scope: loopback replica `d002-replica`. No hosted DB, deployment, email or provider call.

## Reproduction (before)
`scan_deadline_reminders` covered only active collaborations (production/posting). A brand got no warning before
its own campaign stopped accepting applications; `notifications` had no campaign subject.

## Change
- Migration `20261125210000_d055_recruitment_reminder.sql` (manifest packet row #28, counts 132/28):
  `notifications.campaign_id` (nullable, FK cascade); subject check gives only `deadline/recruitment` a campaign
  subject; read policy adds "campaign owner" next to the unchanged saved-search and proposal-party arms; the same
  hourly job adds published/allowed/non-demo campaigns whose effective close `least(recruit_until, terms.recruitment.end)`
  (the pair the D043 application gate checks) is within 24 h. Dedup by `source_key` with the due time.
- Inbox: "모집 마감이 24시간 안에 다가옵니다 · … (KST)" linking to `/campaigns/{id}`.

## Results
| Check | Result |
|---|---|
| `tests/local-deadline-reminders.mjs` | PASS 10 groups (new #10: terms close reminds owner; earlier `recruit_until` reminds again for the effective close; reruns no duplicates; owner 1 / creator 0 / unrelated 0; closed campaign none) |
| Mutation: drop `status='published'` filter | FAIL "closed campaigns get no reminder" → restored PASS |
| `tests/local-saved-search-alerts.mjs` (shared policy) | PASS 8 groups |
| browser `deadline-reminders` + `schedule-history` + `saved-search-alerts` | desktop+mobile 6/6 |
| permission audit `permissions-recruitment-20261125.json` | PASS |
| lint / typecheck / unit 584 / migration_check 132 / test | PASS |

Screens: `recruitment_20261125/d055-deadline-{desktop,mobile}.png` (recruitment + production reminders, KST).

## Remaining
- Email reminders wait for D053 (DEV-B) + U007. Hosted: packet rows #24, #27, #28 approval; pg_cron job present.
