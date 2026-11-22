# D079 — 데이터 보존·삭제·복구 정책 실행 (2026-11-22)

상태: 구현·로컬 격리 DB 검증 완료. **호스트 DB 적용·Vercel 정기 실행(cron) 미설정**. 정기 실행은 배포 후 관리자 버튼 또는 스케줄로 해야 한다.

## 구현
- `supabase/migrations/202611190015_retention_tombstones.sql`
  - **`deletion_tombstones`**(`subject_kind` collected_profile|owner_profile|upload, `subject_id`, `key_hashes`):
    - 내용은 저장하지 않고 ID와 sha256 해시만 남긴다(컬럼 check로 해시 형식 강제).
    - 삭제 요청(reports)과 연결하는 컬럼이 없다. **요청 증거와 삭제 원문을 같은 영구 로그에 두지 않는다**는 경계를 지킨다.
    - 관리자만 읽을 수 있고 사용자 쓰기는 회수했다.
  - **삭제 경로와 무관하게 기록**한다. 트리거 3개:
    - 수집 프로필 삭제 처리(review_report)
    - 본인 프로필 삭제(DELETE 라우트)
    - 파일 삭제(delete_upload)
    - 본인이 재등록하면 owner tombstone을 제거한다(본인의 새 선택을 복구 재적용이 지우지 않도록).
    - 기존 삭제분은 backfill.
  - **`suppressed_sources` 해시화**: D058에서 원문 URL·handle로 저장하던 재수집 차단 키를 `h:<sha256>`으로 바꿨다. insert 트리거가 자동 해시하고, `guard_suppressed_creator`는 해시로 비교한다.
  - **`tombstone_ledger()`**: tombstone을 DB 밖에 복사하기 위한 JSON(ID·해시만).
  - **`reapply_tombstones(ledger)`**: 백업 복구 후 ledger를 병합하고 세 종류 삭제를 모두 다시 적용한다.
    - 수집 프로필 내용 삭제와 차단 키 재등록, 본인 프로필 비식별화, 파일 deleted 처리(저장소 원본은 sweep이 제거).
    - **멱등**: 재시도해도 변경 0.
  - **`run_retention()`** + `retention_runs`(작업 상태 ok/failed, 종류별 건수, 오류 요약):
    - 실패하면 부분 작업은 롤백되고 실패 기록이 남아 재실행 대상임을 보여준다.
    - 세 함수 모두 service_role 전용이다. anon·authenticated·관리자 세션 모두 직접 호출 불가.
- `src/lib/privacy-retention.ts`:
  - `RETENTION_RULES`(필드별 보존 정책, SQL 기간과 동기화 테스트).
  - `assertLedger`(내용·원문 키·이상 ID 거부).
  - `snapshotLedger`(private bucket `privacy-ledger/tombstones.json`).
  - `reapplyFromLedger`, `snapshotAfterDeletion`.
- 삭제 직후 ledger 복사(best-effort): 프로필 DELETE, 파일 DELETE, 관리자 신고 resolved. 복사가 실패해도 DB tombstone은 이미 기록돼 있다.
- `src/app/api/admin/retention/route.ts`: 관리자만. `run` / `snapshot` / `reapply`(ledger 직접 업로드 가능, 형식 오류 400).
- UI:
  - `/privacy` "보존 기간" 표(11개 항목).
  - `/admin` "데이터 보존·삭제"(tombstone 수, 최근 5회 작업 상태, "보존 작업 실행", "복구 후 삭제 재적용").

## 보존 규칙
| 데이터 | 보존 | 이후 |
|---|---|---|
| 본인 프로필 | 삭제 시까지 | 즉시 비공개·비식별, tombstone 영구 |
| 수집 프로필 | 삭제 요청 처리 시까지 | 내용 삭제, 차단 키 해시 |
| 파일 | 삭제 시까지 | 즉시 접근 차단, sweep 1시간 내 원본 제거 |
| 메시지·제안 내용 | 종료 후 3년 | 메시지 삭제, brief 대체 |
| 신고 본문 | 처리 후 3년 | 본문 대체, 번호·일자 유지 |
| 알림 | 180일 | 삭제 |
| 감사 로그(행위·ID만, 원래 내용 없음) | 1년 | 삭제 |
| 내보내기 기록 | 1년(티켓 만료+1일 삭제) | 삭제 |
| 연락 제한 | 종료 후 1년 | 삭제 |
| 결제(TEST) | 자동 삭제 안 함 | — |
| 백업 | 호스팅 보존기간 | 복구 시 tombstone 재적용 |

## 검증
- `tests/retention.mjs`(격리 DB, 직접 REST) PASS:
  - anon·크리에이터·관리자 세션 모두 ledger·reapply·retention 호출 거부, tombstone·run 직접 쓰기 거부, tombstone 목록 비공개.
  - 실제 세 경로로 삭제하면 tombstone 3건이 생긴다. 원문 handle·URL·내용이 없고 reports 연결 컬럼이 없다. 차단 키는 전부 해시.
  - **복구 시뮬레이션**: 삭제 전 상태로 내용·차단 키·tombstone을 되돌리면 프로필이 다시 공개된다. ledger로 `reapply` 하면 세 삭제가 모두 복원되고 재수집도 다시 차단된다.
  - **재시도**: 두 번째 reapply 결과는 전부 0.
  - 본인 재등록 후 reapply가 새 프로필을 건드리지 않는다. 원문 키가 든 위조 ledger는 거부된다.
  - retention: 4년 지난 종료 제안의 메시지 삭제와 brief 대체, 200일 지난 알림·2년 지난 감사 로그만 삭제하고 최신 행은 유지. run 기록 ok. 두 번째 실행은 0건.
- `tests/privacy-retention.test.ts`(vitest 3건): ledger 형식 거부, 문서·SQL 기간 일치.
- `tests/e2e/retention.spec.ts` desktop·mobile PASS: 보존 표 공개(가로 스크롤 없음), 비관리자 3개 action 403, 관리자 실행 → 작업 기록 "완료", snapshot, 재적용 버튼, 잘못된 ledger 400.
- 스크린샷 `privacy-retention-{desktop,mobile}.png`, `admin-retention-{desktop,mobile}.png`. 가로 스크롤 없음.
- 리셋 DB(0001–0015) 전체 회귀: E2E 44/44, DB 테스트 13종 PASS, vitest 80, lint·typecheck·build·secret_scan(`--all`) PASS.
  - 참고: security·search DB 테스트는 E2E가 만든 fixture(주문·크리에이터 프로필)에 의존한다. 리셋 직후 단독 실행하면 실패하고 E2E 이후에는 PASS(기존 순서 의존).

## 한계·후속
- 복구 검증은 **시뮬레이션**이다(삭제 전 상태로 행을 되돌림). 실제 Supabase 백업(PITR) 복구는 호스트 권한이 필요하다(사용자/D087).
- `shortcut:` ledger 사본이 같은 Supabase 프로젝트의 storage에 있다. 관리자가 snapshot을 받아 오프사이트 백업과 함께 보관해야 한다. 별도 저장소 연동은 후속.
- 정기 실행: Vercel cron 등 스케줄 미구성. 현재는 관리자 수동 실행이다.
- 계정(auth.users) 자체 삭제 흐름은 없다. 프로필 비식별과 협업 기록 보존이 현재 정책이며, 계정 삭제는 요청 접수 후 운영자 처리로 안내한다.

## 상대 담당 인터페이스
- D014/D018/D073(DEV-A): 보존 기간 표 = `RETENTION_RULES`. 정책 문서는 이 상수를 기준으로 한다.
- D087(DEV-B): 백업 복구 절차의 마지막 단계는 `/admin` "복구 후 삭제 재적용" 또는 `POST /api/admin/retention {action:"reapply"}`.
