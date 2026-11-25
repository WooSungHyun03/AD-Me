# D046 — 추천 평가·피드백 데이터셋 (2026-11-26, DEV-B)

## 재현
- `match-feedback.spec.ts`가 실패했다. merge 이후 캠페인 추천 결과에 평가 폼이 없었다.
- 추천 결과의 `creatorId`는 공개 참조인데, `/api/matching-feedback`는 그 값을 `matching_feedback.creator_id`(creators FK)에 그대로 upsert했다. 데모가 아닌 프로필이라면 FK 위반이 나거나 엉뚱한 키로 저장될 수 있었다.

## 변경
- 같은 마이그레이션(`20261126100000`)에 두 함수를 추가했다.
  - 서비스 전용 `rate_recommendation`: 공개 참조를 해석하고 캠페인 소유를 다시 확인한 뒤 upsert한다.
  - 평가자 전용 `my_recommendation_feedback`: 공개 참조로 돌려준다.
- 라우트는 서버가 다시 계산한 순위·점수·버전으로 `rate_recommendation`을 호출한다. 클라이언트 값은 저장하지 않는다.
- 캠페인 상세(소유자·비데모) 추천 결과마다 `MatchFeedback` 폼을 복원했다. 표시 개수는 `SHOWN`과 같다.

## 결과
- `node tests/feedback.mjs` PASS.
- `npx playwright test tests/e2e/match-feedback.spec.ts`: desktop·mobile 2/2.
  - 사유와 함께 저장
  - 목록 밖·잘못된 사유 거부
  - 다른 계정 차단
  - 관리자 요약
