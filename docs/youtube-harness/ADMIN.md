# AD Me — integrated operations console

## Roles and authorization
- `super_admin`: all administrative permissions, role grants (requires step-up) and flags.
- `creator_reviewer`: channel claims, tags, profiles, correction/deletion requests.
- `campaign_moderator`: jobs, application reports, disputes.
- `billing_operator`: prices, order investigation, TEST refund and entitlements; cannot elevate admins.
- `data_ops`: YouTube ingestion, AI job ops and quota monitoring.
- `support`: read-limited support and moderation tickets.
Roles stored server-side trusted DB, not user metadata; admin operations require audit reason and server authorization. Ordinary user cannot open admin APIs with URL guessing.

## Navigation/functional modules
| Module | Screens / actions |
|---|---|
| Overview | today/7d/30d KPI for members, claimed channels, discovered channels, jobs, applications, chats started, billed tests, active sponsors, sync success, worker health; actual source only |
| Users | list, filter, role, suspend/reinstate, reset invitation, delete/review requests, audit |
| Brand accounts | brand records, verification status, job volume, abuse reports |
| Channels | approved/unclaimed/claimed, channelId search, duplicate merge preview, source freshness, deletion, owner claims |
| Creator profiles | owner email consent status (without exposing private value unnecessarily), category/tags/portfolio, correct/delete requests |
| Discovery rules | keywords, categories, region/locale, max per run, queue limit, pause/discovery/run now, quota state |
| YouTube sync | daily schedule, sync results by channel, stale >30d, videos added/deleted, detailed errors, retry/reconcile |
| Local AI | model availability, queue/lease, version, JSON schema failures, pending tags, approved/rejected proposals, GPU metrics if available |
| AI recommendations | paid search sessions, filter normalization, result count, errors, refunds/credits only when entitled, explainability quality |
| Job board | drafts/published/closed/abusive, applications, escalations, dates, no mass edit without confirmation |
| Messaging | report queue, scoped message evidence under audit, spam rate limit settings, ban/unban, contact consent |
| Billing | product price versions, Toss TEST orders status, payment confirm errors, grant/ledger, credit adjustment and TEST refunds |
| Sponsor | 30-day passes, scheduled active slots, audit of promotion display and labels, expiry processor |
| Announcements | help center, notices, abuse guidance, privacy policy links |
| Settings | feature flags, derived-policy approval state, scheduler, YouTube API connection health, worker health, test-mode status |
| Audit | immutable actions, actor, target, timestamp, reasons, redacted old/new values; filter/export privileges |

## Admin UX
Persistent sidebar, high-density table with filters/sort/pagination, detail drawer, clear destructive confirmation, conditional export redaction, command palette optional, skeleton/loading/error states, mobile usable. Admin counts from DB, no hard-coded dashboard metrics.

## High-risk admin actions
- Promoting a discovered channel to verified creator **requires owner proof**; manager cannot simply mark `owner_verified` true based on public channel data.
- Grant paid credits requires reason, actor identity, ticket and irreversible audit event.
- Moderator access to private messages only in context of report and scoped minimum data.
- Setting `youtube_derived_metrics_enabled` on requires documented proof of required YouTube amendment acceptance/approval and confirmation; default false.
- Feature disabling/suspension respects active threads and outstanding entitlements according to cancellation/refund rules.

## Test matrix
Unauthenticated admin 403; creator disguised as admin 403; financial operator cannot grant roles; support cannot view unreported chats; every state mutation logged; quota caps and worker pause honored; manual sync idempotent; admin edit of prices affects new orders only.
