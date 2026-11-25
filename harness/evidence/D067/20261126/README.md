# D067 — 주문 승인·복구·중복·금액 방어 (2026-11-26, DEV-B)

코드 변경은 없다. 격리 검증과 외부 게이트를 나눠 기록한다.

## 격리 검증 통과
- `npx vitest run tests/billing-confirmation.test.ts tests/billing-catalog.test.ts tests/admin-entitlements-mode.test.ts`: 16/16. 서버 가격표, 승인 확인 응답 계약, 비밀값 누락 503 고정 문구(D067 2026-11-25)를 검증한다.
- `node tests/test-cancel.mjs`, `node tests/usage-ledger.mjs` PASS(빈 DB 전체 검증, DB 스위트 27/27). 검증 항목:
  - 클라이언트가 결제 상태 머신을 구동할 수 없다
  - 같은 키는 1회만 처리된다
  - 회수하면 주문이 취소된다
  - TEST 주문은 소유자만 본다
- `tests/e2e/billing-cancel.spec.ts`·`billing-fail.spec.ts` desktop·mobile PASS(`harness/evidence/D085/20261126b/ci-db-final.txt`). 실패 URL 코드 해석에서 공급자 임의 메시지는 무시한다.

## 남은 게이트
- 실제 Toss TEST 키(U015)·격리(U006)로 승인 후 재요청, 금액 변조, 승인 중단 복구, 위조 콜백을 검증해야 한다. 이것이 수용 기준의 "실제 TEST 승인" 항목이다. 키가 없어 실행할 수 없으므로 완료 표시하지 않는다(AGENTS: 키 없이 외부 결제를 통과로 주장하지 않음).
