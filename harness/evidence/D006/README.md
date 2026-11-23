# D006 — 핵심 활성화·제품 이벤트 정의 (2026-11-22)

상태: 구현과 로컬 격리 DB 검증 완료. 호스트 DB 적용(0017)은 사용자 `db push` 대기.

## 계약 (`src/lib/analytics.ts` ↔ `supabase/migrations/202611190017_product_events.sql`)
| 이벤트 | 발생 시점 | 중복 키(한 번만 집계) |
|---|---|---|
| signup | profiles 생성 | 주체당 1회 |
| explore | 로그인 상태로 `/creators` 열람 | 주체당 하루(KST) 1회 |
| shortlist | 후보 목록에 추가 | 주체+크리에이터(md5) 1회 |
| proposal | 제안/지원 생성(시작한 쪽) | 제안 ID당 1회 |
| accept | pending→accepted(수락한 쪽) | 제안 ID당 1회 |

저장하는 것은 이벤트명, 발생 시각, **가명 주체**, 역할, 중복 키뿐이다. 가명 주체는 `'p:'` + HMAC-SHA256(user id, 서버 전용 salt) 앞 32 hex이고, salt 테이블은 정책 없는 RLS로 막혀 있다.
- **수집하지 않음**: 이메일, 사용자 ID 원문, 메시지·제안서 원문, 검색어, 상대 크리에이터 ID 원문.
- 쓰기 경로는 DB 트리거와 `track_explore()`(인증 사용자, 인자 없음)뿐이다. 클라이언트 insert와 `record_event` 직접 호출은 거부된다.
- 재전송은 `dedupe_key unique` + `on conflict do nothing`으로 한 번만 집계된다.
- 동의: 설정의 "이용 통계 제외"를 고르면 과거 이벤트가 즉시 삭제되고 이후 기록도 멈춘다. 계정을 삭제하면 이벤트도 삭제된다.
- 보존: 400일. `run_retention`에 추가했고 `/privacy` 보존 표에도 넣었다.
- 관리자 집계: `product_funnel(p_days)`는 admin/service만 호출할 수 있고 단계별 고유 가명 수만 돌려준다. 관리자 페이지에 "활성화 퍼널 (최근 30일)" 표를 넣었다.

## 검증
- `tests/analytics.mjs`(직접 REST와 DB): anon/brand/creator의 insert·위조 RPC·salt·이벤트 조회·집계가 모두 거부된다. explore 2회는 1건, shortlist 재저장은 1건. 이벤트 전체에 user id·email 원문이 없다. admin 집계 5단계가 모두 1 이상(E2E 이후). opt-out 시 삭제되고 미기록되며, 재동의하면 재개된다. 임시 계정 가입은 signup 1건, 계정 삭제 시 0건.
- `tests/analytics.test.ts`: 계약과 SQL check·보존기간 일치, 전환율 0 나누기 방지.
- `tests/e2e/analytics.spec.ts`(desktop+mobile): 설정 토글 왕복, 관리자 퍼널 5행, 이메일 미노출.
- 전체 회귀(`caffeinate -i bash tests/ci-db.sh`): 마이그레이션 17개, E2E 48/48, DB 테스트 15개, 복원 모의 PASS. vitest 89, lint/typecheck/build 0 오류, secret_scan --all PASS.
  - 첫 실행은 `ERR_NETWORK_IO_SUSPENDED`(맥 절전)로 E2E 4건이 실패했다. 해당 spec 재실행 14/14, 전체 재실행 48/48로 환경 원인임을 확인했다.
- 스크린샷: `admin-{desktop,mobile}.png`, `creator-{desktop,mobile}.png`. 가로 스크롤 없음. 모바일 체크박스 줄바꿈은 수정 후 재촬영했다.

## 한계
퍼널은 기간 내 단계별 고유 사용자 수이며 코호트(같은 사람 기준 순차 전환)가 아니다. 로컬 수치는 테스트 계정 데이터이고 실제 통계가 아니다.
