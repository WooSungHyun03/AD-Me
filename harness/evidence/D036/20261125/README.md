# D036 — 후보 그룹·캠페인 shortlist 재검증 (2026-11-25, DEV-B)

Base: origin/main `77fd552`. 환경: **격리 로컬 Supabase 복제본만**(`supabase db reset --local`, 마이그레이션 125개). 운영 DB·배포·결제·외부 승인 없음. 이전 증빙(`../README.md`, 2026-11-20)과 구분한다.

## 재현 (수정 전 main)
- `repro-before-fix.txt`: 기존 `tests/e2e/lists.spec.ts` desktop FAIL — 그룹 생성·이름 변경은 통과, `/creators/creator-001`에 `후보 그룹` 컨트롤 없음(타임아웃).
- 원인: merge `a5f3326`(DEV-A 통합)에서 크리에이터 상세 `AddToList`, 캠페인 상세 `캠페인 후보 목록`/`ShortlistButton` 사용처가 삭제됨. 컴포넌트·API는 남아 있었음.
- 잠재 결함: 화면은 공개 참조(`seed_id`)를 쓰는데 `/api/lists/items`는 이를 `saved_list_items.creator_id`로 직접 insert → 실제 등록 크리에이터(불투명 참조)는 FK 23503으로 실패(`lists-public-refs.txt`의 "legacy direct insert with public ref fails"). `/lists`는 `creators(profile)` embed로 읽어 creator read boundary 하에서 이름 대신 내부 ID를 노출할 수 있었음. 비공개/숨김 크리에이터 추가도 가시성 검사 없이 가능.

## 변경 (최소 호환)
- SQL `supabase/migrations/20261125130000_d036_saved_list_public_refs.sql` (expand): `public.add_saved_list_item`, `public.remove_saved_list_item`, `public.my_saved_lists` (invoker) → `adme_creator.list_add/list_remove/my_lists` (definer, `search_path=''`, authenticated만 execute, anon 불가). 참조 해석 + `catalog_dto` 가시성 게이트 + 본인 목록 한정, 추가는 `on conflict do nothing`으로 재시도 안전(`added`/`exists`), 쿼터 `saved_toggle`. 기존 테이블·RLS·트리거·행 변경 없음.
- API `src/app/api/lists/items/route.ts`: RPC 사용. 응답 계약 유지(201/409 중복/404), 타인 목록·미존재·숨김 크리에이터는 동일 404로 존재 은닉.
- UI: `src/app/creators/[id]/page.tsx` 그룹에 추가 복원, `src/app/campaigns/[id]/page.tsx` 캠페인 후보 목록·후보에 담기 복원(소유자·비데모만), `src/app/lists/page.tsx` 공개 DTO 사용, 숨김 항목은 "비공개 처리된 프로필"로 표시하고 빼기 가능. `src/lib/saved-lists.ts` Zod DTO 파서.
- 테스트: `tests/lists-public-refs.mjs`(신규, `tests/ci-db.sh`에 등록), `tests/e2e/lists.spec.ts` 공개 참조 시나리오 추가. `docs/handoff/RELEASE_MANIFEST.md` 행 추가.

## 결과
| 명령 | 결과 |
|---|---|
| `node tests/lists-public-refs.mjs` | PASS 21 checks — 성공·재시도(순차/동시 3건, 1행)·타 계정 추가/삭제 거부·anon 실행 거부·미존재 참조 거부·캠페인 후보 타 브랜드 거부·숨김 후 이름 비노출/재추가 거부/빼기 가능 |
| `node tests/lists.mjs` (기존) | PASS |
| `playwright tests/e2e/lists.spec.ts` desktop+mobile | 4/4 PASS (`e2e-after-fix.txt`) — 그룹 CRUD·상세에서 추가·중복 409·재로그인 유지·캠페인 후보 담기/빼기, 불투명 참조 추가 201→재시도 409→미존재 404→타 목록 404, `/lists` HTML에 내부 ID 없음 |
| `npm run lint`, `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` (vitest) | 568/569 + 1 suite 오류: `secret-scan` 병렬 5s 타임아웃(단독 실행 6/6 PASS), `asset-provenance` Windows `URL.pathname`(`C:\C:\…`) 경로 결함 — 둘 다 main에 그대로 있는 환경 문제, 이 변경과 무관 |
| `harness/migration_check.py` | D036 행 PASS. 남은 FAIL: DEV-A `20261125120000` manifest 누락(기존) |

스크린샷: `lists-desktop.png`, `lists-mobile.png`, `campaign-shortlist-desktop.png`, `campaign-shortlist-mobile.png` (가로 스크롤 없음).
관찰: 로그인 상태에서도 상단 헤더가 "로그인"을 표시 — 이 티켓 범위 밖, 별도 확인 필요.

## 남은 게이트
- 운영(hosted) 마이그레이션 적용·실환경 검증: **BLOCKED** — 운영자 승인(U004) 필요. 운영 검증 안 함.
- 팀 범위 목록은 팀 모델 부재로 여전히 owner 범위.
