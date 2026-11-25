# D062 — 차단·사칭·스팸 대응 (2026-11-26, DEV-B)

환경: 격리 로컬 Supabase만.

## 재현
- `node tests/safety.mjs`를 현재 계약(제안 RPC `create_creator_proposal`)으로 옮기자 "다계정 제안 폭주 거부"가 실패했다. 크리에이터 1명이 11번째 제안을 받아도 거부되지 않았다.
- 원인: `20261125180000`은 정의자 경로(`create_creator_proposal`, `conversation_send`)에서 차단·연락 제한만 검사했다. 속도 제한은 RPC가 맡는다고 가정했지만, 두 RPC에는 할당량이 없다. 그래서 D062 스팸 한도는 제품이 더 이상 쓰지 않는 직접 REST insert에만 걸려 있었다.
  - 발신 24시간 20건
  - 크리에이터당 시간당 원치 않는 제안 10건
  - 10분 메시지 30건
  - 수신 10분 60건

## 변경
- `supabase/migrations/20261125230000_d062_contact_rate_definer_paths.sql`: `guard_contact`가 로그인 호출자의 모든 경로에서 `contact_check`(차단·제한 + 속도 제한)를 실행한다. 정의자 경로의 차단·제한은 먼저 42501로 판정한다. owner SQL·서비스 작업(auth 사용자 없음)은 그대로다.
- 관리자 제한 UI: D060 운영 검색 `reports` 결과 중 접수·검토 중 건에 `AdminRestrict`(1/7/30일)를 붙였다(D058 계약 4항).
- `tests/safety.mjs`:
  - 게시 RPC 픽스처, 제안 RPC, aal2 관리자로 바꿨다.
  - 플랫폼 공통 메시지 한도(분당 20, PT429)가 먼저 걸리므로, D062 발신 한도(10분 30)는 두 분 창에 걸쳐 검증한다.
- `tests/e2e/safety.spec.ts`: 관리자 제한을 D060 검색 기반으로 바꿨다. 제한 사유에 실행별 고유값을 붙인다.

## 결과
- `node tests/safety.mjs` PASS: 차단, 탐색 불가, 발신·수신(다계정)·지원 한도, 자동 제재 없음, 임시 관리자 제한, 이의신청, 해제.
- `node tests/contact-guard.mjs` PASS.
- `npx playwright test tests/e2e/safety.spec.ts`: desktop·mobile 4/4.

## 남은 것
- 운영 적용(U004)은 운영자 게이트.
