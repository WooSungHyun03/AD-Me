# D032 — 유사 프로필·신고·정정 진입 (2026-11-26, DEV-B)

## 재현
- merge 이후 프로필 상세의 "비슷한 분위기의 크리에이터"가 캠페인 매칭 점수 `rank()`를 썼다. 이 점수는 견적을 예산 신호로 사용한다.
- 공통 태그 근거, 데모·실제 분리, `data-testid="similar"`, 프로필별 삭제 요청 링크가 없었다. `similar.spec.ts`가 실패했다.

## 변경
- `similarCreators`를 공개 카탈로그 DTO에도 쓸 수 있게 제네릭으로 바꿨다(공개 태그 필드만 읽는다).
- 프로필 상세에서 태그 기반 유사 후보 최대 3명을 보여 준다. 근거로 "공통 태그"를 표시하고, 팔로워·가격은 쓰지 않는다. 가상 프로필끼리만 묶는다.
- "이 프로필 삭제 요청"(`/reports/new?creator=…&kind=deletion`, 로그인 후 유지)을 추가했다.

## 결과
- `npx vitest run tests/similar.test.ts` PASS.
- `similar.spec.ts`: desktop·mobile PASS (D058 실행 묶음 4/4).
