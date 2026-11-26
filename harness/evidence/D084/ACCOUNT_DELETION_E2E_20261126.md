# D084 — 계정 삭제 요청 흐름을 CI E2E로 승격 (2026-11-26, DEV-A)

## 공백
- D084 수용 기준("가입·삭제·수집·정정·권한·모바일·결측·동시성")에서 **삭제**는 복제 DB 전용 `tests/local-browser/account-deletion.spec.ts`에만 있었다.
- CI(`tests/e2e`, `tests/ci-db.sh`)는 이 흐름을 실행하지 않았다.
- 설정 화면의 삭제 접수는 `adme_privacy.intake.enabled=false`(운영 검토 게이트)가 기본이다. 그래서 CI DB에서는 "온라인 삭제 요청은 운영 검토 중입니다"만 보인다. 첫 이식 시 4건이 모두 실패해 이를 재현했다.

## 변경 (테스트만)
- `tests/local-browser/account-deletion.spec.ts`를 `tests/e2e/account-deletion.spec.ts`로 옮겼다(git mv). 로컬 설정은 `e2e/**`도 포함하므로 복제 DB에서도 계속 실행된다.
- spec의 `beforeAll`에서 intake를 켜고, `afterAll`에서 원래 값(enabled·review_ref)으로 되돌린다. 일회용 로컬 DB에서만 동작한다. 운영 게이트 값과 마이그레이션은 바꾸지 않았다.
- `tests/support/local-qa.mjs`의 `localRuntime()`:
  - `ADME_LOCAL_QA≠1`이고 `output/dev-a-db/runtime.local.json`이 없을 때만 CI `.env.local`과 `supabase_db_<project_id>`를 쓴다.
  - 루프백 검사는 그대로 적용된다.
  - 복제 DB 경로는 이전과 같다.

## 검증 범위 (brand·creator × desktop·mobile)
- 틀린 현재 비밀번호 → 거부, 요청 0건.
- creator는 TOTP 재인증을 거친다.
- 첫 응답 유실(202 후 connection reset) → 화면 접수 표시, 요청 1건, 같은 payload 재전송 200(멱등).
- "격리 처리 계속" → "영구 파기는 완료되지 않았습니다". Auth 사용자는 유지된다.
- 삭제 요청 뒤 `/api/account` PATCH는 401 또는 403이다.
- 위조 접수번호 상태 조회는 404다.
- 가로 넘침이 없다.
- 끝나면 fixture 계정·요청·격리 파일·한도 기록을 정리한다.

## 결과
- ci-e2e(CI 경로, project_id ci-e2e): spec 단독 4 passed. 새 DB 전체 실행 **2 failed / 4 skipped / 116 passed**. 실패는 기존 retention ×2(DEV-B, U001 대기). 끝난 뒤 intake=false 복원을 확인했다.
- d002-replica(로컬 설정): 4 passed. intake 원래 값이 유지됐다.
- `ADME_LOCAL_QA=1 node tests/local-schedule-history.mjs` PASS(헬퍼 회귀 없음). typecheck·eslint·prettier 통과.
- 참고: 플래그(`ADME_E2E_ISOLATED_YOUTUBE` 등) 없이 실행하면 YouTube 계열 spec이 실패한다. 같은 DB를 재사용하면 intelligence 초안이 쿼터 429로 실패한다. 둘 다 실행 조건 문제이고, 새 DB와 CI 플래그로는 통과한다.
- 스크린샷: `account_deletion_e2e_20261126/deletion-{brand,creator}-{desktop,mobile}.png` (가상 계정).
