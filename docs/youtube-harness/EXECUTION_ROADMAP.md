# Two-person, two-week roadmap / capacity-aware cut line

## Phase plan
| Day | Work focus | Demonstrable slice |
|---|---|---|
| 1 | existing repo audit, baseline tests, design/nav, policy gating, issue inventory | runnable baseline and task board |
| 2 | Supabase schema migrations/RLS & roles | brand/creator/admin login isolated |
| 3 | claim process, owner-managed contact/portfolio | real channel claim UI, privacy controls |
| 4 | official YouTube import, channel registry and browser listing | one real official API channel, if credentials |
| 5 | daily scheduled queue/worker, metadata upserts & diagnostics | daily sync log/refresh/duplicate safe |
| 6 | search filters, results pages, metrics policy gate | accurate filters; blocked derived features clear |
| 7 | local AI runtime, job queue, approved tag flow | local model inference + admin approval |
| 8 | pricing, products, Toss TEST order/confirm ledger | test purchase and correct entitlement |
| 9 | brand campaign and AI search credit usage | full paid brand search |
| 10 | paid job post and creator paid application | real two-sided marketplace |
| 11 | realtime chat + invitations/statuses | two accounts can communicate |
| 12 | sponsor band, 30-day purchase, expiry job | HOT clearly labeled, organic rank unchanged |
| 13 | admin console and security/E2E fixes | RBAC tests, operational dashboards |
| 14 | end-to-end tests, mobile/design review, git main push, staging deploy and verify | defensible demo with status evidence |

## Priority cutline
P0 absolutely includes all four paid flows, actual creator claim, YouTube discovery+daily refresh, policy gating, local AI tag proposal and real chat/admin. Because 2 persons/14 days is tight, only implement deep P1 extras after the gold paths pass. P1: analytics histories/charts, bulk admin tooling, rich messaging, full profile review queue, recommendation quality evaluation, sophisticated observability. P2: auto-renewing billing requiring merchant contract, advertiser reporting/ROI using actual tracked attribution, YouTube authorized audience analytics, enterprise account seats.

## Division of labor
- A: UI/UX, brand & creator screens, messaging, e2e, design QA.
- B: DB/RLS, YouTube worker/local AI, payments, admin APIs, provider integration.
- Both: migrations/contract review, pipeline tests, production readiness and git main integration.

## Build discipline
Reserve at least days 13-14 for regression/UX/deployment. No new high-risk P1 features after day 10. User's request “전부 구현” is treated as all feasible P0 end-to-end plus a transparently labeled P1/P2 backlog, never false completion.
