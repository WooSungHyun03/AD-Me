# D013 — 세션 만료·재인증·로그아웃 (2026-11-19, local)

상태: 코드·단위·브라우저(비로그인 경로) 검증 완료 / 실제 만료·복수 탭 E2E 미실행 (로컬 DB 키 없음)

## 정책 (명시)
- 서버 권한: 모든 서버 경로는 `auth.getUser()`(서버 검증)로 판단 — 기존 `context()`/`currentUser()` 유지. proxy는 `getClaims()`로 쿠키만 갱신.
- 쿠키 갱신: proxy matcher(`/dashboard`,`/settings`,`/campaigns`,`/api`,`/admin`,`/auth`).
- returnTo: `safeNext()` 허용 경로만(`/auth/reset`,`/settings`,`/dashboard`,`/campaigns/new`,`/admin`), 그 외·외부 URL은 `/dashboard`.
- 재인증 완료 시점: `last_sign_in_at`이 10분 이내(비밀번호/OTP 로그인만 갱신, 토큰 자동 갱신으로는 갱신 안 됨).
- 민감 작업: 이메일 변경, 크리에이터 프로필 삭제 → 오래된 세션이면 거부(401) 후 `/login?next=/settings&reauth=1`.
- 로그아웃: `signOut()` 기본 global scope → 모든 세션 토큰 철회. 다른 탭은 다음 서버 요청에서 `getUser` 실패 → 로그인으로 이동(서버 강제, 클라이언트 동기화 없음).

## 변경 파일
`src/lib/auth-links.ts`, `src/app/actions.ts`, `src/app/api/profile/route.ts`, `src/components/{auth-form,account-auth-forms,profile-form}.tsx`, `src/app/{login,settings,dashboard,admin}/page.tsx`

## 검증
- `tests/auth-recovery.test.ts` D013 3건(10분 경계, 오래된 세션 이메일 변경 거부, returnTo 허용/거부). vitest 30/30, lint, typecheck, build PASS.
- 브라우저: 비로그인 `/settings`,`/dashboard` → 로그인 화면(next 포함), `reauth=1` 안내 표시, 모바일 가로 넘침 없음.
- 기존 E2E 영향: 프로필 삭제는 로그인 직후 10분 내 수행이므로 통과 예상 — 실행은 미검증.

## 격리 환경 실검증 (2026-11-19)
- E2E `login returns only to allowed paths` desktop·mobile PASS: `next=/settings` → /settings, `next=https://evil.example/x` → /dashboard.
- 기존 E2E 6/6(프로필 삭제·로그아웃 포함) PASS — 재인증 게이트가 정상 흐름을 깨지 않음.
