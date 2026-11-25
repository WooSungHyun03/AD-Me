# D058 — 신고·정정·삭제·이의신청 큐 (2026-11-26, DEV-B)

계약: `docs/handoff/D058_D057_REPORT_CONTRACT_20261125.md`의 추천안(공존)을 구현했다. DEV-A 회신이 없어 추천 방향으로 진행했다. 합의 전이므로 상태는 IN_PROGRESS를 유지한다.

## 변경
- `ReportForm`:
  - "요청 유형"을 다시 둔다: 근거 자료 검토(기본, D057 그대로), 정보 정정, 신고, 사칭 신고, 삭제 요청.
  - 재심은 `?appeal=` 진입으로 연다.
  - D057 기본 경로의 라벨·버튼·clientKey 재시도는 바뀌지 않는다.
- `/api/reports`:
  - 요청 유형이 있으면 `submit_report`를 호출하고 201로 `{id, ticketNo, dueAt}`을 돌려준다. 알려진 오류는 409로 응답한다.
  - 요청 유형이 없으면 기존 D057 `review_submit`을 그대로 호출한다.
  - 입력 오류는 422다.
- `supabase/migrations/20261125240000_d058_report_public_reference.sql`: `submit_report`가 공개 참조를 `resolve_reference`로 해석한다. 브라우저에는 내부 ID가 없다.
- `/reports`: D057 `ReviewInbox` 앞에 `MyRequests`를 둔다. 본인 요청만 보이며(RLS), 접수번호·유형·상태·기한·임시 조치·답변·처리 로그·재심 1회를 표시한다. 내부 creator ID는 조회하지 않는다.
- 관리자: D060 운영 검색 `reports` 범위의 `AdminReview`(검토 완료 → `resolved`, 사유가 답변이 된다)를 쓴다.

## 결과
- `node tests/reports.mjs` PASS. 픽스처는 게시 RPC, 공개 게이트웨이, 독립 TOTP를 가진 두 번째 관리자로 바꿨다. 검증 항목:
  - 익명·형식 오류·직접 insert 거부
  - 접수번호와 기한 10/7일
  - 중복, 하루 5건
  - 요청자만 조회
  - 임시 비공개, 답변 필수, 종결
  - 로그
  - 삭제 시 정리·재게시 차단
  - 재심(요청자 1회, 다른 관리자)
  - 소유자 확인
- `npx vitest run tests/reviews.test.ts`: 8/8. D058 라우팅, 422, 409를 새로 추가했다.
- `npx playwright test tests/e2e/reports.spec.ts tests/e2e/similar.spec.ts`: desktop·mobile 4/4.

## 남은 것
- DEV-A 합의: 공존인지 흡수인지.
- 운영 적용(U004).
- 관리자 검색 결과에는 접수번호·유형 라벨이 없다. 신고 결과의 라벨은 "이전 접수 신고"로 고정돼 있다(D060 DEV-A 소유).
