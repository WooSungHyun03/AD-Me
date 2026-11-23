# D036 — 후보 그룹·캠페인별 shortlist (2026-11-20)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 0008, 사용자 배포 단계).
범위: 본인 소유(owner) 범위만. 팀 공유 모델은 아직 없음 — 팀 범위가 생기면 `saved_lists`에 team_id를 추가해 정책을 분리.

## SQL — `supabase/migrations/202611190008_saved_lists.sql`
- `saved_lists`(owner_id, name, campaign_id, is_default): owner별 이름 unique, owner별 기본 목록 1개, 캠페인당 후보 목록 1개, 기본 목록은 캠페인 연결 불가.
- `saved_list_items`(list_id, creator_id, owner_id): (list, creator) PK로 중복 방지, 그룹·캠페인 삭제 시 cascade.
- RLS: 목록·항목 모두 owner만. 목록 insert/update는 `campaign_id`가 **본인 캠페인일 때만** 허용, 항목은 본인 목록에만.
- 트리거: 기본 목록 삭제 불가(`default_list_locked`), is_default/campaign_id 변경 불가(`list_scope_locked`) → 다른 캠페인 ID로 재연결 우회 차단.
- `ensure_default_list()` (invoker, 멱등).
- 이관: 기존 `saved_creators` → 각 사용자 "기본 목록" 항목으로 복사 후 테이블 삭제(로컬에서 1건 이관 확인).

## 앱
- `src/app/api/lists/route.ts` 그룹 생성·이름 변경·삭제, `src/app/api/lists/items/route.ts` 추가·빼기(중복 409).
- `src/app/api/saved/route.ts` ♡ = 기본 목록 토글. 대시보드·카탈로그·CSV(`/api/export?list=`)는 새 테이블 사용.
- `src/app/lists/page.tsx` [신규] 그룹 관리, `src/components/lists.tsx` [신규], 크리에이터 상세 "그룹에 추가", 캠페인 상세(소유자) "캠페인 후보 목록" + 추천별 "후보에 담기"(첫 사용 시 캠페인 목록 생성).
- `src/proxy.ts` `/lists` 세션 갱신. `src/app/globals.css` 모바일 `.result` 3번째 칸 정렬 수정(버튼 세로 줄바꿈 버그).
- 문서: `docs/SCHEMA.md`, `docs/FEATURE_IMPLEMENTATION_MATRIX.md` 테이블명 갱신.

## 검증 (로컬 Supabase, `db reset`으로 0001~0008 적용)
- `tests/lists.mjs` 직접 REST PASS: 기본 목록 멱등·두 번째 기본 거부·삭제/범위 변경 거부, 그룹 CRUD, 이름·멤버 중복 거부, 타인 조회·수정·삭제·추가·owner 위조 거부, 타 브랜드가 내 캠페인 ID로 목록 생성 거부(RLS), 캠페인당 1개, 기존 목록을 남의 캠페인으로 재연결 거부, cascade.
- `tests/e2e/lists.spec.ts` desktop·mobile PASS: 그룹 생성·이름 변경 → 상세에서 추가·중복 안내 → **재로그인 후 유지** → 빼기·삭제 → 캠페인 후보 담기·빼기·목록 페이지 표시.
- 전체 E2E 18/18, vitest 52/52, security/claims/profile-fields/search/recruiting PASS, lint·typecheck·build·secret_scan PASS.
- 스크린샷: `lists-*.png`, `campaign-shortlist-*.png` (가로 스크롤 없음).

## 상대 담당 인터페이스
- D040(개인 CRM 메모·비교 리포트)은 `saved_list_items`에 메모 컬럼 추가 또는 별도 테이블로 확장. `saved_creators`는 더 이상 존재하지 않음.
