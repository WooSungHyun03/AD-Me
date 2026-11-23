# D049 — 제안·지원·상태 머신 회귀 (2026-11-20)

상태: 구현·**격리 로컬 Supabase 검증 완료**(`db reset`으로 0001~0009 적용) / 운영 DB 미적용(마이그레이션 0009).

## 상태 전이 (DB `transition_proposal`가 최종 권한, 앱 `canTransition`은 버튼 표시용 사본)
| 현재 | 동작 | 가능한 쪽 |
|---|---|---|
| pending | accepted / rejected | 요청을 받은 쪽(제안→크리에이터, 지원→브랜드) |
| pending | **cancelled (신규)** | 요청을 보낸 쪽 |
| accepted, revision_requested | submitted | 크리에이터, 결과물(deliverable) 메시지가 있을 때 |
| submitted | completed / revision_requested | 브랜드 |
| rejected, cancelled, completed | — | 최종 상태 |

## SQL — `supabase/migrations/202611190009_proposal_events.sql`
- `proposals.status`에 `cancelled` 추가(기존 데이터 호환: 기존 값은 그대로 유지).
- `proposal_events`(proposal_id, actor_id, recipient_id, from_status, to_status): 상태 변경 이력 겸 알림 이벤트. `recipient_id` = 상대 참여자 → D052 인앱 알림이 이 테이블을 읽는다.
  - 참여자·관리자만 조회. insert/update/delete 정책 없음 + 권한 회수 → 정의자 함수만 기록.
  - 생성 시 `adme_proposal_created` 트리거, 전이 시 `transition_proposal` 안에서 **상태 변경·이력·audit_log를 한 트랜잭션**으로 기록. 실패하면 셋 다 남지 않음.
  - 기존 제안은 현재 상태 1건으로 backfill(actor 없음 → 화면에 "기존 기록").
- 수락 시 크리에이터가 공개·본인 확인(verified) 상태가 아니면 `creator_unavailable`(신고·운영 비공개 처리된 프로필은 협업 진입 불가). 미인증(unclaimed) 프로필은 D025 정책상 처음부터 제안·지원 불가.
- 같은 제안에 대한 동시 요청은 `FOR UPDATE` 행 잠금으로 직렬화, 정원 경합은 D043의 캠페인 잠금 유지.
- `cancelled`도 `rejected`처럼 메시지 작성 불가, 캠페인 비공개 전환 차단에서 제외.
- 사용자 단위 차단·계정 정지 모델은 아직 없음 → D062(사용자 차단·사칭·악용 대응)에서 같은 게이트(`transition_proposal`·`proposals_insert`)에 추가.

## 앱
- `src/lib/schemas.ts` `canTransition` 취소 규칙, `creator_unavailable` 안내 문구.
- `src/components/deal-controls.tsx` "요청 취소" 버튼. `src/app/dashboard/page.tsx` 취소됨 상태, 제안별 이력(시각 KST · 상태 · 나/상대/기존 기록).
- `docs/SCHEMA.md` proposals·proposal_events 갱신.

## 검증
- `tests/proposals.mjs` 직접 REST PASS: 같은 캠페인·크리에이터 중복 제안/지원 거부, 보낸 쪽 수락 불가·받은 쪽 취소 불가, 비참여자·다른 크리에이터 forbidden, **동시 수락 vs 거절 → 하나만 성공·이벤트 1건**, 지원 전체 경로(결과물 없이 제출 거부, 수정 요청 후 재제출, 크리에이터 자기 승인 거부, 완료 후 변경 거부, 이력 6건 순서), 취소 후 수락·메시지 거부, 수락 이후 취소 거부, 운영 비공개 크리에이터 수락 거부 시 상태·이력 무변경, 비공개 크리에이터에 신규 제안 거부, 타인 이력 조회 0건, 이력 위조 insert·delete 거부, 상태 직접 update 0건.
- `tests/e2e/proposal-cancel.spec.ts` desktop·mobile PASS(2역할): 크리에이터 지원 → 대시보드 "요청 취소" → 양쪽에 취소됨·이력(나/상대) 표시, 브랜드에 수락 버튼 없음, 오래된 화면에서 보낸 수락 요청 서버 거부.
- vitest 62/62(취소 규칙 단위 테스트 추가), 전체 E2E 22/22, security/claims/profile-fields/search/recruiting/lists PASS, lint·typecheck·build·secret_scan PASS.

## 상대 담당 인터페이스
- D050/D051/D054/D084(DEV-A): 상태값에 `cancelled` 추가, 이력은 `proposal_events`. 상태 변경은 반드시 `transition_proposal` RPC 경유.
