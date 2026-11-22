# D011 — 브랜드·크리에이터 온보딩 (2026-11-19, local)

상태: 코드·단위 검증 완료 / 로그인 상태 대시보드 브라우저 확인 미실행 (로컬 Supabase 키 없음)

## 기존 보호 확인 (변경 없음)
- 권한 기준은 `profiles.role`. `handle_new_user`는 metadata role이 `creator`가 아니면 `brand` → admin 자가 선택 불가.
- `profiles`는 `name` 컬럼만 UPDATE grant → 직접 REST 역할 변조 거부 (`tests/security.mjs`에 기존 검사: brand→admin update 거부).
- 가입 폼·서버 Zod는 brand/creator만 허용. `src`에 user_metadata 기반 권한 판정 없음(grep 0건).

## 구현
- `src/lib/onboarding.ts` [신규]: DB 사실(이름, 캠페인 수, 크리에이터 프로필/공개)에서 역할별 단계를 계산 → 중단 후 재로그인 시 같은 지점에서 재개, 권한과 무관.
- `src/app/dashboard/page.tsx`: 미완료 시 "시작하기 n/m" 체크리스트와 이어서 하기 링크.

## 검증
- `tests/onboarding.test.ts` 3건 (브랜드/크리에이터 단계, 재개 지점, admin·변조 역할은 셀프 온보딩 없음). vitest 27/27, lint, typecheck PASS.
- 미검증: 실제 DB 계정으로 대시보드 표시, `tests/security.mjs` 재실행(QA 자격증명 파일 로컬 부재).

## 격리 DB 검증 (2026-11-19)
- metadata `role: "admin"`으로 가입 → `profiles.role = brand` 저장 확인(자가 승격 불가).
- `tests/security.mjs` PASS(로컬 DB): brand→admin 직접 update 거부 포함. E2E 6/6 PASS.
