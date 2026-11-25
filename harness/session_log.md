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

## 2026-11-19 — Resend·가입/복구·YouTube·실제 Toss TEST·격리 복원

- 사용자 제공 비공개 파일을 메모리/표준입력으로 소비, 키 값을 출력하지 않음. Resend 도메인 verified·도메인 전용 발신 키·SMTP TLS 로그인, Supabase 최소 Auth 설정/한국어 템플릿 push 및 diff0 확인. 새 인증 라우트 배포 후 템플릿 전환.
- 실제 사용자 메일 confirmation/recovery delivered; 사용자가 인증 버튼 완료, DB email_confirmed·brand 프로필 확인. 복구 POST의 증표/유형/비밀번호 확인·GET 미소비·redirect/privacy 가드 구현. 사용자 최종 비밀번호 변경 확인은 대기.
- Toss 혼합 키를 발견해 요청 후 API 개별 연동 TEST 세트로 수정 등록·재배포. 사용자가 직접 TEST 약관/인증, provider GET order DONE·49000·주문 일치 확인. 서버 paid/30일 이용권 활성화, finalize RPC 두 번 재실행 동일 ID·count1 확인. 공급자 가짜 성공/수동 paid 조작 없음.
- YouTube 실제 공식 채널 ID1건 조회 성공·서버 Secret 등록. 실제 인플루언서 수입0, 정책/쿼터·restriction 콘솔 증거/수집 어댑터 미완료. Chrome 제어 오류 지속, 사용자 Google 설정/키 입력 협조.
- public/Auth/Storage 덤프·원본 보존·pg_attver 복원용 정규화·스키마 의존 트리거 지연 적용으로 네트워크 none 임시 PG17 격리 복원. table13/RLS13/FK22/orphan0/Auth5/Storage0 확인 후 컨테이너/볼륨 제거. 여러 시점 덤프, 실제 결제 전 백업이며 정기/원격/암호화 재해복구 완료 아님.
- lint/typecheck/Vitest35/Python5/build PASS, local E2E10/10·production E2E10/10. 최초 결제 상태 기대값 실패1건 및 인증 locator 충돌은 수정 후 재실행. 상세 증거 docs/AUTH_PROVIDER_EXECUTION.md 및 providers-20261119/summary.json. 전체 U20 및 실제 데이터 베타 완료로 표시하지 않음.

- 최종 소스 36327d7 업로드·dpl_9uQy4CiWiW9FV1E9ABqiu788cyfL READY 배포 및 실제 복구 UI desktop/mobile HTTP200 확인. GitHub Actions2개 성공. Toss provider 동일 Idempotency-Key 재승인 HTTP200·DONE·동일결제 반환. 익명/인증 사용자의 직접 finalize RPC 권한 false 확인.

## 2026-11-19 — 사용자 비밀번호 복구·재로그인 확인

- 사용자가 복구 메일에서 새 비밀번호를 설정한 뒤 재로그인 성공을 직접 보고했다. providers 증거의 사용자 확인을 true로 갱신하고 D010/U008/U019 및 외부 실행 기록의 해당 대기 조건을 해제했다. 이메일 변경·관리자 MFA·SNS OAuth 등 별도 미완료 범위는 유지했다. 비밀번호 수집·재입력·재발송 및 재배포는 수행하지 않았다.

## 2026-11-19 KST — DEV-A 로컬 구현 및 인계

- 원본 main 4437eb1 확인 후 v2 문서와 이전 인증을 포함하는 d1b2aa5 기준으로 별도 로컬 브랜치에서 작업했다. 최신 요청에 따라 배포·외부 콘솔·키 등록은 사용자 관할이다.
- D003 서버 설정과 진단, D004 오류 v1, D002/D008/D065 무료 상품·TEST 앱/Edge 가드, D009 이메일 토큰 흐름과 재발송을 수정했다.
- D007 잠금 의존성 506개 및 브랜드·데이터 목록을 작성했다. D028 공식 링크 정규화/공개 공유/클릭 후 임베드, D018/D041 독립 데이터 계약, D064 운영 초안을 기록했다.
- 캐시 버전으로 lint, typecheck, Vitest 80/80, Harness 5/5 및 구조·시연 데이터 검사 통과. Chrome 정적 렌더링 1440px·390px에서 5개 화면씩 확인했다. 기본/대체 빌드와 전체 E2E는 도구 및 설정 차단을 기록했다.
- 실제 제공자 재검증, DB 마이그레이션·RLS 회귀 및 신규 배포는 미완료다. U/DEV-B 상태와 v2 백로그 원본을 보존했으며 수용 기준 미충족 티켓은 DONE으로 바꾸지 않았다.
- 증빙은 `harness/evidence/DEV-A-LOCAL/verification.json`과 티켓별 디렉터리, 콘솔 적용과 DEV-B 변경 계약은 `docs/handoff/DEV-A_LOCAL_PACKET.md`에 남겼다.


## 2026-11-19 KST — DEV-A P0 후속 구현·격리 검증

- root HEAD 4437eb1의 기존 dirty 변경을 보존하고 codex/dev-a-p0-continue에서 이어갔다. 첨부 폴더에 공유 계약이 없어 저장소 계약을 읽었다. 별도 dev-a-local 체크아웃을 삭제하지 않고 루트 검사/추가/배포에서 제외했다.
- 정확한 npm 잠금 설치 후 Node 22로 검증했다. D012 브랜드 공개 DTO/담당자 분리·원자 저장·공유/철회, D016 별도 승인/만료/철회/TOTP 등록·15분 재인증/API+DB 게이트, D059 별도 운영 잠금·사유 감사·직접 REST 및 재공개/삭제 우회를 구현했다. SQL004~007 additive 준비, 이전 적용 SQL 변경 없음. D027 로고 업로드는 미제공으로 유지했다.
- Vitest115/13files, 직접 로컬 REST13, 실제 로컬 DB/Auth/TOTP/Mailpit 운영 빌드 E2E18/18, 무료 모드 운영 빌드 E2E4/4, 최종 lint/typecheck/test/build 통과. 신규 메일은 Mailpit 수신만 검증했으며 외부 SMTP/Toss 제공자·실제 수집 검증으로 주장하지 않는다. 인증 trace/키/메일 원문을 공개 증빙에서 제외했다.
- 개발 서버 HMR/HTTP 운영 origin/label·status·route-announcer 경합 실패를 보존하고 운영 실행기/TLS/접근성 라벨/정확한 assertion으로 수정했다. 감사 삭제는 오류 대신 0건 반환·기록 불변을 검증했다. 실패를 skip하지 않았다.
- 패키지506개 중 정확한 설치 고지393개, 고지 원문533개 수록. 113개와 Linux/Edge·브랜드 권리는 미완료. 콘솔 SQL을 두 번째 격리 DB에서 적용해 migration history4/RLS4/권한 false3 검증, 오프라인 SQL 도우미의 인용부호 처리·실제 승인/철회·외부 요청0 확인.
- 사용자 외부 적용 패킷과 티켓별 증거를 준비하고 runtime의 DEV-A 항목만 갱신했다. U/DEV-B/원본v2 및 과거 증거 보존. 외부 계정·키·콘솔·push·배포 미실행. P0 전체 및 외부 게이트 미완료로 NO-GO 유지, 이번 티켓도 DONE으로 올리지 않았다. 다음 독립 구현은 D076 및 D017/D018/D041 인계 범위를 따른다.

## 2026-11-19 KST — DEV-A 티켓별 커밋 분리

- 사용자 요청으로 DEV-A 구현을 15개 티켓 커밋으로 분리했다. 원본 문서/외부 연동 이력 6개를 별도 체크아웃에서 로컬로 복원해 원래 SHA를 보존했다. codex/pre-ticket-split-20261119가 원래 루트 HEAD를 보존한다.
- 파일 내용 313개 해시 일치 확인. 공유 파일은 index blob 단계에서 분리했고 각 커밋 추출 트리 typecheck15/15, 최종 커밋 추출 트리 단위115/115 통과. 미완료 상태와 외부 차단은 유지, push·배포·계정/키 변경 없음.
- 커밋 목록·파일별 경계·검증은 docs/handoff/DEV-A_TICKET_COMMITS.md 및 harness/evidence/DEV-A-P0-CONTINUE/ticket-commits.json. 기존 적용 ZIP과 과거 검증 결과는 소급 변경하지 않았다.

## 2026-11-20 — 운영 콘솔, YouTube 수집과 로컬 AI

- main을 기존 인증·결제 브랜치로 fast-forward해 이전 운영 기능을 포함했다. 이후 관리자 운영, 공식 API 수집, 로컬 초안, 소유권 공개 조건을 검증하며 main에 커밋했다.
- 롤별 DB 권한 및 사용자의 AI 작업 읽기 경계를 검증했다. 공개 데이터는 운영 승인·본인 인증·공개 동의·공개 프로필을 모두 요구한다.
- 로컬 Ollama CPU 4스레드로 한국어 구조화 응답과 임베딩을 실제 생성했다. 워커는 Supabase에 전용 인증으로 연결한다. Vercel에서는 로컬 추론 포트에 연결하지 않는다.
- 운영 Supabase 첫 일일 작업 성공. 실존 채널 6개·공개 영상 메타데이터 29건. 공개 채널 0개. GitHub 기존 관리자 예외 알림과 운영 배포 검증은 docs/implementation-progress.md 참조.

- 배포 주소 전체 E2E 16개 통과. 화면 폼 보정 후 운영 스모크 4개 통과. 실제 채널 설명에 소유권 인증 문자열이 없을 경우 검증 실패, 비공개 유지와 연결 해제를 확인했다. 최종 배포 dpl_Ep82HQoU28bnTM6kQFG9ytZqWkr9 및 1262c5b Actions 성공.

## 2026-11-20 KST — DEV-A main 통합 및 P0 계속
- 원격 main65063c8의6개 새 커밋과 기존 DEV-A3182ff0의16개 커밋을 codex/dev-a-p0-20261120에서 양쪽 이력 보존 병합(69935f1). 최종 fetch에서도 main 동일 확인. 설정/관리자/로그 충돌은 양쪽 기능 유지 해결.
- D0167466c65: 새 operations 역할도 초대 승인·만료·철회·최근OTP 요구, private schema/public invoker 경계 보존. D05193ce710: 브랜드 메시지가 거부되던 RLS kind 모호성 보수. D07648e8451: 원자 쿼터/429 Retry-After/공급원 예산/자원 pause 기본OFF. D0596e36d58: YouTube 디렉터리 독립 차단 및 검색 쿼터. D0080aa6dd3: main 큐 플래그/앱·DB 연결 정합성.
- Node22 lint/typecheck/unit138/생산 build, Harness5/백로그 구조, REST28그룹+SQL3fixture, 실제 로컬 Auth 포함 desktop/mobile E2E26/26 및 keyless4/4 PASS. 초기 검사 실패와 수정은 dated verification에 보존. 실제 YouTube/LLM/SMTP/Toss/호스팅 검증으로 전용하지 않음.
- 별도 로컬 DB에서 USER SQL패킷 main기준8개 및 기존DEV-A포함기준4개 모두 적용 검증(최종16migration), 잘못된/중복 기준 차단. 예전 패킷과 증빙은 유지. 신규 source/SQL 패키지와 전달 문서 준비.
- D051/D076은 부분 구현 IN_PROGRESS. 가입/로그인 신뢰IP·Auth 제한, 기존 카탈로그/direct draft_get polling·전체 업로드/협업 등 미완료. 다른 담당/USER 원장은 변경하지 않고 모든 항목 DONE 승격0. push/외부 콘솔/키 등록/배포 없음.

## 2026-11-20 KST — DEV-A 계속: 직접 조회 제한·캠페인 조건
- 시작955bf8c/깨끗한 codex/dev-a-p0-20261120, origin/main65063c8 변동 없음. D076a4d9991: getter 내부 계정120/min, volatile public invoker, 앱은1회 RPC. D0411054bce: KST/UTC 기간·미정/현금/제품/혼합 보상·산출물/사용권/독점 조건을 생성·수정·조회·직접DB 검증까지 연결. D08135602e9: 시각검증에서 발견한 캠페인 추천의 가상 크리에이터 DEMO 표기 누락 보수.
- 신규011/012만 추가, 이전 적용 SQL 불변. legacy 캠페인 내용 유지, 새 날짜/보상을 발명하지 않음. v2 조건 누락 업데이트422, 기존 RLS/moderation 유지. 총 예산과 단가/미정은 별개다.
- Node22 unit150/18, lint/typecheck/production builds, 실제 로컬Auth E2E30/30, 무료베타·TEST키없음 조건4/4, keyless4/4 PASS. 직접REST35그룹 및 SQL3 PASS. fixture 충돌/순서·테스트 locator 수정은 dated verification에 기록. 실제 provider 호출 없음.
- USER 적용 패킷은 main8개/기존DEV-A포함12개/직전955bf8c16개 세 기준을 별도 로컬DB로 검증, 최종18 migration과 legacy hash 일치, 잘못된/중복 적용 거부 확인. 이전 두 패킷과 증거는 보존.
- D041 LOCAL_VERIFIED, D076/D081/D084 IN_PROGRESS. USER/DEV-B 원장·원본 배분 미수정, DONE 승격0. 외부 콘솔·키·push·배포 없음. 다음 미완료 범위와 적용 안내는 DEV-A_CONTINUATION_20261120B.md.

## 2026-11-20 — 남은 티켓 설명·작업 브랜치 push 요청
- 최신 사용자가 남은 티켓 설명과 티켓별 커밋·push를 명시 요청했다. codex/dev-a-p0-20261120을 대상으로 하며 main 병합·외부 설정/배포 명령은 포함하지 않는다. origin/main65063c8, 시작0d7b31f, 기존 작업 트리 clean 확인.
- DEV-A43(P0 29/P1 12/P2 2): LOCAL_VERIFIED5, IN_PROGRESS11, BLOCKED_EXTERNAL2, main 기반 PARTIAL_VERIFIED1, OPEN24, DONE0. 구현 이력18개 티켓을 Git 태그/원장과 대조해 전 범위 설명·선행·후속 우선순위를 DEV-A_PUSH_STATUS_20261120.md 및 dated JSON으로 저장했다.
- push 전 인계 검사가 Windows cp949와 worker-token 복합 consumer 경로에서 실패했다. 036c83d(D003)에서 UTF-8/실제 파일 경로+DB guard로 고치고 규칙 완화 없이 handoff/backlog/secret 검사를 통과했다. 앱 변경 없음, 이전 실제 앱 검증 unit150/E2E30+free4+keyless4/REST35 증거 보존. 원본 분배·타 담당/USER 상태 미변경.
- 기존 ZIP3개의 source_head는 역사 스냅샷으로 보존한다. 최신 메타데이터 보수와 이번 설명은 저장소 브랜치를 기준으로 한다. GitHub push 워크플로는 검증뿐이며 별도 호스팅 자동화를 배포 완료로 추정하지 않는다. 원격 ref/SHA는 push 후 확인한다.

## 2026-11-20C — 기존 브랜치 복귀·D018 정규화 저장소
- 사용자 최신 요청으로 남은 티켓 구현/티켓별 commit/push를 이어간다. codex/dev-a-p0-continue를 3182ff0에서4977225로 fast-forward해 분리됐던 모든 이력을 보존했다. 새 브랜치 생성/이력 재작성 없음. fetch 후 origin/main65063c8 유지 확인.
- D018 steward 계획에013 번호를 먼저 기록하고 private adme_creator3테이블, UUID legacy bridge, provider키 unique·시계열 nullable/출처/정책/수집시각·claim/consent 상태, 소유자 전용 invoker snapshot 및 server-only JSON 호환 adapter를 추가했다. 기존18개 migration과 원본48개 JSON은 보존했다.
- 직접 SQL/REST9그룹, 신규 unit6/전체156, 네 SQL 패킷 기준8/12/16/18→19 적용·원본hash불변·RLS/권한·wrong/duplicate 거부를 로컬에서 검증했다. 기존 UI/Auth 회귀와 실제 SQL→TS adapter 증거는 D084 후속에 저장한다. 초기 unit의 JSON 키 순서 비교는 구조 값 보존 비교로 바로잡았고 DB 원본 hash 별도 검증, skip 없음.
- D017 정책 승인·필드/목적/보존/재배포 연결 및 D019 실제 writer/main YouTube 이관·공개 read switch는 미완료다. 가상 ID/지표를 실제 데이터로 전환하거나 정책 승인을 발명하지 않았다. D018은 IN_PROGRESS, DONE0. USER/DEV-B 및 v2 원본 미수정. 외부 콘솔/키/배포 없음.

## 2026-11-20C — D084 정규화 회귀
- 실제 로컬 PostgreSQL/RPC 응답을 server-only TypeScript adapter로 읽는 별도 Vitest suite1 추가. normal unit CI는 Docker 없이156개 유지. 최초 mergeConfig 배열 병합으로157개 전체가 실행된 뒤 include를 명시 덮어쓰기로 고쳐 독립 suite1 PASS 확인.
- Node22 lint/typecheck/build, unit156/19files, 실제 로컬 Auth/DB E2E30/30 desktop/mobile, 무료베타4/4, keyless4/4, 직접 SQL/REST44그룹, SQL rollback3 PASS. 사용자 SQL8/12/16/18→19 네 기준, legacy hash불변·wrong/duplicate 거부·RLS/권한 검증. 민감 인증 trace/개인 메일/키는 공개 증거에서 제외.
- DEV-A-SCHEMA-20261120에 실행 결과와 초기 assertion/config 수정 이유를 보존했다. D018/D084 이외 runtime 항목과 USER 전체가 4977225 기준 동일함을 비교 확인. 실제 provider/출시/미구현 서비스 범위는 별도 미완료이며 DONE 승격 없음.

## 2026-11-20C — D018 사용자 적용 패키지·기존 브랜치 push 준비
- source554c681, 새 SCHEMA ZIP353파일/2,638,800bytes/SHA256 6f88d205f05462376349df26427ca51957a1805e4ee842c981593245e0f34d97. 네 기준 SQL을 제공하며 ZIP CRC·모든 source Git blob·정규화 migration hash·비밀 패턴·이전 전달 ZIP3개 hash를 검증했다. 이전 산출물은 덮어쓰지 않았다.
- 소스/회귀를 각각4fd47a9(D018),554c681(D084)로 커밋했다. 최신 전달 메타데이터와 패킷은 후속 산출물 커밋이며 소스 기준은554c681로 명시한다. 사용자 허가 범위에서 codex/dev-a-p0-continue에 push하고 원격 SHA/CI를 확인한다. main/외부 콘솔/키/배포 명령은 실행하지 않는다.

## 2026-11-20D — 첨부43개 기준 검토·D034 독립 구현
- 첨부 김태권 이번주.md와 저장소 DEV-A 지시서의 전체 내용/해시 일치 확인,43개 기준·선행·커밋·증거 경로를 대조했다. 첨부 폴더 공유 계약 부재로 저장소 계약을 읽었다. c450619 clean/기존브랜치/main65063c8 확인. 과거 완료 주장과 신규 실제 제공자 검증을 혼동하지 않았고 D051 blocker의 누락된 quota 범위를 명확히 했다.
- D034 single→multi OR/AND, URL 단일 상태/restore/reset/back/forward, 범위·0/미확보·stable sort·empty/error·키보드/모바일 구현. D033 취소/늦은 응답 계약4는 별도 미연결 adapter이며 서버 검색/공개 read switch 구현이라고 주장하지 않는다.
- Node22 unit176/21(신규20), lint/typecheck/build, keyless actual Chrome10/10(필터6+기존4) PASS. 최초 동시.next build lock은 순차 재실행으로 해결, 테스트 skip 없음. 기존 서비스 E2E의 플랫폼 selector를 실제 변경된 checkbox로 보수했다.
- D034 IN_PROGRESS, D033 연결·교차 리뷰·대상 적용은 남긴다. 공개 앱 props의 owner/raw JSON 문제는 별도 D018 보수, 직접 REST 공개 권한은 D033/D075 차단으로 기록한다. 외부 계정/키/콘솔/배포 없음.

## 2026-11-20D — D034 모바일 경합·D018 공개 앱 DTO
- 모바일 controlled checkbox가 router transition-priority URL 업데이트 전 잠깐 되돌아가는 실패를 확인했다. URL을 useSyncExternalStore로 동기 구독해 복구 경합을 제거하고 keyless10/10·실제 DB 공개탐색/DTO4/4 재검증. 네 viewport overflow/keyboard와 desktop/mobile 캡처 확인. 단순 sleep/force/재시도로 우회하지 않았다.
- D018 steward 계획을 기록한 뒤 allowlist public app DTO, unavailable=null, unconsented links 제외, private/unknown JSON 제외를 구현했다. 매칭 입력 타입만 최소 공개 필드로 분리했고 알고리즘/점수/DB/원본 JSON을 바꾸지 않았다. unit181/22, 실제 로컬 DB/Auth E2E32/32·free4/4 PASS. 초기 새E2E2건은 목록/상세 동명 heading과 URL 이동 대기 누락을 정확한 URL+level1 대기로 고쳤다.
- 앱 DTO 보수는 직접 REST published creators의 owner_id/raw profile 및 user-<Auth UUID> legacy ID 이관을 대신하지 않는다. D033/D075 연계 개발 및 D017/D019/정규화 read switch는 출시 차단으로 유지한다. 해당 범위를 사용자 소스 편집 작업으로 떠넘기지 않는다. D018 IN_PROGRESS, 외부 승인/DONE 승격 없음.

## 2026-11-20D — D084 실행 증빙 및 전달 준비
- 최종 코드의 unit181/22·local SQL/RPC→TS1·lint/typecheck/생산 build 통과. 공개 DTO 보수 후 전체 실제 로컬 Auth/DB E2E32, free4 통과. 마지막 D034 URL 동기 구독 보수 뒤 영향4와 keyless10 재검증, 공개 가상 캡처2개를 직접 확인. SQL/REST44 및 SQL rollback3 통과 범위와 미해결 직접 REST/legacy-ID 경계를 구분했다.
- 새 DEV-A-FILTERS-20261120 증빙에 initial failures/수정/검증 시점/실제 대 fixture 구분을 보존했다. 원장 변경은 D018/D034/D051/D084 네 DEV-A 항목뿐이며 USER/DEV-B/원본 배분은 동일. 상태는 LOCAL5/진행12/부분1/외부2/OPEN23/DONE0.
- 새로운 source 패킷은 기존 SCHEMA의 검증된 SQL4기준을 바이트 그대로 재사용하며 신규 migration0, 기존19개 불변이다. 이미19개 적용 환경에는 새 SQL 반복 적용이 없다. 기존ZIP4개를 보존하고 외부 콘솔/키/배포 없이 같은 브랜치 commit/push/CI 검증을 이어간다.

## 2026-11-20D — 최종 패킷·같은 브랜치 push 준비
- source06bb2c1의371파일, 새 FILTERS ZIP3,173,820bytes/SHA256 54c9010f93128e2e8d4a410574c76fcf668a13c61cd610c945123f006f4193d9. 모든 source Git blob/CRC/비밀 패턴, 기존 검증 archive와 SQL 바이트21파일 일치, 이전ZIP4개 hash불변을 검증했다. 산출물 커밋은 소스/SQL 코드를 바꾸지 않는다.
- 작업은 검토28d1d1b, D0340899fa4/2377cdc, D018eb65d37, D08406bb2c1로 분리했다. push 전 fetch에서도 origin/main65063c8 유지. 최신 검토 문서에 전체43개 착수 전 표와 실제 후속 상태·잔여 출시 차단을 함께 기록했다. codex/dev-a-p0-continue의 원격 SHA/CI를 push 후 확인하며 main/키/배포 설정은 바꾸지 않는다.

## 2026-11-20E — 소스 의존성 확인·D075 호환 읽기 경계
- 사용자 최신 요청은 소스를 참고해 기존 기능에 문제가 생기지 않는 범위에서 가능한 잔여 구현을 진행하는 것이다.665fcae clean/기존브랜치/main65063c8 확인. 공개 읽기만 닫으면 제안/후보/CSV/embedded saved가 깨지는 경로를 먼저 조사하고014 steward 변경안을 기록했다.
- safe DB DTO/cursor, private raw owner/admin RLS, HOT/saved/후보 최소DTO, 원자 제안 RPC와 기존 직접 INSERT helper를 함께 구현했다. 원본 ID/FK/JSON/주소/HTTP 입력·응답을 유지했다. 기존 원본 공개 fixture 조회 테스트는 명시적42501 및 공개 RPC moderation 부정 검사로 강화했다.
- 직접8그룹과 이전44, 별도 catalog quota2를 순차 검증했다. 메타데이터 inventory28table/81function/35policy, 전체RLS28/privateclientSELECT0. 전체Storage/테넌트 등 완료로 오인하지 않는다.
- 별도 build/DB 준비와 테스트를 중복 실행해 격리 컨테이너 중단1건이 발생했고 순차 재실행54그룹 통과. source014·015는 적용 뒤 수정하지 않았으며016 단계적 활성화로 구버전 적용 순서를 보강한다. 외부 콘솔/키/배포는 수행하지 않았다.

## 2026-11-20E — 최종 호환 보수·증거·패킷
- 017을 추가해 비공개 campaign/없는 campaign 오류 동등성과 NULL kind 거부를 보강했다. 적용된014~016과 기존19개는 수정하지 않았다. 직접8·desktop/mobile 두 역할 영향4·DB→TS2 PASS.
- 최종 unit190/24·lint/typecheck, 전체 local32(21개 이력)와016후6/chooser후4/prefetch후2/017후4, free4·keyless10, SQL/REST54·rollback3을 시점별 기록했다. opt-in DB config 경로 오타는 실제 storage config로 수정해2건 통과했다.
- 생성 SQL을 기존8/12/16/18/19→23 다섯 기준에서 실제 실행했다. 처음 빈 baseline의 INSERT SELECT0행을 literal fixture/count1로 고친 뒤 profile hash·legacy ID 보존과 staged old read·safe DTO·activation·재개방/중복 거부를 검증했다. 이전22개 증거도 보존한다.
- D018/D075/D076/D084 네 DEV-A 원장만 갱신, 전체Storage/테넌트/opaqueID·정책/공급자/실제URL·교차 리뷰는 미완료. LOCAL5/진행13/부분1/외부2/OPEN22/DONE0. source/SQL19개·ZIP5개 불변을 확인하고 새 패킷을 준비한다. 외부 콘솔/키/배포 수행 없음.

## 2026-11-20E — 산출물 검증·기존 브랜치 push 준비
- source5cb77a8의394 Git blob/CRC/비밀 패턴, 새014~017 SQL 원문/이력, 최초 activation source reference를 검증했다. 새ZIP2,725,961bytes/SHA256 fa86f1397ad26c5561800e2938100f885127869aaa13a8b7fe02a2267a7b2418. 이전ZIP5개 hash 불변. artifacts만 후속 커밋한다.
- 티켓별7a553e5(D075),1b6fbf0(D076),891f5a2/5937456/d85cf28(D075),5cb77a8(D084). push 직전 fetch의 main65063c8 유지. 같은 codex/dev-a-p0-continue만 push하며 배포/main merge/외부 설정은 수행하지 않는다. push 후 exact HEAD의 CI/원격 SHA는 ignored output receipt로 확인한다.

## 2026-11-20F — D051 메시지 기능 보강
- 사용자 마감 피드백에 따라 반복 ZIP 패키징 대신 한 기능의 source/SQL/검증을 묶었다. 기존9a45fc0 브랜치/main65063c8 유지.018 nullable retry key·cursor index·private RLS 차단/신고와 participant RPC, lazy 방별 UI·네트워크 응답 유실 재시도를 구현했다. 기존 상태 전이/본문/ID/정상 direct INSERT는 유지한다.
- unit197/25·신규 API7·lint/typecheck·실제 DB8+기존 rate8·desktop/mobile 새 대화2+두 역할 golden2/build PASS. 동시 retry12→1건/1 quota, 신규25→20허용, cursor 동일 microsecond27행·XSS·foreign/anon/위조·차단/신고 검증. 브라우저에서 서버 저장 후 응답만 끊고 같은 key로 재시도하여1건을 확인했다.
- 검토 SQL23→24를 두 번째 격리 DB에서 실제 실행, 기존 message hash/legacy INSERT/read_boundary 보존·unknown/repeat 거부 PASS. source18 적용 후 수정하지 않았다. 초기 fixture host/enum·React effect lint·CRLF 비교 오류는 근본 원인을 수정했다.
- D051만 원장 갱신, 안전 Storage 첨부/D049 리뷰/실제URL은 남아 IN_PROGRESS. 외부 계정/키/콘솔/배포/실제 메시지 없음. 한 SQL과 인계를 전달하고 같은 브랜치 commit/push/CI를 검증한다.

## 2026-11-20G — D057 근거 검토 흐름
- 019/020 private RLS 제출·정정·당사자 답변·검토/감사·정책OFF 공개 게이트 및 curated DTO 구현. 익명/타인/stale MFA/self review·변경된version 승인을 거부하며 미확인 주장은 점수/검색 제외와 연결하지 않는다. 소스 재검토에서 원본 reason 공개 제외와 모든 owner response의 새version 생성을020으로 보강했다. 적용된019/이전24개 불변.
- 실제 local DB/REST9그룹 PASS. API/내 검토함·운영 검토함·프로필 표시 연결, 기존 reports 데이터/ID/POST payload 보존. 원장 D057만 진행으로 바꾸며 공개 실제 정책/USER 적용/교차 리뷰는 남긴다. D029 연계 후 브라우저/최종 공통검증과 하나의 USER SQL을 준비한다.

## 2026-11-20G — D029 광고 이력 제출·검토
- D057 흐름에021/023 owner-only 광고 이력/출처/권한확인·정정·중복 URL guard, 별도 기본OFF 광고 공개 정책, 강한 근거 분류 및 공개 DTO를 연결했다. 단순 언급/본인 진술/unknown interest는 비공개 상태에서도 확인 광고 분류를 거부한다. actor/is_demo/검토자·시각은 DB 결정, 실제 로고·콘텐츠 복제/수집 없음.
- 실제 DB8·신규 API/schema6·unit210/27·lint/typecheck와 desktop/mobile 제출/승인/공개/정정/구버전 승인 거부2 PASS. D057 새 브라우저2+기존 두 역할 golden2도 PASS. getByLabel exact/option label text 차이를 동일한 정확한 accessible combobox role로 수정, 조건 완화/skip 없음.
-022 반복 철회 quota/no-op과024 최신 답변 consent를 보강해 이전 공개 동의 답변이 새 비공개 입장을 대신 노출하지 않도록 했고 직접D0579그룹 재검증. 적용된19~23 및 이전24개 SQL은 수정하지 않았다. 최종 SQL23/24→30·USER gate/교차 리뷰·정책/실제URL은 묶음 인계한다.

## 2026-11-20G — 최종 수용 기준·인계
- D057/D029 수용 기준별 source/실제 local DB17·API/schema13·desktop/mobile 새4+기존golden2 및 SQL23/24→30 검증을 저장했다. unit210/27·lint/typecheck/build 통과. 023 강한 근거 분류/024 최신 답변 consent·022 반복 철회는 부정 조건을 추가해 검증했다. 제출/검토자/date는 DB, 원본 주장/메모/UID/비공개 입장 공개 거부, 실제 광고/법률/공급자 성공 주장 없음.
- 두 티켓을 문서의 local 수용 기준 LOCAL_VERIFIED로 기록, 실제 U001/D073 정책/USER 적용/실제 URL·출처 검토/교차 리뷰는 별도 차단이며 DONE0 유지. D084는 전체 미구현/전체회귀·외부 게이트로 IN_PROGRESS. Local7/진행13/부분1/외부2/OPEN20.
- 새 패킷은 ZIP 반복 대신 SQL5파일/원본6개 hash·source_head manifest를 전달한다. 기존24 SQL/ZIP6개 보존. 두 공개 정책은 독립적으로 기본OFF, actual 승인 값은 USER 확정 후 개발자가 별도 SQL 생성. source/콘솔/배포를 사용자에게 직접 적용하도록 인계하며 터미널/코드 편집/설치는 요구하지 않는다.

## 2026-11-20G — 전달 SQL·source hash 검증
- sourceee83210의019~024 여섯 SQL Git blob/LF hash, 전달 SQL5파일hash·이전 메시지SQL prefix·기존24 source migration/ZIP6개 SHA256 불변을 검증했다. current24/previous23→30은 실제 로컬 생성 SQL에서 비어 있지 않은 legacy 자료와 기존 권한을 보존했다.
- 변경은D05714dc12d/0a65d7c/8ad223b, D029fed59dd, D084ee83210으로 분리했다. 같은 codex/dev-a-p0-continue에 push 후 exactHEAD 원격/CI를 확인하며 산출물 이후 앱 코드 변경 없음. 실제 외부 정책·콘솔/키/배포·출처/공급자 검증은 하지 않았다.

## 2026-11-20G — 전달 SQL 줄바꿈 검증 보강
- plain SQL을 Git에서 받는 Windows/Linux 환경의 CRLF/LF 차이를 고려해 최초 전달9a7fcce SQL blob과 일치하는 canonical LF hash receipt를 추가했다. 기존 SQL/원본 raw manifest는 수정하지 않았다. 검증기는 LF 내용/최초 Git blob을 함께 비교하므로 다른 OS의 정상 checkout을 변조로 오인하지 않는다. 앱 소스 변경 없음.

## 2026-11-20H — D054 결과물 버전·검토
- 사용자 잔여 티켓 요청에 따라 다음 준비 P0 D054를 진행했다. 기존0abc1ee/codex/dev-a-p0-continue 유지, fetch 후 main65063c8 신규 없음. D049/D056 steward 변경 의도를 먼저 기록하고025 additive private RLS snapshot/attestation/event와 버전 전제·retry·검토 API/전용 화면을 구현했다. 기존 수락/거절·일반 메시지·ID/URL/광고 이력은 보존했다.
- 실제 local DB/REST10+기존 rate8/conversation8, unit218/28·lint/typecheck/build·Harness5/backlog PASS. Auth/TLS Chrome desktop/mobile 새 흐름2+golden2+일반 메시지2, 마지막 상태 badge 동기화 보강 후 새2 재통과. 서버 ACK 유실 retry1건·수정본 필수·오래된 승인409·최신 표시 체크 재확인·확정 이력 불변·역할/차단/중재/우회 거부를 확인했다.
- 기존 message 회귀8개 통과 뒤 fixture auth-user cleanup이 새 audit FK로 실패했다. exact local DB의 해당 방 감사만 삭제하도록 cleanup을 확장해8개 재통과했다. 제품 gate/불변 trigger를 완화하지 않았고 fixture 정리는 같은 transaction에서 trigger를 복원한다. 적용된025/기존30 SQL 수정 없음.
- USER SQL30→31을 별도 DB에서 실제 실행, 기존 비어 있지 않은 proposal/message/profile hash·구형 stage·managed 방 선행 보호·activation·unknown/custom/hardened/reapply 거부 PASS. raw025 기본 strict, 검토된30 stage만 구형 unmanaged 호환이며 stage를 보안 완료로 보고하지 않는다.
- D054 LOCAL_VERIFIED, D084 IN_PROGRESS만 갱신: Local8/진행13/부분1/외부2/OPEN19/DONE0. USER SQL/새 source 배포/실제 URL/owner 활성화·D049 교차 리뷰는 남는다. 실제 광고/법률/외부 콘텐츠·플랫폼/Toss 성공 주장과 외부 콘솔/키/배포 수행 없음. 티켓 source와 D084 패킷/증거를 분리 커밋하고 기존 브랜치 push/CI를 확인한다.

## 2026-11-20H — source·전달 패킷 확정
- D054 source b0ba55f, 패킷 MANIFEST source_head와 activation reference를 동일40자리로 생성했다. 새025 Git blob/LF 원문·전달4 SQL hash와 기존30개 source SQL/6 ZIP SHA256 불변 PASS. 증거 D054/packet-integrity-20261120.json. 실제30→31 stage/activation 동작 증거와 최종 static source hash 검사를 구분했다. SQL/metadata/개발자 검증기만 다음 D084 커밋에 포함하며 앱 변경 없음.
- push 전 main65063c8 유지·새 main commit 없음. 기존 브랜치만 push하고 exact 최종 HEAD 원격/CI는 ignored output receipt로 남긴다. 원격 배포 수행/완료를 주장하지 않는다. 격리 QA 컨테이너는 검증 후 volumes를 보존하고 중지한다.

## 2026-11-20I — D045 추천 근거·snapshot
- 사용자 잔여 요청을 이어5044f45/기존 브랜치와 최신 main65063c8 신규 없음 확인. v2 backlog/역사 tasks40/세션/실제 source·D045 지시를 확인하고026 steward 의도를 먼저 기록했다. 기존 adme-1.0 모델의 입력/출처 fingerprint·태그/예산/미확인·근거/충족률/score를 DB가 저장하고 owner 전용 명시적 저장·재계산·과거 기록·갱신 안내를 구현했다. HOT/owner/private JSON은 점수 입력에 없다.
-026 적용 후 불변 유지. 새 FK가 기존 campaign DELETE를 막는 문제를027 부모 cascade 한정으로 보강하고,028로 catalogue scan 전 공유 quota를 추가했다. 직접 snapshot UPDATE/DELETE는 거부, 타인 campaign 삭제 거부/본인 삭제 정리 통과. 기존31 SQL/다른 담당/USER 원장 보존.
- unit225/29·lint/typecheck/build·Harness5/backlog, 실제 SQL→TS48×3+견적0=145사례, 실제 SQL/REST11그룹 PASS. 새 Auth/TLS Chrome desktop/mobile2+기존 golden2 및 모바일 grid의 점수 단위 줄바꿈 보정 후 새2 재통과. ACK 유실 retry12→1/1 quota·HOT 동일·stale/재계산·withdraw·role/moderation·cap1000·quota 선검사 검증. TEST backend503은 예상 거부이지 공급자 통과가 아니다.
- 최초 private UID assertion이 기존 공개 user-UUID ID를 오인해 published ID와 private actor 필드를 구분했고 실제 owner/key/canary/HOT 비노출을 검증했다. opaque ID 전환은 D075 잔여다. 별도 packet DB analytics port54327 충돌은 ignored config54337로 격리했으며 root/hosted 설정 변경 없음. 테스트 삭제/skip 없음.
- 생성 USER SQL31→34를 별도 DB에 실제 적용, 중간 오류 전체 schema/ledger rollback·비어 있지 않은 원본 profile/creator/campaign/message/delivery boundary hash 보존·unknown/reapply·retry/RLS/cascade 검증. D045 LOCAL_VERIFIED/D084 IN_PROGRESS만 갱신: Local9/진행13/부분1/외부2/OPEN18/DONE0. D044 정규화 모델/검색 통합·교차 리뷰·USER 적용/실제 URL·전체 출시 게이트는 남는다. 티켓 source와 D084 패킷/증거를 분리 커밋해 같은 브랜치 push/CI를 확인한다.

## 2026-11-20I — source·패킷 검증
- D045 source47632b5를 manifest에 확정, 새026~028 Git blob/LF SHA256·전달3 SQL hash와 기존31 migration/이전 전달 SQL103개/ZIP6개 불변 PASS. D045/packet-integrity-20261120.json. 실제31→34 동작 검증과 최종 static source hash 증거를 구분했다. 후속 D084 커밋은 패킷/개발자 검증기/기록이며 앱 코드 변경 없음.
- push 전 재 fetch에서 main65063c8 유지, 새 main commit 없음. 기존 codex/dev-a-p0-continue만 push하고 exact HEAD 원격/CI 결과는 ignored output receipt로 남긴다. 실제 외부 SQL/계정/키/설정/배포는 수행하지 않았다. 검증 후 두 격리 QA stack은 volumes를 보존해 중지한다.

## 2026-11-21 — 작업 속도 우선 실행 방식 반영
- 사용자는 앞으로 가능한 한 빠른 마무리를 요청했다. AGENTS.md에 진행 중 독립 P0 우선/준비된 미착수 순차 처리, 연관 티켓 묶음의 공통 검증·최종 패킷1회, QA 재사용·불변 외부 차단 재검토 축소를 기록했다. 티켓별 커밋/증빙·영향 권한/데이터 검사·최종 exit gate는 유지한다.
- 이번 변경은 실행 규칙/세션 기록만이며 기능 구현·티켓 상태 변경 없음. 현재 Local9/진행13/부분1/외부2/OPEN18/DONE0을 그대로 보존한다. 앱/DB/배포 변경과 무관한 전체 앱 테스트·SQL 패킷/ZIP 재생성은 하지 않는다. 문서 diff와 인계 일관성 검증 후 같은 브랜치에 커밋/푸시한다.

## 2026-11-21 — 진행 중 DEV-A P0 13개 마무리 배치
- 기존 codex/dev-a-p0-continue/a1e8080에서 대상13개를 처리했다. D002/D008/D012/D018/D028/D034/D051/D065/D075/D076/D081은 LOCAL_VERIFIED, D007은 BLOCKED_EXTERNAL, D084는 IN_PROGRESS. 다른 담당/미착수/원본 배분은 불변이며 DONE0. 외부 정책·권리·실제 공급자·삭제/보존 전체 흐름·USER 적용/URL/교차 검토를 완료로 가정하지 않았다.
- 035~046 additive SQL: 홈 실제 집계, TEST DB isolation, bounded filtered server search, service Auth HMAC budget, private verified PNG Storage/logo, opaque public refs, normalized policy-gated public read. 기존34 SQL/PK/FK/실데이터 내용 불변, 실제 marked QA 이력46.
- 최종 unit234/33·DB→TS4·local security17/110·47table/189function/2privatebucket inventory·lint/typecheck/build PASS. 실제 로컬 Auth/Storage desktop/mobile48개 시나리오의 영향 재검증, free actual DB6·keyless10의 영향 filter6 PASS. 첫 실패와 실제 수정은 DEV-A-P0-FINISH-20261121/README.md에 보존. 단일48-green 실행으로 과장하지 않는다.
- 실제 USER SQL34→46/중간 rollback/미지·중복·수정 baseline STOP/비어 있지 않은6종 데이터 hash/old-to-opaque ID switch 및 cursor 경계 PASS. 새 USER 적용 패킷1개, 이전 ZIP·SQL 산출물은 불변. source/티켓 commit과 실제 push/CI는 최종 인계에 기록한다. 외부 설정/키/배포/메시지 발송 없음.


## 2026-11-21 DEV-A 남은 P0 (기존 codex/dev-a-p0-continue)

사용자 요청: 남은 P0 진행, 기존 티켓별 commit/push 권한 유지. 시작7b8fcdc/main65063c8, 첨부 DEV-A와 저장소 동일·shared contract/AGENTS 준수. 기존46 SQL 불변, 추가047~054. D021/D064/D080/D082 LOCAL_VERIFIED, D073 BLOCKED_EXTERNAL, D014/D084 IN_PROGRESS; D007/D009 외부 gate 유지. DONE 없음. 로컬 구현 기준 남은 P0 5개, DEV-A 전체 미완료19개(LOCAL_VERIFIED24/DONE0).

실제 로컬 Auth/DB/Storage와 가상 자료: unit244/36, SQL/REST121그룹19파일, DB→TS4, 전체 desktop/mobile54, 최종 settings4, free6, keyless10, Python 전체9(new4), lint/typecheck/build/harness 통과. 원장/RPC metadata52tables/220functions/2privateBuckets. 실제 생성 USER46→54 packet 독립DB 데이터 보존·오류 rollback·중복 거부·구가입 동의 소급 없음·단방향 활성화 검증. 공급자/SMTP/법률/클라우드 적용 성공은 주장하지 않는다. D014는 production adapter/API 없이 독립 계약만 구현했다. 근거/실패 수정/범위 및 정확한 source/티켓 commit은 harness/evidence/DEV-A-P0-NEXT-20261121/{verification.json,README.md,commits.json}. 새 USER 패킷 deliverables/dev-a-p0-next-20261121/README.md. old artifacts 불변, ZIP 중복 생성 없음. 외부 콘솔/keys/deploy/실제 결제/대외 연락 없음.

최종 경로 대조: D073 가입3목적·설정 전역 철회 외 기존 profile/brand 공개 저장의 동의 부여/철회를 버전 원장과 원자 연결하는 후속 코드/직접 REST 회귀가 남는다. 해당 티켓 부분 진행이며 정책 외부 gate만으로 모든 로컬 구현이 완료된 것은 아니다. 최종 source5748a86, 패킷 소스/SQL/적용이력 무결성 PASS. 후속 문서·패킷 커밋은 제품 변경 없음.


## 2026-11-21 DEV-A 남은 P0: D073 공개 저장 원자 통합 / D084 회귀

사용자 요청: 남은 P0 진행, 기존 codex/dev-a-p0-continue·티켓별 commit/push 유지. 시작0a2be26/main65063c8. 기존54 SQL/이전 패킷 불변,055~057 추가. 프로필/브랜드 저장과 scoped 동의 event·receipt를 원자 통합하고 legacy/direct REST 공개 우회·key payload 충돌을 거부한다. scoped/global 오래된 성공 요청은 receipt만 반환해 이후 철회/공개를 재적용하지 않으며 UI는 stale global receipt를 현재 철회 성공으로 오인하지 않고 상태를 재조회한다. 서버 처리 순서이며 클라이언트 클릭 CAS는 아니다.

Actual local SQL/REST127그룹20파일, unit246/37, DB→TS4, Python9, 전체browser58(055/056), 최종057/v2 영향10+capture4, free6/keyless10, lint/typecheck/production build/harness PASS. metadata54tables/227functions/2privateBuckets. 생성 USER54→57 SQL의 실제 독립DB upgrade/기존 비어 있지 않은 데이터 보존/unknown·modified baseline STOP/중간 rollback/legacy staged no-fabricated-consent/one-way strict activation/duplicate STOP PASS. 초기055 record 필드 오류는056 forward fix, old global replay는057; 접근성 대비/폼 refresh/streaming 캡처 준비를 수정. 과거 evidence 유지·새 패킷1개, ZIP 중복 생성 없음.

D073 BLOCKED_EXTERNAL(U001 실제 최종 정책/보존·위탁/국외이전/권리 절차), D084 IN_PROGRESS(실제 삭제 D014/D079·공급자·릴리스) 유지. 기존 profile/brand 원장 통합 코드 부족은 해결. 남은 P0 상태 집계5(진행2/외부3), DEV-A LOCAL24/외부3/진행2/OPEN14/DONE0 동일. 타인 담당/원본 배분 변경 없음. 실제 정책/공급자/SMTP/배포/결제 성공 아님. 외부 콘솔/keys/deploy/outreach 수행 없음. 상세 evidence DEV-A-P0-PUBLICATION-20261121, 정확한 source/티켓 SHA commits.json, 새 USER 패킷 deliverables/dev-a-publication-20261121/README.md. 최종 push/CI 및 QA stack 중지(볼륨 보존)는 ignored receipt.


## 2026-11-21 DEV-A 남은 P0 전체 처리 배치

사용자: 남은 P0 모두 진행. 기존 codex/dev-a-p0-continue/aab0be9, main65063c8 유지. USER 정책 답변은 아직 미확정—구현계속. D014 실제 비밀번호/MFA·DB접수/receipt/lease·stale JWT/RLS·Auth 제한·Storage 검증 보관→원래경로 제거·재시도·소유수집 작업 취소를 구현했으나 영구 파기/Auth삭제/D079 shared 보존/backup·주기worker/receipt복구는 미구현. intake 기본OFF/승인SQL없음.058 source 후속 수정이 섞여 실제 ledger 원본으로 복구하고059 forward hardening으로 분리,060 owned jobs취소. 기존57 및 과거 증빙/패킷 불변.

D007 known notice1,602,660bytes/페이지/footer와 actual Linux Node22.23.5 production build/trace/HTTP proof 추가:17traced/고지4미확인, Windows12/2, optional71/자산권리/최종호스팅Edge gate 유지. 첫 Git archive CRLF byte mismatch는 LF archive/.gitattributes -text로 수정, 고지 trailing whitespace 보존용 해당파일만 -whitespace. D009 local Mailpit current source regression을 외부SMTP로 보고하지 않음. D073 신규 처리 register만 보강, 정책snapshot/hash/승인상태 불변.

최종 unit248/38, DB→TS7/actual quarantine3,20security127groups, full desktop/mobile64 +stricter401/403 permission4, free6/keyless10, lint/typecheck/build, Python9/harness5/backlog88/20/6 PASS.57tables/240functions/3privateBuckets audit, 실제 독립 DB USER57→60 preflight/customhookSTOP/rollback/기존비어있지않은data불변/intakeOFF/duplicateSTOP PASS. 가상 계정/파일/정책·TEST값/실패 주입/실제 local infrastructure 구분.

D007/D009/D073 BLOCKED_EXTERNAL, D014/D084 IN_PROGRESS, LOCAL24/외부3/진행2/OPEN14/DONE0 동일·잔여P0 5. 모든 티켓을 검토했지만 승인/실제 파기/출시 완료로 바꾸지 않음. 원본배분/DEV-B D079 재배분/완료 없음. 외부콘솔/키/배포/외부메일·메시지·실제결제 없음. 새 단일 deliverables/dev-a-p0-all-20261121 패킷, ZIP중복없음. source/티켓 commit 및 세부 commands는 evidence DEV-A-P0-ALL-20261121, exact remote/CI와 QA중지(볼륨보존)는 ignored receipt.


## 2026-11-22 DEV-A 선행 없는 P1 처리

사용자: 선행 티켓 제외 P0/P1/P2 구현·필요 선행사항 전달. 기존80e8d1e/codex/dev-a-p0-continue·main65063c8 확인. 준비된 D030→D031→D035→D060을 순차 구현/티켓별 commit, 15개(P0 5/P1 8/P2 2)는 보류하고 DEV-A_PREREQUISITES_20261122에 담당/필요 결과를 정리했다. 원본배분·다른39 티켓/USER 상태 불변. LOCAL28/외부3/진행2/OPEN10/DONE0.

061~067: 최신 승인 광고 검색/총건수/커서·개인 브랜드 경쟁사, 공개 관측 그래프/단위·산식/표본/기간/0·null·갭, 승인 fresh 비 YouTube 참여율 필터/가용성meta, 업무역할별 운영검색·사유/요청ID/append-only 지원감사. 역사 공개는 현재값 승인과 별도 defaultOFF/window/근거로 제한, 새 승인/활성화 없음. 기존60/과거패킷/고지/lock/정책snapshot 불변. 새 USER60→67 단일 SQL 패킷을 실제 독립 DB에 적용/rollback/비어있지않은 자료·이력 보존/unknown·custom hook·modified baseline·duplicate STOP 검증했다. 66검증 proof도 보존.

최종 unit257/41·actual DB계약7/5·security23파일138그룹·lint/typecheck/production build·Python9/harness5/backlog PASS. full browser68 중62pass/6fail(새 운영경로/선택자 기대), 영향8 재검증6pass/2fail(추가axe가 광고notice 대비 발견), scoped대비 fix 후새4pass, 최종067 history gate/window 포함새4pass. 단일68green으로 과장하지 않는다. unchanged 시나리오 재실행 대신 영향만 검증. free6/keyless10 PASS, native Auth/TOTP와 합성 권한 JWT·가상 자료/정책을 구분. 기존review 보안 검사 old5 RLS table 기대가 새competitors로6이 된 것을 고쳐9그룹 재검증, grant 거부 기준 유지. packet QA 초기fixture는 미시드profile SELECT0을 literal 가상 자료로 수정. 적용065 실패 문법은 transaction rollback 후 최초 적용, 적용 SQL 수정 없음.

자세한 source/커밋/명령·실패/범위: evidence DEV-A-READY-20261122. 운영가이드 discovery-support-contract, 미확정 처리register 보강. 외부콘솔/키/호스팅배포/외부메일·연락/실제결제 없음. 미확정 U001 답변 유지, D014 영구파기/D079·공급자·SMTP·권리·출시 gate 그대로. exact remote/CI·QA중지(볼륨 보존)는 ignored receipt로 기록한다.


## 2026-11-22 DEV-A D007 독립 고지 보완

사용자 잔여 요청에 기존8d9232c/동일브랜치·main65063c8/전체원장·계약/세션을 확인했다. 새 선행완료 기록 없음. 앞선 선행대기 제외 원칙을 유지하고 독립 P0 D007만 진행했다. 기존 미확인71개 exact archive SRI/name/version을 대조: inBundle carrier2·비표준 @types root1의 archive 검증 실패3→0, README Licensing/versions10개 확보. SPDX 선언/README를 완전한 permission/copyright 원문으로 바꾸거나 임의 저작권자를 작성하지 않았다. full notice 새 해결0, D007 BLOCKED_EXTERNAL·잔여15(P0 5/P1 8/P2 2), 다른42/USER 상태 불변.

원문 supplement58,218bytes와 /licenses 링크, 새안전 추출기/immutable Linux Git-tree build helper·desktop/mobile notice+keyless 검증을 추가했다. unit257/41·Python14(새5)/Harness5/backlog·lint/typecheck·browser12/axe·Windows/Linux 실제build/HTTP hashes PASS. Linux17traced/미확인4(그중 exact disclosure2), Win12/미확인2 그대로이며 material collection과 rights review를 구분한다. 첫 inventory LF hash 혼동은 audit가 거부, generator LF JSON과 회귀검사로 수정했고 첫 시도 ignored보존/공개body동일. 적용SQL67/과거고지·패킷·lock·정책snapshot·DB/Auth권한 경로 불변. 영향없는 기존 DB7/security138·역할 시나리오는8d9232c proof를 인용, 공급자 통과로 확대하지 않음.

증거 D007/VERIFY_SUPPLEMENT_20261122.json과 두 runtime proof, 자료 docs/licenses/20261122-supplement. 외부콘솔/키/배포/연락·메일/실제결제 없음. SQL/handoff 변경 없어 사용자 적용 ZIP/SQL 패킷 반복 생성 없음. 기존브랜치 D007 commit/push/정확CI 확인 및 Linux --rm container 종료/기존 QA volumes 보존은 ignoredreceipt에 기록한다.

## 2026-11-22 DEV-A main 통합 사전 리뷰 / Git 배포 보류

사용자가 main 자동 운영배포 분리 확인 후 기존 A branch 리뷰/머지를 명시 승인했다. 기존 f04736a/동일 브랜치, main65063c8 ancestor/99 commits, clean 시작. mandatory Auth/account/search RPC, 서버전용 권한, 삭제 접수/quarantine, 운영 MFA/역할/audit, feature 기본값과 이전 actual-local 증빙을 확인했다. main8 SQL 원본 불변/추가59(총67), CI/build에 DB 적용·배포 단계 없음. Vercel 공식 현재 문서와 schema에 따라 main 및 현재 A branch의 Git deploymentEnabled=false, CI drift guard 추가. CLI/dashboard/hook 수동배포를 차단하거나 외부 콘솔 OFF를 확인했다고 주장하지 않는다.

로컬 unit257/41·secret scan995files·배포hold/4음성변이·diff whitespace·handoff PASS. 처음 ad-hoc Python 명령 quote 실패는 here-string으로 정정 후 통과. 새 commit CI 및 보호된 PR 조건을 확인 후 정상 머지하며 승인/보호를 우회하지 않는다. 상태 원장에 별도 통합검토 정보만 기록, D/U 티켓 완료·DEV-B 교차 수용·실제 공급자/클라우드/정책 승인으로 확대하지 않는다. 상세 docs/handoff/DEV-A_MAIN_INTEGRATION_20261122.md. 실제 머지/체크 SHA와 결과는 후속 로컬 receipt로 기록한다.

## 2026-11-22 DEV-A 독립 구현10개 배치

사용자: 독립 가능한 티켓 전부 진행. 기존3a3f09f/codex/dev-a-p0-continue·main65063c8·열린 PR2, clean 시작. 선행 사실 변경 없음. D042/D039/D055/D037/D020/D022/D050/D071/D047/D067에 티켓별 commit, 기존계약에 연결 가능한5개 화면/API와 선행용5개 안전 계약 코어를 구현했다. 이전 OPEN10→IN_PROGRESS10이며 LOCAL28/진행12/외부3/OPEN0/DONE0. 전체 수용 미완료15(P0 5/P1 8/P2 2)는 그대로다. DEV-B/USER 원장·원본 배분 불변. D014 영구파기/정책/실제 공급자·SMTP·권리/릴리스 gate를 완료로 바꾸지 않았다.

068 private saved-search condition/RPC CAS·20cap·직접권한 없음. 기존67 SQL 불변. owner brief whitelist복제, limited parser명시확인/모호조건거부, privateUTC iCalendar, TEST승인증거/동일주문 재시도. 웹은 승인가드/IPv4 DNS pin/robots subset/redirect거부·quota port; IG는소유자결합 암호화/state/refresh CAS; 합의·팀·embedding은검증된caller/repository CAS가 필요한 독립코어이며 실제연동·DB/RLS전체완료로 보고하지 않는다. private검색처리 register 추가·정책snapshot불변·온라인새정책/알림활성화없음.

최종 unit291/51·Python14/Harness5·lint/typecheck/secret1047/handoff/backlog/hold PASS. 실제local 저장검색7보안그룹·DB계약7/5·release5그룹·metadata60tables/260functions/3privatebuckets PASS. 새browser6은 최초4pass2fail 후 buttonlabel/streamedheading 준비·Next16 documented streamednotFound UI 기대를 정정하고 영향2 PASS; APIforeign404/creator403은유지. keyless10/freeactualDB6·각productionbuild PASS. 초기effect lint1/testporttyping2 수정. actual local fixture와 DNS/OAuth/결제응답/embedding/팀·합의계약을 실제공급자로 과장하지 않는다.

한 USER67→68 packet을 실제독립DB에검증: unknown/modifiedhistory/dependency/customhook STOP, 중간오류전체rollback, 비어있지않은자료/oldledger보존, defaultdeny, duplicateSTOP. generatorquota함수5인자정정, 최초 single-format preflight가 CLI split026이력을거부한문제는 실패산출물ignored보존 후 양QA DB의baseline256함수정의/ACL일치대조+각version정확히알려진두이력hash만허용했다. SQL/이력rewrite나포괄적정규화없음. packet알림/수집/IG/팀/실험활성화·배포없음. 상세 source/티켓commits/실패·증거는 harness/evidence/DEV-A-INDEPENDENT-20261122. 사용자packet deliverables/dev-a-independent-20261122. 동일Abranch/PR2에push후CI확인, main은승인대기유지. QA두stack은중지하고volumes보존한다. 외부콘솔/키/배포/실제결제/대외연락없음.


## DEV-B history retained during 2026-11-23 integration

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

## 2026-11-19 — Resend·가입/복구·YouTube·실제 Toss TEST·격리 복원

- 사용자 제공 비공개 파일을 메모리/표준입력으로 소비, 키 값을 출력하지 않음. Resend 도메인 verified·도메인 전용 발신 키·SMTP TLS 로그인, Supabase 최소 Auth 설정/한국어 템플릿 push 및 diff0 확인. 새 인증 라우트 배포 후 템플릿 전환.
- 실제 사용자 메일 confirmation/recovery delivered; 사용자가 인증 버튼 완료, DB email_confirmed·brand 프로필 확인. 복구 POST의 증표/유형/비밀번호 확인·GET 미소비·redirect/privacy 가드 구현. 사용자 최종 비밀번호 변경 확인은 대기.
- Toss 혼합 키를 발견해 요청 후 API 개별 연동 TEST 세트로 수정 등록·재배포. 사용자가 직접 TEST 약관/인증, provider GET order DONE·49000·주문 일치 확인. 서버 paid/30일 이용권 활성화, finalize RPC 두 번 재실행 동일 ID·count1 확인. 공급자 가짜 성공/수동 paid 조작 없음.
- YouTube 실제 공식 채널 ID1건 조회 성공·서버 Secret 등록. 실제 인플루언서 수입0, 정책/쿼터·restriction 콘솔 증거/수집 어댑터 미완료. Chrome 제어 오류 지속, 사용자 Google 설정/키 입력 협조.
- public/Auth/Storage 덤프·원본 보존·pg_attver 복원용 정규화·스키마 의존 트리거 지연 적용으로 네트워크 none 임시 PG17 격리 복원. table13/RLS13/FK22/orphan0/Auth5/Storage0 확인 후 컨테이너/볼륨 제거. 여러 시점 덤프, 실제 결제 전 백업이며 정기/원격/암호화 재해복구 완료 아님.
- lint/typecheck/Vitest35/Python5/build PASS, local E2E10/10·production E2E10/10. 최초 결제 상태 기대값 실패1건 및 인증 locator 충돌은 수정 후 재실행. 상세 증거 docs/AUTH_PROVIDER_EXECUTION.md 및 providers-20261119/summary.json. 전체 U20 및 실제 데이터 베타 완료로 표시하지 않음.

- 최종 소스 36327d7 업로드·dpl_9uQy4CiWiW9FV1E9ABqiu788cyfL READY 배포 및 실제 복구 UI desktop/mobile HTTP200 확인. GitHub Actions2개 성공. Toss provider 동일 Idempotency-Key 재승인 HTTP200·DONE·동일결제 반환. 익명/인증 사용자의 직접 finalize RPC 권한 false 확인.

## 2026-11-19 — 사용자 비밀번호 복구·재로그인 확인

- 사용자가 복구 메일에서 새 비밀번호를 설정한 뒤 재로그인 성공을 직접 보고했다. providers 증거의 사용자 확인을 true로 갱신하고 D010/U008/U019 및 외부 실행 기록의 해당 대기 조건을 해제했다. 이메일 변경·관리자 MFA·SNS OAuth 등 별도 미완료 범위는 유지했다. 비밀번호 수집·재입력·재발송 및 재배포는 수행하지 않았다.


## 2026-11-20 — 운영 콘솔, YouTube 수집과 로컬 AI

- main을 기존 인증·결제 브랜치로 fast-forward해 이전 운영 기능을 포함했다. 이후 관리자 운영, 공식 API 수집, 로컬 초안, 소유권 공개 조건을 검증하며 main에 커밋했다.
- 롤별 DB 권한 및 사용자의 AI 작업 읽기 경계를 검증했다. 공개 데이터는 운영 승인·본인 인증·공개 동의·공개 프로필을 모두 요구한다.
- 로컬 Ollama CPU 4스레드로 한국어 구조화 응답과 임베딩을 실제 생성했다. 워커는 Supabase에 전용 인증으로 연결한다. Vercel에서는 로컬 추론 포트에 연결하지 않는다.
- 운영 Supabase 첫 일일 작업 성공. 실존 채널 6개·공개 영상 메타데이터 29건. 공개 채널 0개. GitHub 기존 관리자 예외 알림과 운영 배포 검증은 docs/implementation-progress.md 참조.

- 배포 주소 전체 E2E 16개 통과. 화면 폼 보정 후 운영 스모크 4개 통과. 실제 채널 설명에 소유권 인증 문자열이 없을 경우 검증 실패, 비공개 유지와 연결 해제를 확인했다. 최종 배포 dpl_Ep82HQoU28bnTM6kQFG9ytZqWkr9 및 1262c5b Actions 성공.

## DEV-B 티켓 시작 — 2026-11-19 (docs/김진석 이번주.md)
- 참조 문서 `docs/SHARED_EXECUTION_CONTRACT.md`, `harness/service_backlog_v2.json`은 저장소에 없음 → 티켓 문서 본문 기준으로 진행.
- D001, D005 로컬 구현·검증 완료 (evidence: harness/evidence/D001, D005). 배포 미적용. 다음 배포 시 시연 환경에 `SERVICE_MODE=test_demo` 필요.
- Vitest에 `@/` alias 추가(라우트 핸들러 단위 테스트 가능).
- D010(재설정·이메일 변경), D011(파생 온보딩 체크리스트), D013(재인증·returnTo) 로컬 구현·검증. 실제 메일 링크/로그인 E2E는 SMTP·로컬 키 부재로 미검증. 사용자 콘솔 작업: Supabase Redirect URL `/auth/confirm`, `NEXT_PUBLIC_APP_URL`.
- D017(공급원 정책 문서+실행 게이트), D019(YouTube 어댑터, 합성 fixture 계약 테스트) 로컬 완료. 실제 수집은 U001 승인·U009/U010 키 전까지 BLOCKED.
- 로컬 격리 DB 도구(supabase CLI/docker/psql) 확인 결과는 evidence 참고 — DB 마이그레이션 티켓 검증 경로 필요.

## 로컬 격리 Supabase 도입 — 2026-11-19
- Docker Desktop + Supabase CLI 2.122.1 로컬 스택(`supabase/config.toml` 신규, studio/logflare 등 제외). 기존 3개 마이그레이션·seed 적용 성공.
- `.env.local`(로컬 기본 키, gitignore), `.accounts.local.json`(로컬 QA 4계정, gitignore). 공개 운영 DB와 무관.
- 기준선: E2E 6/6, `tests/security.mjs` PASS (로컬 DB). D010 실메일 재설정 E2E 4/4 PASS, D005 필터 실DB 확인.
- D025 청구 기능: 마이그레이션 0004 + API/UI. 로컬 DB reset 후 직접 DB·E2E·security 전부 PASS. 운영 DB 미적용.
- D026 프로필 확장: 다중 태그, null 견적/협업 의사, moderation_locked(0005). 직접 DB·E2E 14/14·vitest 42 PASS. 운영 DB 미적용.
- D033 서버 검색: 0006 keyset RPC·인덱스, /api/creators, 카탈로그 페이지네이션. 직접 REST·20k 성능·E2E 14/14·vitest 49 PASS. 운영 DB 미적용.
- D043 모집 규칙: 0007 마감·정원·상태 전이·동시 선정 잠금. db reset 0001~0007, 직접 DB·E2E 16/16·vitest 52 PASS. 운영 DB 미적용.
- D036 후보 그룹: 0008 saved_lists/items, 즐겨찾기 이관·saved_creators 제거, 캠페인 소유권 RLS·범위 잠금. 직접 REST·E2E 18/18·vitest 52 PASS. 운영 DB 미적용.
- D044 추천 계약: 게이트 선행·Policy(분야/예산 hard|soft, 결측 hold|exclude)·WEIGHTS 합 100·재정규화. vitest 61, E2E 20/20(로컬 auth rate limit 상향 후). DB 변경 없음.
- D049 제안 상태 머신: 0009 cancelled·proposal_events(상태·이력·audit 단일 트랜잭션, recipient=알림 대상), 수락 시 비공개/미인증 크리에이터 차단. 직접 REST·E2E 22/22·vitest 62 PASS. 운영 DB 미적용.
- D052 인앱 알림: 0010 notifications(source_key unique)·notification_cursors(단조)·notification_unread, realtime(토큰 설정 후 구독)+30초 polling, 알림함·배지. 0009 messages_insert kind 모호성 결함(일반 메시지 항상 거부) 수정. reset 후 E2E 28/28·DB 8종 PASS. 운영 DB 미적용.
- D058 요청 큐: 0011 접수번호·유형·기한(삭제 10일)·본인 확인·임시 비공개·답변·재심(다른 관리자)·report_events, submit_report(로그인·5건/일·중복), 삭제 시 scrub+suppressed_sources로 재수집 차단. reset 후 E2E 30/30·DB 9종 PASS. 운영 DB 미적용.
- D074 개인정보 반출: 0012 privacy_exports(sha256 토큰·15분·1회·재로그인 10분·5건/일)+privacy_access_log, POST 다운로드, 상대 메시지·브리프·id·민감키 제외+assertClean 가드, 설정 '내 개인정보'(수정·요청·삭제 경로·접근 기록). reset 후 E2E 32/32·DB 10종 PASS. 운영 DB 미적용.
- D027 비공개 업로드: 0013 private-uploads bucket(5MB·이미지/PDF)+uploads 참조, 브라우저 직접 쓰기 없음(portfolios 우회 정책 제거), 서버 magic byte·확장자·활성 PDF 검사 후 서버 키 저장, 본인 세션 60초 signed URL, delete_upload+sweepUploads(1h 유예). reset 후 E2E 34/34·DB 11종 PASS. 배포 시 SUPABASE_SERVICE_ROLE_KEY 서버 env 필요(사용자). 운영 DB 미적용.
- D062 안전: 0014 contact_denied 단일 helper(제안·메시지 트리거, 수락, 알림), user_blocks(공유 협업에서 차단·대기 요청 종료·비노출), 속도 제한(메시지 30/10분·수신 60, 제안 20/일, 크리에이터 수신 제안 10/시간; 지원은 수신 상한 없음), 사칭 신고 유형, 자동 제재 없음(누적은 검토 신호), 관리자 1~30일 제한+이의신청+해제. reset 후 E2E 38/38·DB 12종 PASS. 운영 DB 미적용.
- D077 웹 경계: CSP(self+Toss TEST+Supabase만, object/base/frame-ancestors 차단)·COOP/CORP/HSTS·/api no-store, 서버 fetch 고정 호스트 스캔 테스트, CSRF origin 단위 테스트, npm audit 0. CSP E2E 위반 0·외부 스크립트 차단. 전체 E2E 40/40. Toss 결제창은 키 없어 BLOCKED.
- D078 비밀정보: secret_scan.py 확장(미추적·Git 이력·번들·trace zip 내부·evidence trace 금지·로그·서버 env 실제값 일치·--keys 지문), vitest 6건(값 미출력 확인), --all PASS(이력 321 blob). 키 교체 절차 문서화. 콘솔 교체 실행은 사용자 담당.
- D079 보존·삭제: tombstone(ID·해시만, 요청증거와 분리)·삭제 3경로 트리거·차단키 해시화·ledger 복사·reapply(멱등)·run_retention+작업기록, /privacy 보존표·/admin 보존 패널. retention.mjs(복구 시뮬레이션) PASS, E2E 44/44, vitest 80. 실제 PITR 복구·cron 미구성.
- D085 CI·마이그레이션: RELEASE_MANIFEST(환경별 상태 분리·단계·롤백·env·체크리스트), migration_check(정적+rollback-sim)+unittest 6, CI 검증전용+migrations job(ci-db.sh), typecheck에 next typegen(깨끗한 checkout TS2304 수정). ci-db.sh 로컬 exit 0(E2E 44, DB 13). GitHub 실행·호스트 적용은 사용자.
- D086 관측: observability(마스킹·JSON 로그·webhook 알림 10분 중복억제)·instrumentation onRequestError·/api/health(공개 status만, 관리자 상세)·ops_stats(0016)·관리자 서비스 상태. DB pause 모의장애 503→webhook 1건 수신→복구. E2E 46/46, DB 14종, vitest 87. 외부 채널 수신은 U018 BLOCKED.
- D087 백업·복원: restore_drill(격리 DB 백업→파괴→복원, RPO/RTO 실측, Auth 로그인·비공개 파일 바이트·tombstone 검증), 발견 결함 2건 수정(pg_dump -n/-t 누락, MIME), 부하 p95 전부 예산 내·1만 행 검색 p95 16ms·용량 추정. 무료플랜 자동백업 없음 문서화. PITR/첫 백업은 사용자.
- D088 BLOCKED(사용자 배포 대기, 기존 배포 재사용 금지). D006 활성화 이벤트: 0017 product_events(가명 HMAC 주체·dedupe unique·opt-out/계정삭제 소거·400일 보존)·admin 퍼널·설정 토글, analytics.mjs/E2E/vitest, 전체 회귀 PASS.
- D015 동의·알림·관심분야: 0018(service/marketing 분리, 서버 버전·시각, consent_log, email_outbox 철회 시 queued 취소, enqueue_marketing 동의자만), 설정 PreferencesForm, consent.mjs/E2E/vitest, 기존 E2E 2건 locator 충돌 수정, 전체 회귀 PASS.
- D032 유사 프로필: 결정적 공통태그 가중 점수(가상/실제 비혼합·미공개·삭제 제외, 이유=공통 태그만), 삭제 요청 버튼, 로그인 후 creator/kind 유지(safeNext 엄격 패턴). similar.test/E2E, 전체 회귀 PASS.
- D038 CSV: 후보 그룹 import(미리보기→확인, 유효 행만, 출처 실제값 대조, URL 미수집, 100KB/500행, 인코딩·수식·중복 행별 오류)·export에 ID/출처/근거. csv-import.test/E2E(타계정 404), 전체 회귀 PASS.
- D040 메모·비교: 0019(creator_notes 본인전용·messages와 분리, compare_reports 2~3명·서버 발급/폐기 토큰, shared_compare=제목+ID만), /compare 결측·출처·기준시점 분리·메모(본인 화면만)·저장·공유·CSV(메모 제외), 개인정보 내보내기에 메모/비교/동의기록 추가. notes.mjs/E2E/vitest, 전체 회귀 PASS.
- D046 추천 피드백: 0020(matching_feedback 서버 전용 쓰기·사유 코드·모델 버전·노출 순위, 캠페인 단위 split, 관리자 데이터셋에 평가자 id 없음), /api/matching-feedback(서버가 순위·버전 재계산), 데이터 부족 시 성능 주장 거부, 관리자 요약. ci-db exit 0(E2E 58/58), vitest 112. 증거 harness/evidence/D046.
- D048 AI 어댑터: 4종 스키마·프롬프트 버전·provider 인터페이스·템플릿 fallback(사유 표시)·주입 방어·개인정보 가림·수치 검증·검토 후 복사, 0021 ai_usage(서버 전용 예약, 사용자/전체 일일 한도, 동시성 검증). 실제 LLM provider는 SDK 설치 승인·키 필요로 BLOCKED. ci-db exit 0(E2E 60/60), vitest 120. 증거 harness/evidence/D048.
- D053 메일 outbox: 0022(event+수신자+채널 unique, 템플릿 버전, 재시도 backoff·5회 후 dead, lease 회수, 발송 시 동의 재확인, HMAC 원클릭 수신거부+consent_log), notifications/email.ts(렌더·List-Unsubscribe·idempotency key·sender 어댑터), /unsubscribe, 관리자 outbox 현황, docs/operations/EMAIL.md(Auth SMTP와 분리). 실제 발송은 공급자 미설정으로 BLOCKED(U007). ci-db exit 0(E2E 62/62), vitest 124. 증거 harness/evidence/D053.
- D056 대시보드·성과 CSV: lib/pipeline.ts(단계 정의 단일화, 집계=목록 필터 동일), 대시보드 단계 칩·URL 필터·단계별 CSV, /api/export?type=pipeline(기록된 상태일·결과물 수만, 추정 없음). ci-db exit 0(E2E 66/66), vitest 127. 증거 harness/evidence/D056.
- D061 선정 검토: 마이그레이션 0023(review_checklist_items·creator_reviews 브랜드 전용 RLS, set_creator_review RPC, selection_gate 트리거=체크리스트 있으면 전 항목 승인 없이 지원 수락 불가, 항목 추가 시 재검토), /api/notes/{review,checklist}, 캠페인 화면 '선정 검토(비공개)'. DB 테스트+E2E 2, ci-db exit 0(E2E 68/68). 증거 harness/evidence/D061.
- D063 운영 통계·도움말·문의: 마이그레이션 0024(is_test_email 예약 도메인 제외, ops_errors PII 없는 경로별 카운트·record_error, inquiries 서버 전용 접수·한도·관리자 답변 감사, ops_metrics 기간 7/30/90·정의 표시), /help·문의 폼·내 문의, 관리자 운영 지표·문의 처리, 클라이언트 중단은 오류 집계 제외. ci-db exit 0(E2E 70/70). 증거 harness/evidence/D063.
- D066 Toss TEST 완주: BLOCKED(TEST 키 없음, U015/U019·D065). 무키 점검: payment()=API 개별 연동 → test_ck_/test_sk_ 세트만 허용(위젯 gck/gsk 거부, Edge Function 포함), failUrl 코드별 취소/실패 안내(메시지 텍스트 렌더). vitest+E2E billing-fail 2. 증거 harness/evidence/D066.
- D069 이용권 원장: 마이그레이션 0025(credit_ledger·credit_reservations, 예약→확정/해제·요청키 멱등, DB 시각 만료·재활성/연장 차단 트리거, 관리자 수동 발급 사유 필수·회수 시 잔액 0·주문 취소), /api/admin/entitlements·관리자 발급/회수 UI. ci-db exit 0(E2E 74/74), vitest 129. 실제 차감처(LLM)는 미연결. 증거 harness/evidence/D069.
- 2026-11-23 D070 완료(로컬): HOT 별도 광고 슬롯(serve_promotion_slots 서비스 전용·최소 DTO·노출 집계, 0026), 일반 검색 순서 불변 검증, 크리에이터 노출 이력. 전체 회귀 E2E 78/78·vitest 135. 증거 harness/evidence/D070.
- 2026-11-23 D083 완료(로컬): robots/sitemap/X-Robots-Tag/canonical/OG/JSON-LD, 공개·검증·비데모 프로필만 색인, TEST 데모 환경 전체 noindex. 비공개 프로필은 200+noindex(루트 loading 스트리밍 한계, 내용 비노출). 증거 harness/evidence/D083.
- 2026-11-23 D068 BLOCKED(실제 Toss TEST 취소 — 키·Edge Function 배포 없음), 키 없는 부분 완료: 0027 payment_cancellations·begin/finish_test_cancel(멱등키·소유자·사용 크레딧 거부·즉시 권한 회수·감사), Edge Function 취소 분기(동일 Idempotency-Key·GET 대사), /api/billing/cancel, 대시보드 TEST 취소. DB 테스트 PASS·E2E. 증거 harness/evidence/D068.
- 2026-11-23 D072 완료(로컬): /pricing 수수료 가정 계산기(서버 호출·저장·집계 없음, 면책), 주문 이력 TEST 상태 표식. 증거 harness/evidence/D072.
- 2026-11-23 D023 BLOCKED(U013 앱 승인·D018 미완): 공식 문서 기반 연동 설계 문서, 정책 게이트된 tiktok.ts(최소 scope·research 거부·토큰 수명·웹훅 서명·철회 이벤트) + 단위 테스트 5. 전체 회귀 E2E 82/82·vitest 142. 증거 harness/evidence/D023.

- 2026-11-23 origin/main(DEV-A YouTube 마켓) 병합: 충돌 21파일 해소(원격 화면 기준 + DEV-B 기능), DEV-B 마이그레이션 `202611231000NN`으로 재번호, `20261123100028`에서 proposals_insert/messages_insert 양측 조건 통합, 중복 비밀번호 복구 경로 제거, 로컬 seed에 가상 크리에이터 유지(호스팅 미적용). 검증: db reset 39개 적용, DB 테스트 26종+복원 훈련 PASS, vitest 163, lint 0 오류, build, secret scan PASS. E2E 84/98: 실패 14건(7종×2)은 YouTube worker·YOUTUBE_API_KEY·로컬 AI가 필요한 원격 테스트로 키 없는 로컬에서 BLOCKED.


## 2026-11-23 latest main integration / existing PR2

Preserved codex/dev-a-p0-continue and ticket commits; merged YouTube main5d3bc6c, DEV-B main14980c8 and follow-up8b5be1d. Initial44 shared-path conflicts and later5 conflicts resolved. Unit416/77files, lint/typecheck/build, Python16, actual local security7+8+5, fresh104SQL and affected desktop/mobile regressions passed. Full DEV-B E2E fixture setup remains blocked by source-policy validation; no guard disabled and no full-suite/provider/hosted claim. Core auth/consent/public DTO/admin boundaries retain DEV-A behavior; DEV-B shared-screen acceptance requires review. Evidence: harness/evidence/MAIN-INTEGRATION-20261123/verification.json. All D/U statuses preserved; latest request is PR update, no main push or deployment.

## 2026-11-23 — Be-Celeb 디자인 미리보기 및 가입 검증 복구

- 최신 디자인 커밋의 독립 HTML을 로컬 HTTP에서 실행해 한글 인코딩 오류로 JSX의 정규식이 깨지고 화면이 초기화되지 않는 문제를 재현했다. HTML5 문서와 UTF-8 선언을 추가했다. Playwright 데스크톱 광고 모집 이동과 모바일 홈 렌더링에서 JavaScript 오류 0건을 확인했다.
- GitHub Actions의 선행 실패는 DEV-A 병합 후 격리 가입 준비였다. PostgreSQL이 현재 약관과 성인 베타 동의가 누락된 테스트 가입을 차단했다. 격리 스택에서만 테스트 정책을 활성화하고 기존 합성 가입에 해당 메타데이터를 제공했다. 격리 스택에서 브랜드·크리에이터·관리자 생성에 성공했다.
- lint, TypeScript, Vitest 416건, Next.js 빌드가 통과했다. 운영 사이트는 검증 시 정상 응답했으며 최신 디자인 파일은 docs/prototype의 독립 미리보기다.

## 2026-11-23 — Be-Celeb 디자인 적용 및 티켓 검토

- 팀원 HTML 시안의 블루 계열 탐색 화면과 검색창, 결과 카드, 공고 레이아웃을 Next.js 앱에 연결했다. 기존 AD Me 로고를 사용하며 실제 YouTube 구독자 수와 갱신일, 채널 이름 검색·구독자 구간 필터를 제공한다. 워크스페이스와 공고는 기존 앱 경로를 사용한다.
- 개발 88개, 사용자 작업 20개의 원장 상태와 증빙 위치는 docs/handoff/COMPLETION_AUDIT_20261123.md에 기록했다. 최신 main은 104개 마이그레이션, 운영 DB는 40개다. 기존 운영 스키마를 대상으로 현재 UI만 별도 검증·빌드했으며 신규 기능 마이그레이션과 운영 동의·권한 설정은 건드리지 않았다.
- main lint·타입·Vitest 416건·빌드, 운영 호환 소스의 lint·타입·Vitest 163건·빌드가 통과했다. 로컬 운영 호환 빌드를 데스크톱과 모바일에서 열어 쯔양 검색, 필터 영역, 모바일 가로 넘침과 브라우저 콘솔을 확인했다.
- 디자인 운영 후보는 f624fd8 및 Vercel dpl_EyFZmpa8BAFoThq1Uw1kwiCP3guj다.

## 2026-11-23 — 운영 전수 감사 및 제품 재구성 1차

- 개편 전 운영 화면 및 역할별 로그인 경로를 Chrome으로 확인했다. 차콜·라임 공통 UI, 홈 상품 브리프 추천, 공개 영상 기간·개수 필터, 관리자 YouTube 동기화 위젯을 구현했다.
- 실제 공개 채널 10개의 공식 원본 주제를 홈 추천에 사용하는 추가 마이그레이션 1개를 운영에서 확인했다. 04:00 KST 수집 완료 및 36시간 이내 갱신 상태를 확인했다. 시작 시 운영 40개에서 41개로 늘었고, 현재 main 마이그레이션과 차이는 64개다.
- lint, 타입, main 단위 420건, 운영 호환 단위 167건 및 빌드가 통과했다. 운영 호환 로컬 Playwright 10건, 실제 운영 Playwright 14건과 5개 너비의 브라우저 검증을 완료했다. Local AI 한국어 광고 초안은 실제 운영 워커에서 생성됐고, 합성 원고 태그 6개는 별도로 로컬에서 추론했다.
- 운영 배포는 호환 소스 f84bd810a19ec4cc21e90fad630556030e358ddf와 Vercel dpl_7EpFVnF9PFHu5oKGvpTVnSX4fq5Y다. 상세 감사·검증과 차단 사항은 docs/audit/2026-11-23-full-audit.md 및 harness/youtube/product-audit-20261123.json에 기록했다. 이번에는 승인 데이터 지표 연결, 태그 운영 승인 큐, TEST 거래 전 과정, 전체 스키마 전환을 완료하지 못했다.

- 격리 Supabase에서 105개를 새로 적용했다. 과거 범용 E2E 2건 통과·4건 실패 원인은 필수 산출물 사용권 누락과 미인증 수락 가정이다. 보강 후 공고·주문 API, 대화, YouTube 기본값과 미인증 수락 409에 대한 격리 E2E 6건이 통과했다.
- 신규 캠페인 플랫폼 기본값 수정은 호환 소스 6fb374f2c0fdb3d896c0e4ea3078bdf20ee0718b와 운영 Vercel dpl_HpKpLetDybQVECCFdpFfUyCgTYbE로 배포했다.
- 최종 운영 재실행은 13건 통과 및 1건 실패였다. 동일 QA 계정에 적용되는 시간당 Local AI 초안 생성 한도 3건을 초과해 모바일 네 번째 요청이 429로 거부됐다. 1차 운영 실행에서는 데스크톱·모바일 추론이 모두 통과했다. 최종 새 캠페인 YouTube 기본값은 두 화면 폭에서 통과했다.

## 2026-11-23 — 프리미엄 디자인 및 브라우저 감사

- 피처링과 레뷰 두 사이트를 실제 Chromium에서 검토했다. AD Me 홈·탐색·상세·요금제, 공고 빈 화면, 역할별 공통 UI를 개편하고 스튜디오 경로를 제거했다.
- 광고 공고 게시권 버튼이 흰색 글자와 흰색 배경으로 보이던 문제를 수정했다. 운영 16.27:1, 48px과 격리 TEST 버튼 동작을 확인했다.
- 최종 프로덕션은 호환 소스 11af311f50e3ff8280ce530879031d636af908ca, Vercel dpl_G3S8oSBWEEadE4dShsgjKHjKa854다. 최종 운영 E2E 20건, 격리 TEST 결제 접근과 AI 워커 API 각 2건, 단위 420건, axe-core 22회와 Lighthouse 결과를 docs/design/visual-audit.md에 남겼다.

## 2026-11-23 — 실서비스 출시 감사와 2인 개발 인계

- 최신 main과 운영 Vercel을 대조했다. 운영 원장 41행과 저장소 SQL 105개, 최신 RPC 차이를 확인하고 출시 판정 NO-GO를 유지했다.
- 브라우저 운영 60개 고유 경로, API 16개 읽기 관측, 운영 Playwright 14건 및 격리 Playwright 8건을 확인했다. 격리 보안 직접 REST는 미인증 fixture와 정상 앱 RPC를 구분하도록 수정한 후 14건을 통과했다.
- Local Ollama에서 한국어 구조화 응답, 768차원 임베딩, 근거 기반 합성 태그를 실행했다. 실제 콘텐츠 태그 운영 저장·심사와 장애 복구는 별도 티켓이다.
- 기존 108개 ID를 보존한 114개 원장과 DEV-A/B 독립 실행 문서를 만들었다. 감사 문서, CSV/JSON/Markdown, 외부 조건, 릴리스 게이트와 증빙은 docs/production-readiness에 있다. 구매 문구·SDK 오류 노출은 main 검증 변경이며 운영 재배포는 하지 않았다.


## 2026-11-23 DEV-A resumed from latest main d79235d

Scope: D003 configuration consumers and D004 API boundary; no DB/UI redesign/provider work. Preserve shared exports and existing API errors; main ordinary push requested by USER. D003 unified app/legacy/CLI/admin health mode resolution; optional keys no longer falsely required when disabled. Affected29 tests PASS. Canonical production-readiness status remains TESTED; external acceptance not inferred. Evidence: harness/evidence/D003/CONFIG_20261123.md.

- D004: 실제 바이트 제한·위조 Content-Type/Length·분할 요청·파일/CSV 경계·immutable 응답·동적 문맥을 보강. API/역할 stubs50건 PASS이며 DB/provider 검증으로 보고하지 않는다. tests/browser/api-boundary.spec.ts에 실제 HTTP desktop/mobile 회귀 추가; 최종 배치에서 실행한다. 증거 harness/evidence/D004/API_20261123.md.

- Final D003/D004 batch: unit442/78files, lint, typecheck, production build, Python16 PASS. Desktop/mobile10 HTTP scenarios passed as6 + affected4 after test method/locator corrections. Missing browser binary handled with existing Chrome; stale generated dev types archived, no source restoration. Config-only USER packet and actual-vs-synthetic scope: harness/evidence/DEV-A-CONTRACTS-20261123/verification.json. Main ordinary push authorized, no cloud config/deploy/keys/DB application.


## 2026-11-23 sequential actionable DEV-A queue

USER requested all feasible tickets in order, keeping direct main push and ticket commits. First ready IN_PROGRESS P0 is D019: src/lib/ingestion/youtube.ts, scripts/intelligence_worker.py and provider-free contract tests. No SQL, policy approval, hosted/provider call or key action. Validate bounded inputs/responses, immutable channel/video attribution, hidden/unsafe numeric fields, public-only videos, error/timeout and quota classification. D033 server directory pagination and D044 matching contract follow after this adapter commit. U001/D017/U009/D085 gates remain explicit; existing TESTED receipts are not whole-ticket acceptance.

- D019: TypeScript 응답/입력 한도·실제 귀속·공개 영상/안전 통계·오류 분류, 실제 Python worker의 동일 귀속/숫자 경계 보강. TS20/Python8 및 typecheck PASS; 키·공급자/운영 호출 없음. 정책/U009 게이트와 IN_PROGRESS 유지. D033으로 진행.

- D033: 공개 첫24개 클라이언트 필터를 안전한 서버 필터·키셋 페이지·개수로 전환. TS/API10 및 실제 격리 DB5그룹(가상67/적격63) 통과. epoch 커서 결함은 원본106 보존+107 전진 수정. 누락 DB에서 가상 대체 없이 복구 안내. 브라우저/공유 배치 및 운영 적용·실데이터/성능 게이트는 별도.

- D044: 현재 추천에 hard/soft 분야·예산과 결측 제외/보류 연결. JS scorer1.2는 보류를 확정 적격과 구분, 빈 태그/형식 재정규화·숫자 검증·중복 태그 제거. 합성39건 통과. 구 SQL snapshot-v1은 보존하며 운영/통합 게이트 별도. 다음 D029/D016/D075 최신 소스 격리 검증으로 진행.

- D021: 워커30개/DB5개 실제 계약 불일치를 워커5개 제한+동률 id 정렬로 수정. Python9 및 격리 DB 복구7그룹, 실제 Python 합성50개→5개 체크포인트 저장 통과. 실제 API/cron 검증 아님.

- D029: 현재107 로컬 DB 제출/중복/정정/검토/출처·정책 분리/공개·철회8그룹 통과. 기존 seed 의존 fixture 수정, 만료된 QA 관리자 초대 로컬 갱신. 제품 권한 완화·운영 변경 없음.

- D016: 현재107 DB MFA/초대/만료·회수/자기승격/비공개 권한6그룹 통과. main의 집계용 definer2개는 명시 역할·MFA/회수 테스트로 검증하고 나머지 invoker 요구 유지. 외부 U008 미완료.

- D075: 로컬98 RLS/371함수/4비공개버킷, core7·brand7·creator-read8·normalized storage9 통과. main 저장 테이블 교체 뒤 stale RPC와 서비스 HOT의 원시ID/검토·동의·TEST 경계 결함을108/109 전진 수정. 전수 함수/운영 검증 아님; B 명명목록/import/D049 계약 검토 별도.

- D019 추가: 별도 소유 증명 worker 분기의 ID/도전값/응답 귀속·정확 토큰 검증. Python11 통과, 실제 소유 증명/공급자 호출 아님.

- D037: 현109 DB 본인 저장 조건·CAS 경합/재실행·삭제·한도7그룹 통과. D052 후보 알림과 동의/중복/해지 통합 미완료를 분리, IN_PROGRESS 유지.

- D048: 취소 신호만 주던 어댑터에 실제 응답 deadline/늦은 결과 폐기, 한도 확인 실패의 안전 fallback, 토큰 usage 스키마 추가. 합성11건 통과. 로컬11539 listener/ollama 명령 미확인, configuredProvider=null·실제 모델/worker통합 게이트 유지.

- Sequential batch source d608aed9ac539a49f2fde03bc6852f388c99075d: lint/typecheck/unit478/Python22/build/static109 PASS. Distinct keyless8/local20 browser scenarios PASS after documented harness and real form-reset fixes; all historical E2E/fresh0→109 not claimed.105→109 v2 packet atomic upgrade/rollback/retry/data/flags PASS. Main/A deployment hold preserved. Push this reviewed batch, then continue D042 version implementation.

- D042 continuation: immutable private brief files/state/versions + owner UI/API,4MiB/account20/revision200; actual9 DB/Storage groups and9 API+5copy tests, final desktop/mobile4 PASS.109→112 atomic USER packet tested separately; default collectionOFF. USER U001/B D079 physical expiry/orphans/delete/export and short-link behavior are activation gates. Existing account parent cleanup FK preserved;110 schema resolution caught before apply,111 attestation snapshot/112 global owner cap added forward only.

- D045/remaining batch20261123: additive113 model1.2 hard/soft/unknown snapshots + immutable1.0 read/replay compatibility, campaign policy edit/copy and exact112→113 USER packet. Final494unit/42Python/lint/typecheck/build/affected14 browser, actual D0456+legacy12 DB groups and fresh0→113 PASS. PR-001/002/003 independent model/Zod/source/transport contracts progressed with actual disposable CPU model receipts; first empty/invalid extraction failures retained and prompt versions advanced rather than weakening validation. Legacy runtime owners/status vocabulary preserved; new PR statuses live in canonical production-readiness only. External/B gates and unfinished owner-bound pipelines remain explicit; no DONE/VERIFIED/hosted deployment claim.

## 2026-11-24 — 개발자 A·B 및 운영자 실행 인계

- 원격 DEV-A 작업과 검증 이력을 최신 main으로 반영한 뒤 115개 원장을 세 역할로 나눴다. 운영자 문서에 기존 U/BUSINESS 항목, PR-003 Local AI 호스트 운영과 O001 웹디자인 승인을 연결했다.
- 로컬 AI 호출 코드와 웹 화면 통합은 개발자 인계로 유지했다. 운영 배포·키 등록·외부 승인에 필요한 확인과 담당 범위는 운영자 문서에 모았다.

## 2026-11-24 — 최신 main 반영 및 상품 조건 로컬 통합

- main7ae25a6 문서/역할 변경을 기존 codex/dev-a-p0-continue에 fast-forward, 기능 코드 충돌 없음. 모델 host PR-003는 OPERATOR 소유이므로 가동하지 않음.
- D048 f8087d7 기존 worker operation 계약; PR-001083395d 소유 상품/버전·큐·확인/거부→명시 검색; D0755fc6838 private operation/legacy 호환; D0391519bad YouTube·부정/OR 거부. PR-001/D039 로컬 TESTED, 전체 VERIFIED/DONE 아님.
- 최종504unit/43Python/lint/typecheck/build/영향 desktop-mobile6, 상품 SQL/REST9그룹·legacy draft, fresh0→116, 엄격113→116 원자 USER패킷 PASS. 전체 원격 CI/실제 provider·메일·Toss·운영 적용 미완료. Vitest 병렬 자원 경합 timeout은 maxWorkers4로 제한, 기존 assertion/5s timeout/isolation 유지.
- A ACTIVE 미완료36 = TESTED23+추가 구현·통합·외부선행13(P0 9/P1 3/P2 1). 상세/증빙 harness/evidence/DEV-A-PRODUCT-CONDITIONS-20261124/. U001 미확정, collection OFF/정책·기간NULL 유지. main/A 자동 배포 차단 유지, 로컬 QA는 volume 보존 종료.

## 2026-11-24 — 운영 Harness, 밝은 UI, 도메인 경계

- 기준선 main `2a1764e3001f982668e5314bd0dce87811678fa7`. 코드 검증 SHA `2f5d1d14358e26ce66c21f4bd248d6c29ec06974`.
- 밝은 디자인과 접근 가능한 홈 모션, 8개 도메인으로 일부 로직 이동, 구조화 로그 및 관리자 건강 상태 진단의 OTP 검증, Vercel 경로 누락 수정. 변경 파일은 `docs/production-readiness/FILE_MOVE_MAP.json`에 기록했다.
- 운영자 24건 및 A/B 91건 재정합. Vitest 506, Python 43, 국소 데스크톱·모바일 Playwright 10, 상품 분석 실DB 보안 9, 로컬 새 Supabase 마이그레이션 116 적용. 넓은 30건 회귀의 초기 실패와 남은 계약 검증은 운영 실행 기록을 참조한다.
- 프리뷰 준비 완료. 운영은 DB 스키마 호환 및 운영 백업·복구 승인 대기. 공개 도메인 라우팅과 PROD 배포를 변경하지 않았다.
- 증빙은 `harness/evidence/OPERATOR-20261124/verification.json`, 후속 작업은 `harness/operator-20261124`와 공식 원장에 있다.

## 2026-11-24 — main 자동 배포

main 푸시 후 Vercel 운영 빌드를 시작하도록 변경했다. 운영 DB 대상으로 검증된 마이그레이션 지문이 일치해야 운영 사이트에 승격된다. 운영 ledger 41건과 신규 상품 조건 RPC 부재를 읽기 전용으로 재확인했으며 운영 DB에 변경을 적용하지 않았다.

GitHub 소유자 승인 뒤 Vercel 프로젝트를 연결했다. Vercel API 기준 Production branch는 main이고 도메인 자동 할당이 켜져 있다. 분리된 Production 빌드는 승인 지문 미등록으로 중단했고 기존 운영 별칭은 유지됐다.

## 2026-11-24 — Figma-first 작업 시작

- 이전 Claude 작업은 별도 디자인 트리에 유지했다. 현재 기준은 AD ME Figma 원본 Page 1의 49개 프레임이다. 원본 보존 아래 Production Extensions에 캠페인용 편집 가능 프레임 13개를 추가했다.
- 원본 히어로·로고·에디토리얼 자산, 라벤더 토큰, 홈·내비게이션·캠페인 목록·상세·초안·인증 페이지를 적용했다. 운영 데이터 흐름에서 표시할 수 있는 필드만 사용하고, 무료 공개 경로에서 체험 상품 목록을 제거했다.
- 86개 첨부 작업에서 발견한 결제·가입 변형 4개를 추가했다. 기존 115개 공식 원장은 ID와 상태를 유지하고 참조 노드 및 현재 변경 경로를 추가했다.
- 공개 도메인 상태, 운영 마이그레이션 41건·신규 상품 RPC 부재, Local AI 서비스 및 04:00 KST YouTube 완료 기록을 재확인했다. 운영 DB 복구와 서비스 출시는 별도 게이트다.

### 2026-11-24 Figma 구현 및 검증 범위

- AD ME 원본 49개 최상위 프레임과 변수 17개, 주요 컴포넌트·프로토타입 연결을 기록했다. 원본에 없던 화면 상태는 Production Extensions에 분리하고, 개발 원장에 데스크톱·모바일 프레임 4개를 추가했다.
- Figma 홈·내비게이션·로그인·회원가입·크리에이터 탐색과 캠페인 목록·상세·작성의 초기 구현을 검증했다. 홈과 캠페인 목록은 해상도 1440px / 390px에서 Figma 렌더와 실제 브라우저 화면을 대조했다.
- 격리 환경에서 Playwright 10건 및 브랜드 상품→캠페인 초안, 모집 중 필터, 다른 사용자 초안 차단을 검증했다. 단위 테스트 510건, ESLint·TypeScript·Next.js 빌드 통과. 테스트 결제·협업·채팅까지의 운영 E2E 및 전체 화면 3회 검수는 미완료다.
- 서명된 운영 스키마 확인이 없어 Vercel의 운영 빌드 보호가 작동했다. 운영은 기존 Ready 배포 `dpl_G3S8oSBWEEadE4dShsgjKHjKa854`를 제공한다. Figma 프리뷰에서는 운영 DB와 결제 설정을 사용하지 않는다.
- 이전 복구 검증의 Storage `42P10`과 호스팅 스키마 차이, Local AI 제품 동선 검증은 해결 증거가 생길 때까지 운영 출시 차단으로 유지한다.

## 2026-11-24 — DEV-A 최신 main1710f23 후속

- 기존 브랜치 fast-forward. Figma·도메인 이동·main 자동 빌드 및 필수 운영 DB 지문 변경을 반영했다. U001/D017/D052/D079 미완료를 승인으로 추정하지 않음.
- D00366be9d8 LF/CRLF 지문·인코딩 검증, D0042ea36b6 소비된 빈 NextRequest의 실제500→401, D07557f67d0 Windows graph false-green 수정, PR-0012b56fa2 Figma 앵커/스트리밍 수동 추천 호환, D0024cc9d74 현행 YouTube 안내. 티켓 전체 상태는 보존.
- 최종517unit/87files·43Python·lint·typecheck·free-keyless production build·영향 desktop/mobile10 PASS. 실제317 소스 그래프의 직접 DB9개/순환0/위반0, 정적 SQL116 및116 Git 소스/Windows 지문 일치. 초기 오류·수정·정확한 미실행 범위를 DEV-A-MAIN-FOLLOWUP-20261124 증빙에 기록.
- Docker Desktop 시작과 후속 모델 version/preflight 명령이 자동 승인 검토에서 blocked by policy로 거부됨. 대체 가동/포트 probe/DB·실제 모델·전체 양측 테스트를 우회하지 않음. 새 SQL·이전 패킷 변경 없음. 검토 인계 deliverables/dev-a-main-followup-20261124/. main 생산 빌드 지문 게이트 유지, 운영 적용·전체 DONE/VERIFIED 주장 없음.

### 2026-11-24 Figma 운영 호환 릴리스와 복구 재검증

- 운영 DB에 직접 접속해 역할·스키마·데이터 및 마이그레이션 기록을 비공개 위치에 백업했다. 운영 원장 41건의 SQL을 다시 받아 Vercel 빌드의 스키마 지문과 대조했다. 적용 내역을 변경하지 않았다.
- 기존 운영 서버 커밋 `11af311`에 검증한 Figma 변경을 이식한 호환 릴리스 `3fa78d1`을 Vercel `dpl_C4JnCULQagACgsuFky3DbaxjB1cU`로 만들고 `be-celeb.org`로 승격했다. 이전 배포 `dpl_G3S8oSBWEEadE4dShsgjKHjKa854`가 롤백 지점이다.
- 1440px·390px Chromium에서 운영 홈·탐색·캠페인·요금제·로그인·회원가입이 각 HTTP 200을 반환하고 가로 넘침이 없음을 확인했다. 공개 구매는 닫혀 있다.
- D087 재현에서 이전 Storage API와 재초기화된 DB의 인덱스가 맞지 않아 최초 업로드도 42P10을 반환했다. 새 스택의 API·DB를 맞추고 복원 순서를 수정해 성공했다. 합성 데이터 225행과 비공개 파일 1개를 백업·초기화·복구했다. 복구 후 로그인, 소유자 파일 접근, 내용 바이트 일치 및 삭제 원장 재적용을 확인했다.
- 신규 main의 무료 캠페인 RPC는 기존 게시·지원 로직과 검증된 YouTube 소유권을 사용한다. 격리 실행에서 상품→게시→지원→수락→메시지와 다른 계정의 접근 거부가 데스크톱·모바일에서 통과했다. 호환 운영 버전에는 새 RPC와 메시지 화면이 아직 반영되지 않았다.
- 상품 분석 RPC는 현재 운영에 없으며, 운영 원장을 새로 만든 격리 DB에서 최신 스키마 전환 SQL의 트랜잭션 실행·롤백까지 검증했다. 데이터 이관 및 권한 회귀를 포함한 운영 적용은 별도 증거가 필요하다.

- 후속 Figma 호환 배포 `dpl_9nWr4BscAEwxyPtzacDUaJx3wbhG`를 운영 도메인으로 승격했다. /recommendations 및 실제 YouTube 상세, 공개 서비스 안내 검증을 추가했다.
- 운영 기존 원장 41건을 재현한 격리 스키마에 검토용 변경을 적용해 상품 분석 RPC 계약 9개 그룹을 통과시켰다. 운영에서는 데이터 이관·권한 전환·Cron과 기존 동선의 호환성을 남겼다.
- 최신 main의 캠페인 게시·지원 완료 상태와 신규 메시지 화면을 격리 브라우저 데스크톱·모바일로 재검증했다. 단위 테스트 517건, 린트·타입·빌드가 통과했다.

## 2026-11-24 — DEV-B D001 수동 TEST 발급 경계

- 최신main8ec0ec2 독립트리에서 D001 선정, 작업 중 d471c1b FF통합. 무료/featureOFF API200와 DBOFF fresh관리자 발급을 재현해 grant만 서버 feature/DB boundary로 차단, 회수·기존 데이터 유지. CLI 신규118, 적용 SQL 불변. DEV-A 교차리뷰 P2 전체 QA 제어행 복원 보완 및 재검토.
- 통합 소스 lint/typecheck/Vitest523/build,118 migration_check, fresh0→118 및117→118 rollback/실패주입, 역할REST3그룹, 무료 desktop/mobile2 + 실제 로컬Auth OTP TEST관리자 API desktop/mobile2 PASS. 초기 단위 실행 경합과 기존 catalog GET405/400 미해결을 증빙에 분리. 운영118/환경분리/관리자 확인은 BLOCKED_EXTERNAL, Toss/운영DB/외부 승인 실행 없음. D001 TESTED/runtimeLOCAL_VERIFIED이며 DONE아님.
- 증빙 harness/evidence/D001/GRANT_BOUNDARY_20261124.md 및 verification-20261124.json, 공개 캡처4개. 인계 deliverables/d001-grant-boundary-20261124/. 이전 패킷/이력 보존, 원장D001 외 상대 상태 변경없음.

## 2026-11-24 — DEV-B D005 공개 시연 데이터 경계

- 기준a78610e 기존 독립트리 재사용. mixed목록/상세free필터 누락과 직접DB demo48/legacysearch24/공개campaign4 재현. free 서버data/CSV/캠페인fallback 차단, CLI119 기본OFF 독립catalog경계를 중앙DTO/legacyfilter/count/campaignRLS에 추가. 기존SQL·48행·개인계정/캠페인·스냅샷 보존. DEV-A 계약/교차리뷰 완료, D005 원장만 TESTED/runtimeLOCAL_VERIFIED.
-119 static/fresh0→119 및118→119 rollback/실패주입, demo역할3+기존creator-read8+추천policy6 DB그룹, desktop/mobile free4+TEST OTP4+keyless2, lint/typecheck/Vitest533/build PASS. 키없는 브라우저는 기존 설치Chrome옵션 사용. 운영119·독립환경·실제URL 및 legacyraw투영(D075/D033)은 별도 게이트, 기존catalog405/400 실패 보존.
- 증빙 harness/evidence/D005/DEMO_BOUNDARY_20261124.md, verification-20261124.json·공개캡처6개. 인계 deliverables/d005-demo-boundary-20261124/. 운영DB/라이브결제/외부승인 수행 없음, 이전패킷 불변.

## 2026-11-24 — DEV-B D010 이메일 변경·현재 세션

- 기준2425405. 다른기기로그인/토큰갱신0초·현재AMR1201초에서도 허용되던emailchange 재현/수정, settings폼 및 양쪽확인/pending/최종settings연결. 새SQL없음, 기존119/볼륨재사용, localemail_change템플릿만설정. DEV-A source리뷰완료.
- lint/typecheck/Vitest552 및 Playwright productionbuild PASS, actuallocalAuth/Mailpit 신규desktop-mobile4+기존recovery4 PASS. 만료/재사용·반대역할세션·새/기존주소/암호·refresh회수검증. 첫locator충돌/scan5s timeout은수정·재실행증빙보존. 사용자사용량정책에따라 동일build/미변경SQL검증 중복실행하지않음.
- D010 TESTED/runtimeLOCAL_VERIFIED. U007/U008/D009운영메일/템플릿/계정 및 직접AuthAPI·기존D013/D074helper는별도게이트. 증빙 harness/evidence/D010/EMAIL_SESSION_20261124.md, packet deliverables/d010-email-session-20261124/. 운영변경/실결제없음.

## 2026-11-24 — DEV-B D013 세션 생명주기

- main922f34d 통합 후 provider signOut 오류 무시 재현(신규단위3 FAIL)·global 범위/실패 안내 수정. 실제 로컬 양 역할2세션/복수탭/철회refresh/명시만료JWT fixture/재로그인 및 기존 탈퇴 후 접근 차단 회귀 검증. D010/D074와 최종source 공통lint/typecheck/Vitest559/build1회·영향desktop/mobile16 PASS. DEV-A 정적리뷰 추가blocker/공유예약 없음. 기존access JWT 즉시전역폐기는 미검증으로 분리.
- D013 TESTED/runtimeLOCAL_VERIFIED, D009/U007/U008실제Auth/메일/계정/TTL은BLOCKED_EXTERNAL. 증빙 harness/evidence/D013/SESSION_LIFECYCLE_20261124.md. 기존자료/운영DB/키/결제 변경없음.

## 2026-11-24 — DEV-B D074 자기 자료 반출

- 설정 미연결/계정전체 로그인시각 우회 재현(route2 FAIL) 후 현재verified AMR/live session gate+기존PrivacyExport연결. CLI120 신규SQL의 quota account lock/actor 검사·private ACL, 기존티켓/consume/테이블/기록 보존. 실제localAuth/PostgREST 양역할·foreign/wrongtoken·oneuse race·expiry·감사보호·동시8중5·철회JWT RPC거부 및119→120 rollback/failure PASS.
- D013과 같은 최종source 공통검사/productionbuild1회/영향desktop-mobile16 PASS, DEV-A 정적review 추가blocking/예약없음. D074 TESTED/runtimeLOCAL_VERIFIED. U001/D073·운영120/지문/실제요청처리 BLOCKED_EXTERNAL. 증빙 harness/evidence/D074/SESSION_EXPORT_20261124.md, 패킷 deliverables/d074-session-export-20261124/. 운영SQL/키/결제/승인 미실행.

## 2026-11-24 — DEV-B D043 모집·지원 경계

- main44b3dff 뒤 API모집columns미저장/SECDEF신규지원의기존window·capacity검사우회 재현(unit4FAIL/future실제지원성공). 신규121 privatepredicate/applicationtrigger+clock/lock로RPC·REST통합강제, 기존선정/상태/idempotentretry·레거시기록보존. board집계/accepting·조건요약/모집필터/최소마감/만석화면 및명시APIcolumns매핑.
- 실제localSDK/DB 기간·일회중복·1slot경합·만석/마감·role/foreign/private·경계/기존retry 및120→121 fault/rollback/ACL PASS. source lint/typecheck/Vitest564/productionbuild·desktop-mobile6(신규2/기존D0414) PASS. fixturecleanup·초기타입·마감후사라진폼locator·Date.now lint 실패를수정재검증했고원시증거보존. DEV-A추가blocking/번호충돌없음.
- D043 TESTED/runtimeLOCAL_VERIFIED, 운영121/지문·과거metadata·실제채널/계정수용은BLOCKED_EXTERNAL. 수동claim은합성fixture이며실제공급자승인아님. evidence harness/evidence/D043/RECRUITMENT_WINDOW_20261124.md, packet deliverables/d043-recruitment-window-20261124/. 운영DB/키/결제/외부승인없음.

## 2026-11-24 — DEV-B D049 초기 결정·재시도·양측 적격성

- main65ba572 clean/fetch/HEAD후 D043선행충족. 취소 enum/화면누락 및lostACK재시도재현(신규3FAIL), 선택적requestKey/expectedStatus·privateRLS receipt122·클라이언트동일키재시도/취소표시추가. actualDB수신상대연락제한 수락우회추가재현후122불변·123공통acceptance trigger로양측contact/privacy/creator·campaign적격성강제. 기존2argRPC/결과물계약/과거accepted/ACK보존.
- directSDK/RPC5그룹·기존delivery9,121→123원자rollback/fault/ACL,desktop-mobile4(초기decision2/기존결과물2),lint/typecheck/Vitest568/productionbuild/secret/migration123 PASS. SQL123후동일JSbuild재사용. DEV-A122/123추가blocking/예약없음. local-only실제적용검증후ledger123동기화; hosted없음.
- D049 TESTED/runtimeLOCAL_VERIFIED; U014실제승인QA/채널·hosted123/백업/지문은BLOCKED_EXTERNAL. evidence harness/evidence/D049/DECISION_RETRY_20261124.md, packet deliverables/d049-decision-retry-20261124/. D052 read-api/upto계약불일치는별도후속으로기록했으며이번변경에미포함. 운영SQL/키/라이브결제/외부승인없음.

### 2026-11-25 · main CI and production deployment follow-up

- GitHub run 45406304554 accepted the push and passed static checks/build. Playwright reported 75 failures, 35 passes and 4 skips. Vercel withheld the incompatible build through the schema check.
- c1bad00 restored account analytics and email preferences and mapped the Toss failure screen to known codes. Updated CI to run direct database permissions and restore checks even after an E2E failure while preserving the failing exit status. Local lint, typecheck, 568 tests and build passed. Isolated desktop/mobile consent and billing error checks passed.
- Replaced role-only CI admin provisioning with a database-owner grant and real Supabase TOTP. Desktop/mobile health, operations access and analytics preferences passed on isolated Supabase. The direct analytics test verified the funnel is denied before OTP and accessible after verification.
- A network-isolated restore of the hosted snapshot and rollback rehearsal preserved account, campaign, proposal and order counts and created the product RPC. Production fingerprint remains unapproved until current signup policy and channel refresh/publication are verified. See docs/production-readiness/RELEASE_CHECKLIST.md for the blocking findings.
