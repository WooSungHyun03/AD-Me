# D077 — 웹 보안·외부 URL·파일 경계 재검증 (2026-11-25, DEV-B)

Base: main `32ca3d1`. 격리 로컬만. 운영 응답 헤더 확인은 D088(운영자 배포 후). 이전 증빙(`../README.md`, 2026-11-22)과 구분한다.

## 재점검 결과
| 항목 | 현재 main 상태 | 근거 |
|---|---|---|
| CSP·보안 헤더 | `next.config.ts`에 CSP(`object-src 'none'`, `frame-ancestors 'none'`, Toss TEST·Supabase만 외부 허용), COOP/CORP, Permissions-Policy, 운영 HSTS 유지 | `tests/web-security.test.ts` |
| CSP 런타임 | 홈·탐색·요금제·캠페인·로그인·대시보드 realtime 위반 0, Toss SDK 로드, 임의 외부 스크립트 차단 | 빈 DB `tests/e2e/csp.spec.ts` desktop·mobile PASS (`../../D085/20261125/ci-db-after.txt`) |
| CSRF | 변경 API는 `safeOrigin`(유사 도메인·`null` origin·cross-site 거부) | `web-security.test.ts` |
| 리다이렉트 | 로그인 `next` 허용 목록 | `tests/auth-links.test.ts` |
| XSS | `dangerouslySetInnerHTML` 0건, 외부 링크는 https 확인 후 렌더 | `grep` 결과 0 |
| SSRF·DNS rebinding | 서버 fetch는 고정 호스트(Edge Function, YouTube API, 내부 API)만. 사용자 URL을 가져오는 곳은 승인 정책 기반 `src/lib/ingestion/web.ts`뿐(호스트·경로 allowlist, 공인 IPv4만, DNS 결과 고정, 리다이렉트 불추종, 5초 타임아웃) | `web-security.test.ts`, `tests/approved-web.test.ts` |
| 파일 | D027 재검증 TESTED | `../../D027/20261125/README.md` |
| 의존성 | `npm audit` 운영·전체 모두 0건 | `npm-audit-prod.json`, `npm-audit-all.json` |

## 발견·수정
- 회귀 가드 사각지대: 기존 스캔은 `fetch(`/`f(` 호출만 검사해 `node:https`·`undici` 같은 원시 HTTP/소켓 클라이언트가 추가되면 SSRF 검토를 우회할 수 있었다.
- `tests/web-security.test.ts`에 원시 네트워크 import(`node:http(s)`, `http2`, `tls`, `dgram`, `undici`, `axios`, `got`, `node-fetch`, `net.connect` 등)는 `src/lib/ingestion/web.ts`에서만 허용하는 검사를 추가했다.
- 변이 확인: 임시 `src/lib/zz-ssrf-probe.ts`(`node:https` import)를 넣자 FAIL했고, 제거하자 PASS했다.

## 결과
- `vitest.txt`: web-security·approved-web·auth-links·api-errors PASS.

## 남은 게이트
- Toss 실제 결제창을 CSP 하에서 여는 확인은 TEST 키 등록(U015/U006) 전까지 **BLOCKED**.
- 운영 응답 헤더 실측은 D088.
