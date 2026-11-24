# D074 — 현재 세션 재인증과 자기 자료 반출

- 기준 main `922f34d96a1905c89ccc8e5553c88979f5d5cb71`. 설정에 PrivacyExport 미연결, API/DB가 계정 전체 last_sign_in_at을 사용했다. 현재 세션의 Auth AMR만20분 과거로 만든 뒤 다른 로그인과 실제 refresh를 수행하면 이전 조건을 통과한다. 신규 route 단위3건 중2 FAIL(`output/d074-before.log`).
- 최소 호환 변경: 기존 버튼을 설정에 연결. 기존 POST/JSON/오류/15분 만료/1회 토큰/컬럼 권한/파일 미저장 계약은 보존한다. API는 provider-verified getClaims 및 D010의 현재 세션 helper로 확인한다. SQL120은 private helper에서 trusted JWT AMR의 `0≤age<600초`, UID 소유의 실제 auth.sessions를 검사한다. refresh/iat·다른 세션 로그인·미래/누락/잘못된 AMR로 대체하지 않는다. 삭제 격리 actor gate 유지 및 quota 확인/생성을 계정별 advisory lock으로 직렬화한다.
- 실제 로컬 Auth/PostgREST/PostgreSQL 양 역할: 익명 거부, 자기 티켓/일회 download 성공, 다른 계정 조회0/올바른 토큰도 거부, 틀린 토큰 거부, 토큰 hash 조회/로그 위조 거부, 원문 토큰 미저장, 동시 사용1성공/1재사용, 만료 거부, 본인 접근 기록만 조회. `node tests/local-privacy-session.mjs` PASS.
- 실제 issuer의 오래된 현재 AMR+다른 세션 새 로그인+refresh 후 direct RPC 거부. 로컬 서명 fixture의 malformed/future/정확히600초/missing session 거부. 실제 fresh session으로 동시 생성8건 중5건 성공/3건 rate_limited; 실제 global logout 뒤 기존 JWT의 direct RPC 거부.
- `tests/local-browser/privacy-session.spec.ts` desktop/mobile: 두 역할 각각 오래된 세션→재로그인 안내→설정 복귀→실제 JSON 파일 download→본인 계정/보안 키 부재→200후410 retry PASS. 상대 자료·메시지·본문·식별자 제거는 기존 privacy/privacy-retention 단위 fixture를 함께 검증했다. 이번 브라우저는 상대방 협업 전체를 새로 만든 시나리오가 아니며 과거 협업 fixture와 구분한다.
- `node scripts/verify-local-privacy-migration.mjs`: 기존119 함수 상태→120 적용/rollback 및 실패 주입, 기존 최종 정의 보존, private helper의 anon/authenticated/service_role 실행 거부 PASS. 기존119 fresh 증거는 D005에서 재사용했고 전체 DB reset을 반복하지 않았다. 새120은 기존119 DB에 원자 적용한 후 역할별 시험했다. SQL120 static migration_check PASS.
- 공통 lint/typecheck/Vitest559/production build와 영향 desktop/mobile16 PASS. build1회 이후 같은 산출물로 메일/복구/탈퇴 회귀를 확장했다. source/client/artifact scan PASS. 최초 전체 화면 screenshot은 합성 이메일 마스킹이 부정확해 공개 보존하지 않고 개인정보 없는 export component 캡처로 교체했다. 최종 screenshot은 직접 시각 확인 및 가로 넘침 assertion을 통과했다.
- **BLOCKED_EXTERNAL:** U001/D073 승인된 개인정보 절차/보유·삭제 기준, hosted119→120 검토·적용/지문/실제 계정 수용. 기존 설정의 수정·선택적 공개 철회/운영자 권리 요청 링크·계정 삭제 요청 경로를 보존한다. 운영자의 실제 요청 처리/영구 삭제를 완료했다고 주장하지 않는다. 운영 SQL/메일/키/결제 미실행, 전체 DONE/VERIFIED 아님.
- 명령·소스 지문: `verification-20261124.json`. 적용·복구: `deliverables/d074-session-export-20261124/README.md`. 이전 문서의 옛 migration 번호·UI 연결 주장은 이번 실제 소스/증거와 구분해 보존한다.

DEV-A의 최종 미커밋 소스 정적 리뷰: 추가 blocking finding 및 공유 파일 변경/번호 예약 없음. 현재 세션/actor/quota·consume 보존을 확인했고 JWT 즉시 전역 폐기는 주장하지 않는 범위로 합의했다.
