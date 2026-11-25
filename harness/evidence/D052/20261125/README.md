# D052 — 미읽음·인앱 알림·실시간 갱신 재검증 (2026-11-25, DEV-B)

Base: origin/main `d5a9b9b`. 환경: **격리 로컬 Supabase 복제본만**(마이그레이션 125개, `tests/setup-isolated-youtube.sql`). 운영 DB·배포·결제·외부 승인 없음. 이전 증빙(`../README.md`, 2026-11-20)과 구분한다.

## 재현 (수정 전 main)
- `repro-e2e-before.txt`: `tests/e2e/notifications.spec.ts` desktop·mobile 4건 FAIL.
  - `POST /api/read {}` 실패: 라우트가 D052 이전의 제안별 `proposal_reads` 버전(`{proposalId}` 필수)으로 되돌아가 있었다. 그 결과 `/notifications`의 "모두 읽음으로 표시"(`{upto}` 전송)도 운영 코드에서 422로 실패.
  - 대시보드에 `unread-count` 배지와 제안별 "새 알림 n"이 없음.
  - 원인: merge `a5f3326`(DEV-A 통합)이 `src/app/api/read/route.ts`와 대시보드 알림 부분을 이전 버전으로 덮어씀. DB(알림 테이블·커서·`mark_notifications_read`·`notification_unread`·realtime publication)는 그대로였다.
- `repro-notifications-rest.txt`: `tests/notifications.mjs` 픽스처가 오래됨(직접 `published:true` insert → 게시 동의 트랜잭션 가드 42501, 직접 제안 insert → 현행 계약 아님).

## 변경 (최소 호환, DB 변경 없음)
- `src/app/api/read/route.ts`: 두 요청 형태 지원 — `{proposalId}`(기존 메시지 읽음 버튼 유지) / `{upto?}`(D052 알림 커서; DB가 단조 증가·최신 id로 clamp). 그 외 필드는 422. `apiRoute`의 requestId·오류 계약 유지.
- `src/app/dashboard/page.tsx`: `NotificationBadge`(realtime 신호 + 30초 polling + 탭 복귀 갱신, 숫자는 항상 서버 재조회)와 제안별 "새 알림 n" 복원. 알림 조회 실패 시 표시만 생략.
- 테스트: `tests/notifications.mjs` 픽스처를 로컬 owner SQL + `create_creator_proposal` RPC로 갱신, 종료 시 픽스처 비공개 처리. `tests/e2e/notifications.spec.ts`에 오래된 커서 재전송(재시도/낡은 탭) 무변화, 잘못된 입력 422, 증거 스크린샷 추가.

## 결과
| 명령 | 결과 |
|---|---|
| `node tests/notifications.mjs` | PASS — 원천당 1건, 보낸 사람 미알림, 정확한 미읽음, 부분/단조/clamp 커서, 동시 3회 표시 최대값 유지, 타 계정 조회·위조·삭제·커서 거부, anon 거부, realtime 본인 4건 / 타 계정 0건 |
| `playwright tests/e2e/notifications.spec.ts` desktop+mobile | 6/6 PASS — 브랜드 2개 탭 무새로고침 갱신, 보낸 쪽 미알림, 알림함·대시보드 "새 알림 1", 한 탭 읽음 → 다른 탭 0, 재로그인 후 0 유지, 오래된 커서 재전송 무변화, WebSocket 차단 시 polling 갱신, 비로그인 401 |
| `npm run lint`, `npm run typecheck`, `npm run build` | PASS |
| vitest (`--testTimeout=60000`) | 569/569 tests PASS; `asset-provenance` 스위트는 Windows `URL.pathname` 경로 결함(main 기존, 이 변경과 무관) |

스크린샷: `dashboard-desktop.png`, `dashboard-mobile.png`, `inbox-desktop.png`, `inbox-mobile.png` (가로 스크롤 없음).

## 교차 발견 (DEV-A 인계)
- 견적이 `null`인 공개 크리에이터가 1명만 있어도 `readPublicCreatorCatalog`(`src/lib/creator-catalog-read.ts`)가 전체를 throw해 `/campaigns/[id]`가 500이 된다(`publicCatalogCreatorSchema`는 정수 견적 필수). D026은 "견적 미확인은 null"을 요구하므로 D026/D033 계약 정합이 필요. 이번에는 테스트 픽스처를 유효한 견적으로 바꾸어 우회했고 앱 코드는 변경하지 않았다.
- 대시보드의 "저장한 크리에이터"는 D036에서 은퇴한 `saved_creators`를 조회해 항상 비어 있다(별도 후속).

## 남은 게이트
- 운영 앱 배포·실환경 두 역할 실시간 수신 검증: **BLOCKED** — 운영자 배포 승인(U005)·운영 QA 계정(U019) 필요. 운영 검증 안 함.
