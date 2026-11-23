# D052 — 미읽음·인앱 알림·실시간 갱신 (2026-11-20)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 0010).

## SQL — `supabase/migrations/202611190010_notifications.sql`
- `notifications`(user_id, proposal_id, kind status|message|deliverable, status, **source_key unique**): `proposal_events` insert 트리거(`event:<id>`)와 `messages` insert 트리거(`message:<id>`)가 수신자(상대 참여자)에게 1건씩 기록. 같은 원천은 두 번 알림이 생기지 않음. 보낸 사람 본인은 알림 없음. 기존(backfill) 이력은 알림으로 만들지 않음.
- RLS: 수신자 본인이면서 **현재도 그 제안의 참여자**일 때만 조회. insert/update/delete 권한 없음(본인도 위조 불가).
- `notification_cursors`(user_id, last_read_id, read_at): 사용자별 읽음 커서. `mark_notifications_read(p_upto)`만 변경 가능 — `greatest`로 **뒤로 가지 않고**, 자기 최신 알림 id를 넘지 않으며, read_at은 커서가 실제로 전진할 때만 갱신.
- `notification_unread()`: invoker(RLS 적용)로 커서보다 큰 id 개수 → 정확한 미읽음 수.
- 두 테이블을 `supabase_realtime` publication에 추가.
- 알려진 한계(코드 `shortcut:` 주석): id는 단일 sequence라, 늦게 커밋된 더 작은 id 알림은 읽음으로 계산될 수 있음. 현재 쓰기는 단일 문장 트리거라 실질 위험 낮음.

## 앱
- `src/lib/notifications.ts` [신규] 조회·문구. `GET /api/notifications`(401/503, no-store). `POST /api/read`는 제안별 읽음 버튼 대신 커서 전진(`{upto?}`)으로 변경.
- `src/components/notifications.tsx` [신규] `NotificationBadge`: **세션 토큰을 realtime에 먼저 설정한 뒤** 본인 행만 구독. 이벤트는 갱신 신호일 뿐이고 숫자는 항상 서버에서 다시 조회(RLS 재검사). 30초 polling + 탭 복귀 시 갱신 fallback. `MarkAllRead`.
- `src/app/notifications/page.tsx` [신규] 알림함(최근 50건, 새 알림 표시, 대시보드 해당 제안으로 이동). 대시보드: 알림 배지, 제안별 "새 알림 n", 기존 `ReadButton` 제거. `src/proxy.ts`에 `/notifications`.
- 기존 `proposal_reads` 테이블은 더 이상 쓰지 않지만 데이터 보존을 위해 삭제하지 않음.

## 함께 고친 결함 (0009 수정)
- `messages_insert` 정책 하위 쿼리의 `kind`가 `proposals.kind`로 해석되어 **일반 메시지가 0001부터 항상 거부**되고 있었음(수락 후 크리에이터 결과물만 통과). `messages.kind`로 명시해 수정, `tests/proposals.mjs`에 양측 메시지 허용·결과물 제한·제3자 거부 회귀 추가. 운영 DB에도 같은 결함이 있으며 0009 적용 시 해결됨.

## 검증
- `tests/notifications.mjs` 직접 REST PASS: 원천당 1건(source_key 고유), 보낸 사람 미알림, 정확한 미읽음(3→2→0), 부분 읽음·역행 거부·최신 id로 clamp·read_at 단조, 동시 3회 표시 시 최대값 유지, 다른 계정 조회·위조·삭제·커서 변경 거부, 익명 거부, **realtime: 본인 구독 4건 수신 / 다른 계정이 내 user_id 필터로 구독해도 0건**.
- `tests/e2e/notifications.spec.ts` desktop·mobile PASS:
  - 2역할 + 브랜드 **2개 탭**: 크리에이터 지원 → 두 탭 배지가 새로고침 없이 "1개 안 읽음"(10초 제한 < 30초 polling → realtime 경로 증명), 보낸 쪽 미알림, 알림함 새 알림 표시, 대시보드 "새 알림 1", 한 탭에서 모두 읽음 → 다른 탭도 0, **로그아웃·재로그인 후에도 0 유지**.
  - realtime WebSocket 차단(`routeWebSocket`) 상태에서도 polling으로 배지 갱신(~31초).
  - 비로그인 API 401.
- 스크린샷 `dashboard-*.png`, `inbox-*.png`(가로 스크롤 없음).
- 회귀: `db reset`으로 0001~0010 적용 후 전체 E2E 28/28, 직접 DB 테스트 8종(security/claims/profile-fields/search/recruiting/lists/proposals/notifications) PASS, vitest 62/62, lint·typecheck·build·secret_scan PASS. 첫 전체 실행에서 공용 크리에이터 계정의 기존 알림 때문에 "보낸 사람 미알림" 단언이 실패 → 지원 전 커서를 비우고 0 유지를 확인하도록 테스트 수정.

## 상대 담당 인터페이스
- D053(DEV-B, 이메일 outbox): `notifications`를 원천으로 사용(source_key로 중복 방지).
- D037/D055(DEV-A): 알림 문구는 `notificationText`, 미읽음은 `notification_unread()` RPC.
