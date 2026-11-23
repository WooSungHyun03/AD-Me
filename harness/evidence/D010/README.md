# D010 — 비밀번호 재설정·이메일 변경 (2026-11-19, local)

상태: 코드·단위·브라우저 검증 완료 / **실제 메일 링크 E2E 미검증** (SMTP 미설정 블로커, U007)

## 구현
- `src/lib/auth-links.ts` [신규]: `appUrl()`은 `NEXT_PUBLIC_APP_URL`(없으면 Vercel `VERCEL_PROJECT_PRODUCTION_URL`)로만 메일 링크 생성 — Host 헤더 오염 차단. `safeNext()`는 `/auth/reset`,`/settings`,`/dashboard`만 허용.
- `src/app/auth/confirm/route.ts` [신규]: `token_hash+type`(verifyOtp) 또는 `code`(PKCE) 처리. 실패·재사용·만료 → `/login?error=link`. recovery 검증 시 해당 user id에 묶인 httpOnly 쿠키(10분).
- `src/app/actions.ts`: `requestPasswordReset`(계정 존재 여부와 무관한 동일 응답), `updatePassword`(recovery 쿠키 == 현재 user일 때만, 성공 후 쿠키 삭제·다른 세션 로그아웃), `changeEmail`(로그인 필요, 확인 링크 경유).
- 화면: `/auth/forgot`, `/auth/reset` [신규], 로그인에 재설정 링크·만료 안내, 설정에 이메일 변경 폼. proxy matcher에 `/auth` 추가.

## 사용자 콘솔 적용 (Supabase Auth)
1. URL Configuration → Redirect URLs에 `https://<배포도메인>/auth/confirm` 추가.
2. Vercel env `NEXT_PUBLIC_APP_URL=https://<배포도메인>`.
3. (권장) Email Templates의 Reset password / Change email 링크를 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`(이메일 변경은 `type=email_change&next=/settings`)로 — 다른 기기에서 열어도 동작. 기본 템플릿(PKCE code)은 요청한 같은 브라우저에서만 동작.
4. Secure email change(기존·새 주소 모두 확인) 활성 유지.

## 검증
- `tests/auth-recovery.test.ts` 8건: 외부/프로토콜 상대 리다이렉트 거부, 설정 origin만 사용, 존재/미존재 동일 응답, 재사용 링크 거부(외부 next 무시), recovery 사용자만 표식, 비recovery·다른 계정 비밀번호 변경 거부, 성공 시 표식 삭제·타 세션 로그아웃, 이메일 변경 로그인 필요.
- lint / typecheck / vitest 24/24 / build PASS. 브라우저 데스크톱·iPhone 13: 3개 화면 렌더, 가로 넘침 없음.
- 미검증: 실제 메일 수신→링크→새 비밀번호 로그인·기존 비밀번호 거부 (SMTP·키 필요). 

## 격리 환경 실검증 (로컬 Supabase Auth + Mailpit, 2026-11-19)
- `tests/e2e/auth-recovery.spec.ts` (MAILPIT_URL 있을 때만 실행) desktop·mobile **4/4 PASS**:
  미존재/존재 계정 동일 응답 → 링크 없이 `/auth/reset` 거부 → 실제 메일 링크(PKCE code) → 새 비밀번호 → 대시보드 → 같은 링크 재사용 시 `otp_expired`로 `/login?error=link` → 이전 비밀번호 로그인 실패, 새 비밀번호 성공.
- 실서비스 SMTP 배달은 여전히 미검증(U007).
