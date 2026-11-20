# D051 — 2026-11-20 partial message policy repair
- Found while testing D076 against main65063c8: unqualified kind inside the proposals subquery bound to proposals.kind, so a brand's ordinary message was rejected.
- Additive 202611200010_message_policy.sql explicitly qualifies messages.kind. Pending participants may send ordinary messages; only the creator may submit deliverables after acceptance/revision request; rejected participants remain blocked.
- Tests: supabase/tests/message_policy.sql PASS in isolated PostgreSQL, rollback; direct REST cases also PASS in tests/local-rate-security.mjs. No real correspondence or external messages sent.
- D051 remains IN_PROGRESS: pagination, upload references, spam/report UX and collaboration D049 integration are still outstanding. This repair is not completion of the entire ticket.

## 2026-11-20 첨부 문서 대조
기존 D076/회귀 증거의 원자 메시지·신고 한도 검증도 구현 범위다. 원장의 ‘RLS만’ 설명을 바로잡았다. idempotency/cursor/첨부/신고 UX/D049 통합은 미완료, 상태 승격 없음.
