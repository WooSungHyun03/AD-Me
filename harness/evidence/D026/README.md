# D026 — 크리에이터 프로필 편집 확장 (2026-11-19)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 0005, 사용자 배포 단계).

## 변경
- 분야(최대 5)·분위기(최대 8)·광고 형식·플랫폼을 단일 선택에서 다중 선택으로 확장 (`src/components/profile-form.tsx`).
- 견적 미확인 → `price_min/max_krw = null`, 협업 의사 미정 → `is_available = null`. 0원/협업 가능으로 위장하지 않음.
  - 표시: 상세·비교·탐색 카드 "견적 미확인", "협업 의사 미확인". 가격 정렬은 미확인을 맨 뒤로. 예산 필터·협업 가능 필터에서 제외.
  - 매칭: 미확인 견적은 "예산" 요인을 missing으로 처리(점수 부풀림 없음), 협업 의사 미확인은 추천 대상 제외.
- Zod `profileSchema`: 태그를 서비스 분류 목록 enum으로 제한, 중복 거부, 견적은 둘 다 입력 또는 둘 다 null, 서버 소유 필드(is_demo/owner_id/followers) 제거.
- `supabase/migrations/202611190005_profile_fields.sql`: `valid_creator_dto`가 null 견적/협업 의사 허용·플랫폼 allowlist·최대/최소 일관성 검사. `creators.moderation_locked` 추가 — 관리자 비공개 처리 시 잠금, 본인은 내용 수정만 가능하고 공개 전환·잠금 해제 불가. 관리자 재공개 시 해제.
- 잠금 시 API 409 안내, 설정 화면 상태 안내.
- 버그 수정: 삭제된 프로필(빈 배열)로 재등록 시 체크박스가 모두 해제되어 저장 실패하던 문제 → 기본 선택으로 대체.

## 검증 (로컬 Supabase)
- `tests/profile-fields.mjs` 직접 DB PASS: null 견적·협업 의사 허용, 반쪽 null·max<min·허용 외 플랫폼·문자열 availability 거부, 본인 잠금 설정/해제 거부, 잠금 중 재공개 거부·비공개 수정 허용, 관리자 해제 후 재공개 허용.
- vitest 42/42 (D026 계약 4건: null 허용, 분류 외/중복/초과 거부, 서버 필드 제거, 미확인 견적 매칭 missing).
- `tests/e2e/profile-fields.spec.ts` desktop·mobile PASS (다중 선택 저장·재로드 유지, 상세 "견적 미확인"·"협업 의사 미확인", "0원~" 미표시).
- 회귀: 전체 E2E 14/14 연속 2회, `tests/security.mjs`·`tests/claims.mjs` PASS, lint·typecheck·build·secret_scan PASS.
