# D013·D074 운영자 검토 인계 — 2026-11-24

신규 SQL120 `supabase/migrations/20261124124402_privacy_session_reauthentication.sql`과 현재 세션 기반 export 앱 변경의 검토 패킷이다. 운영 적용 승인이 아니다. 새 키/환경변수·유료 자원 없음.

- 선행: 검토된119 전체 스키마·대상 지문·백업/복구·U001/D073 절차 확인. 옛 운영 ledger41에120만 단독 적용하지 않는다. 기존 패킷/적용 SQL은 불변이다.
- 순서: 대상/백업 승인→120을 transaction으로 적용→자기 계정 fresh 성공/old current AMR·철회 session·반대 계정 거부→지문이 일치하는 앱 배포→실제 desktop/mobile 설정/다운로드·1회·메일/탈퇴 회귀. ordinary main push와 hosted DB 적용 승인은 별개다.
- DB는 기존 create_privacy_export signature/15분 hash ticket/24h5건/다운로드·로그를 보존한다. private helper는 공개 실행 불가. 권한을 추가로 열거나 JWT/session 검사를 제거하지 않는다. 기존 티켓은 원래 만료·일회 규칙대로 유지된다.
- D013은 signOut 성공·실패를 구분하며 실패 시 재시도 안내를 표시한다. global refresh 철회 검증이며 이미 발급된 모든 access JWT의 즉시 무효화를 보장한다는 정책 문구를 사용하지 않는다.
- 실패: 반출을 중단하고 호환 앱으로 롤백하되120 DB gate는 유지한다. 원래 account-wide 재인증으로 DB를 되돌리지 않고 forward fix한다. 사용자/협업/티켓 기록을 삭제하지 않는다.
- 증거: `harness/evidence/D013/SESSION_LIFECYCLE_20261124.md`, `harness/evidence/D074/SESSION_EXPORT_20261124.md`와 verification·desktop/mobile 캡처. 로컬 합성 환경의 실제 Auth/DB 결과이며 hosted 계정/SMTP/운영 검증이 아니다.
