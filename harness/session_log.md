# Persistent Agent Session Log

## Initialization
- Created starter harness, docs, logo, and synthetic fixtures.
- Next step: implement Next.js application tasks from `tasks.json`.
- **Evidence status:** baseline harness can be validated. Application tests are not yet run because application code has not been generated.

## Sessions
Append entries: date/time, task ID, source changes, command outputs, screenshots, defects, remaining blockers, next action.

- `2026-11-19T01:51:32+00:00` START T001 Next.js strict TS 프로젝트 및 npm 실행계약 생성

- `2026-11-19T02:10:46+00:00` DONE T001 evidence: Next 16.4.6; lint/typecheck/build passed; actual DB Playwright desktop/mobile 4 passed (40.0s), 2026-11-19.

- `2026-11-19T02:10:47+00:00` START T002 AD Me 디자인 토큰 헤더 로고 반응형

- `2026-11-19T02:10:47+00:00` DONE T002 evidence: Original logo+symbol; desktop/mobile screenshot output/playwright/home-*.png; responsive browser E2E 4 passed.

- `2026-11-19T02:10:47+00:00` START T003 Supabase 타입 스키마 마이그레이션 RLS

- `2026-11-19T02:20:47+00:00` DONE T003 evidence: Supabase ivtdfioypmzknlhinstg core+operations migrations applied, all private tables RLS; tests/security.mjs passed privilege escalation/foreign-owner/forged-entitlement/admin audit checks.

- `2026-11-19T02:20:47+00:00` START T005 Synthetic 48명 8캠페인 DB seed

- `2026-11-19T02:20:47+00:00` DONE T005 evidence: Actual SQL counts: 48 DEMO creators, 8 DEMO campaigns; seed inserts use unique seed IDs and ON CONFLICT; public browser discovery verified actual DB.

- `2026-11-19T02:20:47+00:00` START T004 브랜드 크리에이터 인증/역할/설정

- `2026-11-19T02:20:47+00:00` BLOCKED T004: Login, roles, owner profile and persisted sessions pass local/deployed E2E. Full self-signup email delivery BLOCKED by Supabase default SMTP organization-only delivery; custom SMTP or approved OAuth needed. No auth security bypass.

- `2026-11-19T02:20:47+00:00` BLOCKED T018: Toss TEST keys ready per user but browser DOM/screenshot/navigation tools fail with timeoutMs internal error. Actual key retrieval/registration not possible yet; SDK UI and missing-key errors verified.

## 2026-11-19 / implementation and live deployment
- Bootstrapped Next 16.4.6 / React 19.3.1 / strict TS / Tailwind 4 / Supabase SSR / Zod / Toss v2.
- Preserved original Harness, logo and synthetic fixtures. Original wordmark + symbol appear on desktop/mobile.
- Created actual Supabase AD Me Seoul project ivtdfioypmzknlhinstg with user organization approval. Core/operations SQL migrations, RLS, private Storage bucket, idempotent fixture seed applied.
- Actual DB seed counts: 48 DEMO creators, 8 DEMO campaigns. Disposable QA credentials are ignored local files; no credentials in public source.
- Local initial gates: lint/typecheck/build success; Vitest 11 then 12 tests pass; Playwright 4 desktop/mobile pass. Extended six-case suite adds application, account settings, CSV, saved state and admin UI.
- Direct Supabase security tests PASS: foreign-owner campaigns/orders/messages, role escalation, forged paid entitlement, state transitions, admin report review and audit.
- DB-only transactional check PASS: finalize idempotency, payment mismatch rejection, active HOT selection and expiry. All test paid orders rolled back. This is NOT Toss provider payment evidence.
- Defects fixed: same-origin comparison against internal Next hostname blocked valid POSTs; fixed to browser Host + origin check. Select/textarea accessible names made explicit for stable form automation. Harness selftest assumed first task had no evidence; fixed test fixture to explicitly clear evidence.
- GitHub push: de3fa86 initial application source, public WooSungHyun03/AD-Me. Pre-push scan found no secret/private account files.
- Vercel MCP create 403, env 404; same team CLI fallback succeeded. GitHub automatic linking failed, direct CLI deploy succeeds.
- First Vercel deploy READY but Other preset served 404; explicitly configured Next.js in vercel.json and redeployed. Public URL https://ad-me-topaz.vercel.app returned HTTP 200.
- Actual public URL Playwright 4/4 passed in 48.5s: desktop/mobile search, comparison, history, draft tools, pricing missing-key path, two-role DB workflow, cross-user denials, result submission/approval, order manipulation denial.
- Provider blockers: browser APIs fail with timeoutMs error despite reset and documented fallbacks; user authorizes reading/registering TEST keys but key retrieval unavailable. No actual Toss payment is claimed. Supabase SMTP external self-signup delivery remains unverified.
- Remaining scope and exact external actions: docs/PROJECT_STATUS.md.

## Final hardening and release evidence
- Local final gates passed: lint, strict typecheck, Vitest 12/12, Harness selftest 5/5, production build, desktop/mobile E2E 6/6 (57.5s).
- Actual DB JSON-contract migration added to reject malformed public profile/campaign DTOs through direct PostgREST. Direct authenticated malformed-campaign insertion was rejected; RLS security script passed again.
- Profile deletion now clears public profile information and unpublishes while retaining collaboration references; E2E covers deletion, draft campaign deletion and logout.
- Extended UI includes campaign edit/status, account name, SNS/portfolio links with owner consent, follower filters, restored saved state, CSV formula neutralization, admin moderation and paid HOT DTO.
- GitHub Actions validation succeeded: https://github.com/WooSungHyun03/AD-Me/actions/runs/44444025538 . Initial run failed due Harness selftest fixture state; fixed rather than skipped.
- Runtime error-log query: Vercel returned no log entries for the requested 30-minute window. This is a bounded query, not a claim of permanent error-free operation.
- Seed executed again; actual counts remain 48 DEMO creators and 8 DEMO campaigns.

## Final public verification — 2026-11-19
- Deployment: dpl_F3ChhRiasCKtfDEA3rwsqdd4eGgR, application commit 76cdc15, target production, READY.
- Verified public alias: https://ad-me-topaz.vercel.app . Home/signup/login/creators/campaigns/pricing/compare returned HTTP 200. Compare provenance labels checked on final release.
- Final actual-public-URL Playwright: **6 passed (1.2m)**, desktop and mobile. Logout now waits for the server action's home navigation before asserting protected-page denial. Prior failed race preserved in history and fixed.
- Current CI success: https://github.com/WooSungHyun03/AD-Me/actions/runs/44444318158 . No failing checks claimed as success.
- QA-created public campaigns closed after testing; creator public profile removed through tested API. Disposable accounts and historic collaboration/payment-test records remain private for reproducibility; no paid provider transaction or live payment occurred.
- Final blockers remain: Toss TEST keys not retrieved/registered because browser control is broken despite explicit user permission; external email signup delivery needs SMTP; Vercel GitHub auto-link needs provider repository authorization. Core public deployment and existing-account workflows are verified.

## Supabase connection follow-up audit — 2026-11-19
- Supabase connection confirmed usable; all 13 public-schema tables have RLS enabled. Latest GitHub Actions run 44444572147 succeeded.
- Rechecked official changelog and security advisors. Existing warnings remain documented: intentionally callable guarded SECURITY DEFINER RPCs and default leaked-password protection setting. Remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . No security protection disabled.
- Security re-run initially failed because final QA cleanup had closed every draft campaign. Fixed the test to create its own private draft fixture and remove it after verification, rather than relying on previous E2E state. Re-run passed real database authorization checks.
- No application code or hosted schema changed in this follow-up; deployment remains the previously browser-verified release. Toss browser/key retrieval and SMTP/Git provider blockers unchanged.

## 2026-11-19 — 실서비스 전체 티켓·2인 공수 배분

- 현재 코드/PRD/Harness/검증 이력을 대조하고 공식 YouTube·Meta·TikTok·Toss·개인정보위·국세청 자료에 따라 수집/운영 가능성과 조건을 검토했다.
- `docs/REAL_SERVICE_TICKETS.md`, `harness/service_backlog_v2.json`, 구조 검증 스크립트 추가. 개발 88개·438SP(DEV-A/B 각219), USER 외부 작업20개, 보류6개. 각 개발 티켓에 완료 기준·검증·선행 조건 포함.
- 무료 실제 데이터 베타와 격리 TEST 결제 기준을 적용하고 AGENTS/README/PRD/STATUS/DECISIONS의 우선 규칙을 갱신했다. 기존 작업 증거는 보존했다.
- `python3 harness/validate_service_backlog.py` PASS: 중복/누락/의존성 순환 없음, PRD116/116 및 기존40/40 매핑, 전체/우선순위별 공수 균형 확인. 이는 제품 기능 테스트 통과가 아니다.
- 이번 요청은 분석·티켓팅이므로 신규 기능·실제 크롤링·키 조회/등록·클라우드 변경·배포를 실행하지 않았다.

## 2026-11-19 — 사용자 외부 작업 상세화·개발 A/B 바이브코딩 명세

- 사용자 요청 20개 U 작업을 개별 실행 명세로 작성: 준비물·외부 콘솔 절차·증거·검증·실패/복구·공식 참고 포함. 계정 설정/키 등록/배포가 실행된 것으로 표시하지 않았다.
- 개발자 A 43개·B 45개(각219SP)의 모든 티켓에 코드 위치·신규 경로·구현 계약·부정 시나리오·검증·선행/후속 인계를 명시했다. 공유 DB/API 계약·교차 리뷰·릴리스 산출물·외부 게이트를 별도 문서로 제공했다.
- 현재/예정 환경변수 계약·값 없는 manifest·미완료 runtime 원장을 추가했다. NEXT_PUBLIC_APP_URL은 현재 선언만 되고 사용되지 않으며, 신규 인증 콜백/수집기는 아직 구현 전임을 표시했다.
- 구형 loop.py는 D/U를 지원하지 않으므로 AGENTS 지시를 바로잡았다. 이전 자동 배포 안내는 역사 자료로 옮기고 사용자 전담 runbook 진입점으로 교체했다.
- 공식 Supabase SMTP/redirect/secret·Vercel env/플랜·Toss/YouTube/Meta/TikTok 자료 확인. 무료 B2B 베타가 Vercel Hobby 개인 비상업 조건을 자동 충족한다고 단정하지 않도록 U005에 적합성 확인 게이트 추가.
- 문서 검증 PASS: 개발88·사용자20 전체 커버, 배분·내부 링크·설정 consumer·manifest 일치, 원 PRD116/구 Harness40 연결 유지, git diff whitespace 검사 통과. 이는 제품 기능의 신규 실행/배포 완료 증거가 아니다.
- 로컬 문서/검증 도구만 작성했으며 비밀값 조회·등록·실제 수집·클라우드 변경·push·배포를 수행하지 않았다.

## 2026-11-19 — 외부 U001~U020 직접 실행 요청

- 사용자가 외부20개 직접 실행을 명시하여 이전 USER-only 기술 실행 제한을 이번 작업에서 변경했다. 계정 본인 인증·법적 수락·유료 결정·타인 참여 동의는 미대행.
- 실제 원격 변경: GitHub main checks/review/conversation/force-delete 보호, Vercel framework null→nextjs·Node26→22·npm ci/build, Supabase Auth localhost→실제 origin·exact redirect 두 개. 각 GET/diff로 재검증했다.
- 운영자 우성현·지원 이메일 2242798@donga.ac.kr은 사용자 제공. privacy에 반영 후 preview dpl_2pFfuPbkPZxRvJS5H7SGShybcQ6M 및 production dpl_FqrtgkPAXTM7EXs1eRNCHKCjieEf READY. 공개 alias /privacy HTTP200·실제 브라우저에서 연락처 확인. 신규 실제 데이터 서비스 출시가 아닌 기존 시연 서비스 유지보수다.
- lint/typecheck/Vitest12/build PASS; 기존 공개 desktop/mobile E2E6/6 및 직접 DB 권한 검사 PASS. 시연 데이터 기반 기존 흐름 검증이며 SMTP 신규 가입·Toss provider 거래는 미검증.
- 실제 조회: Supabase ACTIVE_HEALTHY·서울·기존3 migration·결제function ACTIVE·public13테이블RLS·private Storage, paid orders0. 제공 backup 목록 null/PITR false. Vercel Hobby·Git link null·Supabase env2개; Toss secret 미등록.
- GitHub-Vercel 연결 재시도 권한 오류. CUA 바인딩/초기화/DOM/스크린샷 대체에도 timeoutMs 오류. SMTP/Google/Toss 등 계정·자격증명/심사·참가자 동의 미확보. 임의 승인·키 생성·유료 전환 없음.
- 전체20개 정확한 상태를 docs/EXTERNAL_EXECUTION_STATUS.md 및 evidence/external-20261119/ticket-results.json·runtime-status.json에 기록. 무료 실제 베타 NO-GO 유지. 테스트가 만든 공개 QA 모집 캠페인만 소유권/제목 한정으로 종료 정리했다.

## 2026-11-19 — be-celeb.org 도메인 연결

- 사용자가 Cloudflare 보유 be-celeb.org의 기존 웹 연결을 해제하고 AD Me로 연결하도록 명시 승인. Vercel Domains 및 Plugin Management 스킬 적용. Cloudflare 전용 플러그인 검색 결과 없음, CUA는 기존 timeoutMs 오류. 그러나 기존 Vercel 도메인 소유권·DNS를 이용해 사용자 수동 작업 없이 완료 가능했다.
- 사전 DNS/프로젝트 연결 기록 저장. 기존 웹404·대상 팀 프로젝트 연결 없음. apex/www를 ad-me에 추가하고 www→apex308(경로/query 유지) 적용. Cloudflare DNS API/NS/메일 설정은 직접 변경하지 않음. 관측 A응답 차이는 별도 기록; NS/MX/SPF/www CNAME 보존·Vercel DNS valid 확인.
- Supabase Auth Site URL을 https://be-celeb.org 로 변경, exact new/legacy root/dashboard redirect 유지. declared diff0 확인. Production NEXT_PUBLIC_APP_URL 등록 후 dpl_3up1TmKNaQd66CvfzCoEKRWGwHnR READY 재배포. 변수는 현재 코드 미사용임을 문서화.
- 새 실제 URL7개경로 HTTP200·TLS·AD Me·연락처 확인, www308 확인, 실제 브라우저 homepage 캡처. E2E 결과는 별도 summary에 기록. 도메인 완료가 전체 실서비스 출시를 의미하지 않음.
- 새 도메인 실제 E2E 최종 결과: desktop/mobile 6/6 PASS (1.2m). QA 공개 모집 캠페인은 테스트 계정/이름 한정으로 종료 정리. domain-20261119/e2e-summary.json 증거 저장.
