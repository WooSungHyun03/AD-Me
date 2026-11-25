# D036 후속 — 대시보드 "저장한 크리에이터" (2026-11-25, DEV-B)

Base: origin/main `d5b0785`. 환경: 격리 로컬 Supabase 복제본만. DB 변경 없음, 운영 검증 없음.

## 재현
- `repro-before-fix.txt`: ♡ 저장(`POST /api/saved`, 기본 목록) 후 `/dashboard#workspace-saved`에 크리에이터가 표시되지 않음(FAIL).
- 원인: 대시보드가 D036 마이그레이션에서 은퇴한 `saved_creators`를 조회 → 오류가 무시되어 항상 빈 목록. 설령 행이 있어도 내부 `creator_id`를 그대로 표시·링크.

## 변경
- `src/app/dashboard/page.tsx`: `readSavedLists`(`public.my_saved_lists`)의 기본 목록 항목을 사용. 공개 참조로 링크, 카탈로그 이름 표시, 숨김 처리된 항목은 "비공개 처리된 프로필"(링크 없음), 조회 실패 시 오류 안내.
- `tests/e2e/lists.spec.ts`: ♡ 저장 → 대시보드에서 이름·`/creators/<공개참조>` 링크 확인, 종료 시 저장 해제.

## 결과
- E2E `lists.spec.ts` + `notifications.spec.ts` desktop·mobile **12/12 PASS** (`e2e-after-fix.txt`).
- `node tests/lists-public-refs.mjs` 21 checks PASS.
- lint·typecheck·build PASS. vitest 569/569 (기존 Windows `asset-provenance` 경로 결함 스위트 1개 제외).
- 스크린샷: `dashboard-saved-desktop.png`, `dashboard-saved-mobile.png`.
