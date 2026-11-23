# DEV-A D054 결과물 버전 인계 — 2026-11-20

로컬 구현·검증 완료(LOCAL_VERIFIED), 외부 적용·실제 URL 검증·D049 교차 리뷰 전이며 DONE은 아니다. source commit은 [전달 manifest](../../deliverables/dev-a-deliverables-20261120/MANIFEST.json)의 source_head, 증거는 [D054 검증](../../harness/evidence/D054/verification.json)을 따른다. 이전30개 migration/6개 ZIP은 보존했다.

## 변경과 계약

- 신규025 `adme_delivery`: boundary/rooms/submissions/attestations/events, private RLS/no-client-table-grant. public gateway는 invoker/volatile, protected private 함수는 실제 participant/역할·상태·차단·moderation·quota를 재검사한다. 버전/actor/time/광고 확인과 검토 근거는 DB에서 확정한다. client GUC로 status를 승인할 수 없다.
- `src/lib/deliverables.ts`, `/api/deliverables` GET/POST/PATCH, `/collaborations/[id]/deliverables`, `delivery-workflow.tsx`, dashboard 결과물 링크를 추가했다. 일반 메시지는 기존 대화 UI에 남는다. API 오류는 기존 v1 code/requestId/error.message 계약이다.
- D049 steward: 상태 이름·기본 pending 수락/거절·제안 POST는 유지한다. 결과물 PATCH는 `id/action/submissionId/expectedVersion/clientKey/reviewNote/advertisingChecked`를 원자 검증한다. expectedVersion은 제출본 번호가 아니라 room revision이다. 응답의 기존 `data:status`를 유지하고 roomRevision을 추가한다. 일부 version 필드만 전송하면422, stale409. 구형 결과물 PATCH는 strict/managed에서409이며, stage의 unmanaged 방만 기존 흐름을 허용한다.
- GET은 version1 DTO, active snapshot과 최근20개 items/nextVersion이다. 과거 페이지에서도 현재 검토 대상은 별도다. 공개 DTO에 Auth UID/내부 retry key를 넣지 않는다. actual actor와 시각은 private immutable table에서 보존한다.
- D056 후속: 결과물 event는 제출/수정 요청/완료, submission_id/expected_revision/actor_id/from/to/note/표시 확인/time이다. 직접 private grant를 열지 말고 승인된 집계 DTO를 추가한다. D029 공개 광고 이력/성과 통계로 자동 등록하지 않는다.

## 보존·불변 범위

기존 proposal/message/profile ID·본문·URL·상태를 바꾸지 않는다. 기존 실제 message를 created_at/id 순으로 backfill하며 과거 검토자/표시 체크를 발명하지 않는다. 과거 완료는 `legacyCompleted`로 안내한다. 진행 중 구형 제출은 현재 제출자의 명시적 표시 확인 후 새 검토로 채택할 수 있다. 확정된 snapshot·attestation·review는 UPDATE/DELETE를 거부하고 완료 방에 새 제출도 금지한다. 보존되는 것은 제출 당시 URL 문자열/설명이다. 외부 URL 내용은 변경될 수 있으며 파일 저장/hash 보장은 D027 별도다.

## USER 적용 순서

실제 콘솔/계정/키/배포는 USER가 수행한다. 터미널·코드 편집·패키지 설치 작업은 요구하지 않는다. 새 환경 변수/키는 없다. [적용 패킷](../../deliverables/dev-a-deliverables-20261120/README.md)을 사용한다.

1. 기존30개 이력과 복구 지점을 확인한 뒤 SQL Editor에서00을 실행한다. unknown/custom/hardened/부분 적용이면 STOP이며 개발자가 실제 schema를 읽고 추가 패킷을 만든다.
2.01을 실행하고02 결과를 확인한다. 이 단계는 구형 앱 호환을 위한 stage이며 전역 `enabled=false`다. 새 UI에서 채택한 managed 방은 이미 version 보호를 받는다. stage 자체는 D054 보안 완료가 아니다.
3. USER가 manifest source_head를 포함하는 source를 배포하고 실제 URL에서 creator 저장/표시 확인/제출 → brand 수정 → 새 버전 → 오래된 탭 승인409 → 최신 승인, 타인403/404를 검증한다. D049 steward도 확장 계약을 리뷰한다.
4. 조건 충족 후03으로 전역 version 경계를 활성화하고02에서 enabled=true/첫 source ref·시각/RLS5/테이블 clientSELECT false를 확인한다. 이 배치는 agent가 외부 실행하지 않았다.

CLI raw025는 기본 strict이므로 구형 앱을 계속 사용해야 하는 운영 DB에는 stage 패킷과 혼용하지 않는다. 기존 정책OFF·read boundary·일반 메시지·TEST 결제 설정은 그대로다. 활성화 후 구형 앱으로만 되돌리면 결과물 status 변경은 거부된다. 안전한 수정은 새 source 또는 additive migration으로 진행하며 boundary 재개방/이력 삭제로 복구하지 않는다. 검토된 백업 복구는 USER의 별도 hosted 작업이다.

## 검증·남은 게이트

실제 local PostgreSQL/PostgREST10+기존16그룹, 기존30→31 생성 SQL·legacy/stage/managed/activation, 실제 local Auth Chrome6건, unit218/28·lint/typecheck/build PASS. 신규2건은 최종 locator/fixture 정리 수정 후 재통과했다. 전체 과거 E2E나 실제 provider를 이번에 모두 재수행한 것은 아니다. 실제 광고/법률/플랫폼/공급자 승인·Toss 확인·전체 출시 준비는 주장하지 않는다. D054 외부 적용/실제 URL/교차 리뷰와 전체 D084 잔여는 원장에 유지한다.
