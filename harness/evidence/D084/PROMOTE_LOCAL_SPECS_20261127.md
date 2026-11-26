# D084 — 계정 비의존 로컬 브라우저 spec 4종을 CI E2E로 승격 (2026-11-27, DEV-A)

## 공백
- D084 수용 기준 중 결측·재인증·응답 유실 재시도 검사가 복제 DB 전용 `tests/local-browser`에만 있었다.
- CI는 `tests/e2e`만 실행한다.

## 시험 (ci-e2e, CI 경로, 새 DB)
계정 파일에 의존하지 않는 8종을 수정 없이 실행했다.

| spec | 결과 | 다루는 범위 / 막힌 이유 |
|---|---|---|
| catalog-filters | PASS 6 | OR 그룹·URL 복원, 0 경계·잘못된 범위·빈 결과(결측), 키보드·320–1440 넘침 |
| privacy-session | PASS 2 | 두 역할 현재 세션 재인증 뒤 내 데이터 1회 다운로드 |
| publication-save | PASS 4 | 공개 저장 응답 유실 후 재전송, 철회를 되돌리지 않음 |
| search-proposal-scope | PASS 2 | 자연어 필터 제안 범위, 미지원 부정 표현 |
| account-email | FAIL | 복제 DB 전용 token-hash 메일 템플릿이 필요하다 ("Local token-hash email template missing"). CI `supabase/config.toml` 템플릿 설정이 먼저 필요하다. |
| email-signup | FAIL | 위와 같은 메일 템플릿 계열. 재전송 안내 문구가 나오지 않는다. |
| session-lifecycle | FAIL | 복제 DB 런타임에만 있는 키 값을 쓴다(`key` undefined, 53행). CI runtime에 해당 값이 없다. |
| decision-retry | FAIL | 응답 유실 뒤 두 번째 클릭(58행)에서 시간 초과. 원인 미확정. |

## 변경 (테스트 위치만)
- PASS 4종을 `tests/local-browser/`에서 `tests/e2e/`로 옮겼다(git mv). 내용 변경은 catalog-filters 하나뿐이다(아래).
- 로컬 설정은 `e2e/**`도 포함하므로 복제 DB 실행 범위는 같다.
- FAIL 4종은 그대로 두었다. 필요한 조건은 위 표에 적었다.

## 결과
- d002-replica(로컬 설정): 옮긴 4종 14 passed.
- ci-e2e 새 DB 전체(CI 순서·플래그) 1차: 127 passed / 5 failed. retention ×2와 catalog-filters mobile ×3(`48명` 기대, `52명` 수신)이었다.
  - 원인: 앞선 DEV-B spec이 만든 공개 `user-*` 크리에이터를 지우지 않는다. privacy-export(D074, "D074 크리에이터"), profile-fields(D026, "다중 태그 검증"), safety(D062, "D062 크리에이터")가 각각 프로젝트당 1~2건, 전체 실행 뒤 8건을 남긴다. 세 spec 모두 finally·deleteUser가 없다. **DEV-B 정리 권고**.
  - 조치(DEV-A D034 spec만): catalog-filters `beforeAll`에서 공개 `user-*` 행을 비공개로 바꾸고 그 id를 기억한다. `afterAll`에서 그 id만 다시 공개한다. 시드 카탈로그 계약(48·필터별 수)은 그대로다.
  - 검증: 누수 8건이 있는 DB에서 6 passed, 종료 뒤 8건 복원. 복제 DB 6 passed(0→0).
- ci-e2e 새 DB 전체 2차: **130 passed / 2 failed / 4 skipped**. 실패는 기존 retention ×2(DEV-B·U001 대기)다.
- eslint·prettier 통과.
