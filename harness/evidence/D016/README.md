# D016 — 별도 승인과 관리자 TOTP

DEV-A · 2026-11-19 KST · root HEAD 4437eb1 / codex/dev-a-p0-continue (미커밋)

SQL 004, admin-security/admin helper, 관리자 API·화면 게이트와 TOTP 등록/재인증을 구현했다. DB 역할+유효 승인+검증된 AAL2+최근 15분 TOTP AMR를 요구한다. 토큰 refresh iat는 재인증이 아니다. 승인/철회 RPC는 public/anon/authenticated/service_role 실행을 철회하고 DB 소유자만 허용한다. 승인 근거·기한·DB 실행 주체와 감사 이력을 저장한다.

일반/미승인/철회/만료/AAL1/오래된·미래 AMR/계정 불일치/공급자 장애를 검증했다. 실제 로컬 Auth의 신규 TOTP 등록과 OTP 확인을 desktop/mobile로 완료했다. 시간 변형 REST JWT는 합성 로컬 증표로 구분한다. [공통 결과](../DEV-A-P0-CONTINUE/verification.json), [직접 REST](../DEV-A-P0-CONTINUE/local-security.json).

**LOCAL_VERIFIED**: U008 외부 설정·사용자가 확정한 운영자 신원/승인·DEV-B 리뷰·실제 URL 검증 전 DONE이 아니다. 외부 권한을 부여하지 않았다.
