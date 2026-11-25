# D058 ↔ D057 신고 접수 계약 제안 (DEV-B → DEV-A, 2026-11-25)

## 현재 상태 (origin/main 기준)
- `/api/reports` POST는 DEV-A D057의 `review_submit(p_kind='issue', …)`만 호출한다. `ReportForm`도 근거 자료 구분(`evidenceKind`)만 받는다.
- D058의 요청 유형(신고·정보 정정·삭제·사칭·이의신청)은 사용자 진입점이 없다. 이 유형은 접수번호(`ticket_no`)·처리 기한(`due_at`)·임시 비공개·재심을 다룬다.
- 그런데 레거시 큐 자체는 살아 있다.
  - `public.submit_report`: DEV-A가 `20261125120000`에서 중복 경합을 직렬화했다.
  - `reports` 테이블.
  - 관리자 검색(D060)의 `reports` 범위와 `admin_review_report`(검토 완료 → `resolved` 위임).
- 영향받는 E2E: `reports.spec.ts`, `similar.spec.ts`(삭제 요청 진입), `safety.spec.ts`의 관리자 제한(사칭 신고 → 7일 제한).

## 제안 (추천안, 마이그레이션 없음)
1. `ReportForm`에 "요청 유형" 선택(신고/정보 정정/삭제 요청/사칭/이의신청)을 다시 둔다. 기본값은 D057 "근거 검토"(현재 동작 유지)로 둔다.
2. `/api/reports` POST:
   - 요청 유형이 D058 유형이면 `submit_report(kind, creator, reason, source_url, parent?)`를 호출해 접수번호·기한을 돌려준다.
   - 그렇지 않으면 지금처럼 `review_submit`(D057)을 호출한다.
   - 두 경로 모두 `clientKey` 재시도·공용 오류 계약(D004)을 따른다.
3. `/reports` 화면: D057 `ReviewInbox` 옆에 내 D058 요청(접수번호·상태·기한·답변·이의신청)을 나란히 보여 준다.
4. 관리자: 현재 D060 검색 `reports` 범위를 그대로 쓴다. "7일 연락 제한" 버튼(D062 `AdminRestrict`)은 사칭·신고 건이 검토 중일 때 그 결과 행에 붙인다.
5. 테스트:
   - `reports.spec.ts`·`similar.spec.ts`·`safety.spec.ts`(관리자 제한)는 관리자 화면 조작을 D060 검색 기반으로 갱신한다.
   - `tests/reports.mjs`는 현재 RPC 계약으로 갱신한다.

## DEV-A 확인 요청
- D057 근거 검토와 D058 요청 큐를 공존시키는 데 동의하는지, 아니면 D058 유형을 `review_submit` 종류로 흡수하는 쪽을 원하는지.
- 흡수하는 쪽이면 접수번호·기한·재심·임시 비공개를 D057 스키마로 옮기는 마이그레이션이 필요하다(DEV-A 소유).
- 합의 전에는 D058을 구현 완료로 표시하지 않는다. 그 사이 D062 관리자 제한 E2E도 이 계약에 의존한다.
