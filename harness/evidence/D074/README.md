# D074 — 개인정보 열람·수정·반출 (2026-11-22)

상태: 구현·**격리 로컬 Supabase 검증 완료**(`db reset`으로 0001~0012 적용) / 운영 DB 미적용(마이그레이션 0012).

## SQL — `supabase/migrations/202611190012_privacy_exports.sql`
- `privacy_exports`: 1회용 내보내기 티켓.
  - 토큰 원문은 저장하지 않고 sha256만 저장한다. `token_hash` 컬럼은 API로 읽을 수 없다(컬럼 단위 권한).
  - 15분 뒤 만료, 한 번 쓰면 `consumed_at`.
  - 직접 쓰기는 모두 회수했다.
- `privacy_access_log`: 내보내기 요청·다운로드·만료·재사용·거부 기록. 본인만 읽을 수 있고 위조할 수 없다.
- `create_privacy_export()`: 최근 10분 안에 로그인한 경우만 허용(DB에서도 `reauth_required`로 확인). 계정당 24시간 5건.
- `consume_privacy_export(id, token)`: 소유자이고 토큰이 맞고 만료·사용 전일 때만 `ok`.
  - 다른 계정은 올바른 토큰이 있어도 `denied`이며, 거부 기록에는 A의 티켓 id를 남기지 않는다.
  - 모든 결과를 기록한다(예외 대신 값을 반환하므로 기록이 롤백되지 않음).
- 파일은 저장하지 않는다. 다운로드 시점에 로그인한 사용자 권한(RLS)으로 생성한다.

## 앱
- `src/app/api/privacy/exports/route.ts` [신규]: POST로 티켓을 만든다(origin 확인, 재로그인 확인, 429·401 안내, no-store).
- `src/app/api/privacy/download/route.ts` [신규]: POST `{id, token}`로 JSON 첨부 파일을 받는다.
  - GET 링크를 쓰지 않으므로 토큰이 URL·기록·로그에 남지 않는다.
  - 410은 만료·재사용, 403은 거부.
- `src/lib/privacy.ts` [신규]: `collectExport`, `sanitizeExport`, `assertClean`.
  - 수집: 계정, 프로필, 크리에이터 프로필, 캠페인, 제안, **내가 보낸 메시지만**, 상태 기록, 후보 목록, 요청, 소유권 신청, 주문, 이용권, 알림, 접근 기록.
  - 제외(동일 협업의 타인 자료): 상대 메시지, 상대가 쓴 제안·지원 본문, 상대 계정 id. 상대 계정 id는 `me`/`counterparty`로 바꾼다.
  - 민감 필드 제거: `payment_key`, `token_hash`, `decided_by` 등.
  - `assertClean`이 최종 출력에 금지 키나 상대 계정 id가 남아 있으면 응답하지 않고 실패한다.
- `src/components/privacy-panel.tsx` [신규], `src/app/settings/page.tsx`의 "내 개인정보" 영역:
  - 내보내기 버튼. 재로그인이 필요하면 다시 로그인 링크를 보여준다.
  - 수정 경로: 기존 계정·프로필 설정.
  - 처리 요청 상태(`/reports`)와 수집 프로필 삭제 경로(D058 삭제 요청, 10일, 재수집 차단) 안내.
  - 최근 접근 기록 10건.

## 검증
- `tests/privacy.mjs` 직접 REST PASS:
  - 익명 생성·사용 거부.
  - 15분 만료값, `token_hash` 컬럼 조회 거부, 토큰 원문 미저장.
  - 다른 계정은 조회 0건이고, **올바른 토큰으로도 다운로드할 수 없다**.
  - 직접 insert·update·로그 위조 거부.
  - 틀린 토큰 거부, 1회 사용 후 재사용 거부, 만료 거부.
  - 접근 기록은 본인 것만 보이고 순서가 정확하며, B의 시도는 B의 기록에만 남는다.
  - 24시간 5건 제한, 오래된 로그인은 DB에서 거부.
- `tests/privacy.test.ts`(vitest 2건):
  - 상대 메시지·상대 브리프·상대 id·결제 키·처리자 제거, 본인 메시지·본인 지원서 유지.
  - 정제하지 않은 데이터는 가드가 거부.
- `tests/e2e/privacy-export.spec.ts` desktop·mobile PASS:
  - 익명 401.
  - 새 크리에이터와 공용 브랜드가 실제 협업을 만들고 서로 메시지를 보낸다.
  - 크리에이터가 설정에서 파일을 내려받는다. 파일에는 본인 답장이 있고, 브랜드 메시지·브리프·브랜드 계정 id·민감 키는 없으며, `my_role=creator`.
  - 접근 기록에 요청·다운로드가 표시된다. 추측한 티켓은 403.
- reset 후 전체 E2E 32/32, 직접 DB 테스트 10종 PASS, vitest 64/64, lint·typecheck·build·secret_scan PASS.
- 스크린샷 `settings-privacy-{desktop,mobile}.png`(가로 스크롤 없음).

## 남은 범위
- 계정 삭제(탈퇴)는 이 티켓 범위가 아니다(기존 크리에이터 프로필 삭제만 있음).
- 다른 계정에서 이미 받은 협업 메시지 열람은 각자 화면에서만 가능하다.

## 상대 담당 인터페이스
- D073(DEV-A): 개인정보처리방침의 열람·반출 절차를 "설정 > 내 개인정보, 재로그인 10분, 링크 15분·1회, 24시간 5건"으로 맞춘다.
