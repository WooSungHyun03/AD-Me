# D037 independent implementation

Reserve additive068 only; existing67 SQL remain immutable. Store private condition schema v1 with explicit owner scope,20-account cap serialized with transaction lock, revision CAS, validated conditions and hard-disabled notification capability. New private schema has RLS and no app/service direct grants; authenticated bounded RPCs check active account on every call. UI save/open/update/delete uses these RPCs through validated APIs.

Plan: unit malformed/ownership/notification injection, actual local direct RPC/REST cross-owner/grant/quota/CAS/delete checks, desktop/mobile save/reopen/update/delete and final shared checks. No D052 event delivery/cursor candidate processing or email is implemented. IN_PROGRESS until D052 and actual/user integration are verified. Final results in batch evidence; no cloud apply.

Actual local results:068 applied atomically to the marked67 baseline; tests/local-saved-search-security.mjs PASS7groups (actual Auth/PostgREST, anonymous denial, private schema/table/function denial, malformed conditions, cross-owner read/write/delete, competing CAS, stale delete, cap20). All inserted fictional records cleaned. First068 attempt had CASE/IF syntax ambiguity and rolled back completely; parenthesized CASE before first successful application. Applied068 is now immutable. Unit2 PASS. Shared/browser/USER packet follow at batch end.

Shared-check follow-up: React effect lint now separates pure asynchronous reads from setState callbacks; abort prevents an unmounted result update. Final lint/typecheck PASS. No applied SQL changed.
