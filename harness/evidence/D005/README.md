# D005 — 데모와 실제 데이터 저장·조회 분리 (2026-11-19, local)

상태: 코드·로컬 검증 완료 / 실 DB 대상 검증 미실행 (로컬에 Supabase 키 없음)

## 구현
- `src/lib/data.ts` `publicCreators()`: free_beta는 `profile->>is_demo = false` 서버 필터 강제. DB 미설정 시 fixture 대신 연결 오류(요청 시점 오류 페이지)로 처리. 검색·추천·비교·캠페인 추천이 모두 이 함수를 사용.
- `src/app/campaigns/page.tsx`: free_beta는 fixture 미사용 + `is_demo=false` 필터.
- `src/app/campaigns/[id]/page.tsx`: free_beta에서 fixture/`is_demo` 캠페인은 404.
- `src/app/page.tsx`: 시연 크리에이터 카드·"가상 48명" 문구는 test_demo에서만.
- `src/app/api/export/route.ts`: free_beta CSV에서 시연 프로필 제외.

## 범위 밖 / 후속
- SEO(sitemap/OG)는 아직 없음 → D083에서 같은 helper 사용.
- 관리자 통계(`/admin` count)는 운영 화면으로 아직 시연 포함 → D063에서 분리.
- DB 수준 분리: 같은 Supabase 프로젝트를 쓰면 anon REST로 시연 행 조회 가능. 완전 격리는 test_demo 전용 Supabase 프로젝트(사용자 콘솔 작업)로 권장.

## 검증
- 단위: `tests/mode.test.ts`. 브라우저: free_beta `/`, `/creators`(연결 오류 화면), `/campaigns`(빈 상태) DEMO 카드 미노출. test_demo에서는 DEMO 라벨과 함께 노출.

## 격리 DB 검증 (로컬 Supabase, 2026-11-19)
- PostgREST `profile->>is_demo=eq.false` 필터 동작: 공개 48건 중 비데모 0건 반환.
- free_beta 앱(local DB): `/creators`·`/campaigns`·`/compare`에 데모 레코드 0건(범례 문구만), `/campaigns/campaign-001` not-found.
