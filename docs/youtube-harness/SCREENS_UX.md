# AD Me — Screen/UX implementation contract

## Brand Identity
Original files: `public/brand/ad-me-logo.png`, `ad-me-logo-trimmed.png`, `ad-me-symbol.png`, `ad-me-wordmark.png`. **Use these exact assets** and never reinterpret logo with emoji/robot arm. Palettes: charcoal `#111312`, warm white `#F6F6F0`, text `#171A17`, lime `#D7FF45`, muted `#737971`, red semantic error. On dark headers choose contrast-safe logo rendition/background, avoid disappearing black text.
Typography: readable Korean sans (font locally available/system allowed), 8px spacing grid, generous white space, 14–16px bodies, keyboard focus, WCAG AA color contrast on actionable text. Polished functional SaaS, not glassmorphism-heavy marketing-only page.

## Site map + functional acceptance
| URL | Role | Must have | CTA/state |
|---|---|---|---|
| `/` | everyone | product intro, how it works, exact 4 revenue paths, verified demo disclaimer | search / browse jobs / claim channel |
| `/pricing` | everyone | itemized TEST prices, credits/30-day pass, refund/expiration rules | pick product |
| `/auth/*` | everyone | brand/creator registration, verified email, reset/redirect | role-safe login |
| `/explore` | brand | advanced filters, subscription raw, average if approved, AI natural language box, sponsor band | buy/use search credit |
| `/search/sessions/[id]` | brand | persisted recommendations, query params, source badges, full rationale | shortlist/compare/message |
| `/creators/[channelId]` | everyone/member | real creator header, YouTube badges, recent videos, tags, statistics date, claimed status, consented contact, work portfolio | proposal/chat/claim |
| `/creators/me` | claimed creator | contact privacy, portfolio, rate card, availability, tag corrections, sponsored status | save/verify/upgrade |
| `/creator/claim` | creator | channel OAuth verification, conflicts, pending review, privacy | claim |
| `/campaigns/new` | brand | product & campaign details, private draft, media, audience/format, budget | save draft |
| `/campaigns/[id]` | owner | overview, paid matching history, shortlist, conversations, results | run search/compare |
| `/jobs` | everyone | publicly available YouTube job feed, sponsored notice where applicable, category/pay range/deadline | view |
| `/jobs/new` | brand | draft preview, coupon/credit, publish gate (no double charge) | TEST pay/publish |
| `/jobs/[id]` | everyone/creator | brand identity, deliverables, budget, deadlines, qualifications, creator application status | TEST pay/apply |
| `/jobs/[id]/applicants` | owner | applicant queue, profiles, details, notes, accept/reject | begin chat |
| `/applications` | creator | submitted applications, stage, edit allowed fields, conversation | respond |
| `/messages` | two roles | conversations, unread, realtime, blocks, reports, attachments optional | send message |
| `/billing` | logged-in | product catalog, credits, order/TEST history, entitlement expiration | checkout |
| `/creator/sponsor` | creator | HOT pass TEST checkout, expiry and clearly labelled placement policy | purchase |
| `/dashboard/brand` | brand | campaign count, paid searches, applications, contact, spend (TEST) | work next |
| `/dashboard/creator` | creator | claims, job applications, messages, sponsored state, search impressions (if tracked) | work next |
| `/settings` | member | profile, privacy, deletion/appeal, notifications | save |
| `/admin` | admin | overview and alerts | inspect |
| `/admin/users` | admin | account RBAC, suspension, access logs | moderate |
| `/admin/creators` | admin | claimed/unclaimed and real channel registry | verify/merge |
| `/admin/youtube` | admin | discovery rules, sync statuses, quota usage, failed jobs | retry/approve |
| `/admin/ai` | admin | AI model health, queue, tag proposals, model versions | approve/re-run |
| `/admin/jobs` | admin | job postings and applications, spam, expiry | moderate |
| `/admin/messages` | restricted admin | reports + scoped evidence, not blanket access to private chats | resolve |
| `/admin/billing` | finance admin | prices, order/entitlement ledger, refunds, sponsorships | verify |
| `/admin/settings` | super admin | flags, plans, policies, scheduler config, audit | save |
| `/privacy`, `/terms` | everyone | consent, data source, deletion, limitations | support |

## Page completion rubric
- No dead buttons; URL navigation works after refresh.
- Mobile 390px and desktop 1440px screenshots reviewed. No overflow, clipped modal, or hidden CTA.
- Keyboard navigation, focus states, loading, error, empty, success, pagination, dates in Asia/Seoul.
- Sample/mock data visibly marked, source/time labels on public channel data, **스폰서** label always shown for paid placement.
- Real YouTube channel thumbnails/profile images used only through allowed links/embedding and correct attribution; no deepfake fictional endorsement.
