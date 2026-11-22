# End-to-end QA, evidence and release gates

## Golden scenarios (actual browser run)
1. **Brand search fee:** brand signs up, creates campaign, sets subscriber and consented/policy-allowed average views or fallback tags, sees price, pays Toss TEST or spends credit, gets recorded ranked results, reopens page for free, changes filters and sees new price before charge.
2. **Brand paid posting:** brand saves draft without charge, pays TEST, publishes and sees job in public feed. Second submission/network retry doesn't charge or duplicate post.
3. **Creator paid applying:** owner-verified YouTube creator opens job, pays TEST/uses application credit, submits once, sees status; brand sees applicant and can shortlist/accept/reject. Double submit costs only once.
4. **Creator HOT:** owner buys TEST 30-day sponsor, sees `스폰서` card in separate paid band on matching search page, organic result scores unchanged; expiry removes placement.
5. **Chat:** accepted relationship opens room; messages from both accounts update in real time, unread/read, blocked, reload persistence; unauthorized third account gets 403/empty.
6. **Daily YouTube:** official API with configured key discovers one channel, records channelId, fetches uploads and updates metadata, duplicate sync is harmless; scheduled daily job exists and rerun safe; stale/deletion test. Distinguish LIVE API and MOCK.
7. **Local LLM:** local model returns structured tags with evidence on eligible owner-authorized source, admin approves, channel appears in appropriate search; denied policy flags never leak results.
8. **Admin:** only approved admin sees user/channel/job/payment/AI/sync dashboards, reviews claim and tags, records audit. Standard creator cannot perform admin action.
9. **Role/security:** simulate brand A, brand B, creator X, outsider. Cross-tenant RLS and API checks, contact privacy default, payment amounts server controlled, no credential leakage.
10. **Responsive/design:** screenshots at 390x844 / 1440x900, verified nav, contrast, form errors, success/error/offline/empty states, actual original logo.

## Testing pyramid
- Unit: price selection, search filter parser and stability, 30/90-day average metric **only in permitted/test fixtures**, entitlement idempotency, state transitions, consent visibility, sponsored allocation, time math.
- Integration: database migrations, RLS negative tests, application/write transaction double-click, payment gateway mocked separate from TEST-live, persisted chat membership, channel dedupe.
- E2E: Playwright cross-role in local with seeded fictional data, real provider sandbox tests separated by env. Do not seed real contact data.
- Smoke: deployed URL, test keys required, no fake 200 success, test artifact link/screenshots, acceptance log.

## Evidence standard
Each task status requires specific code changes and evidence: command+exit code, relevant test case, log snippet/path, screenshot, DB query count, remote git SHA, official-provider test identifiers (redacted). A “done” text-only claim is not validation. `harness/loop.py` checks only format/dependencies, not true behavior; human/agent must verify.

## Gate failures not to overlook
- Unapproved derived YouTube metrics displayed or used for ranks/search -> FAIL.
- Public unclaimed creator shows personal contact/membership claim -> FAIL.
- Sponsor without `스폰서` label or hidden organic score boost -> FAIL.
- Paid placements on an API-data page without meaningful independent AD Me marketplace/creator-profile value -> review YouTube promotional-screen terms before rollout.
- Payment success redirect granting access before server confirm -> FAIL.
- Creator applying to job without credit or with repeated debit -> FAIL.
- Super admin signup from public user role input -> FAIL.
- 'Git push completed' without matching remote main SHA -> FAIL.
- 'Deployed' without actual URL browser evidence -> FAIL.
- 30-day scheduler exists but no worker uptake/next-run health -> PARTIAL, not PASS.
- Chat history visible to unrelated users -> FAIL.
