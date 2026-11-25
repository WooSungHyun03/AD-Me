# D067 — TEST 승인 실패 사유·로컬 Edge 런타임 (2026-11-25, DEV-B)

Base: origin/main `542dd57`. 격리 로컬만. D067은 D066(U015) 선행으로 IN_PROGRESS 유지.

## 재현
- 로컬·CI Supabase의 Edge 런타임에는 `ADME_SERVICE_MODE`/`ADME_FEATURE_TEST_BILLING`이 없다. 그래서 `payment-confirm`이 모든 요청에 "현재 환경에서 TEST 결제를 제공하지 않습니다."(404)를 반환해, 키 없는 TEST 경로("시크릿 키 미설정")를 E2E가 검증할 수 없었다.
- `/api/billing/confirm`(D067 재작성)은 상태 코드만 매핑해서, 503 시크릿 미설정도 "승인 서버 응답을 확인하지 못했습니다."로만 보였다.
- 재부팅 뒤 `supabase_edge_runtime_AD-Me` 컨테이너가 Exited(255) 상태였다. 재시작하니 응답했다.

## 변경
- `supabase/config.toml` `[edge_runtime.secrets]`: 로컬·CI 일회용 스택에만 TEST 모드 플래그를 둔다. 비밀값이 아니고 Toss 키도 없다. 운영 함수는 자체 프로젝트 secrets를 쓴다.
- `/api/billing/confirm`: 상태 매핑은 그대로 두고, 503 시크릿 미설정은 고정 문구("…시크릿 키가 연결되지 않아… 이용권은 부여되지 않았습니다.")로 응답한다. 400 문구에는 이용권 미부여를 명시한다. 공급자 원문은 전달하지 않는다.
- `service.spec.ts`: 역할·상품 불일치는 D004 오류 계약대로 403.

## 결과
- `billing-cancel.spec.ts` desktop·mobile 2/2 PASS.
- `service.spec.ts` "two-role" 결제 검증 구간(409·503 시크릿·403 역할)까지 통과한다. 이후 결과물 제출 단계는 D054 결과물 화면으로 옮겨진 흐름에 맞춰 갱신해야 한다.
- typecheck·lint, `billing-confirmation.test.ts` PASS.
