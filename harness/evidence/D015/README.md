# D015 — 계정 설정·관심 분야·알림 동의 (2026-11-22)

상태: 구현과 로컬 격리 DB 검증 완료. 호스트 DB 적용(0018)은 사용자 `db push` 대기. 실제 메일 발송기(SMTP)는 사용자 설정(U 티켓) 대기이며, 이번 범위는 발송 대기열까지다.

## 구현
- `supabase/migrations/202611190018_preferences_consent.sql`
  - `profiles`에 컬럼을 추가했다: `service_email`(기본 true), `marketing_email`(기본 **false**), `marketing_version`, `marketing_at`, `interests`(최대 5개).
  - 사용자에게 이 컬럼의 update 권한을 주지 않았다. 유일한 쓰기 경로는 `set_preferences()`이고, **버전(`marketing-2026-11`)과 시각은 서버가 기록**한다.
  - `consent_log`: 목적, 값, 버전, 시각을 남기는 추가 전용 기록. 본인과 관리자만 읽을 수 있고, 값이 실제로 바뀐 목적만 기록한다. 탈퇴하면 삭제된다.
  - `email_outbox`: 서버 전용(RLS 정책 없음). 알림이 생기면 서비스 메일이 대기열에 들어간다(`service_email`이 켜져 있을 때만).
  - `enqueue_marketing(key, interest)`: service_role만 호출할 수 있다. 대상은 **현재 동의자만**이고 관심 분야로 거를 수 있다. 같은 키로 다시 호출해도 한 번만 들어간다.
  - 철회하면 해당 목적의 **queued 메일이 cancelled**로 바뀐다.
- `src/lib/consent.ts`: 목적별 고지 문구와 버전(DB와 단위 테스트로 일치 확인).
- `src/app/api/account/route.ts` `PUT`: zod로 검증한다. 관심 분야는 카탈로그 카테고리 enum에 속해야 하고 최대 5개다.
- `src/components/account-form.tsx` `PreferencesForm`, `src/app/settings/page.tsx`: 서비스 알림, (선택) 마케팅, 관심 카테고리를 분리하고 동의일을 표시한다.
- 가입 화면에는 마케팅 체크박스가 없다. 사전 선택된 체크박스가 0개임을 E2E로 확인했다.
- `/privacy` 보존 표에 "동의 변경 기록: 탈퇴할 때까지(동의 증빙)"를 넣었다.

## 검증
- `tests/consent.mjs`(직접 REST와 DB):
  - 기본값은 서비스 on, 마케팅 off, 버전 없음.
  - 직접 컬럼 update(버전 위조 포함)는 효과가 없고, consent_log insert는 거부되고, outbox는 보이지 않는다. 사용자의 `enqueue_marketing`과 anon의 `set_preferences`는 거부된다.
  - 동의하면 서버 버전과 시각이 기록되고 로그가 목적별로 쌓인다. 같은 값을 다시 저장하면 로그가 늘지 않는다. 다른 사용자는 내 로그를 읽을 수 없다.
  - 마케팅 대상은 동의자만이다. 재호출은 멱등이고 관심 분야 필터가 동작한다.
  - 철회하면 queued가 cancelled로 바뀌고 이후 발송에서 빠진다.
  - 서비스 메일은 자기 스위치만 따른다. 끄면 대기분이 취소되고 새로 들어가지 않는다. 사이트 안 알림은 계속 생성된다.
  - 탈퇴하면 기록이 삭제된다.
- `tests/consent.test.ts`: 고지 버전과 기본값이 SQL과 일치한다.
- `tests/e2e/consent.spec.ts`(desktop+mobile): 가입 화면에 사전 체크가 없다. 설정에서 마케팅·관심 분야 저장 → 새로고침 후 유지·동의일 표시 → 철회까지 왕복한다.
- 기존 E2E 2건이 충돌해 고쳤다.
  - 관심 분야 fieldset이 프로필 폼의 `/분야/` 그룹 locator와 겹쳤다. 사용자에게도 헷갈리는 이름이라 "관심 카테고리"로 바꿨다.
  - 설정 화면에 status 영역이 여러 개가 되어 `service.spec`의 status locator를 해당 폼 안으로 한정했다.
- 전체 회귀: 마이그레이션 18개, E2E 50/50, DB 테스트 16개, 복원 모의 PASS. vitest 90, lint/typecheck/build 0 오류, secret_scan --all PASS.
- 스크린샷: `creator-desktop.png`, `creator-{desktop,mobile}-form.png`. 가로 스크롤 없음.

## 한계와 인계
- 발송 워커(queued → sent)와 SMTP는 없다(사용자 SMTP 설정 후 구현).
- sent·cancelled outbox 행의 보존 정리는 아직 `run_retention`에 없다.
