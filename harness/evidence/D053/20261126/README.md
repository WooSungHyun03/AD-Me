# D053 — 이메일 알림 outbox·수신 설정 (2026-11-26, DEV-B)

격리 검증 기준: main 빈 DB 전체 검증(`harness/evidence/D085/20261126b/ci-db-final.txt`). 코드 변경 없음.

## 격리 검증 통과
- `node tests/email-outbox.mjs` PASS(같은 실행 DB 스위트 27/27): 클라이언트 역할 차단, 이벤트·수신자·채널 유일, 템플릿 v1 트리거, skip-locked 청구, 백오프 5회 후 dead, 리스 회수, 발송 시 동의 재확인, 수신거부 토큰(위조·타인 거부, 동의 기록, 큐 취소)
- `tests/e2e/unsubscribe.spec.ts` desktop·mobile PASS: 링크 열기(GET·프리패치)는 변경 없음, 버튼·RFC 8058 원클릭 POST로 해당 목적만 해지, 잘못된 토큰 거부, 관리자는 발신자 미설정 확인
- `tests/e2e/consent.spec.ts` PASS: 서비스·마케팅 분리, 마케팅 기본 미체크

## 남은 게이트
- 실제 메일 공급자 설정과 배달 확인(U007)이 남아 있어 완료 표시하지 않는다.
