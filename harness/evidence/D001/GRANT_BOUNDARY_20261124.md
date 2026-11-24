# D001 — 무료 환경의 수동 TEST 이용권 발급 차단

2026-11-24 KST · DEV-B · 로컬 검증 범위. 운영 적용/검증은 BLOCKED_EXTERNAL.

## 기준과 재현

- 원본 작업 디렉터리 HEAD `58d9e336b5bd02ece0e51a90430538e6317f3573`, 시작 `git status --short`는 비어 있었음.
- `git fetch origin main` 후 최신 main `8ec0ec2658aefed7d9918873822dcd0a1ea23ef4`에서 독립 트리 `C:/projects/AD-Me-dev-b-p0`, 브랜치 `codex/dev-b-active-p0-20261124` 생성.
- 작업 중 원격이 전진해 `d471c1b6259bf136a7d93896b94b915d9d64c7fd`를 fast-forward 통합. 상대의 Figma/추천/캠페인 및 원장 변경을 보존한 뒤 최종 검증. D001 항목 외 상대 상태를 수정하지 않음.
- AGENTS, production-readiness SHARED_CONTRACT, 사용자 첨부 DEV-B 문서 및 기존 v2/역사 원장을 확인. 첨부 문서는 담당/수용 기준이며 실제 실행 권한은 현재 사용자 요청을 따름.
- D001은 ACTIVE P0이며 선행 없음. `/pricing`, dashboard, 서버 config/TEST 상품, 구매/관리자 API, 기존 billing boundary/RLS/관리자 MFA/발급·회수 SQL을 함께 조사.
- baseline 새 회귀 테스트: free_beta 또는 test_demo+feature OFF의 관리자 grant API가 **200**(기대404), DB OFF의 fresh-MFA 관리자 직접 RPC도 발급 성공(기대PT404). DB OFF 오류를 API가409로 표시하던 차이도 재현.
- 초기 실패 로그는 ignored `output/d001-unit-before.log`, `output/d001-db-before.log`. 기존 증빙은 수정하지 않음.

## 최소 호환 변경과 검토

- 기존 `/api/admin/entitlements`의 grant에만 서버 `features.testBilling=enabled` 검사 추가. free/설정 누락은404, DB PT404도404로 정규화. 기존 code/requestId, origin/auth/입력/관리자 검사를 보존.
- CLI 3.2.0 도움말 확인 후 `migration new test_entitlement_grant_boundary`로 `20261124074917`(118) 생성. 기존 함수 본문은 `billing_enabled()` 검사 외 동일. 적용된 SQL 수정 없음; 서명·MFA·원장·감사·회수 보존. 새 테이블 없음.
- grant는 기존처럼 요청 키가 없는 수동 작업이다. 성공 발급의 멱등성을 새로 주장하지 않는다. 이번 재시도 증거는 차단된 요청에서 추가 행이 생기지 않는 범위다. 주문 승인 멱등성은 기존 DB 회귀의 첫3그룹에서 별도 확인.
- RELEASE_MANIFEST의 기존117 누락 행을 복원하고118 추가. config/schema/catalog/data 공유 인터페이스 변경 없음.
- DEV-A 채팅으로 변경 범위와 SQL 순번 전달, 읽기 전용 교차 리뷰. 기존 함수가 검사 외 동일함/공유 파일 충돌 없음 확인. P2 요청에 따라 QA의 enabled뿐 아니라 release_ref/changed_at 전체를 중첩 finally에서 복원하고 동일성 검사 추가.
- DEV-A가 P2 보완을 재검토하고 추가 정적 리뷰 차단 사항/마이그레이션 예약 충돌 없음을 확인. 새 DB/브라우저 결과를 공유해 해당 증거 범위로 통합.

## 실행 증거

실제 로컬 PostgreSQL/PostgREST/Auth이며 계정·상품은 합성 fixture다. `localRuntime()`이 loopback URL을 강제한다. Toss SDK 승인·외부 결제/운영 DB 검증으로 대체하지 않는다.

- `npm ci`:413 audited, vulnerabilities0. 별도 트리의 실제 node_modules 사용.
- `npm run lint`, `npm run typecheck`: PASS.
- `npm test`:88 files /523 tests PASS. 최초 빌드 동시 실행에서 기존 secret scanner의5초 timeout1건, 자원 경합 해소 후 같은 timeout/assertion으로 전체 재실행 PASS. ignored `output/d001-unit-final.log`.
- 최종 통합 소스의 직렬 `npm test`:523/523 PASS, `npm run build`:PASS. `output/d001-integrated-unit-final.log`, `output/d001-integrated-build.log`. lint/typecheck도 통합 후 PASS. 소스 범위/상태 요약은 `verification-20261124.json`.
- `node scripts/verify-local-entitlement-migration.mjs`:117→118 SQL의 명시적 rollback 및 division-by-zero 실패 주입 후 함수 정의/ACL이 기존과 같음.
- CLI `migration up --local --workdir output/dev-a-db`:117→118 PASS.
- `npm run setup:qa:local`: marked disposable DB fresh0→118 전체 적용 PASS, 새 로컬5계정/OTP 생성. 최종 역할 REST 재실행 및 무료·TEST 브라우저는 이 새 DB에서 검증.
- `node tests/local-entitlement-boundary-security.mjs`: OFF fresh-admin grant/반복 거부·0행, ON 관리자 성공·anon/brand/creator/stale-MFA 거부·원장1행, OFF 전환 후 기존 행 보존·신규 발급 거부·회수 가능 3그룹 PASS.
- `npm run test:e2e -- --config playwright.free-local.config.ts tests/local-free/entitlement-boundary.spec.ts`: desktop/mobile2 PASS. 무료 요금/TEST 상품0, 기존 TEST 크레딧937 비노출, brand/creator/admin 로그인 후 grant 각2회404 및 행 불변, 일반 역할의 관리자 화면 거부.
- `npm run test:e2e -- --config playwright.local.config.ts tests/local-browser/entitlement-boundary.spec.ts`: desktop/mobile2 PASS. TEST 상품7/격리 안내, 실제 로컬 Auth OTP 검증 관리자 API grant200 → DB OFF 반복404 → revoke200. 공급자 호출 없음.
- 통합 후 unit/browser 병행 시작 시 Playwright가 공유 test-results를 비워 기존 secret-scan log 테스트가 ENOENT 실패. 이후 두 검증을 직렬화하고 결과를 별도 재기록. 제품 코드/기존 테스트/timeout 변경 없이 해결한 실행 경합이며 초기 실패 로그 보존.
- `python -X utf8 harness/migration_check.py`:118 PASS. Windows 기본 cp949 실행의 UnicodeDecodeError는 UTF-8 실행으로 해결, 검사 생략 없음.
- `python -X utf8 -m unittest discover -s harness -p '*test*.py'`:11 PASS; `harness/selftest.py`:5 PASS; `harness/validate_service_backlog.py`:PASS.
- 넓은 `node tests/local-p0-release-security.mjs`: D001 관련 앞3그룹 PASS(가격·반대역할·중복 DB 승인1이용권 포함), 뒤 catalog GET 부정 검사에서 기대405/실제400으로 실패. 해당 파일 전체 PASS 주장 없음. 이번 SQL은 grant 함수만 바꾸므로 catalog 수정은 범위 밖에 남김. ignored `output/d001-release-db.log`.

## 화면·남은 게이트

- 로컬 HTTPS `/pricing`: desktop1440×900, mobile390×664(DPR3). 무료/TEST 캡처를 직접 시각 검토: 구매 영역 분리, 한글·버튼 가독성 및 가로 넘침 없음. 무료 화면과 TEST 화면 캡처는 같은 디렉터리의 `pricing-*-20261124.png`.
- Figma 참조11:271/11:1492와 missing-frames 확인. screenshot API는 edit access 거부. 원본과의 신규 시각 비교는 미검증, UI/CSS 변경 없음.
- 운영 SQL 적용·운영 환경 분리 및 실제 대상 URL의 관리자 동작은 **BLOCKED_EXTERNAL**. 이 변경으로 D001 전체 DONE/VERIFIED 또는 운영 배포 완료를 주장하지 않음.
- 읽기 전용 운영 `GET https://be-celeb.org/pricing`:HTTP200, 무료 베타 포함, `pricing-brand_pro` TEST 상품 없음 확인. 공개 GET 확인은 신규 관리자 경로/SQL의 운영 검증을 의미하지 않음.
- 운영자 패킷: `deliverables/d001-grant-boundary-20261124/README.md`. 기존 운영 ledger41과 로컬118은 동일하지 않으며 이 SQL 단독 운영 적용을 지시하지 않음.
- 복구: 앱 이전 커밋 복귀 가능. SQL은 forward-only; 발급 차단을 유지하고 회수 가능. 기존 발급/계정/캠페인 데이터 삭제 없음.
