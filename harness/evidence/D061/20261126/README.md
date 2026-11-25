# D061 — 선정 전 체크리스트·승인 (2026-11-26, DEV-B)

환경: 격리 로컬 Supabase만.

## 재현
- 빈 DB 재검증에서 `selection-review.spec.ts`가 실패했다(desktop·mobile).
- 원인: merge 이후 캠페인 상세에서 선정 검토 섹션이 빠졌다. 화면은 공개 참조만 갖고 `creator_reviews`·`set_creator_review`는 내부 creator_id를 키로 써서, 공개 참조로는 후보를 지정할 수 없었다.
- 추가 결함: 체크리스트 미승인 상태에서 선정하면 DB는 `review_required`(23514)로 거부한다. 그런데 `/api/proposals`는 P0001 코드만 사용자 문구로 바꿔서, 사용자는 "선정 전 검토 체크리스트" 안내 대신 422 일반 오류를 받았다.

## 변경
- `supabase/migrations/20261126100000_d061_d046_public_ref_gateways.sql`:
  - `set_creator_review`가 공개 참조를 해석한다. STOP 가드는 줄바꿈에 무관한 정규식이다.
  - 소유자 전용 `campaign_selection_reviews(campaign)`를 추가했다. 지원자와 캠페인 후보 목록을 비공개 검토 상태와 함께 공개 참조로만 돌려준다.
- 캠페인 상세(소유자·비데모)에 선정 검토 섹션을 복원했다: `ChecklistEditor`, 후보별 `ReviewForm`.
- `/api/proposals`: 게이트 거부는 오류 코드와 무관하게 안정 메시지로 409를 돌려준다.

## 결과
- `node tests/selection-review.mjs` PASS.
- `npx playwright test tests/e2e/selection-review.spec.ts`: desktop·mobile 2/2.
  - 체크 항목 추가
  - 미승인 선정 시 409와 안내 문구
  - 메모·체크·승인 후 선정 200
  - 크리에이터·공개 화면에 메모와 섹션 비노출
- vitest 585/585 (Windows `asset-provenance` 기존 결함 스위트 제외).

## 남은 것
- 운영 적용(U004)은 운영자 게이트.
