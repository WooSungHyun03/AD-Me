# D051 — 2026-11-20 partial message policy repair
- Found while testing D076 against main65063c8: unqualified kind inside the proposals subquery bound to proposals.kind, so a brand's ordinary message was rejected.
- Additive 202611200010_message_policy.sql explicitly qualifies messages.kind. Pending participants may send ordinary messages; only the creator may submit deliverables after acceptance/revision request; rejected participants remain blocked.
- Tests: supabase/tests/message_policy.sql PASS in isolated PostgreSQL, rollback; direct REST cases also PASS in tests/local-rate-security.mjs. No real correspondence or external messages sent.
- D051 remains IN_PROGRESS: pagination, upload references, spam/report UX and collaboration D049 integration are still outstanding. This repair is not completion of the entire ticket.
