# D006 — 핵심 활성화·제품 이벤트 정의 (2026-11-26, DEV-B)

이번 변경 없음. 수용 기준을 현재 main(`252dfdd`)의 빈 DB 전체 검증으로 확인했다(`harness/evidence/D085/20261126b/ci-db-final.txt`).

## 결과
- `tests/e2e/analytics.spec.ts`: desktop·mobile PASS.
- `node tests/analytics.mjs` PASS (같은 실행의 DB 스위트 27/27).
- 확인 범위: 클라이언트 쓰기와 위조 거부, explore·shortlist 중복 제거(하루 1회), 원시 ID·이메일 미저장(가명 subject), 관리자 전용 퍼널, 수신 거부와 삭제 시 이벤트 삭제. E2E: 수신 거부 토글 유지.

## 남은 것
- 운영 데이터 퍼널 확인은 운영 적용(U004) 후.
