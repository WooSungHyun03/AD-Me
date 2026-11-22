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
