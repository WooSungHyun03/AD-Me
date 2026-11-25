# D068 — TEST 취소 실패 응답 회귀 (2026-11-25, DEV-B)

Base: origin/main `3f35322`. 격리 로컬만. 티켓은 D067·U015 선행으로 BLOCKED 유지.

- 수정 (D085 커밋 `f2bcd3d`):
  - 대시보드 TEST 주문 라벨·취소 버튼을 복원했다.
  - `/api/billing/cancel`이 `fail()`을 `try` 밖에서 호출하도록 바꿔, Edge Function 미연결·시크릿 미설정 사유가 일반 메시지로 바뀌지 않게 했다.
- `billing-cancel.spec.ts` desktop+mobile 2/2 PASS (`e2e.txt`): 비로그인 401, 잘못된 입력 400, Edge Function 미연결 사유 표시, 주문은 `paid` 유지, 취소 행 0.
- 실제 Toss TEST 취소·권한 회수 확인은 TEST 키 등록(U015/U006) 전까지 BLOCKED.
