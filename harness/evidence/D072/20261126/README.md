# D072 — 수수료 가정 계산·결제 이력 (2026-11-26, DEV-B, P2)

## 결과
- `tests/e2e/fees.spec.ts`: 빈 DB 2차 검증(`harness/evidence/D085/20261126b/ci-db-final.txt`)에서 desktop·mobile PASS.
  - 시뮬레이터에 "가정 계산 · 실제 수납·정산 없음" 표시
  - 입력 경계(0~30%, 정수)
  - 서버 호출 0건
- `node tests/test-cancel.mjs` PASS. TEST 주문 이력은 소유자만 본다는 단언을 추가했다: 다른 계정·익명 조회 0건, 소유자 1건(`orders_read` RLS).
- 실제 수납·정산 기능은 연결하지 않았고, TEST 결제만 쓴다(AGENTS 결제 규칙).

## 남은 것
- 없음(P2). 운영 적용은 U004.
