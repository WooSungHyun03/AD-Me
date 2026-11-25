# D069 — TEST 이용권 만료·usage·크레딧 (2026-11-26, DEV-B)

이번 변경 없음. 수용 기준을 현재 main(`252dfdd`)의 빈 DB 전체 검증으로 확인했다(`harness/evidence/D085/20261126b/ci-db-final.txt`).

## 결과
- `tests/e2e/entitlements.spec.ts`: desktop·mobile PASS.
- `node tests/usage-ledger.mjs` PASS (같은 실행의 DB 스위트 27/27).
- 확인 범위: 동시 reserve 10건 중 6건만 성공(음수 불가), 같은 키 1회 차감, finalize/release 멱등, 만료 정리, DB 시계 만료(환불·연장·부활 없음), 관리자 발급은 역할과 사유 필수, 회수 시 주문 취소. E2E: 사유 없는 발급 거부 → 회원 화면 표시 → 회수 후 제거.

## 남은 것
- 실제 Toss TEST 승인과 연계한 회수는 D067/D068(U015·U006) 대기. 실서비스 무료 권한과는 분리되어 있다.
