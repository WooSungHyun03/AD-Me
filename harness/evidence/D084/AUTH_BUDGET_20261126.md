# D084 — E2E 로그인 요청 한도로 인한 실패 (2026-11-26, DEV-A)

## 재현
- 격리 스택 `ci-e2e`(새 DB, main `252dfdd`)에서 CI와 같은 순서로 전체 실행했다: 10 failed / 4 skipped.
- notifications:29·133, pipeline:33 (desktop·mobile)이 로그인 뒤 `/login`에 머무른다.
- error-context에 `alert: 요청이 많습니다. 15초 후 다시 시도해주세요.`가 남았다.

## 원인
- D076 `adme_ops.auth_budget`(202611210038)의 로그인 한도는 계정당 10회/60초, IP당 20회/60초다.
- 공유 fixture 계정(brand/creator)과 127.0.0.1로 33개 spec이 UI 로그인한다. 빠른 실행에서는 한 분 창 안에 한도를 넘는다.
- CI는 실행이 느려 통과했다. 같은 이유로 간헐 실패할 위험이 있다.
- 로그인 한도 자체를 검사하는 e2e는 없다. 한도 검사는 DB suite가 맡는다.

## 변경 (테스트 실행기만)
- `tests/support/e2e-auth-budget.ts`를 새로 만들어 Playwright `globalSetup`으로 연결했다(`playwright.config.ts` 1줄).
  - BASE_URL이 localhost 또는 127.0.0.1일 때만 동작한다.
  - `supabase/config.toml`의 project_id로 로컬 DB 컨테이너를 찾는다.
  - 3초마다 `auth_ip_login`·`auth_account_login` 창만 지운다.
  - 다른 한도(가입·재전송·검색·도메인 쿼터)는 건드리지 않는다.
- 로컬 DB가 없으면(keyless 실행) 아무것도 하지 않는다.
- 운영 코드·마이그레이션·한도 값은 바꾸지 않았다.

## 결과
- 같은 스택을 새 DB로 다시 올려 전체 실행: **2 failed / 4 skipped / 112 passed** (수정 전 10 failed).
- 남은 실패는 retention ×2이고, CI `252dfdd`와 같다(D079 표 보류와 spec 불일치, DEV-B 결정, `DEVB_CI_ROOTCAUSE_20261126.md`).
- desktop·mobile 두 project가 모두 포함된다.
- typecheck·eslint·prettier 통과.

## 명령
```
supabase db reset --local → prepare-ci-consent → provision → provision-admin → setup-isolated-youtube.sql
CI=true BASE_URL=http://localhost:3300 npx playwright test --reporter=line
```
