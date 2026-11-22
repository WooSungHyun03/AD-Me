# Independent DEV-A implementation — 2026-11-22

Started3a3f09f on existing codex/dev-a-p0-continue. Original ticket ownership, USER-only external configuration/deployment and default gates remain unchanged. Ten previously OPEN tickets now have independent implementation and focused tests. All ten are IN_PROGRESS; no full acceptance or external verification is inferred from a contract test.

|Ticket|Implemented scope|Still required|
|---|---|---|
|D037|Actual private versioned conditions CRUD, owner RPC/API/UI, CAS and20-account cap|D052 candidate cursor/dedup/notification consent/delivery and final retention/review|
|D039|Limited keyless parser with visible evidence/unknown text, confirm/cancel before filter replacement|D048 optional LLM adapter/review and actual-provider verification if enabled|
|D042|Owner-only brief whitelist copy to a new draft via existing creation path|D027 immutable attachment versions, private file restore and review|
|D055|Owner-only escaped/folded UTC iCalendar export for campaign windows|D049 collaboration milestones, D052 rescheduling/cancel/dedup/reminder delivery|
|D067|Strict confirmation evidence in API/UI and same-order manual recovery|D066 reviewed order contract and U015 actual TEST SDK/provider interruption/reconciliation|
|D020|Unexpired host/path approval, public IPv4 DNS pinning, robots subset, redirect/access-wall denial and bounded transport/quota port|D017/U011 actual source/rights/robots approval, minimizing extractor, durable quota/job wiring and permitted sample|
|D022|Owner/app/key-bound encrypted credential, one-use OAuth state, refresh scope/subject and revocation CAS contracts|U012 account/scopes/API version/app approval, actual callbacks/provider/repository/RLS/revoke/sync|
|D047|Separate baseline/experiment versions, per-document permission, cost reservation and source-current save contracts|D046 evaluation baseline/criteria, U010 approval, real provider/ledger/vector deletion/evaluation|
|D050|Immutable bilateral revisions, prior-confirmed preservation, idempotency and version/scope denial|D049 state authority, durable atomic agreement_versions/RLS/API/UI and review|
|D071|Free-team membership/invite expiry/recipient/one-use/tenant CAS and last-admin safety core|D011 brand/role switching, durable membership/invite CAS, tenant RLS/API/UI|

No new facts resolve D007/D009/D014/D073/D084 launch gates. D014 permanent Auth/derived erasure, approved retention/backup replay and lost-receipt recovery are still absent; current intake remains defaultOFF in source. No actual source/cost/payment/license/policy approval is manufactured.

## Verification

- Unit291/51 PASS (34 additional cases across10 files); Python14/Harness5 and backlog/handoff checks PASS. Lint/typecheck PASS after one React effect violation and two test-port typing errors were corrected.
- Actual local Auth/PostgREST saved-search security7groups PASS: foreign owner and anonymous denied, schema/table/helper grants absent, invalid SQL conditions rejected, competing CAS/stale delete/cap20 enforced. Actual DB→TS contract7/5 and existing release security5groups PASS, including DB-only duplicate TEST finalization and one entitlement; this is not Toss approval.
- New desktop/mobile scenarios6 covered: initial full6 had4pass/2fail; copy tests first needed the actual save-button label and a visible streamed heading before axe, then needed the documented Next16 streamed-notFound UI assertion instead of expecting HTTP404 after streaming. Final affected2 PASS, including foreign-page no form/data and real calendar404/creator403. No permission assertion was skipped. New search/save/confirmation flows include axe/overflow checks and screenshots. Not claimed as one all-green6 invocation.
- Existing keyless desktop/mobile10 PASS, including URL/back-forward/reset/keyboard/invalid-bound/free-billing behavior. TEST and keyless production builds PASS through Playwright's existing webServer command. No new provider/SMTP/cloud E2E claim.
- Permission inventory60tables/260functions/3private buckets PASS; metadata snapshot is local, with behavior separately tested. Historical SQL67 and old notices/packets/lock/policy snapshot remain unchanged.
- Actual independent DB USER67→68 packet: unknown/modified history/dependency/custom hook STOP, injected failure atomic rollback, nonempty data/old ledger preservation, default-denied private probes and duplicate STOP all PASS. Initial generator referenced the wrong require_quota arity; corrected before generation. Initial single-format preflight correctly rejected CLI-split026 history; failed artifact is preserved ignored. Final packet admits only two exact known ledger hashes per version after comparing all256 baseline function definitions/ACLs across marked QA DBs; no blanket normalization/bypass and no old migration rewrite. Source/history formats outside those exact known baselines still STOP.

One final USER packet: `deliverables/dev-a-independent-20261122/README.md`. It only adds068 to the exact reviewed67 baseline and does not activate external integrations or deploy. Runtime counts remain28 LOCAL_VERIFIED/3 BLOCKED_EXTERNAL/12 IN_PROGRESS/0 OPEN/0 DONE for DEV-A;15 full tickets still await acceptance. Original88 development/20 USER/deferred6 allocation and DEV-B/USER states remain unchanged.

Exact source/commits/checks/scope are recorded in verification.json, commits.json, packet-upgrade.json and security-inventory.json. Raw Auth traces, credentials and failure logs remain ignored. Git main/A deployment hold remains in place; main merge is still pending an eligible review of the latest PR head.
