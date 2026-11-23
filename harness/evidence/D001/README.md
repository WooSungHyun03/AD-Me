# D001 — 무료 실서비스·TEST 시연 모드 분리 (2026-11-19, local)

상태: 코드·로컬 검증 완료 / **배포 환경 적용 미검증** (Vercel 환경변수 설정은 사용자 작업)

## 구현
- `src/lib/mode.ts` [신규]: 서버 전용 `SERVICE_MODE` 환경변수. 정확히 `test_demo`일 때만 시연 모드, 그 외(미설정·오타 포함)는 `free_beta`로 fail-closed. `NEXT_PUBLIC_` 값이 아님.
- `src/app/api/billing/orders/route.ts`, `confirm/route.ts`: free_beta에서 인증/DB 접근 전에 403.
- `src/app/pricing/page.tsx`: free_beta는 무료 플랜만 노출, Checkout·AI 크레딧 숨김, 무료 베타 안내.
- `src/app/creators/page.tsx`: TEST HOT 슬롯(`active_hot_creators`)은 test_demo에서만 조회 → TEST entitlement가 free_beta 노출을 바꾸지 않음.

## 설정명
- `SERVICE_MODE` = `free_beta`(기본) | `test_demo`. SQL 변경 없음.
- ⚠ 현재 배포(https://ad-me-topaz.vercel.app)는 48명 시연 데이터 기반이다. 다음 배포 전 시연 환경에는 `SERVICE_MODE=test_demo`를 설정해야 기존 시연·E2E가 유지된다. 미설정 시 실서비스(free_beta)로 동작해 시연 데이터가 숨겨진다.
- pricing은 정적 페이지이므로 모드는 빌드 시점 서버 env 기준(모드 변경 시 재배포 필요).

## 검증
- `tests/mode.test.ts`: 기본값 fail-closed, free_beta 결제/승인 API 403, 키 없는 free_beta 목록이 가상 48명으로 대체되지 않음, test_demo는 DEMO 표식 fixture만.
- lint / typecheck / vitest 16/16 / build(양 모드) / harness selftest / secret_scan PASS.
- 브라우저(데스크톱 1366·iPhone 13): free_beta `/pricing`=무료만, `/campaigns/campaign-001`=404, test_demo `/pricing`=Brand Pro 노출.
- 미실행: `npm run test:e2e`(Supabase 키 없는 로컬, 기존 E2E는 공개 URL 대상). DB 직접 REST 검사 해당 없음(DB 변경 없음).

## 상대 담당 인터페이스 변경
- 새 서버 helper `isDemoMode()`/`serviceMode()`. 결제·시연 데이터 노출 코드는 이 helper로 판정할 것 (D002·D065).
