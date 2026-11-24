# D049 운영자 검토 인계 — 2026-11-24

SQL122 `20261124133155_proposal_transition_requests.sql`과123 `20261124133707_proposal_acceptance_eligibility.sql`을 함께 검토한다. 운영 적용 승인이 아니다. 새 키/환경변수·유료 자원 없음.

- 선행: 검토된121 전체 스키마/대상 지문/백업·복구·D085 릴리스 승인. 옛 운영 원장에122/123만 단독 적용하지 않는다.
- 순서: 대상·백업 확인→122/123 transaction 적용→기존/신규 RPC의 반대 권한·연락 제한/차단·미청구 수락 거부→양 역할 취소/수락·동시 경합·동일 키 ACK 확인→일치하는 migration fingerprint의 앱→실제 desktop/mobile 및 버전 결과물 수용.
- 새 receipt 테이블은 private RLS이며 클라이언트 직접 접근 불가. requestKey/expectedStatus는 초기 응답 전이용이고 기존 결과물 clientKey/expectedVersion과 혼합하지 않는다. 기존 ACK는 당시 처리 확인이며 현재 상태로 되돌리는 명령이 아니다.
-123은 pending→accepted만 검사한다. 과거 accepted/협업·이력 기록을 덮어쓰거나 일괄 종료하지 않는다. 수락 시 양측 적격성/공개·청구·moderation을 확인하며 취소·거절은 유지한다.
- 실패 시 새 전이를 중단하고 호환 앱으로 복귀한다. DB 수락 경계는 유지하고 적용 SQL 편집/receipt·협업 기록 삭제 대신 forward fix한다.
- `harness/evidence/D049/DECISION_RETRY_20261124.md`, verification·desktop/mobile 캡처가 로컬 시험 근거다. 실제 승인 QA/채널/운영 DB 검증을 완료했다는 의미가 아니다.
