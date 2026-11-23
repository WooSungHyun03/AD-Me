# D051 — 2026-11-20 partial message policy repair
- Found while testing D076 against main65063c8: unqualified kind inside the proposals subquery bound to proposals.kind, so a brand's ordinary message was rejected.
- Additive 202611200010_message_policy.sql explicitly qualifies messages.kind. Pending participants may send ordinary messages; only the creator may submit deliverables after acceptance/revision request; rejected participants remain blocked.
- Tests: supabase/tests/message_policy.sql PASS in isolated PostgreSQL, rollback; direct REST cases also PASS in tests/local-rate-security.mjs. No real correspondence or external messages sent.
- D051 remains IN_PROGRESS: pagination, upload references, spam/report UX and collaboration D049 integration are still outstanding. This repair is not completion of the entire ticket.

## 2026-11-20 첨부 문서 대조
기존 D076/회귀 증거의 원자 메시지·신고 한도 검증도 구현 범위다. 원장의 ‘RLS만’ 설명을 바로잡았다. idempotency/cursor/첨부/신고 UX/D049 통합은 미완료, 상태 승격 없음.

## 2026-11-20F — 메시지 기능 보강
- additive018: sender/room/key idempotency·동시 retry1건/1회 quota, 시간+ID cursor20/최대50, 방별 lazy UI, 차단·비공개 중복 방지 신고·DB 한도·직접 INSERT guard. 기존 payload/IDs/협업 상태·원본 데이터 유지. 새 폼은 응답 유실 시 key를 유지한다.
- verification-20261120.json, conversation-security-20261120.json8그룹, 기존 rate8, 실제 Chrome 두 viewport golden+새 대화4 PASS. 생성 USER SQL23→24/원본 hash·legacy INSERT·read 상태 보존 및 중복 거부 PASS. unit197/25·API7·lint/typecheck/build PASS.
- 전체 D051은 여전히 IN_PROGRESS: D027 안전 Storage 파일 첨부·signed URL 재인가, D049 교차 리뷰·실제 URL 검증이 남는다. 이전 문단은 착수 전 이력이며 이번에 idempotency/cursor/신고·차단 UX를 구현했다. 인계 docs/handoff/DEV-A_MESSAGES_20261120.md.
