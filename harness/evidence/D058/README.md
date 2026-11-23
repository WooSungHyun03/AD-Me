# D058 — 신고·정정·삭제·이의신청 큐 (2026-11-22)

상태: 구현·**격리 로컬 Supabase 검증 완료**(`db reset`으로 0001~0011 적용) / 운영 DB 미적용(마이그레이션 0011).

## SQL — `supabase/migrations/202611190011_report_queue.sql`
- `reports` 확장(기존 행 호환: `reviewed`→`resolved`, 접수번호·기한 backfill):
  - 접수번호 `ADR-YYMMDD-00001`(KST, sequence), 유형 `report|correction|deletion|appeal`, 재심 `parent_id`.
  - 처리 기한 `due_at`: 삭제 요청 10일(개인정보 처리 요청 기한 기준), 그 외 7일.
  - 본인 확인 `identity_verified`: 요청 계정이 대상 프로필 소유자면 DB가 true로 기록. 제3자 요청은 false → 관리자가 권리 관계 확인.
  - 상태 `pending → in_review → resolved | dismissed`(종결 후 재개 불가), 임시 조치 `interim_hidden`, 답변 `response`(종결 시 필수), `decided_by/at`.
- 접수는 `submit_report` RPC만 가능(직접 insert 정책 제거·권한 회수):
  - 로그인 필수(익명 함수 실행 권한 없음), 계정당 24시간 5건, 같은 계정·대상·유형의 처리 중 요청 1건.
  - 정정·신고는 HTTPS 출처 필수.
  - 재심은 원 요청자만, 결과가 나온 뒤 30일 안에 1회, 재심의 재심 불가.
- 처리는 `review_report(p_id, p_status, p_response, p_hide)`(관리자만):
  - 임시 비공개/해제(프로필 `published`·`moderation_locked`). 공개 화면에는 신고 흔적이 남지 않음.
  - 재심은 원 처리자가 아닌 다른 관리자만(`same_reviewer`).
  - 처리 기록은 `report_events`(요청자에게 공개, 처리자 미포함) + `audit_log`(관리자 전용, 처리자 포함).
- **삭제 후 재수집 차단**: 소유자 없는(수집·데모) 프로필의 삭제 요청이 처리 완료되면,
  - 내용을 "삭제된 프로필"로 비우고 비공개·잠금 처리한다.
  - `suppressed_sources`에 `id:`/`url:`/`handle:` 키를 기록한다.
  - `adme_creator_suppressed` 트리거가 같은 키의 ownerless 프로필 insert와 재공개를 막는다. DB 소유자 경로(향후 수집기)와 관리자 `moderate_entity`도 포함.
  - 본인 등록 프로필은 막지 않는다(본인의 선택).

## 앱
- `src/app/api/reports/route.ts` 유형·재심 접수(201 + 접수번호), `src/app/api/admin/route.ts` 상태·답변·임시 조치.
- `src/components/report-form.tsx` 유형 선택(정정/신고/삭제), 삭제 시 본인 확인·10일 기한 안내, 접수번호 표시.
- `src/app/reports/page.tsx` [신규] 내 요청(접수번호·유형·상태·기한·임시 조치·답변·처리 기록·재심 요청 버튼).
- `src/app/reports/new/page.tsx` 로그인 필요, 재심 모드(`?appeal=`).
- `src/components/admin-review.tsx`, `src/app/admin/page.tsx` 처리 큐(미처리 우선·기한순, 기한 초과 강조, 본인 여부, 재심 표시).
- 대시보드 "내 요청" 링크, `src/lib/auth-links.ts` 로그인 후 이동 허용 경로에 고정 경로 `/reports` 추가, `src/proxy.ts`.
- `tests/security.mjs` 신고 부분을 새 API로 갱신(직접 insert 거부 확인 추가).

## 검증
- `tests/reports.mjs` 직접 REST PASS:
  - 익명·짧은 사유·잘못된 유형·출처 없음·없는 대상·직접 insert 거부.
  - 접수번호 형식, 기한 10/7일, 제3자 본인 확인 false, 처리 중 중복 거부, 하루 5건 초과 거부.
  - 다른 계정·익명 조회 0건, 요청자 상태 변경·로그 위조·직접 처리 거부, 차단 목록 비공개.
  - 임시 비공개 시 공개 조회 0건, 답변 없이 종결 거부, 종결 후 재개 거부, 처리 기록 3단계, audit 기록.
  - 삭제 후 같은 id·같은 handle·같은 URL 재수집, 재공개(직접·관리자) 모두 `suppressed_source`. 무관한 프로필은 영향 없음.
  - 재심: 남의 요청 재심 거부, 결정 전 재심 거부, 두 번째 재심·재심의 재심 거부, 같은 관리자 처리 거부, 다른 관리자 처리 성공.
  - 소유자 본인 삭제 요청은 본인 확인 true.
- `tests/e2e/reports.spec.ts` desktop·mobile PASS(요청자·관리자·다른 계정 3역할):
  - 비로그인 접근 시 로그인으로 이동, 상세 화면에서 정정 요청 후 접수번호 확인.
  - 관리자 큐에서 답변 없이 완료 시 안내, 답변 후 완료.
  - 요청자 화면에 처리 완료·답변·기록 2건 표시, 재심 접수 후 재심 버튼 사라짐.
  - 다른 계정 `/reports`에는 해당 접수번호가 없음.
- reset 후 전체 E2E 30/30, 직접 DB 테스트 9종 PASS, vitest 62/62, lint·typecheck·build·secret_scan PASS.
- 스크린샷 `admin-queue-*.png`, `request-form-*.png`(가로 스크롤 없음).

## 남은 범위
- 제3자 삭제 요청의 권리 확인은 관리자 수동 판단(증빙 파일 업로드 없음).
- 요청자 알림(이메일)은 D053 outbox에서 `report_events`를 원천으로 연결.

## 상대 담당 인터페이스
- D057(DEV-A): 정책 문서의 기한(삭제 10일·기타 7일)과 하루 5건 제한이 DB 값과 일치해야 함.
- D032/D063(DEV-B): 수집 경로는 ownerless insert 시 `suppressed_source` 오류를 "삭제 요청으로 수집 제외"로 처리.
