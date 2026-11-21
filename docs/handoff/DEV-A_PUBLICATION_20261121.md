# DEV-A P0 공개 저장 인계

기존 `codex/dev-a-p0-continue`, 시작0a2be26. D073의 남아 있던 profile/brand 공개 저장을 동의 원장·멱등 receipt와 원자적으로 연결했고 D084 실제 회귀를 확장했다. [티켓별 커밋/소스](../../harness/evidence/DEV-A-P0-PUBLICATION-20261121/commits.json) · [검증](../../harness/evidence/DEV-A-P0-PUBLICATION-20261121/verification.json) · [실패와 수정/범위](../../harness/evidence/DEV-A-P0-PUBLICATION-20261121/README.md).

새 저장/철회 재시도는 이전 성공 상태를 다시 적용하지 않는다. 현재 상태와 다른 오래된 전역 철회 응답은 UI를 다시 불러온다. strict 상태는 direct REST·legacy brand/logo RPC의 공개 우회를 거부하며 유효한 비공개·삭제는 승인 만료 후에도 가능하다. signup/global/creator/brand 동의를 구분하고 기존 사용자 동의를 소급 생성하지 않는다. 다른 새 key의 요청은 서버 처리 순서이며 클릭 시각 충돌 해결은 별도다.

기존54 SQL·패킷을 보존하고055~057 추가. 단일 [USER54→57 패킷](../../deliverables/dev-a-publication-20261121/README.md)을 준비했다. 선행46→54 패킷 다음 순서이며 stage는 완료가 아니다. 실제 설정·키·배포·외부 연락은 수행하지 않았다. USER에게 소스 수정/터미널/설치를 요구하지 않는다.

이전과 같은 runtime 집계 기준 **남은 P0는5개(진행2·외부대기3)**다. 이번에 D073의 코드 통합 부족분을 해결했지만 U001 최종 정책 승인 전 BLOCKED_EXTERNAL을 유지한다. D014는 실제 실행 어댑터/API·D079 보존/복구가 남고 D084는 전체 실제 삭제/공급자/대상URL·릴리스 통합이 남는다. D007 권리/최종 고지와 D009 외부 SMTP gate는 재시도하거나 완료로 바꾸지 않았다. LOCAL_VERIFIED24/외부3/진행2/OPEN14/DONE0으로 수량은 동일하다.

원격 push/CI의 exact SHA와 QA 두 stack 중지(볼륨 보존)는 ignored output receipt에 기록한다. hosted deployment 성공은 미검증이다.
