# D016 — 별도 승인과 관리자 TOTP

DEV-A · 2026-11-19 KST · root HEAD 4437eb1 / codex/dev-a-p0-continue (미커밋)

SQL 004, admin-security/admin helper, 관리자 API·화면 게이트와 TOTP 등록/재인증을 구현했다. DB 역할+유효 승인+검증된 AAL2+최근 15분 TOTP AMR를 요구한다. 토큰 refresh iat는 재인증이 아니다. 승인/철회 RPC는 public/anon/authenticated/service_role 실행을 철회하고 DB 소유자만 허용한다. 승인 근거·기한·DB 실행 주체와 감사 이력을 저장한다.

일반/미승인/철회/만료/AAL1/오래된·미래 AMR/계정 불일치/공급자 장애를 검증했다. 실제 로컬 Auth의 신규 TOTP 등록과 OTP 확인을 desktop/mobile로 완료했다. 시간 변형 REST JWT는 합성 로컬 증표로 구분한다. [공통 결과](../DEV-A-P0-CONTINUE/verification.json), [직접 REST](../DEV-A-P0-CONTINUE/local-security.json).

**LOCAL_VERIFIED**: U008 외부 설정·사용자가 확정한 운영자 신원/승인·DEV-B 리뷰·실제 URL 검증 전 DONE이 아니다. 외부 권한을 부여하지 않았다.

## 2026-11-20 main compatibility — D016
- Additive 202611200006_ops_mfa.sql preserves private implementations and public invoker wrappers. Profile admin alone cannot become operations super; approved current grant plus OTP <=15min is required.
- Delegated staff approval expires after 7 days (console owner approval max90 days); historical role-only rows fail closed. Fresh super can invite/revoke scoped roles; browser cannot grant super or change own role. No implicit profile elevation.
- Own enrollment RPC discloses only own approved role. Delegated staff can use existing local Auth OTP enrollment without classic admin permissions.
- Verified isolated PostgreSQL+direct PostgREST: 5 operation security groups PASS, upstream intelligence/ownership SQL transactions PASS, previous13 security groups PASS; unit admin14 PASS; typecheck PASS. Synthetic signed JWT tests are contract tests, not provider verification. Desktop/mobile OTP regression follows in D084 evidence.
- State remains IN_PROGRESS pending integrated browser/final gates and external approval/MFA settings. USER must apply ordered migrations; no hosted changes made.

## Final 2026-11-20 integrated local verification
- Actual local Auth delegated OTP enrollment/verification and scoped operations desktop/mobile PASS, alongside classic admin and opposite-role denials. Shared evidence DEV-A-MAIN-20261120/verification.json. No hosted MFA settings changed; external/cross-review gate retained.
