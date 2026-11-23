# D033 — 서버 검색·페이지네이션·인덱스 (2026-11-19)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 0006, 사용자 배포 단계).

## 변경
- `supabase/migrations/202611190006_creator_search.sql`
  - `filtered_creators` (inline 가능한 SQL, API 역할 실행 불가), `search_creators` (keyset: (정렬 키, id) tie-breaker, name/followers/price 정렬별 ORDER BY 분리, 페이지 1..49 = 48+look-ahead), `count_creators` (정확 개수 1000까지, 1001 = "1000명+").
  - DTO에서 `owner_id`/`owner_consent`/`seed_id` 제거, 테이블 owner_id 컬럼 미반환. `published` 필수(소유자·관리자도 공개 검색에 초안 미노출). 데모 포함 여부는 서버 모드가 결정.
  - 인덱스: 이름/팔로워/견적(미확인은 끝) 정렬용 (key,id) 부분 인덱스, 태그 GIN(jsonb_path_ops), 검색 trigram GIN.
  - search/count는 SECURITY DEFINER: RLS 아래에서는 비-leakproof LIKE/@>가 인덱스를 못 씀. 노출 범위는 creators_read의 anon 공개 행과 동일하고 정제 DTO만 반환.
  - LIKE 와일드카드 이스케이프(%·_·\ 문자 그대로 검색).
- `src/lib/search.ts` [신규] Zod 입력(q≤80, 분류 enum, 숫자 범위, sort allowlist, limit≤48, 서명 없는 불투명 cursor는 형태 검증), DB/키 없는 TEST 데모 fixture 동일 계약.
- `src/app/api/creators/route.ts` [신규] GET, 400/503.
- `src/components/catalog.tsx` 클라이언트 필터링 제거 → 서버 조회(250ms debounce) + "더 보기". `src/app/creators/page.tsx` 첫 페이지만 SSR.

## 검증
- `tests/search.mjs` 직접 REST PASS: 3개 정렬 모두 7개 단위 순회 중복·누락 없음(전체 개수와 일치), owner 필드 없음, 소유자 초안 비노출, free_beta 데모 제외, limit 100000→49, sort 주입 거부, `%` 리터럴, count=순회 수.
- 성능(로컬, 합성 20,000행, 트랜잭션 rollback, anon 역할): 기본 이름순 페이지 ~31ms, 팔로워+플랫폼 ~20ms, 견적 커서 ~4ms, 검색어 0.6ms(trigram 인덱스), count 0.3ms / 검색어 count 0.5ms. EXPLAIN에서 `creators_pub_search`, `creators_pub_tags` 사용 확인. 이름순은 top-N heapsort(직접 실행 4ms) — 20k에서 예산(<100ms) 내라 추가 최적화 보류.
- vitest 49/49 (D033 7건: 입력 상한·거부, 클라이언트 include_demo 무시, 정렬별 무중복 순회, API 400/503).
- E2E 14/14 desktop·mobile (첫 페이지 24 → 더 보기 48, RSC payload에 owner uuid 없음, 검색·즐겨찾기 유지). 스크린샷 `catalog-desktop.png`, `catalog-mobile.png`.
- 회귀: security/claims/profile-fields PASS, lint·typecheck·build·secret_scan PASS.

## 남은 점·인터페이스
- `creators` 테이블 직접 REST select는 여전히 owner_id 컬럼을 읽을 수 있음(기존 정책). 상세·비교 페이지는 서버에서 `publicCreators` 전체 조회 후 필터 — 브라우저 전송은 아니지만 대규모 시 D032/D034에서 단건 조회로 교체 필요.
- 수집기(DEV-A D018)는 profile에 `followers` 숫자, `price_min_krw/max` null 허용 형태를 지켜야 정렬 키 캐스팅이 유효.
