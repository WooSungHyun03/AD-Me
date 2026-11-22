# D043 — 캠페인 상태·모집 탐색·지원자 (2026-11-20)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 0007, 사용자 배포 단계).

## SQL — `supabase/migrations/202611190007_campaign_recruiting.sql`
- `campaigns.recruit_until timestamptz`, `campaigns.capacity int (1..100)`.
- `campaign_selected(id)`(accepted 이후 상태 수), `campaign_accepting(id)`(published·마감 전·정원 미달) — SECURITY DEFINER, anon 실행 불가.
- 트리거 `guard_campaign_status`: 신규는 draft/published만, 전이 허용 draft→published/closed, published→closed/draft, closed→published. published→draft(비공개 전환)는 거절 외 진행 제안이 없을 때만. 공개 상태에서 과거 마감일 설정 거부(DB `now()` 기준). 정원을 선정 수 미만으로 축소 거부.
- `proposals_insert`: 지원은 `campaign_accepting` 필수, 브랜드 제안은 closed·정원 충족 시 거부. unique(campaign_id, creator_id)로 중복 지원 차단(기존).
- `transition_proposal`: accepted 시 캠페인 행 `FOR UPDATE` 잠금 후 정원 확인 → 동시 선정 직렬화, 초과 시 `capacity_full`.

## 앱
- `src/lib/schemas.ts` recruit_until(ISO, offset 필수)·capacity Zod, DB 규칙 코드→한국어 메시지 `recruitingError`.
- `src/app/api/campaigns/route.ts` brief와 모집 컬럼 분리 저장, 규칙 위반 409. `src/app/api/proposals/route.ts` 마감·정원 메시지.
- `src/components/campaign-form.tsx` 마감 일시(datetime-local → ISO)·선정 인원. 편집 화면 값 유지.
- `src/app/campaigns/page.tsx` 마감 지난 캠페인 목록 제외, 마감순 정렬, 마감·정원 표시. `src/app/campaigns/[id]/page.tsx` 마감·선정 n/m 표시, 마감 시 지원 폼 대신 안내.

## 검증 (로컬 Supabase, `db reset`으로 0001~0007 처음부터 적용)
- `tests/recruiting.mjs` 직접 DB PASS: 과거 마감 공개 거부, 마감 2.5초 전 지원 성공·3초 후 거부(DB 시계), 중복 지원 거부, 정원 1에 동시 선정 2건 → 정확히 1건 성공·1건 capacity_full, 정원 충족·closed 지원 거부, 선정자 있는 캠페인 비공개 전환 거부, closed→draft·closed 생성 거부, 정원<선정 수 축소 거부, 재공개된 만석 캠페인 지원 거부, 다른 브랜드의 초안 조회·수정·선정 거부.
- vitest 52/52 (D043 3건). E2E 16/16 desktop·mobile (`tests/e2e/recruiting.spec.ts`: 마감·정원 입력→상세 0/2명→목록 표시→편집 값 유지→과거 마감 서버 거부 메시지→마감 전환 안내).
- 회귀: security/claims/profile-fields/search PASS, lint·typecheck·build·secret_scan PASS.

## 상대 담당 인터페이스
- D041(DEV-A) 캠페인 브리프 JSON에는 recruit_until/capacity를 넣지 않음(컬럼). 선정 수는 `campaign_selected` RPC 사용.
