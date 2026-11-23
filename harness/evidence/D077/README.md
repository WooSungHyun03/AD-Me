# D077 — 웹 보안·외부 URL·파일 경계 (2026-11-22)

상태: 구현·로컬 검증 완료. **Toss 실제 결제창은 TEST 클라이언트 키가 없어 BLOCKED**(SDK 도메인 허용·로드만 확인).

## 변경
- `next.config.ts`:
  - **CSP**를 추가했다. `default-src 'self'`, 외부 출처는 Toss TEST(`https://*.tosspayments.com`: script·connect·frame·form-action)와 Supabase origin(REST/Auth/Storage + Realtime ws)만 허용한다.
  - `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`. 운영(https 백엔드)에서는 `upgrade-insecure-requests`.
  - 개발 모드에서만 `'unsafe-eval'`(Next 문서 기준).
  - 헤더 추가: COOP `same-origin-allow-popups`(결제 팝업 opener 유지), CORP `same-origin`, 운영 HSTS 2년, Permissions-Policy `payment=(self)`.
  - `/api/*` 응답 `Cache-Control: no-store`.
  - 타협(`shortcut:` 표기): 정적 페이지 유지와 인라인 style 119곳 때문에 `'unsafe-inline'`을 쓴다. 사용자 HTML을 렌더하게 되면 `src/proxy.ts` nonce 방식으로 올린다. 현재 사용자 입력은 모두 React 텍스트로 이스케이프되고 `dangerouslySetInnerHTML`은 없다.

## 점검 결과
- **CSRF**: 모든 변경 API가 `safeOrigin`을 쓴다(Origin host 일치, Origin이 없으면 `Sec-Fetch-Site`가 cross-site인지 확인). 단위 테스트를 추가했다(유사 도메인 `adme.test.evil.test`, `null` origin 거부). Supabase 인증 쿠키는 `@supabase/ssr` 기본 SameSite=Lax.
- **Redirect**: 로그인 `next`는 고정 허용 목록(`src/lib/auth-links.ts`, 기존 테스트). Toss success/fail URL은 서버 `NEXT_PUBLIC_APP_URL` 기준.
- **SSRF·DNS rebinding**: 서버 fetch는 고정 호스트 두 곳뿐이다.
  - Supabase Edge Function(`NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/…"`).
  - YouTube API(상수 `https://www.googleapis.com/youtube/v3`).
  - 사용자 URL을 서버가 가져오는 경로가 없다. 단위 테스트가 서버 코드 전체를 스캔해 이 외의 fetch가 추가되면 실패한다. 사용자 URL fetch가 필요해지면 allowlist와 DNS 해석 고정(rebinding 방지)을 먼저 구현해야 한다.
- **외부 URL·XSS**:
  - DB 제약으로 `messages.url`과 `reports.source_url`은 `https://`만 허용된다.
  - 프로필 `social_url`·`portfolio_url`은 렌더 시 `https://` 확인 후에만 링크로 만든다.
  - 모든 외부 링크에 `rel="noopener noreferrer"`. React 19는 `javascript:` URL을 차단한다.
- **파일**: D027(magic bytes 검사, HTML·SVG·활성 PDF 차단, private bucket, 첨부 다운로드, 60초 URL).
- **의존성**: `npm audit`(dev 포함) 0건(2026-11-22).

## 검증
- `tests/web-security.test.ts`(vitest 3건): CSP 지시어·외부 출처 허용 목록(와일드카드 `*`·`https:` 금지), 서버 fetch 고정 호스트 스캔, CSRF origin 판정.
- `tests/e2e/csp.spec.ts` desktop·mobile PASS:
  - 홈, 탐색, 요금제, 캠페인, 로그인, 로그인 후 대시보드(Realtime 배지)에서 CSP 위반 0건.
  - Toss SDK(`js.tosspayments.com/v2/standard`, 200)는 위반 없이 로드된다.
  - 임의 외부 스크립트(`example.com`)는 `script-src` 위반으로 차단된다.
- 전체 E2E 40/40(인증·비밀번호 재설정·알림 realtime·업로드·결제 페이지 포함, CSP 적용 상태), vitest 71/71, lint·typecheck PASS.

## 남은 범위
- Toss TEST 키를 받으면 결제창을 CSP 상태에서 실제로 확인해야 한다(U 티켓). 결제창 iframe 도메인이 `*.tosspayments.com` 밖이면 frame-src 추가가 필요하다.
- 운영 배포 후 실제 응답 헤더 재확인은 D088.

## 상대 담당 인터페이스
- D076(DEV-A): 보안 정책 문서의 CSP 허용 출처 목록 = Toss TEST·Supabase 프로젝트 origin만.
