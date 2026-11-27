# AD Me 전체 출시 티켓

ALL_TICKETS.json에서 생성했다. 상태와 기존 이력은 검증 범위별로 구분한다.

## D001 · 무료 실서비스·TEST 시연 모드 분리

DEV-B · P0 · S0 출시 차단 · UX · TESTED · 3 SP · ACTIVE

- **현재 문제** — 운영은 무료 모드로 열리지만 독립된 공개 시연/정식 결제 환경과 데이터 격리 증빙이 부족하다.
- **재현·관찰** — 운영 GET /pricing과 격리 TEST 결제 사례를 비교하고 동일 계정의 크레딧·노출이 다른 환경으로 번지지 않는지 검증한다.
- **화면** — /pricing
- **관련 코드** — src/lib/data.ts · src/lib/billing.ts · src/app/pricing/page.tsx
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 실서비스는 무료 기능만 노출하고 TEST 상품·시연 데이터는 별도 환경으로 격리한다.
- **구현** — serviceMode=free_beta/test_demo는 서버 값으로 판정한다. free_beta의 fixture fallback·구매 API·유료 권한 부여를 차단한다. 공개 빌드 플래그만으로 보호하지 않는다.
- **변경 파일** — src/lib/data.ts · src/lib/billing.ts · src/app/pricing/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — 없음
- **영향** — / · /pricing · /dashboard
- **보안** — 동일 사용자로 환경을 바꿔도 TEST entitlement가 무료 실서비스 권한/노출을 변경하지 않아야 한다.
- **검증** — 환경별 라우트·상품·데이터 노출 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 실서비스는 무료 기능만 노출하고 TEST 상품·시연 데이터는 별도 환경으로 격리한다.
- **차단 요인** — 로컬 무료/TEST·역할·반복 거부·회수 검증 범위만 TESTED. 운영 선행 스키마 전환/지문 승인과118 적용, 독립 운영 환경 분리 및 실제 관리자 API 확인은 BLOCKED_EXTERNAL. 실제 Toss 승인·전체 출시 VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D001/ (이번 검증 기록 위치) · harness/evidence/D001/GRANT_BOUNDARY_20261124.md
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492)
- **이전 기록** — OPEN

## D002 · 운영 정책·요금·기능 설명 일치

DEV-A · P0 · S0 출시 차단 · UX · TESTED · 2 SP · ACTIVE

- **현재 문제** — 요금제·도움말·공고·결제 CTA에 내부 TEST/공급자 오류가 섞였다. 이번 main은 1차 정리했고 운영 배포·전체 i18n 검수는 남았다.
- **재현·관찰** — 운영 /pricing과 main Checkout을 비교한다. 실패 응답에 공급자 세부 정보가 사용자 경고로 렌더링되지 않는지 확인한다.
- **화면** — /about
- **관련 코드** — src/lib/billing.ts · docs/PRD.md · src/app/about/page.tsx
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 현재 제공 기능만 안내하고 AI 크레딧 수량·가격 등 문서와 코드의 불일치를 제거한다.
- **구현** — 가격·수량·지원 플랫폼·지표 정의를 단일 상품/기능 설정에서 파생한다. 기존 AI 크레딧 문서와 코드 차이를 실제 값으로 비교 후 정리한다.
- **변경 파일** — src/lib/billing.ts · docs/PRD.md · src/app/about/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D001
- **영향** — / · /pricing · /dashboard
- **보안** — 화면·FAQ·서버 주문 금액의 스냅샷이 동일해야 한다.
- **검증** — 화면·상품 설정·문서 대조 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 현재 제공 기능만 안내하고 AI 크레딧 수량·가격 등 문서와 코드의 불일치를 제거한다.
- **차단 요인** — 로컬 복제 DB·desktop/mobile 범위만 TESTED. 운영 /pricing 배포 후 대조, D001 독립 운영 환경 수용, 전체 i18n 문구 검수는 남음.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D002/README.md · harness/evidence/D002/VERIFY_20261121.md · harness/evidence/DEV-A-P0-FINISH-20261121/verification.json · harness/evidence/D002/ (이번 검증 기록 위치) · harness/evidence/D002/YOUTUBE_GUIDANCE_20261124.md · harness/evidence/D002/VERIFY_20261125.md
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492)
- **검증 범위** — 2026-11-25: freeFeatures 단일 출처, /pricing 동적 렌더, PRD 7개 TEST 상품·가격 일치를 로컬 복제 DB(역할별 성공·거부·재시도)와 desktop/mobile에서 확인. 운영 미검증.
- **이전 기록** — LOCAL_VERIFIED

## D003 · 환경 설정 스키마·누락 진단

DEV-A · P0 · S0 출시 차단 · DEVOPS · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 환경값을 Zod로 검증하고 비밀값 없이 누락된 설정명과 비활성 기능을 표시한다.
- **재현·관찰** — /api/health · 릴리스 환경에서 먼저 누락·잘못된 값·라이브 결제 키 거부 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/supabase.ts, .env.example, src/lib/config.ts.
- **화면** — /api/health · 릴리스 환경
- **관련 코드** — src/lib/supabase.ts · .env.example · src/lib/config.ts
- **DB·RPC** — supabase_migrations.schema_migrations; release, environment 및 실제 적용 RPC 매핑
- **기대 동작** — 환경값을 Zod로 검증하고 비밀값 없이 누락된 설정명과 비활성 기능을 표시한다.
- **구현** — server-only 설정을 별도 모듈에서 검증한다. 아직 구현되지 않은 공급자 설정은 required로 만들지 않는다. 공개 URL은 환경별 origin이다.
- **변경 파일** — src/lib/supabase.ts · .env.example · src/lib/config.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — 없음
- **영향** — /api/health · 릴리스 환경
- **보안** — 누락 설정 진단에는 값·접두사를 포함한 키 일부·연결 토큰을 출력하지 않는다.
- **검증** — 누락·잘못된 값·라이브 결제 키 거부 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 환경값을 Zod로 검증하고 비밀값 없이 누락된 설정명과 비활성 기능을 표시한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D003/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/D003/ (이번 검증 기록 위치) · harness/evidence/D003/CONFIG_20261123.md · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D003/SCHEMA_FINGERPRINT_20261124.md
- **Figma 노드** — [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537)
- **검증 범위** — 2026-11-23 로컬: 앱·legacy mode·CLI·admin health의 동일 모드 해석, 충돌/잘못된 alias 무료 안전 모드와 값 없는 진단, optional TEST 키 진단29건. 운영 적용 미검증. main1710f23 후속: Windows/Linux SQL 지문 정규화·운영 차단7계약 및 실제116 Git 소스/체크아웃 일치 검증. 운영 승인/설정 변경은 없음.
- **이전 기록** — LOCAL_VERIFIED

## D004 · 서버 API 오류·검증 계약 통일

DEV-A · P0 · S0 출시 차단 · BACKEND · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 주요 API에 오류 코드·요청 ID·Zod 검증과 안전한 오류 응답을 적용한다.
- **재현·관찰** — /api/**에서 먼저 잘못된 입력·DB 실패·로그 민감값 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/api.ts, src/app/api/**/route.ts.
- **화면** — /api/**
- **관련 코드** — src/lib/api.ts · src/shared/server/http.ts · src/app/api/**/route.ts
- **DB·RPC** — API가 호출하는 기존 role/ownership RPC
- **기대 동작** — 주요 API에 오류 코드·요청 ID·Zod 검증과 안전한 오류 응답을 적용한다.
- **구현** — 기존 error.message 호환을 유지하며 code/requestId를 추가한다. 입력 실패·인증 실패·권한 실패·경합·한도·외부 장애를 구분한다.
- **변경 파일** — src/lib/api.ts · src/shared/server/http.ts · src/app/api/**/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — 없음
- **영향** — /api/*
- **보안** — 알려지지 않은 예외의 stack/SQL/토큰은 응답에 포함하지 않는다.
- **검증** — 잘못된 입력·DB 실패·로그 민감값 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 주요 API에 오류 코드·요청 ID·Zod 검증과 안전한 오류 응답을 적용한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D004/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D004/ (이번 검증 기록 위치) · harness/evidence/D004/API_20261123.md · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D004/EMPTY_BODY_20261124.md
- **검증 범위** — 2026-11-23 로컬: UTF-8 실제 바이트·거짓 길이·분할 입력·미디어 위장 제한, immutable 응답·동적 문맥 보존·안전한 오류50건. DB/provider 역할 전체 및 운영 미검증. 실제 keyless HTTP 빈 업로드 요청500→401 전진 수정; API25계약 및 desktop/mobile6 HTTP 회귀 통과. DB 권한 성공을 대신하지 않음.
- **이전 기록** — LOCAL_VERIFIED

## D005 · 데모와 실제 데이터 저장·조회 분리

DEV-B · P0 · S0 출시 차단 · DATABASE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. is_demo 필터를 서버에 강제하고 실서비스 API·검색·SEO·통계에서 가상 데이터를 제외한다.
- **재현·관찰** — /creators · /admin/intelligence에서 먼저 직접 API 호출과 검색 결과의 시연 데이터 누출 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/data.ts, src/lib/catalog.ts, supabase/seed.sql.
- **화면** — /creators · /admin/intelligence
- **관련 코드** — src/lib/data.ts · src/lib/catalog.ts · supabase/seed.sql
- **DB·RPC** — creators, creator_identities, source_runtime_policies
- **기대 동작** — is_demo 필터를 서버에 강제하고 실서비스 API·검색·SEO·통계에서 가상 데이터를 제외한다.
- **구현** — 실서비스 질의에 is_demo=false를 서버 강제한다. DB 미설정 시 시연 fallback을 실서비스 성공처럼 반환하지 않는다. 검색/추천/SEO/통계도 같은 정책이다.
- **변경 파일** — src/lib/data.ts · src/lib/catalog.ts · supabase/seed.sql
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D001
- **영향** — /creators · /admin/intelligence
- **보안** — 키 없는 free_beta는 명확한 연결 오류/빈 상태이고 48명 가상 목록으로 대체하지 않는다.
- **검증** — 직접 API 호출과 검색 결과의 시연 데이터 누출 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — is_demo 필터를 서버에 강제하고 실서비스 API·검색·SEO·통계에서 가상 데이터를 제외한다.
- **차단 요인** — 무료/시연 공개 데이터 경계의 로컬 코드·DB·역할 검증 범위만 TESTED. 운영118→119 스키마·지문 승인/적용과 별도 환경·실제 사용자 확인은 BLOCKED_EXTERNAL. legacy 검색 일반 raw 투영은 D075/D033 별도 출시 게이트이며 전체 VERIFIED/DONE 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D005/ (이번 검증 기록 위치) · harness/evidence/D005/DEMO_BOUNDARY_20261124.md
- **이전 기록** — OPEN

## D006 · 핵심 활성화·제품 이벤트 정의

DEV-B · P1 · S1 주요 부족 · PRODUCT · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 가입→탐색→후보 저장→제안→수락 퍼널을 개인정보 최소화 이벤트로 기록한다.
- **재현·관찰** — /admin에서 먼저 중복 이벤트·동의·관리자 집계 검증을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/analytics.ts, src/app/admin/page.tsx.
- **화면** — /admin
- **관련 코드** — src/lib/analytics.ts · src/app/admin/page.tsx
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 가입→탐색→후보 저장→제안→수락 퍼널을 개인정보 최소화 이벤트로 기록한다.
- **구현** — 정의된 이벤트명·발생 시간·가명 주체·중복 키·보존기간을 계약으로 고정한다. 원문 메시지/검색어/이메일은 기본 수집하지 않는다.
- **변경 파일** — src/lib/analytics.ts · src/app/admin/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — 없음
- **영향** — / · /pricing · /dashboard
- **보안** — 이벤트 재전송은 unique key로 한 번만 집계한다.
- **검증** — 중복 이벤트·동의·관리자 집계 검증 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 가입→탐색→후보 저장→제안→수락 퍼널을 개인정보 최소화 이벤트로 기록한다.
- **차단 요인** — 운영 데이터 퍼널 확인은 운영 적용(U004) 후.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D006/ (이번 검증 기록 위치) · harness/evidence/D006/20261126/README.md
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: analytics.spec.ts desktop/mobile PASS, analytics REST PASS. 클라이언트 쓰기와 위조 거부, explore·shortlist 중복 제거(하루 1회), 원시 ID·이메일 미저장(가명 subject), 관리자 전용 퍼널, 수신 거부와 삭제 시 이벤트 삭제. E2E: 수신 거부 토글 유지.
- **이전 기록** — OPEN

## D007 · 라이선스·의존성·출처 목록

DEV-A · P0 · S0 출시 차단 · COMPLIANCE · BLOCKED · 2 SP · ACTIVE

- **현재 문제** — 현재 원장 BLOCKED_EXTERNAL이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 패키지·이미지·로고·외부 데이터의 사용 권한과 재배포 조건을 기록한다.
- **재현·관찰** — /about · /privacy · /licenses에서 먼저 lockfile·자산·라이선스 대조을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: package-lock.json, public/brand, docs/licenses.
- **화면** — /about · /privacy · /licenses
- **관련 코드** — package-lock.json · public/brand · docs/licenses
- **DB·RPC** — source_runtime_policies, consent_log; 사용 정책은 검토 버전으로 관리
- **기대 동작** — 패키지·이미지·로고·외부 데이터의 사용 권한과 재배포 조건을 기록한다.
- **구현** — 직접·간접 패키지 및 자산을 출처/라이선스/수정/재배포 의무로 목록화한다. 알 수 없는 이미지 권리는 확보됨으로 표시하지 않는다.
- **변경 파일** — package-lock.json · public/brand · docs/licenses
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — 없음
- **영향** — /about · /privacy · /licenses
- **보안** — 라이선스 파일 없는 외부 자산은 출시 차단 또는 교체 대상으로 남긴다.
- **검증** — lockfile·자산·라이선스 대조 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 패키지·이미지·로고·외부 데이터의 사용 권한과 재배포 조건을 기록한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다. 2026-11-25: 잠금 506개 일치·고지 감사 gap3 유지. Figma 반입 인물 이미지 3개(hero/editorial/creator-editorial)의 출처·저작권·초상권 근거 없음 — 권리 기록 또는 교체 전 출시 차단(운영자/O001).
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D007/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/D007/VERIFY_20261121.md · harness/evidence/D007/ (이번 검증 기록 위치) · harness/evidence/D007/ASSETS_20261125.md
- **이전 기록** — BLOCKED_EXTERNAL

## D008 · 기능 플래그·단계별 공개

DEV-A · P0 · S0 출시 차단 · DEVOPS · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 수집·LLM·메일·결제 기능을 서버 설정으로 안전하게 켜고 끈다.
- **재현·관찰** — /api/health · 릴리스 환경에서 먼저 꺼진 기능 직접 API 접근·오류 상태 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/config.ts, src/app/api.
- **화면** — /api/health · 릴리스 환경
- **관련 코드** — src/lib/config.ts · src/app/api
- **DB·RPC** — supabase_migrations.schema_migrations; release, environment 및 실제 적용 RPC 매핑
- **기대 동작** — 수집·LLM·메일·결제 기능을 서버 설정으로 안전하게 켜고 끈다.
- **구현** — feature gate는 서버 API와 UI 모두 적용한다. 토글 변경 이벤트·상태·실패 기본값을 정의한다.
- **변경 파일** — src/lib/config.ts · src/app/api
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D003
- **영향** — /api/health · 릴리스 환경
- **보안** — 수집/LLM/billing 토글 off 시 직접 요청으로 우회되지 않는다.
- **검증** — 꺼진 기능 직접 API 접근·오류 상태 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 수집·LLM·메일·결제 기능을 서버 설정으로 안전하게 켜고 끈다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D008/README.md · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D008/VERIFY_20261121.md · harness/evidence/D008/ (이번 검증 기록 위치)
- **이전 기록** — LOCAL_VERIFIED

## D009 · 외부 사용자 이메일 가입 완주

DEV-A · P0 · S0 출시 차단 · AUTH · BLOCKED · 3 SP · ACTIVE

- **현재 문제** — 기존 QA 계정 로그인은 가능하지만 외부 신규 가입 전체와 운영 /signup/resend(404)는 재검증 또는 배포가 필요하다.
- **재현·관찰** — 격리 SMTP/외부 승인 계정으로 가입→수신→일회 링크→재로그인. 운영 /signup/resend 응답과 회귀를 확인한다.
- **화면** — /login · /signup · /settings · /admin
- **관련 코드** — src/app/actions.ts · src/components/auth-form.tsx · src/app/auth
- **DB·RPC** — auth.users, auth.sessions, profiles, administrator_grants
- **기대 동작** — 이메일 인증·재발송·만료 링크·중복 가입·콜백 리다이렉트를 처리한다.
- **구현** — 인증 콜백은 Supabase SSR 방식 하나로 통일한다. code 교환과 token_hash OTP 방식을 섞지 말고 템플릿과 경로를 맞춘다.
- **변경 파일** — src/app/actions.ts · src/components/auth-form.tsx · src/app/auth
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U007 · U008
- **영향** — /login · /signup · /settings · /admin
- **보안** — 임의 next URL·재사용/만료 링크·팀 밖 메일·인증 전 계정 상태를 검증한다.
- **검증** — SMTP 설정 후 신규 외부 이메일로 가입 E2E · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 이메일 인증·재발송·만료 링크·중복 가입·콜백 리다이렉트를 처리한다.
- **차단 요인** — 외부 선행 U007, U008의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/AUTH_PROVIDER_EXECUTION.md · harness/evidence/D009/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/D009/ (이번 검증 기록 위치)
- **Figma 노드** — [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [17 · 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-379) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537) · [17 · 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1546) · [21 · 가입 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2206) · [21 · 가입 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2271) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **이전 기록** — BLOCKED_EXTERNAL

## D010 · 비밀번호 재설정·이메일 변경

DEV-B · P0 · S0 출시 차단 · AUTH · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 PARTIAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 재설정·변경 확인·링크 만료·열린 리다이렉트 방지를 구현한다.
- **재현·관찰** — /settings에서 먼저 메일 링크 및 기존·변경 계정 로그인 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/actions.ts, src/app/auth, src/app/settings/page.tsx.
- **화면** — /settings
- **관련 코드** — src/app/actions.ts · src/app/auth · src/app/settings/page.tsx
- **DB·RPC** — auth.users, auth.sessions, profiles, administrator_grants
- **기대 동작** — 재설정·변경 확인·링크 만료·열린 리다이렉트 방지를 구현한다.
- **구현** — 재설정 요청은 계정 존재 여부를 노출하지 않는다. recovery 세션에서만 새 비밀번호를 적용하고 이메일 변경 확인 단계를 제공한다.
- **변경 파일** — src/app/actions.ts · src/app/auth · src/app/settings/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D009
- **영향** — /login · /signup · /settings · /admin
- **보안** — 이전 링크 재사용·다른 계정 세션 혼동·외부 리다이렉트를 거부한다.
- **검증** — 메일 링크 및 기존·변경 계정 로그인 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 재설정·변경 확인·링크 만료·열린 리다이렉트 방지를 구현한다.
- **차단 요인** — 현재세션 AMR·설정 이메일변경·로컬 양쪽메일/복구 검증만 TESTED. D009/U007/U008 운영 템플릿/secure확인/SMTP·실제 계정 수용은 BLOCKED_EXTERNAL. 직접 Auth API 전체의10분 정책강제와 D013/D074 기존helper 보강은 별도, 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/AUTH_PROVIDER_EXECUTION.md · harness/evidence/D010/ (이번 검증 기록 위치) · harness/evidence/D010/EMAIL_SESSION_20261124.md
- **Figma 노드** — [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537)
- **이전 기록** — PARTIAL_VERIFIED

## D011 · 브랜드·크리에이터 온보딩

DEV-B · P0 · S0 출시 차단 · PRODUCT · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 역할별 필수 항목·진행 상태·재진입을 제공하고 역할 자가 승격을 막는다.
- **재현·관찰** — /settings · /api/account에서 먼저 가입 중단·재로그인·직접 역할 변조 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/auth-form.tsx, src/app/settings/page.tsx, src/app/api/account/route.ts.
- **화면** — /settings · /api/account
- **관련 코드** — src/components/auth-form.tsx · src/app/settings/page.tsx · src/app/api/account/route.ts
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 역할별 필수 항목·진행 상태·재진입을 제공하고 역할 자가 승격을 막는다.
- **구현** — DB profiles.role이 권한 기준이다. user_metadata는 이름/요청 역할 입력일 뿐 권한 근거로 쓰지 않는다. admin 자가 선택은 금지한다.
- **변경 파일** — src/components/auth-form.tsx · src/app/settings/page.tsx · src/app/api/account/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D009
- **영향** — / · /pricing · /dashboard
- **보안** — 온보딩 미완료 상태는 이어서 작성 가능하며 권한 검사 결과는 동일하다.
- **검증** — 가입 중단·재로그인·직접 역할 변조 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 역할별 필수 항목·진행 상태·재진입을 제공하고 역할 자가 승격을 막는다.
- **차단 요인** — 운영 적용 후 실계정 확인(U004)은 운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D011/ (이번 검증 기록 위치) · harness/evidence/D011/20261126/README.md
- **Figma 노드** — [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [17 · 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-379) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537) · [17 · 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1546) · [21 · 가입 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2206) · [21 · 가입 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2271) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **검증 범위** — 2026-11-26 main 격리 로컬: 역할별 단계·DB 기반 진행·가입 중단 후 재로그인 재진입·첫 브리프 후 완료·역할 자가 승격(REST·가입 메타데이터) 거부·/admin 차단, onboarding E2E desktop/mobile 4/4, 단위 3/3.
- **이전 기록** — OPEN

## D012 · 브랜드 프로필·담당자 정보

DEV-A · P0 · S0 출시 차단 · AUTH · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 브랜드명·업종·소개·로고·담당자 공개 범위를 관리하며 사업자 인증을 가입 필수로 요구하지 않는다.
- **재현·관찰** — /api/account에서 먼저 CRUD·공개 DTO·다른 계정 수정 차단을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/account/route.ts, src/components/account-form.tsx.
- **화면** — /api/account
- **관련 코드** — src/app/api/account/route.ts · src/components/account-form.tsx
- **DB·RPC** — auth.users, auth.sessions, profiles, administrator_grants
- **기대 동작** — 브랜드명·업종·소개·로고·담당자 공개 범위를 관리하며 사업자 인증을 가입 필수로 요구하지 않는다.
- **구현** — 브랜드 공개 DTO와 담당자 비공개 DTO를 분리한다. 로고는 D027 업로드 계약을 재사용한다.
- **변경 파일** — src/app/api/account/route.ts · src/components/account-form.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D011
- **영향** — /login · /signup · /settings · /admin
- **보안** — 사업자번호를 필수 입력이나 인증 배지 근거로 요구하지 않는다.
- **검증** — CRUD·공개 DTO·다른 계정 수정 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 브랜드명·업종·소개·로고·담당자 공개 범위를 관리하며 사업자 인증을 가입 필수로 요구하지 않는다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D012/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/D012/VERIFY_20261121.md · harness/evidence/D012/ (이번 검증 기록 위치)
- **이전 기록** — LOCAL_VERIFIED

## D013 · 세션 만료·재인증·로그아웃

DEV-B · P0 · S0 출시 차단 · AUTH · TESTED · 3 SP · ACTIVE

- **현재 문제** — 역할 로그인 접근은 확인했다. TTL 만료·재인증·탈퇴 직후 세션의 전 경로는 미검증이다.
- **재현·관찰** — 격리 DB에서 만료된 세션으로 설정·민감 API·다중 탭을 확인하고 요구 작업만 재인증으로 복구한다.
- **화면** — /login · /signup · /settings · /admin
- **관련 코드** — src/proxy.ts · src/lib/supabase.ts · src/app/actions.ts
- **DB·RPC** — auth.users, auth.sessions, profiles, administrator_grants
- **기대 동작** — 만료 후 재로그인 경로·탭 간 상태·민감 작업 재인증을 처리한다.
- **구현** — getUser/검증된 세션으로 서버 권한을 확인한다. 쿠키 갱신·returnTo 허용 경로·재인증 완료 시점을 명시한다.
- **변경 파일** — src/proxy.ts · src/lib/supabase.ts · src/app/actions.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D009
- **영향** — /login · /signup · /settings · /admin
- **보안** — 민감 작업은 만료/철회된 세션으로 실행되지 않는다.
- **검증** — 만료·새로고침·복수 탭·로그아웃 E2E · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 만료 후 재로그인 경로·탭 간 상태·민감 작업 재인증을 처리한다.
- **차단 요인** — 로컬 Auth 두 역할의 logout/refresh 철회·다중 탭·만료 fixture·재로그인·탈퇴 회귀 검증. D009/U007/U008 운영 Auth/TTL/계정/메일 수용은 BLOCKED_EXTERNAL. 기존 access JWT 즉시 전역 폐기는 주장하지 않으며 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D013/ (이번 검증 기록 위치) · harness/evidence/D013/SESSION_LIFECYCLE_20261124.md · harness/evidence/D013/verification-20261124.json
- **Figma 노드** — [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537)
- **이전 기록** — OPEN

## D014 · 계정 탈퇴·개인정보 삭제 실행

DEV-A · P0 · S0 출시 차단 · PRIVACY · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 프로필 숨김과 계정 삭제를 구분하고 Auth·Storage·파생 데이터·보존 예외·재수집 차단을 처리한다.
- **재현·관찰** — /api/account · /api/profile에서 먼저 삭제 후 접근 거부·삭제 작업 재시도·보존 최소화 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/account/route.ts, src/app/api/profile/route.ts, src/lib/account-deletion.ts.
- **화면** — /api/account · /api/profile
- **관련 코드** — src/app/api/account/route.ts · src/app/api/profile/route.ts · src/lib/account-deletion.ts
- **DB·RPC** — account_deletion_requests, privacy requests, source tombstones, Storage object references
- **기대 동작** — 프로필 숨김과 계정 삭제를 구분하고 Auth·Storage·파생 데이터·보존 예외·재수집 차단을 처리한다.
- **구현** — 삭제 요청→재인증→세션 철회→공개 중단→비동기 삭제→완료를 멱등 상태로 설계한다. 보존 예외는 필드/근거/기한을 기록한다.
- **변경 파일** — src/app/api/account/route.ts · src/app/api/profile/route.ts · src/lib/account-deletion.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D073 · D079
- **영향** — /settings · /privacy · /reports
- **보안** — Auth 삭제만으로 기존 JWT가 즉시 무효라고 가정하지 말고 민감 접근 재검증 또는 정지 상태를 강제한다.
- **검증** — 삭제 후 접근 거부·삭제 작업 재시도·보존 최소화 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 프로필 숨김과 계정 삭제를 구분하고 Auth·Storage·파생 데이터·보존 예외·재수집 차단을 처리한다.
- **차단 요인** — U001 보존/처리 정책과 B D079 물리 삭제·복구 계약 대기. 로컬 접수·접근 차단과 별개로 영구파기/Auth 삭제 어댑터·주기 worker·receipt 분실 복구는 미구현이며 최종 정책·교차 검토 후 연결 필요.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D014/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D014/VERIFY_ALL_20261121.md · harness/evidence/D014/ (이번 검증 기록 위치) · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md
- **이전 기록** — IN_PROGRESS

## D015 · 계정 설정·관심 분야·알림 동의

DEV-B · P1 · S1 주요 부족 · UX · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 서비스 알림·선택적 마케팅·관심 분야를 분리하여 변경 기록을 저장한다.
- **재현·관찰** — /api/account에서 먼저 동의 철회·기본값·메일 발송 대상 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/account-form.tsx, src/app/api/account/route.ts.
- **화면** — /api/account
- **관련 코드** — src/components/account-form.tsx · src/app/api/account/route.ts
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 서비스 알림·선택적 마케팅·관심 분야를 분리하여 변경 기록을 저장한다.
- **구현** — 서비스 필수 알림과 선택 마케팅 동의 목적·버전·시각을 분리한다. 철회는 이전 발송 대기 작업에도 반영한다.
- **변경 파일** — src/components/account-form.tsx · src/app/api/account/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D011
- **영향** — / · /pricing · /dashboard
- **보안** — 가입 체크박스 사전 선택으로 마케팅 동의를 받지 않는다.
- **검증** — 동의 철회·기본값·메일 발송 대상 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 서비스 알림·선택적 마케팅·관심 분야를 분리하여 변경 기록을 저장한다.
- **차단 요인** — 실제 메일 발송 대상 확인은 U007(메일 공급자) 이후.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D015/ (이번 검증 기록 위치) · harness/evidence/D015/20261126/README.md
- **Figma 노드** — [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: consent.spec.ts desktop/mobile PASS, consent REST PASS. 마케팅 기본 미체크, 서비스·마케팅·관심 분야를 따로 저장하고 유지·철회 가능. REST consent: 변경 기록과 철회.
- **이전 기록** — OPEN

## D016 · 관리자 MFA·초대 기반 권한

DEV-A · P0 · S0 출시 차단 · AUTH · TESTED · 5 SP · ACTIVE

- **현재 문제** — 운영 /admin/intelligence는 열리지만 /admin/security와 /admin/reviews가 404이고 ops_enrollment_role RPC가 없다.
- **재현·관찰** — QA 관리자와 일반 브랜드로 대조한다. 격리 실환경에서 MFA 등록·재확인·회수·감사 기록을 확인한다.
- **화면** — /admin
- **관련 코드** — src/app/admin/page.tsx · src/lib/api.ts · src/shared/server/http.ts · src/proxy.ts
- **DB·RPC** — auth.users, auth.sessions, profiles, administrator_grants
- **기대 동작** — 관리자는 별도 프로비저닝·MFA·재인증을 요구하고 UI 숨김에 의존하지 않는다.
- **구현** — 관리자 작업에 DB 역할과 필요한 AAL2/최근 재인증을 서버에서 검사한다. 권한 부여는 감사 가능한 사용자 외부 적용 절차로 준비한다.
- **변경 파일** — src/app/admin/page.tsx · src/lib/api.ts · src/shared/server/http.ts · src/proxy.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U008
- **영향** — /login · /signup · /settings · /admin
- **보안** — UI 차단만으로 완료하지 말고 관리자 RPC/REST 직접 호출을 검사한다.
- **검증** — 일반 계정 관리자 API 거부·MFA 없는 세션 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 관리자는 별도 프로비저닝·MFA·재인증을 요구하고 UI 숨김에 의존하지 않는다.
- **차단 요인** — 외부 선행 U008의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D016/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D016/ (이번 검증 기록 위치) · harness/evidence/D016/REVALIDATE_20261123.md · docs/production-readiness/REFACTOR_IMPACT.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537)
- **검증 범위** — 현재107 격리 DB 직접 권한6그룹: MFA/초대/회수/자기승격/집계 definer와 public CREATE 경계. 합성 JWT이며 외부 U008/실제 운영 OTP 미검증.
- **이전 기록** — LOCAL_VERIFIED

## D017 · 플랫폼별 수집 허용 목록·데이터 계약

DEV-B · P0 · S0 출시 차단 · COMPLIANCE · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 필드·목적·근거·약관 버전·보존기간·갱신주기·재배포 범위를 공급원별로 정의한다.
- **재현·관찰** — /about · /privacy · /licenses에서 먼저 승인 없는 공급원 실행 거부·정책 검토표을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: docs/data-sources, src/lib/ingestion/policy.ts.
- **화면** — /about · /privacy · /licenses
- **관련 코드** — docs/data-sources · src/lib/ingestion/policy.ts
- **DB·RPC** — source_runtime_policies, consent_log; 사용 정책은 검토 버전으로 관리
- **기대 동작** — 필드·목적·근거·약관 버전·보존기간·갱신주기·재배포 범위를 공급원별로 정의한다.
- **구현** — 공급원별 field allowlist·이용 목적·권리 근거·약관 URL/버전·보존/삭제·검토자·허용 상태를 문서와 실행 정책으로 연결한다.
- **변경 파일** — docs/data-sources · src/lib/ingestion/policy.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U001
- **영향** — /about · /privacy · /licenses
- **보안** — 정책 미승인/만료 공급원은 fetch 이전에 중단한다.
- **검증** — 승인 없는 공급원 실행 거부·정책 검토표 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 필드·목적·근거·약관 버전·보존기간·갱신주기·재배포 범위를 공급원별로 정의한다.
- **차단 요인** — 2026-11-26: 격리 계약·권한 검증 통과(증빙 참조). YouTube 등 외부 공급원 정책이 U001 검토 대기(status pending, terms_version 미기록)라 실제 수집 허용 근거가 없다. 완료 표시하지 않는다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D017/ (이번 검증 기록 위치) · harness/evidence/D017/20261126/README.md
- **이전 기록** — OPEN

## D018 · 실제 인플루언서 통합 스키마

DEV-A · P0 · S0 출시 차단 · DATABASE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- **재현·관찰** — /creators · /admin/intelligence에서 먼저 중복·핸들 변경·결측·마이그레이션 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/catalog.ts, src/lib/schemas.ts, supabase/migrations.
- **화면** — /creators · /admin/intelligence
- **관련 코드** — src/lib/catalog.ts · src/lib/schemas.ts · supabase/migrations
- **DB·RPC** — creators, creator_identities, source_runtime_policies
- **기대 동작** — SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- **구현** — 기존 creators JSON DTO와 호환 adapter를 둔다. provider+external_id unique, nullable 지표·출처·관측시각·동의/claim 상태를 정규화한다.
- **변경 파일** — src/lib/catalog.ts · src/lib/schemas.ts · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D017
- **영향** — /creators · /admin/intelligence
- **보안** — 스키마/공개 DTO 버전을 먼저 인계하고 이전 데이터 마이그레이션·역호환을 검증한다.
- **검증** — 중복·핸들 변경·결측·마이그레이션 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D018/README.md · harness/evidence/D018/normalization-security-20261120.json · harness/evidence/D018/packet-terms_18-20261120.json · harness/evidence/D018/ (이번 검증 기록 위치)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **이전 기록** — LOCAL_VERIFIED

## D019 · YouTube 공식 API 수집 어댑터

DEV-A · P0 · S0 출시 차단 · YOUTUBE · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 운영에 공개 채널 10개가 갱신됐다. 크리에이터 소유권 인증·오류/철회 및 쿼터 계약은 별도다.
- **재현·관찰** — DB 운영 집계와 실제 공개 채널을 대조한다. 공식 API fixture로 403/429/404, quota, 불변 channel ID를 검증한다.
- **화면** — /creators/youtube · /settings/youtube · /admin/intelligence
- **관련 코드** — src/lib/ingestion/youtube.ts · tests/ingestion
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — 허용된 채널 seed로 공개 프로필·영상·제공 지표를 수집하고 비공개 지표를 추정값으로 채우지 않는다.
- **구현** — 채널 ID/허용 seed 기반으로 수집한다. API 제공 필드·동영상 통계의 단위·숨김 상태를 보존한다. 저비용 조회를 우선하고 API 키는 서버만 사용한다.
- **변경 파일** — src/lib/ingestion/youtube.ts · tests/ingestion
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · U009
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — quota/rate/404/삭제 채널/숨긴 구독자 수를 구분하고 허용된 fixture로 계약 테스트한다.
- **검증** — 계약 테스트·쿼터 실패·사용자 키 연결 후 실제 채널 검증 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 허용된 채널 seed로 공개 프로필·영상·제공 지표를 수집하고 비공개 지표를 추정값으로 채우지 않는다.
- **차단 요인** — 일반 공식 원본 API에는 U009의 키·권한이 필요하다. 파생·추가 용도의 U010은 D031/PR-002에서 적용한다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D019/ (이번 검증 기록 위치) · harness/evidence/D019/ADAPTER_20261123.md · harness/evidence/D019/OWNERSHIP_20261123.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411)
- **검증 범위** — 실제 공급자 호출 없는 TS20/Python8 계약: 응답·요청 상한, 공개/타 채널 귀속, 숨김/안전 정수, quota·rate·404·전송 실패. 정책·현재 키/소유권/운영 검증은 미완료.
- **이전 기록** — PARTIAL_VERIFIED

## D020 · 허용된 공개 웹 크롤러

DEV-A · P1 · S1 주요 부족 · COMPLIANCE · IN_PROGRESS · 8 SP · GATED

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 허용 목록 도메인에서 약관·권리·robots 검토 후 최소 업무 정보를 수집한다. 로그인·CAPTCHA 우회는 하지 않는다.
- **재현·관찰** — /about · /privacy · /licenses에서 먼저 허용되지 않은 도메인 차단·robots·속도 제한·HTML fixture·실제 허용 샘플 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/ingestion/web.ts, docs/data-sources.
- **화면** — /about · /privacy · /licenses
- **관련 코드** — src/lib/ingestion/web.ts · docs/data-sources
- **DB·RPC** — source_runtime_policies, consent_log; 사용 정책은 검토 버전으로 관리
- **기대 동작** — 허용 목록 도메인에서 약관·권리·robots 검토 후 최소 업무 정보를 수집한다. 로그인·CAPTCHA 우회는 하지 않는다.
- **구현** — URL allowlist·DNS/IP 검증·리다이렉트 재검증·robots·동시성·다운로드 한도·연락 가능한 user agent를 적용한다. 이번 YouTube-only 범위에서는 Instagram/TikTok을 붙이지 않는다.
- **변경 파일** — src/lib/ingestion/web.ts · docs/data-sources
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D017 · D018 · U011
- **영향** — /about · /privacy · /licenses
- **보안** — 내부 IP/메타데이터 주소·로그인 벽·CAPTCHA·허가 없는 도메인은 수집하지 않는다.
- **검증** — 허용되지 않은 도메인 차단·robots·속도 제한·HTML fixture·실제 허용 샘플 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 허용 목록 도메인에서 약관·권리·robots 검토 후 최소 업무 정보를 수집한다. 로그인·CAPTCHA 우회는 하지 않는다.
- **차단 요인** — 외부 선행 U011의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다. 2026-11-26: 격리 계약 — 수집 경계가 원문 HTML 대신 최소 필드(제목·설명·정책 내 canonical)만 반환, 연락처 가림·길이 제한·정책 밖 링크 제거. 단위 9/9·mutation PASS. 실제 허용 소스(U011)·D017·지속 쿼터 연결·실제 샘플은 미완료.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D020/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D020/ (이번 검증 기록 위치) · harness/evidence/D020/MINIMAL_FIELDS_20261126.md
- **이전 기록** — IN_PROGRESS

## D021 · 수집 작업 큐·갱신·삭제·쿼터

DEV-A · P0 · S0 출시 차단 · YOUTUBE · TESTED · 8 SP · ACTIVE

- **현재 문제** — 운영 04:00 KST 일일 작업과 10개 최신 채널을 확인했지만 누락/재시작/할당량 소진 복구는 미검증이다.
- **재현·관찰** — 운영 작업 집계를 읽고 격리 워커에서 하루 대체 시각·중복 tick·락 회수·삭제·재시도와 큐 관찰을 재현한다.
- **화면** — /creators/youtube · /settings/youtube · /admin/intelligence
- **관련 코드** — src/lib/ingestion/jobs.ts · supabase/migrations
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — 체크포인트·지수 백오프·재시도·캐시 만료·일일 한도·삭제 tombstone으로 중복·재수집을 막는다.
- **구현** — 동일 provider/job key 중복 방지·lease/heartbeat·checkpoint·retry_at·max attempts·TTL·tombstone을 저장한다. 별도 영구 서버 대신 DB 작업+허용된 실행기를 쓴다.
- **변경 파일** — src/lib/ingestion/jobs.ts · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D019
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — 사용자 설정 전 외부 cron을 생성하지 않는다. 작업 중단/중복 실행에서도 중복 row와 삭제 데이터 재유입을 막는다.
- **검증** — 429·작업 중단 복구·삭제 재유입·정책별 TTL 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 체크포인트·지수 백오프·재시도·캐시 만료·일일 한도·삭제 tombstone으로 중복·재수집을 막는다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D021/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D021/ (이번 검증 기록 위치) · harness/evidence/D021/CACHE_20261123.md
- **검증 범위** — 현 Python 워커 출력50→5 영상과 실제 격리107 DB 체크포인트 저장/복구7그룹, Python9건 통과. 운영 공급자·cron과 구분.
- **이전 기록** — LOCAL_VERIFIED

## D022 · Instagram 공식 연결 어댑터

DEV-A · P2 · S2 개선 · YOUTUBE · BLOCKED · 8 SP · ARCHIVED

- **현재 문제** — 이 플랫폼은 현재 YouTube 전용 출시 범위에서 제외됐다.
- **재현·관찰** — 메인 내비게이션·가입·새 캠페인·검색 신규 흐름에 해당 플랫폼을 추가하지 않는지 확인한다.
- **화면** — /creators/youtube · /settings/youtube · /admin/intelligence
- **관련 코드** — src/lib/ingestion/instagram.ts
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — YouTube 전용 신규 흐름에 이 플랫폼이 노출되지 않고 과거 기록은 보존된다.
- **구현** — 현재 작업하지 않는다. 역사적 어댑터와 증거를 유지하고 신규 공개 진입점을 추가하지 않는다.
- **변경 파일** — 현재 변경 없음. 역사 기록만 보존
- **신규 파일** — src/app/api/integrations
- **선행 티켓** — D018 · U012
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — 심사 전 mock은 계약 테스트로만 기록하고 임의 계정 전수 탐색을 광고하지 않는다.
- **검증** — 신규 YouTube 화면에 해당 플랫폼의 CTA와 OAuth 링크가 없는지 정적·브라우저 검사.
- **완료 조건** — YouTube 전용 신규 흐름에 이 플랫폼이 노출되지 않고 과거 기록은 보존된다.
- **차단 요인** — 제품 범위 외. 별도 제품 결정과 플랫폼 승인 전 착수하지 않는다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D022/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D022/ (이번 검증 기록 위치)
- **이전 기록** — IN_PROGRESS

## D023 · TikTok 공식 연결 어댑터

DEV-B · P2 · S2 개선 · YOUTUBE · BLOCKED · 8 SP · ARCHIVED

- **현재 문제** — 이 플랫폼은 현재 YouTube 전용 출시 범위에서 제외됐다.
- **재현·관찰** — 메인 내비게이션·가입·새 캠페인·검색 신규 흐름에 해당 플랫폼을 추가하지 않는지 확인한다.
- **화면** — /creators/youtube · /settings/youtube · /admin/intelligence
- **관련 코드** — src/lib/ingestion/tiktok.ts
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — YouTube 전용 신규 흐름에 이 플랫폼이 노출되지 않고 과거 기록은 보존된다.
- **구현** — 현재 작업하지 않는다. 역사적 어댑터와 증거를 유지하고 신규 공개 진입점을 추가하지 않는다.
- **변경 파일** — 현재 변경 없음. 역사 기록만 보존
- **신규 파일** — src/app/api/integrations
- **선행 티켓** — D018 · U013
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — Research API 자격이 있다고 상업적 검색 접근을 허용하지 않는다.
- **검증** — 신규 YouTube 화면에 해당 플랫폼의 CTA와 OAuth 링크가 없는지 정적·브라우저 검사.
- **완료 조건** — YouTube 전용 신규 흐름에 이 플랫폼이 노출되지 않고 과거 기록은 보존된다.
- **차단 요인** — 제품 범위 외. 별도 제품 결정과 플랫폼 승인 전 착수하지 않는다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D023/ (이번 검증 기록 위치)
- **이전 기록** — OPEN

## D024 · 실제 데이터 파일럿 품질 게이트

DEV-B · P0 · S0 출시 차단 · YOUTUBE · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 PARTIAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 허용된 실제 프로필 50~100개를 목표로 중복·출처·갱신·결측·삭제 대응을 표본 검수한다. 확보 수량은 결과로 기록한다.
- **재현·관찰** — /creators/youtube · /settings/youtube · /admin/intelligence에서 먼저 실제 수량·공급원·오류율 증빙, 미확보 수량을 성공 처리하지 않음을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: tests/ingestion, docs/evidence/data-pilot.
- **화면** — /creators/youtube · /settings/youtube · /admin/intelligence
- **관련 코드** — tests/ingestion · docs/evidence/data-pilot
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — 허용된 실제 프로필 50~100개를 목표로 중복·출처·갱신·결측·삭제 대응을 표본 검수한다. 확보 수량은 결과로 기록한다.
- **구현** — 표본별 원본 URL·수집 허용 근거·필드별 최신성·중복·결측·claim을 기록한다. 원문 PII를 공개 evidence에 덤프하지 않는다.
- **변경 파일** — tests/ingestion · docs/evidence/data-pilot
- **신규 파일** — docs/evidence/data-pilot
- **선행 티켓** — D005 · D019 · D021 · U014
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — 50~100은 목표다. 실제 확보한 고유 프로필 수와 실패율을 사실대로 보고한다.
- **검증** — 실제 수량·공급원·오류율 증빙, 미확보 수량을 성공 처리하지 않음 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 허용된 실제 프로필 50~100개를 목표로 중복·출처·갱신·결측·삭제 대응을 표본 검수한다. 확보 수량은 결과로 기록한다.
- **차단 요인** — 외부 선행 U014의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다. 2026-11-26: U014 독립 부분 구현 — 서비스 롤 전용 pilot_quality_samples(20261126130000), 판정 lib·CLI·docs/evidence/data-pilot. 단위 5/5, REST 4/4, 로컬 격리 실행 NOT_MET(가상 데이터 10, 후보 0). 실제 파일럿 수량은 U014·U001·U004 뒤 운영자 실행 대기. 2026-11-27: hasViews가 null/문자열 views를 통과시키던 결함 수정(20261127100000, 숫자만 인정). REST 4/4, 마이그레이션 검사 140 PASS. 운영 적용은 U004.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D024/ (이번 검증 기록 위치) · harness/evidence/D024/20261126/README.md · docs/evidence/data-pilot/README.md · harness/evidence/D024/20261127/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **이전 기록** — PARTIAL_VERIFIED

## D025 · 미청구 프로필과 본인 프로필 청구

DEV-B · P0 · S0 출시 차단 · YOUTUBE · TESTED · 8 SP · ACTIVE

- **현재 문제** — 공개 채널과 AD Me 소유권 확인을 구분하지만 새 실제 참여자의 동의·해제 전체는 미검증이다.
- **재현·관찰** — QA creator의 /settings/youtube를 열고, 사용자 승인 테스트 채널로 소유권 증명·철회 후 공개 DTO/지원권 차단을 비교한다.
- **화면** — /api/profile · /creators/[id]
- **관련 코드** — src/app/api/profile/route.ts · src/app/creators/[id]/page.tsx · src/app/api/claims
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — 수집 프로필은 미인증·협업 의사 미확인으로 표시하고 소유 증명 후에만 수정·제안 수신을 허용한다.
- **구현** — unclaimed/pending/verified/rejected/disputed claim 상태를 운영 상태와 분리한다. OAuth 또는 일회성 소유 증명과 수동 검토를 제공한다.
- **변경 파일** — src/app/api/profile/route.ts · src/app/creators/[id]/page.tsx · src/app/api/claims
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D011 · U014
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — 수집 프로필의 owner_id를 로그인한 사람에게 자동 귀속하지 않는다. claim 전 제안 수신/수락을 금지한다.
- **검증** — 타인 계정 청구·중복 청구·증명 만료 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 수집 프로필은 미인증·협업 의사 미확인으로 표시하고 소유 증명 후에만 수정·제안 수신을 허용한다.
- **차단 요인** — 실제 채널 소유 증명 증거(U014)와 운영 적용(U004)은 외부·운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D025/ (이번 검증 기록 위치) · harness/evidence/D025/20261126/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **검증 범위** — 2026-11-26 main 격리 로컬: 수집 프로필 collected_unverified 표시(견적·협업 의사 미확인), 캠페인 CTA 숨김, 소유 확인 요청 1회 코드·중복 거부, 관리자 코드 불일치 거부·일치 승인, 청구 전 제안 불가(20261125220000·20261126110000), claims REST PASS, claims E2E desktop/mobile 2/2.
- **이전 기록** — PARTIAL_VERIFIED

## D026 · 크리에이터 프로필 편집 확장

DEV-B · P0 · S0 출시 차단 · SECURITY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 분야·분위기·형식·플랫폼 다중 선택, 견적 범위·가용성·견적 미확인을 구분한다.
- **재현·관찰** — /api/profile에서 먼저 CRUD·미입력·권한·모바일 폼 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/profile-form.tsx, src/app/api/profile/route.ts.
- **화면** — /api/profile
- **관련 코드** — src/components/profile-form.tsx · src/app/api/profile/route.ts
- **DB·RPC** — creators, storage.objects, upload reference; signed URL
- **기대 동작** — 분야·분위기·형식·플랫폼 다중 선택, 견적 범위·가용성·견적 미확인을 구분한다.
- **구현** — 견적 미확인은 null, 협업 의사 미확인은 unknown으로 구분한다. 다중 taxonomy 선택과 게시 상태 변경에 운영 잠금을 반영한다.
- **변경 파일** — src/components/profile-form.tsx · src/app/api/profile/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018
- **영향** — /settings · /api/uploads
- **보안** — 클라이언트에서 숨긴 필드도 서버 Zod·DB 제약으로 검증한다.
- **검증** — CRUD·미입력·권한·모바일 폼 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 분야·분위기·형식·플랫폼 다중 선택, 견적 범위·가용성·견적 미확인을 구분한다.
- **차단 요인** — 운영 적용·실계정 검증은 운영자 게이트. 레거시 moderation_locked 가드의 정의자 경로 미동작은 D059/D075와 정리 필요(노출은 moderation_status로 차단 확인).
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D026/ (이번 검증 기록 위치) · harness/evidence/D085/20261125/README.md · harness/evidence/D026/20261125/README.md
- **Figma 노드** — [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **검증 범위** — 2026-11-25 main 077bab2 격리 로컬: 다중 taxonomy, 견적 미확인 null·협업 의사 미확인 null 저장/표시, 서버·DB 검증(반쪽·역전 견적, 허용 외 플랫폼, 비불리언 의사 거부), 운영 제한 프로필 재공개 시 비노출 — REST PASS, E2E desktop/mobile 2/2, 공개 DTO 단위 7/7. 운영 미검증.
- **이전 기록** — OPEN

## D027 · 안전한 이미지·포트폴리오 업로드

DEV-B · P0 · S0 출시 차단 · SECURITY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 파일 크기·실제 MIME·경로·접근권한·삭제를 검증하고 권리 있는 파일만 업로드한다.
- **재현·관찰** — /settings · /api/uploads에서 먼저 위장 파일·다른 소유자 다운로드·고아 파일 정리 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/uploads.ts, src/components/profile-form.tsx, supabase/migrations.
- **화면** — /settings · /api/uploads
- **관련 코드** — src/lib/uploads.ts · src/components/profile-form.tsx · supabase/migrations
- **DB·RPC** — creators, storage.objects, upload reference; signed URL
- **기대 동작** — 파일 크기·실제 MIME·경로·접근권한·삭제를 검증하고 권리 있는 파일만 업로드한다.
- **구현** — private object path는 owner namespace+무작위 ID, MIME magic/용량/확장자 검증, 짧은 signed URL, 참조 테이블과 삭제 job으로 관리한다.
- **변경 파일** — src/lib/uploads.ts · src/components/profile-form.tsx · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D075
- **영향** — /settings · /api/uploads
- **보안** — HTML/SVG 등 실행 가능 파일은 안전한 처리 전략 없으면 차단한다. private 파일을 public bucket으로 우회하지 않는다.
- **검증** — 위장 파일·다른 소유자 다운로드·고아 파일 정리 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 파일 크기·실제 MIME·경로·접근권한·삭제를 검증하고 권리 있는 파일만 업로드한다.
- **차단 요인** — 운영 Storage 정책 적용·실환경 업로드 검증은 U004/U006 전까지 BLOCKED.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D027/ (이번 검증 기록 위치) · harness/evidence/D027/20261125/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **검증 범위** — 2026-11-25 main f2bcd3d 격리 로컬 빈 DB: 위장 HTML·SVG 거부, magic/확장자/5MB, 소유자 전용 짧은 서명 URL, 타 계정·익명 거부, 덮어쓰기·직접 쓰기 거부, 삭제·고아 sweep — REST PASS, E2E desktop/mobile 2/2. 운영 미검증.
- **이전 기록** — OPEN

## D028 · SNS 링크·공식 임베드·공유

DEV-A · P0 · S0 출시 차단 · YOUTUBE · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 허용된 HTTPS 링크·임베드·공개 프로필 공유를 제공하고 무단 이미지 복제를 피한다.
- **재현·관찰** — /creators/[id]에서 먼저 악성 URL·비공개 공유·임베드 실패 처리을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/creators/[id]/page.tsx, src/lib/schemas.ts.
- **화면** — /creators/[id]
- **관련 코드** — src/app/creators/[id]/page.tsx · src/lib/schemas.ts
- **DB·RPC** — adme_ops.channels, adme_ops.channel_claims, adme_ops.jobs, featured_youtube, ops_public_channels
- **기대 동작** — 허용된 HTTPS 링크·임베드·공개 프로필 공유를 제공하고 무단 이미지 복제를 피한다.
- **구현** — SNS URL provider host·경로를 정규화한다. 임베드는 공식 허용 방법·동의/로딩 정책으로 격리하고 실패 시 원본 링크를 제공한다.
- **변경 파일** — src/app/creators/[id]/page.tsx · src/lib/schemas.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D026
- **영향** — /creators/youtube · /settings/youtube · /admin/intelligence
- **보안** — javascript/data/protocol-relative 악성 URL·비공개 프로필 공유는 거부한다.
- **검증** — 악성 URL·비공개 공유·임베드 실패 처리 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 허용된 HTTPS 링크·임베드·공개 프로필 공유를 제공하고 무단 이미지 복제를 피한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다. 2026-11-25 CSP frame-src가 youtube-nocookie를 막아 임베드가 열리지 않던 결함 수정(로컬 desktop/mobile PASS). 운영 확인 미완료.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D028/README.md · harness/evidence/D028/VERIFY_20261121.md · harness/evidence/DEV-A-P0-FINISH-20261121/verification.json · harness/evidence/D028/ (이번 검증 기록 위치) · harness/evidence/D084/LOCAL_BROWSER_20261125.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **이전 기록** — LOCAL_VERIFIED

## D029 · 실제 광고 이력 제출·출처 검증

DEV-A · P0 · S0 출시 차단 · YOUTUBE · TESTED · 8 SP · ACTIVE

- **현재 문제** — 운영 /ad-history/new는 크리에이터 계정에서 404다. 근거 있는 광고 이력 제출·검토 화면을 최신 스키마와 함께 승격해야 한다.
- **재현·관찰** — 크리에이터 QA를 로그인하고 /ad-history/new 404를 확인. 격리에서 등록·근거 검증·정정 이후 공개 필드만 표시되는지 확인한다.
- **화면** — /creators/[id]
- **관련 코드** — src/app/api/ad-history · src/app/creators/[id]/page.tsx · supabase/migrations
- **DB·RPC** — ad history, channel snapshots, verified source provenance and consent
- **기대 동작** — 브랜드·기간·형식·경제적 이해관계 표시·증거 URL·제출자·검토 상태를 저장한다. 단순 브랜드 언급을 광고로 확정하지 않는다.
- **구현** — 제출/검토/정정 버전, 광고 근거 종류·URL·표시 확인·이해관계·검토자·날짜를 저장한다. 기계 탐지 결과는 검토 대기로만 둔다.
- **변경 파일** — src/app/api/ad-history · src/app/creators/[id]/page.tsx · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D057
- **영향** — /creators/youtube/[id] · /ad-history/new
- **보안** — 실제 브랜드 로고·콘텐츠를 무단 복제하거나 단순 언급을 확정 광고로 만들지 않는다.
- **검증** — 허위·중복·정정·권한·검토 전후 공개 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 브랜드·기간·형식·경제적 이해관계 표시·증거 URL·제출자·검토 상태를 저장한다. 단순 브랜드 언급을 광고로 확정하지 않는다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D029/PLAN_20261120.md · harness/evidence/D029/README.md · harness/evidence/D029/ad-history-security-v29-20261120.json · harness/evidence/D029/ (이번 검증 기록 위치) · harness/evidence/D029/REVALIDATE_20261123.md
- **Figma 노드** — [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **검증 범위** — 현재107 격리 DB 실제 SQL/PostgREST8그룹 통과. 독립 가상 프로필 fixture로 변경; 기존 seed 부재 및 QA 관리자 초대 만료 실패를 수정 후 검증. 운영/출처 검토와 구분.
- **이전 기록** — LOCAL_VERIFIED

## D030 · 광고 이력 타임라인·경력 필터

DEV-A · P1 · S1 주요 부족 · YOUTUBE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 실제 검증 이력 기반 브랜드·카테고리·기간 필터와 브랜드별 경쟁사 표식을 제공한다.
- **재현·관찰** — /creators/[id]에서 먼저 근거 없는 이력 제외·사용자 정의 경쟁사 교차 접근 차단을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/creators/[id]/page.tsx, src/app/api/ad-history.
- **화면** — /creators/[id]
- **관련 코드** — src/app/creators/[id]/page.tsx · src/app/api/ad-history
- **DB·RPC** — ad history, channel snapshots, verified source provenance and consent
- **기대 동작** — 실제 검증 이력 기반 브랜드·카테고리·기간 필터와 브랜드별 경쟁사 표식을 제공한다.
- **구현** — 검색 가능한 광고 이력 DTO를 D029와 공유한다. 경쟁사 목록은 브랜드/팀 소유 자료이며 공개 프로필 평판으로 쓰지 않는다.
- **변경 파일** — src/app/creators/[id]/page.tsx · src/app/api/ad-history
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D029
- **영향** — /creators/youtube/[id] · /ad-history/new
- **보안** — 검토 취소/정정 시 타임라인과 집계가 같이 갱신된다.
- **검증** — 근거 없는 이력 제외·사용자 정의 경쟁사 교차 접근 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 실제 검증 이력 기반 브랜드·카테고리·기간 필터와 브랜드별 경쟁사 표식을 제공한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D030/VERIFY_READY_20261122.md · harness/evidence/DEV-A-READY-20261122/verification.json · harness/evidence/D030/ (이번 검증 기록 위치)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **이전 기록** — LOCAL_VERIFIED

## D031 · 실제 성과 그래프·지표 정의

DEV-A · P1 · S1 주요 부족 · YOUTUBE · TESTED · 5 SP · GATED

- **현재 문제** — 공개 원본과 최근 영상 필터는 있으나 7/30/90일 평균·증가량의 허용된 운영 소스 계약이 비어 있다.
- **재현·관찰** — 공개 영상 화면을 확인하고 원본만으로 평균 경로가 비활성인지 검증. 적법한 creator 자료·두 시점 fixture에서 평균/증감 정의를 검증한다.
- **화면** — /creators/[id]
- **관련 코드** — src/app/creators/[id]/page.tsx · src/lib/metrics.ts
- **DB·RPC** — ad history, channel snapshots, verified source provenance and consent
- **기대 동작** — 확인 가능한 시계열과 집계 산식·기간·출처를 표시하고 타깃 인구통계는 미제공 상태로 남긴다.
- **구현** — 원본 지표와 파생 지표·기간·표본·산식을 구분한다. 지연/누락 데이터를 0으로 잇지 않는다.
- **변경 파일** — src/app/creators/[id]/page.tsx · src/lib/metrics.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D021 · U010
- **영향** — /creators/youtube/[id] · /ad-history/new
- **보안** — 정책 수락 전 제한되는 YouTube 파생 지표를 비활성화하고 원본 지표 표시만 제공한다.
- **검증** — 결측·수집 지연·표본 부족·공식 지표와 파생 지표 구분 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 확인 가능한 시계열과 집계 산식·기간·출처를 표시하고 타깃 인구통계는 미제공 상태로 남긴다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D031/VERIFY_READY_20261122.md · harness/evidence/DEV-A-READY-20261122/verification.json · harness/evidence/D031/ (이번 검증 기록 위치)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **이전 기록** — LOCAL_VERIFIED

## D032 · 유사 프로필·신고·정정 진입

DEV-B · P1 · S1 주요 부족 · MATCHING · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 근거 있는 태그 유사 후보와 프로필별 정정·삭제 요청 경로를 제공한다.
- **재현·관찰** — /creators/[id]에서 먼저 가상 프로필 섞임·비공개 후보·신고 연결 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/catalog.ts, src/app/creators/[id]/page.tsx.
- **화면** — /creators/[id]
- **관련 코드** — src/lib/catalog.ts · src/app/creators/[id]/page.tsx
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 근거 있는 태그 유사 후보와 프로필별 정정·삭제 요청 경로를 제공한다.
- **구현** — 태그 기반 유사도의 결정적 기준·제외 조건·미공개 후보 제외를 정한다. 공유는 공개 DTO만 사용한다.
- **변경 파일** — src/lib/catalog.ts · src/app/creators/[id]/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D033 · D058
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 추천 이유에 민감 속성이나 수집되지 않은 인구통계를 넣지 않는다.
- **검증** — 가상 프로필 섞임·비공개 후보·신고 연결 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 근거 있는 태그 유사 후보와 프로필별 정정·삭제 요청 경로를 제공한다.
- **차단 요인** — 운영 확인은 운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D032/ (이번 검증 기록 위치) · harness/evidence/D032/20261126/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420)
- **검증 범위** — 2026-11-26 main 격리 로컬: 공개 태그 기반 유사 후보(데모·실제 분리, 팔로워·가격 미사용, 공통 태그 근거)와 프로필별 정정·삭제 요청 진입, similar unit PASS, similar E2E desktop/mobile PASS.
- **이전 기록** — OPEN

## D033 · 서버 검색·페이지네이션·인덱스

DEV-A · P0 · S0 출시 차단 · MATCHING · TESTED · 8 SP · ACTIVE

- **현재 문제** — 공개 주제·정렬은 동작하나 운영에 filtered_creator_catalog RPC가 없고 현재 공개 큐레이션·등록 조건 검색의 전체 동작이 일치하지 않는다.
- **재현·관찰** — 운영 /creators에서 주제와 정렬을 변경하고 실제 결과를 확인한다. 스테이징에서 정렬 동률·cursor 경계 중복/누락과 후보 DTO 권한을 검증한다.
- **화면** — /creators · /explore · /compare · /campaigns/[id]
- **관련 코드** — src/components/catalog.tsx · src/lib/data.ts · src/app/api/creators
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 전체 프로필 브라우저 전송을 없애고 공개 DTO·정렬·페이지 크기 제한·검색 인덱스를 적용한다.
- **구현** — search/category/platform/tag/price/availability/follower/cursor/limit 입력을 Zod로 검증한다. 허용 정렬에 id tie-breaker를 둔다.
- **변경 파일** — src/components/catalog.tsx · src/lib/data.ts · src/app/api/creators · src/app/creators/page.tsx · src/app/figma-theme.css
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D005
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 서버 limit 상한·전체 개수 정책·필터별 인덱스를 검증하고 owner_id/비공개 필드를 응답에서 제거한다.
- **검증** — 페이지 중복·비공개 누출·합의된 데이터량의 쿼리 성능 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 전체 프로필 브라우저 전송을 없애고 공개 DTO·정렬·페이지 크기 제한·검색 인덱스를 적용한다.
- **차단 요인** — D005와 실제 데이터 회귀, USER 조율105→107 DB 적용 및 합의된 데이터량 성능 검증이 남았다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D033/ (이번 검증 기록 위치) · harness/evidence/D033/DIRECTORY_20261123.md · docs/design/visual-review.md (Figma 탐색 DB 연결, 데스크톱·모바일 주제 필터 및 정렬 E2E)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [23 · 모바일 상세 필터](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2303)
- **검증 범위** — 로컬 계약10건 + 실제 격리 Postgres/PostgREST5개 그룹(가상67/적격63), 세 정렬 다중 페이지·필터·권한·철회 통과. 운영/대규모 성능/브라우저 최종 배치는 별도. Figma 탐색 레이아웃에서 격리 Playwright 데스크톱·모바일 주제 필터 및 정렬 재검증. 고급 조건의 데이터 정책·전체 반응형 Figma 일치도는 별도.
- **이전 기록** — OPEN

## D034 · 다중 필터·URL 상태·빈 결과

DEV-A · P0 · S0 출시 차단 · FRONTEND · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 플랫폼·분야·태그·가격·가용성·팔로워 필터를 조합하고 URL 복원·초기화·0과 결측을 구분한다.
- **재현·관찰** — /creators에서 먼저 필터 조합·새로고침·모바일·경계값 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/catalog.tsx, src/app/creators/page.tsx.
- **화면** — /creators
- **관련 코드** — src/components/catalog.tsx · src/app/creators/page.tsx
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 플랫폼·분야·태그·가격·가용성·팔로워 필터를 조합하고 URL 복원·초기화·0과 결측을 구분한다.
- **구현** — URLSearchParams와 필터 상태를 일치시키고 다중 선택 의미(필드 내 OR/필드 간 AND)를 명시한다. 검색 요청 취소/경합을 처리한다.
- **변경 파일** — src/components/catalog.tsx · src/app/creators/page.tsx · src/app/figma-theme.css
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D033
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 이전 검색의 늦은 응답이 최신 결과를 덮어쓰지 않는다.
- **검증** — 필터 조합·새로고침·모바일·경계값 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 플랫폼·분야·태그·가격·가용성·팔로워 필터를 조합하고 URL 복원·초기화·0과 결측을 구분한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D034/README.md · harness/evidence/D034/PLAN_20261120.md · harness/evidence/D034/VERIFY_20261121.md · harness/evidence/D034/ (이번 검증 기록 위치) · docs/design/visual-review.md (Figma 탐색 DB 연결, 데스크톱·모바일 주제 필터 및 정렬 E2E)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [23 · 모바일 상세 필터](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2303)
- **검증 범위** — Figma 탐색 레이아웃에서 격리 Playwright 데스크톱·모바일 주제 필터 및 정렬 재검증. 고급 조건의 데이터 정책·전체 반응형 Figma 일치도는 별도.
- **이전 기록** — LOCAL_VERIFIED

## D035 · 지표 가용성 기반 필터

DEV-A · P1 · S1 주요 부족 · YOUTUBE · TESTED · 3 SP · GATED

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 참여율·연령·성별 필터는 적법하게 확보된 데이터가 있는 공급원만 제공한다.
- **재현·관찰** — /creators/youtube/[id] · /ad-history/new에서 먼저 데이터 없는 필터 미노출·출처·산식 확인을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/catalog.tsx, src/lib/metrics.ts.
- **화면** — /creators/youtube/[id] · /ad-history/new
- **관련 코드** — src/components/catalog.tsx · src/lib/metrics.ts
- **DB·RPC** — ad history, channel snapshots, verified source provenance and consent
- **기대 동작** — 참여율·연령·성별 필터는 적법하게 확보된 데이터가 있는 공급원만 제공한다.
- **구현** — 공급원별 제공 가능 지표·산식·샘플 크기를 API meta로 전달한다. 값 없는 필터는 숨기거나 이유와 함께 비활성화한다.
- **변경 파일** — src/components/catalog.tsx · src/lib/metrics.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D031
- **영향** — /creators/youtube/[id] · /ad-history/new
- **보안** — 결측값을 필터 최솟값 0으로 통과시키지 않는다.
- **검증** — 데이터 없는 필터 미노출·출처·산식 확인 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 참여율·연령·성별 필터는 적법하게 확보된 데이터가 있는 공급원만 제공한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D035/VERIFY_READY_20261122.md · harness/evidence/DEV-A-READY-20261122/verification.json · harness/evidence/D035/ (이번 검증 기록 위치)
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [23 · 모바일 상세 필터](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2303)
- **이전 기록** — LOCAL_VERIFIED

## D036 · 후보 그룹·캠페인별 shortlist

DEV-B · P0 · S0 출시 차단 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 기존 즐겨찾기를 이름 있는 그룹·캠페인 후보로 확장하고 중복을 방지한다.
- **재현·관찰** — /api/saved · /campaigns/[id]에서 먼저 그룹 CRUD·캠페인 소유권·재로그인 유지을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/saved/route.ts, src/app/campaigns/[id]/page.tsx.
- **화면** — /api/saved · /campaigns/[id]
- **관련 코드** — src/app/api/saved/route.ts · src/app/campaigns/[id]/page.tsx
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 기존 즐겨찾기를 이름 있는 그룹·캠페인 후보로 확장하고 중복을 방지한다.
- **구현** — saved list/list_items와 campaign shortlist의 소유/팀 범위를 분리하고 unique 제약을 둔다. 기존 즐겨찾기를 기본 목록으로 이관한다.
- **변경 파일** — src/app/api/saved/route.ts · src/app/campaigns/[id]/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D043
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 다른 캠페인 ID를 연결해도 소유권을 우회할 수 없다.
- **검증** — 그룹 CRUD·캠페인 소유권·재로그인 유지 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 기존 즐겨찾기를 이름 있는 그룹·캠페인 후보로 확장하고 중복을 방지한다.
- **차단 요인** — 운영 마이그레이션 20261125130000 적용과 실환경 검증은 운영자 승인(U004) 전까지 BLOCKED. 팀 범위 목록은 팀 모델 부재로 owner 범위 유지.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D036/ (이번 검증 기록 위치) · harness/evidence/D036/20261125/README.md · harness/evidence/D036/20261125-dashboard/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510)
- **검증 범위** — 2026-11-25 origin/main 77fd552 격리 로컬 복제본(마이그레이션 125): 공개 참조 기반 그룹/캠페인 후보 추가·재시도·삭제, 타 계정·anon·숨김 크리에이터 거부 21건, E2E desktop/mobile 4/4. 운영 미적용. 후속: 대시보드 저장 크리에이터를 기본 목록 공개 DTO로 전환, E2E desktop/mobile 12/12.
- **이전 기록** — OPEN

## D037 · 저장 검색·신규 후보 알림

DEV-A · P1 · S1 주요 부족 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 운영 /saved-searches가 404이며 새 후보 알림의 실제 운영 발송이 확인되지 않았다.
- **재현·관찰** — 브랜드 계정으로 /saved-searches 진입 후 별도 배포에서 저장/재실행과 알림 동의에 따른 outbox를 확인한다.
- **화면** — /creators · /explore · /compare · /campaigns/[id]
- **관련 코드** — src/app/api/saved-searches · src/lib/notifications
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 검색 조건 버전을 저장하고 동의한 사용자에게 신규 후보 요약을 제공한다.
- **구현** — 검색 조건 schema version·마지막 알림 cursor·신규 후보 판정을 저장한다. D052 인앱 알림으로 먼저 제공하고 이메일은 D053 이후다.
- **변경 파일** — src/app/api/saved-searches · src/lib/notifications
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D034 · D052
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 동일 후보 갱신이 매번 새 알림을 만들지 않는다.
- **검증** — 조건 변경·중복 알림·해지·삭제 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 검색 조건 버전을 저장하고 동의한 사용자에게 신규 후보 요약을 제공한다.
- **차단 요인** — 2026-11-25 로컬 TESTED: 저장 검색 새 후보 인앱 알림(opt-in·조건 버전 baseline·중복 방지·해지·삭제·동시 실행 잠금·이메일 제외) 구현, 복제 DB 8그룹·브라우저 desktop/mobile PASS. 운영 마이그레이션 20261125150000 적용·지문 승인(운영자), 이메일 알림은 D053/U007 이후.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D037/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D037/ (이번 검증 기록 위치) · harness/evidence/D037/REVALIDATE_20261123.md · harness/evidence/D037/ALERTS_20261125.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510)
- **검증 범위** — 109-source 실제 로컬 Auth/PostgREST/SQL7그룹: 본인 저장/재실행·CAS·해지/삭제·한도. 새 후보 알림은 미구현/미검증.
- **이전 기록** — IN_PROGRESS

## D038 · CSV 가져오기·내보내기 보강

DEV-B · P1 · S1 주요 부족 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 템플릿·크기 제한·미리보기·행별 오류·중복·출처 필수값과 수식 주입 방지를 제공한다.
- **재현·관찰** — /api/export에서 먼저 악성 CSV·한글 인코딩·부분 오류·다른 팀 자료 접근 차단을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/csv.ts, src/app/api/export/route.ts, src/app/api/import.
- **화면** — /api/export
- **관련 코드** — src/lib/csv.ts · src/app/api/export/route.ts · src/app/api/import
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 템플릿·크기 제한·미리보기·행별 오류·중복·출처 필수값과 수식 주입 방지를 제공한다.
- **구현** — parse→validate→preview→commit 2단계로 구성한다. 공급원/권한 근거·고유 ID를 포함하고 외부 URL 수집을 업로드 즉시 실행하지 않는다.
- **변경 파일** — src/lib/csv.ts · src/app/api/export/route.ts · src/app/api/import
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 행 한도·바이트 한도·수식/CSV injection·한글·부분 실패 결과를 검증한다.
- **검증** — 악성 CSV·한글 인코딩·부분 오류·다른 팀 자료 접근 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 템플릿·크기 제한·미리보기·행별 오류·중복·출처 필수값과 수식 주입 방지를 제공한다.
- **차단 요인** — 운영 마이그레이션 적용(U004)은 운영자 게이트. 템플릿 다운로드 라우트는 직접 단언하는 테스트 없음.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D038/ (이번 검증 기록 위치) · harness/evidence/D085/20261125/README.md · harness/evidence/D038/20261126/README.md
- **검증 범위** — 2026-11-26 main 격리 빈 DB: csv-import E2E desktop/mobile PASS(미리보기→부분 반영·왕복·타 계정 차단), csv 단위 5/5(인코딩·수식·행별 오류·중복·출처·크기 제한), lists-public-refs REST PASS.
- **이전 기록** — OPEN

## D039 · 자연어 검색→확인 가능한 필터

DEV-A · P0 · S0 출시 차단 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 홈은 명시 조건 일치 방식이다. 한국어 자연어 질의를 승인된 구조와 확인 가능한 필터로 바꾸는 운영 흐름은 미확인이다.
- **재현·관찰** — 같은 카탈로그에 한국어 질의 5종을 주고 기존 필터와 비교한다. 범위 밖 민감 추론과 가짜 후보, 잘못된 JSON은 배제한다.
- **화면** — /creators · /explore · /compare · /campaigns/[id]
- **관련 코드** — src/lib/search-parser.ts · src/components/catalog.tsx
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 파서 기본값과 선택적 LLM을 제공하고 변환 조건을 사용자가 확인·수정한다.
- **구현** — 지원 필터 JSON 스키마에만 매핑하고 설명 가능한 deterministic parser를 기본으로 한다. LLM은 제안으로만 반환한다.
- **변경 파일** — src/lib/search-parser.ts · src/components/catalog.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D034 · D048
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 모호한 예산·팔로워 단위를 사용자 확인 없이 확정하지 않는다.
- **검증** — 환각 조건·지원하지 않는 필터·키 없는 fallback · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 파서 기본값과 선택적 LLM을 제공하고 변환 조건을 사용자가 확인·수정한다.
- **차단 요인** — 결정론적 로컬 범위 TESTED. 선택 LLM/운영 worker 통합과 B 교차 검토·실제 운영 URL 수용은 미완료. 정책/권한을 우회하거나 VERIFIED/DONE으로 간주하지 않는다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D039/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D039/ (이번 검증 기록 위치) · harness/evidence/D039/YOUTUBE_SCOPE_20261124.md · docs/production-readiness/REFACTOR_IMPACT.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 결정론적 YouTube 자연어 조건 제안6 단위/desktop-mobile2 시나리오 통과. 부정·제외·OR·비지원 플랫폼 차단, 명시 확인/취소 및 실제 URL/필터 반영. 실제 LLM/provider 검증과 구분.
- **이전 기록** — IN_PROGRESS

## D040 · 개인 CRM 메모·후보 비교 리포트

DEV-B · P1 · S1 주요 부족 · UX · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 공개 메시지와 비공개 메모를 분리하고 2~3인 비교·출처·공유 범위를 저장한다.
- **재현·관찰** — /compare에서 먼저 상대방 메모 접근 차단·비공개 공유·CSV 비교 결과을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/compare/page.tsx, src/app/api/notes.
- **화면** — /compare
- **관련 코드** — src/app/compare/page.tsx · src/app/api/notes
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 공개 메시지와 비공개 메모를 분리하고 2~3인 비교·출처·공유 범위를 저장한다.
- **구현** — 비교 항목·근거·신선도·결측·메모를 분리한다. private/team note는 공개 메시지와 다른 테이블·권한으로 저장한다.
- **변경 파일** — src/app/compare/page.tsx · src/app/api/notes
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D036
- **영향** — / · /pricing · /dashboard
- **보안** — 비교 공유 링크를 통해 비공개 메모·campaign 금액이 노출되지 않는다.
- **검증** — 상대방 메모 접근 차단·비공개 공유·CSV 비교 결과 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 공개 메시지와 비공개 메모를 분리하고 2~3인 비교·출처·공유 범위를 저장한다.
- **차단 요인** — 운영 적용(U004) 후 확인.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D040/ (이번 검증 기록 위치) · harness/evidence/D040/20261126/README.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: compare.spec.ts desktop/mobile PASS, notes REST PASS. 비공개 메모는 소유자만 보고, 공유 비교 링크는 공개 필드만 보이며 철회할 수 있다. CSV 비교. REST notes: 소유자 외 접근 차단.
- **이전 기록** — OPEN

## D041 · 캠페인 기간·예산·산출물 계약

DEV-B · P0 · S0 출시 차단 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- **재현·관찰** — /api/campaigns에서 먼저 날짜 순서·음수·예산 단위·필수 조건 검증을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/campaign-form.tsx, src/app/api/campaigns/route.ts, src/lib/schemas.ts.
- **화면** — /api/campaigns
- **관련 코드** — src/components/campaign-form.tsx · src/app/api/campaigns/route.ts · src/lib/schemas.ts · src/app/jobs/forms.tsx · src/app/jobs/new/page.tsx · src/app/jobs/[id]/page.tsx
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- **구현** — KST 입력/UTC 저장, KRW 정수·현금/제품 제공 구분·수량·사용권·독점 조건을 검증한다. 날짜 경계와 모집 상태를 분리한다. Figma 전환 · 캠페인 작성과 상세 조건을 디자인에 맞췄다. 신규 모집 필드와 이미지·권한은 기존 DTO와 맞춘 뒤 추가한다.
- **변경 파일** — src/components/campaign-form.tsx · src/app/api/campaigns/route.ts · src/lib/schemas.ts · src/app/jobs/forms.tsx · src/app/jobs/new/page.tsx · src/app/jobs/[id]/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D012
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 사업자/결제 기능이 없어도 무료 캠페인 협업 조건 기록은 동작한다.
- **검증** — 날짜 순서·음수·예산 단위·필수 조건 검증 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D041/README.md · harness/evidence/DEV-A-CONTINUE-20261120B/verification.json · harness/evidence/D041/ (이번 검증 기록 위치) · docs/design/visual-review.md · docs/production-readiness/FIGMA_RELEASE_20261124.md
- **Figma 노드** — [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [08 · 캠페인 작성 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-921) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [08 · 캠페인 작성 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-970) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [18 · 캠페인 게시 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1063) · [18 · 캠페인 게시 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1072)
- **검증 범위** — 격리 DB에서 무료 캠페인 등록·게시와 데스크톱·모바일 지원 동선을 검증했다. 운영의 무료 게시 계약은 스키마 전환에서 검증한다.
- **이전 기록** — LOCAL_VERIFIED

## D042 · 캠페인 복제·brief·첨부 버전

DEV-A · P1 · S1 주요 부족 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 복제 시 참여자·메시지 등 개인정보를 복사하지 않고 brief 파일 버전을 관리한다.
- **재현·관찰** — /api/campaigns에서 먼저 복제 소유권·파일 권한·이전 버전 복구을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/campaigns/route.ts, src/components/campaign-form.tsx.
- **화면** — /api/campaigns
- **관련 코드** — src/app/api/campaigns/route.ts · src/components/campaign-form.tsx
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 복제 시 참여자·메시지 등 개인정보를 복사하지 않고 brief 파일 버전을 관리한다.
- **구현** — 캠페인 복제는 brief 필드만 whitelist 복사한다. brief 파일은 immutable version+active pointer로 관리한다.
- **변경 파일** — src/app/api/campaigns/route.ts · src/components/campaign-form.tsx
- **신규 파일** — src/lib/campaign-brief-files.ts · src/components/campaign-brief-files.tsx · src/app/campaigns/[id]/brief/page.tsx · src/app/api/campaigns/[id]/brief · supabase/migrations/20261123121526_campaign_brief_file_versions.sql · supabase/migrations/20261123122650_brief_upload_attestation_snapshot.sql · supabase/migrations/20261123123531_brief_account_budget.sql
- **선행 티켓** — D027 · D041 · U001 · D079
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 메시지·지원자·개인 메모·기존 파일 공개권한을 새 캠페인에 그대로 복제하지 않는다.
- **검증** — 복제 소유권·파일 권한·이전 버전 복구 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 복제 시 참여자·메시지 등 개인정보를 복사하지 않고 brief 파일 버전을 관리한다.
- **차단 요인** — 새 수집 기본OFF. U001 최종 정책/보존과 B D079 새 버킷·고아/만료/계정 삭제 물리 정리·export 및60초 기존 서명 링크 검토 전 활성화 금지. USER DB/앱 적용과 운영 회귀 별도.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D042/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D042/ (이번 검증 기록 위치) · harness/evidence/D042/VERSIONS_PLAN_20261123.md · harness/evidence/D042/FILES_20261123.md
- **Figma 노드** — [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [08 · 캠페인 작성 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-921) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [08 · 캠페인 작성 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-970)
- **검증 범위** — 112-source 본인 전용 불변 첨부/active pointer/재시도·CAS·복원·복제 분리. API9+복제5, 실제 로컬DB/Storage9그룹, desktop/mobile4 시나리오 통과. 실제 정책/저작권·물리 정리/운영 별도.
- **이전 기록** — IN_PROGRESS

## D043 · 캠페인 상태·모집 탐색·지원자

DEV-B · P0 · S0 출시 차단 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 브랜드 공고 초안·TEST 주문 계약이 격리에서 통과했다. 운영 유료 게시·지원과 승인된 채널 조건의 전체 순환은 미검증이다.
- **재현·관찰** — 격리 브랜드 상품→공고→게시권→공개→인증 크리에이터 지원→마감/상태를 확인. 실제 Toss 승인 증거는 D066과 독립으로 기록한다.
- **화면** — /campaigns · /api/campaigns · /api/proposals
- **관련 코드** — src/app/campaigns/page.tsx · src/app/api/campaigns/route.ts · src/app/api/proposals/route.ts · src/app/jobs/page.tsx · src/app/jobs/actions.ts · tests/e2e/marketplace.spec.ts
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 모집 종료·중복 지원·마감 후 지원·선정 인원·비공개 전환 규칙을 서버에서 강제한다.
- **구현** — 허용 상태 전이·모집 마감·capacity·지원 unique·선정 경합을 DB transaction/RPC로 강제한다. Figma 전환 · 캠페인 목록에서 범위·마감 순서를 검증한다. 임시 저장·게시·마감은 기존 marketplace RPC에 연결한다.
- **변경 파일** — src/app/campaigns/page.tsx · src/app/api/campaigns/route.ts · src/app/api/proposals/route.ts · src/app/jobs/page.tsx · src/app/jobs/actions.ts · tests/e2e/marketplace.spec.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D041
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 클라이언트 시간 조작이나 동시 요청으로 모집 인원을 초과하지 않는다.
- **검증** — 마감 경계·동시 선정·다른 브랜드 접근 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 모집 종료·중복 지원·마감 후 지원·선정 인원·비공개 전환 규칙을 서버에서 강제한다.
- **차단 요인** — 양 역할 free-beta actual local DB/RPC·API/UI 모집 기간/마감·중복 retry·1slot 선정경합·반대권한 및120→121 검증. D085 hosted121/지문·과거metadata검토/실제채널·운영계정 수용은 BLOCKED_EXTERNAL; D066 공급자 TEST 별도, 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D043/ (이번 검증 기록 위치) · docs/design/visual-review.md · harness/evidence/D043/RECRUITMENT_WINDOW_20261124.md · harness/evidence/D043/verification-20261124.json
- **Figma 노드** — [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [08 · 캠페인 작성 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-921) · [09 · 캠페인 지원 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1002) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [08 · 캠페인 작성 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-970) · [09 · 캠페인 지원 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1039) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [18 · 캠페인 게시 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1063) · [19 · 캠페인 지원 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1081) · [18 · 캠페인 게시 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1072) · [19 · 캠페인 지원 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1090)
- **이전 기록** — OPEN

## D044 · 추천 하드 조건·결측·점수 계약

DEV-A · P0 · S0 출시 차단 · MATCHING · TESTED · 8 SP · ACTIVE

- **현재 문제** — 기본 조건 추천은 실제 공개 채널을 반환하지만 오디언스·7/30/90 조회수·승인 데이터·크레딧까지 일관된 경로는 부족하다.
- **재현·관찰** — 동일 실제 공개 집합에서 음식과 테크 조건을 변경한다. 차단·누락·비공개·HOT 변화에도 일반 결과와 순위 규칙을 대조한다.
- **화면** — /creators · /explore · /compare · /campaigns/[id]
- **관련 코드** — src/lib/catalog.ts · tests/matching.test.ts
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 현재 소프트 점수인 예산·분야의 하드/선호 조건을 명시하고 초기 가중치·결측 재정규화·데이터 충실도를 일관되게 계산한다.
- **구현** — eligibility를 scoring 전에 평가한다. 예산/분야는 hard/soft 정책 입력으로 명시하고 미확인 예산·카테고리는 정책별 제외/보류 처리한다.
- **변경 파일** — src/lib/catalog.ts · tests/matching.test.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D041
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 0분모·결측·tie-break·가중치 합·hard gate 위반 테스트를 고정한다.
- **검증** — 고정 데이터셋 점수·경계값·입력 순서 독립성·결측 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 현재 소프트 점수인 예산·분야의 하드/선호 조건을 명시하고 초기 가중치·결측 재정규화·데이터 충실도를 일관되게 계산한다.
- **차단 요인** — 실데이터/정책·D041 실환경 회귀, 배포 조율과 기존 snapshot-v1 대비 통합 검증이 남았다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D044/ (이번 검증 기록 위치) · harness/evidence/D044/MATCHING_20261123.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 현재 추천 폼의 hard/soft/unknown과 scorer1.2 연결, 결측 가중치·보류 적격·안전 숫자·정렬·HOT 독립성 포함39개 합성 단위/action/DTO 테스트 통과. 운영 및 SQL snapshot-v1 통합과 구분.
- **이전 기록** — OPEN

## D045 · 추천 이유·출처·스냅샷·재계산

DEV-A · P0 · S0 출시 차단 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 추천 이유는 조건 근거가 일부 보이지만 운영에서 사용자별 버전 스냅샷, 새로고침 및 재계산 무결성을 확인하지 못했다.
- **재현·관찰** — 동일 입력과 소스 버전을 두 번 조회하고 타 계정 거부, 목록에서 사라진 채널, 결과 재사용과 재계산 분리를 검증한다.
- **화면** — /matches
- **관련 코드** — src/app/matches/page.tsx · src/lib/catalog.ts · supabase/migrations
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 점수 버전·입력·태그·예산 적합·미확인 항목을 저장하고 광고 슬롯과 순위를 분리한다.
- **구현** — recommendation snapshot에 model_version/input/source versions/score/coverage/reasons를 저장한다. 데이터 갱신 시 이전 결과임을 알린다.
- **변경 파일** — src/app/matches/page.tsx · src/lib/catalog.ts · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D044
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 유료 HOT 입력은 organic scoring 함수로 전달하지 않는다.
- **검증** — 동일 입력 재현·갱신 표시·HOT 유무 순위 동일 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 점수 버전·입력·태그·예산 적합·미확인 항목을 저장하고 광고 슬롯과 순위를 분리한다.
- **차단 요인** — 현재1.2 정책/결측/보류·운영 가상 제외와 불변1.0 호환 로컬 검증 완료. USER 정확112→113 기준 적용·배포와 실제 URL/교차 검토는 미완료.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D045/PLAN_20261120.md · harness/evidence/D045/README.md · harness/evidence/D045/verification.json · harness/evidence/D045/ (이번 검증 기록 위치) · harness/evidence/D045/POLICY_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md
- **Figma 노드** — [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **이전 기록** — LOCAL_VERIFIED

## D046 · 추천 피드백·평가 데이터셋

DEV-B · P1 · S1 주요 부족 · MATCHING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 적합/부적합 사유·수락 결과를 저장하고 데이터 희소성·특정 규모 편향을 검토한다.
- **재현·관찰** — /matches에서 먼저 평가 기준·회귀 비교·개인정보 최소화·오프라인 평가을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/matches/page.tsx, src/app/api/matching-feedback.
- **화면** — /matches
- **관련 코드** — src/app/matches/page.tsx · src/app/api/matching-feedback
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 적합/부적합 사유·수락 결과를 저장하고 데이터 희소성·특정 규모 편향을 검토한다.
- **구현** — 피드백 주체·캠페인·후보·모델 버전·사유를 기록하고 결과 유출 없는 평가 split을 정의한다.
- **변경 파일** — src/app/matches/page.tsx · src/app/api/matching-feedback
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D045
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 맞음 클릭만으로 모델 성능이 증명됐다고 보고하지 않는다.
- **검증** — 평가 기준·회귀 비교·개인정보 최소화·오프라인 평가 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 적합/부적합 사유·수락 결과를 저장하고 데이터 희소성·특정 규모 편향을 검토한다.
- **차단 요인** — 운영 적용(U004)은 운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D046/ (이번 검증 기록 위치) · harness/evidence/D046/20261126/README.md
- **Figma 노드** — [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 2026-11-26 main 격리 로컬: 서버 재계산 순위·점수로 rate_recommendation(공개 참조 해석) 저장, 평가자 전용 조회, 목록 밖·잘못된 사유 거부, feedback REST PASS, match-feedback E2E desktop/mobile 2/2.
- **이전 기록** — OPEN

## D047 · 추천 실험·가중치·임베딩

DEV-A · P2 · S2 개선 · MATCHING · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 기준 모델과 실험 모델을 분리하고 허용된 콘텐츠로만 임베딩하며 YouTube 파생 지표 정책 적용 여부를 검토한다.
- **재현·관찰** — /tools에서 먼저 기준 대비 평가·출처 권한·비용 상한·삭제 전파을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/matching-experiments, src/app/tools/page.tsx.
- **화면** — /creators · /compare · /admin/intelligence
- **관련 코드** — src/lib/matching-experiments.ts · src/lib/matching-eval.ts · scripts/intelligence_worker.py
- **DB·RPC** — creators, saved lists/searches, campaign recommendation snapshots, marketplace_search
- **기대 동작** — 기준 모델과 실험 모델을 분리하고 허용된 콘텐츠로만 임베딩하며 YouTube 파생 지표 정책 적용 여부를 검토한다.
- **구현** — 기준 모델 고정·실험 설정 버전·승인된 콘텐츠의 벡터·원본 삭제 전파·비용 상한을 정의한다.
- **변경 파일** — src/lib/matching-experiments.ts · src/lib/matching-eval.ts · scripts/intelligence_worker.py
- **신규 파일** — src/lib/matching-experiments
- **선행 티켓** — D046 · U010
- **영향** — /creators · /explore · /compare · /campaigns/[id]
- **보안** — 약관상 허용되지 않은 파생 분석·무단 이미지 임베딩을 만들지 않는다.
- **검증** — 기준 대비 평가·출처 권한·비용 상한·삭제 전파 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 기준 모델과 실험 모델을 분리하고 허용된 콘텐츠로만 임베딩하며 YouTube 파생 지표 정책 적용 여부를 검토한다.
- **차단 요인** — 외부 선행 U010의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D047/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D047/ (이번 검증 기록 위치)
- **Figma 노드** — [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **이전 기록** — IN_PROGRESS

## D048 · 콘셉트·제안문·요약 AI 어댑터

DEV-A · P1 · S1 주요 부족 · AI · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 스튜디오는 제거됐고 Local AI 한국어 추론/API는 살아 있다. 기존 사용자용 초안 화면을 재도입할 근거는 없다.
- **재현·관찰** — /tools 및 /tools/local 리디렉션, 격리 AI 작업 API, 실제 로컬 JSON 응답과 모델 장애 시 기본 추천 유지 확인.
- **화면** — /admin/intelligence · /api/intelligence
- **관련 코드** — src/app/api/intelligence/route.ts · src/lib/ai · scripts/intelligence_worker.py
- **DB·RPC** — adme_ops.jobs, ops_draft_create; API 유지·스튜디오 경로 유지 금지
- **기대 동작** — 기존 내부 템플릿·Local AI API 어댑터에 입력·출처·프롬프트 버전·결과 검증·사용량 계약이 적용되고 AI 스튜디오 사용자 경로는 계속 리디렉션된다.
- **구현** — concept/proposal/summary/brief별 schema·프롬프트 버전·provider adapter·timeout·usage를 둔다. 외부 콘텐츠는 신뢰할 수 없는 입력이다. 사용자 AI 스튜디오와 공개 초안 생성 UI는 재도입하지 않고, AI가 필요한 추천·운영 지원에 내부 어댑터를 재사용한다. 모델 호출 코드·입출력 검증·자동 테스트는 A가 담당하고 운영 모델 설치·가동·복구 작업은 PR-003 운영자에게 인계한다.
- **변경 파일** — src/app/api/intelligence/route.ts · src/lib/ai · scripts/intelligence_worker.py
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D003 · D008
- **영향** — /admin/intelligence · /api/intelligence
- **보안** — 초안은 자동 전송하지 않는다. 키 미설정/실패 시 템플릿 fallback과 생성 방식을 표시한다.
- **검증** — 키 없음·프롬프트 주입·개인정보 유출·타임아웃·사용량 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 기존 내부 템플릿·Local AI API 어댑터에 입력·출처·프롬프트 버전·결과 검증·사용량 계약이 적용되고 AI 스튜디오 사용자 경로는 계속 리디렉션된다.
- **차단 요인** — 소유 상품 operation의 기존 예산 큐 소비/사전·사후 heartbeat/엄격한 출처 계약 연결 완료(f8087d7), PR-001 로컬 end-to-end는 합성 결과로 검증. OPERATOR PR-003 실제 worker/model host, B D086 TTL/전역동시성·실환경 수용 별도; 이번 세션 모델 host 가동 없음. 2026-11-25: 템플릿 fallback이 입력 연락처를 그대로 노출하던 결함 수정(template-v3, 4종 테스트), 모델 미가동 상태 API·리디렉션·추천 desktop/mobile 확인. 실제 모델 host는 PR-003 운영자.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D048/ (이번 검증 기록 위치) · harness/evidence/D048/DEADLINE_20261123.md · harness/evidence/D048/QUEUE_PROVENANCE_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/D048/OWNED_OPERATION_20261124.md · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D048/TEMPLATE_PII_20261125.md
- **Figma 노드** — [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 공통 호환 어댑터11건: 취소 무시 provider 절대 응답 제한/늦은 결과 폐기·한도 실패/안전 usage·schema·PII·명시 template. 실제 모델/worker 통합과 별도.
- **이전 기록** — PARTIAL_VERIFIED

## D049 · 제안·지원·상태 머신 회귀

DEV-B · P0 · S0 출시 차단 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 격리에서 미인증 지원 수락이 차단됐다. 인증된 양측 사용자로 실제 확정·결과물 연동까지 검증한 기록은 없다.
- **재현·관찰** — 권한이 승인된 QA 쌍에서 제안/지원→수락→역할별 목록을 비교하고 상태·idempotency·동시 요청 검증.
- **화면** — /api/proposals
- **관련 코드** — src/app/api/proposals/route.ts · src/components/deal-controls.tsx · supabase/migrations · src/app/jobs/[id]/page.tsx · src/app/jobs/forms.tsx
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 제안/지원/수락/거절/취소/수정요청/완료와 중복·경합·참여자 권한을 검증한다.
- **구현** — 현 상태 전이를 읽고 기존 데이터와 호환되는 회귀 테스트부터 작성한다. 상태 변경+이력+알림 event는 단일 원자 작업이다. Figma 전환 · 브랜드 초안 저장과 공개 접근 거부를 격리 확인했다. 게시·지원·양측 채팅 및 새 상태 화면은 후속 확인 대상이다.
- **변경 파일** — src/app/api/proposals/route.ts · src/components/deal-controls.tsx · supabase/migrations · src/app/jobs/[id]/page.tsx · src/app/jobs/forms.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D043
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — unclaimed/blocked/suspended 상대의 협업 진입과 동시 수락/거절을 검사한다.
- **검증** — 두 역할 E2E·동시 요청·DB 이력 원자성 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 제안/지원/수락/거절/취소/수정요청/완료와 중복·경합·참여자 권한을 검증한다.
- **차단 요인** — actual local 양 역할 취소/수락 lostACK동일키·동시경합·이력/알림 원자성·미청구/차단/양측제한/moderation 거부 및121→123 검증. U014 실제 승인 QA/채널·hosted123/백업/지문/적용은 BLOCKED_EXTERNAL. 기존 versioned delivery fixture와 구분하며 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D049/ (이번 검증 기록 위치) · docs/design/visual-review.md · docs/production-readiness/FIGMA_RELEASE_20261124.md · harness/evidence/D049/DECISION_RETRY_20261124.md · harness/evidence/D049/verification-20261124.json
- **Figma 노드** — [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [08 · 캠페인 작성 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-921) · [09 · 캠페인 지원 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1002) · [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [08 · 캠페인 작성 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-970) · [09 · 캠페인 지원 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1039) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519) · [18 · 캠페인 게시 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1063) · [19 · 캠페인 지원 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1081) · [18 · 캠페인 게시 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1072) · [19 · 캠페인 지원 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1090)
- **검증 범위** — 격리 DB에서 캠페인→지원→수락→두 브라우저 메시지 수신→새로고침→제3자 거부가 데스크톱·모바일에서 통과했다.
- **이전 기록** — OPEN

## D050 · 협업 조건 변경·합의 이력

DEV-B · P1 · S1 주요 부족 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 예산·산출물·일정 수정안을 버전으로 남기고 양측 확인 전 확정으로 표시하지 않는다.
- **재현·관찰** — /api/proposals에서 먼저 이전 합의 보존·동시 수정·권한 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/deal-controls.tsx, src/app/api/proposals/route.ts.
- **화면** — /api/proposals
- **관련 코드** — src/components/deal-controls.tsx · src/app/api/proposals/route.ts
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 예산·산출물·일정 수정안을 버전으로 남기고 양측 확인 전 확정으로 표시하지 않는다.
- **구현** — agreement_versions에 작성자·조건·버전·양측 동의·대체 관계를 기록한다. 합의는 플랫폼 전자서명/정산 보장과 구분한다.
- **변경 파일** — src/components/deal-controls.tsx · src/app/api/proposals/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 한쪽이 금액을 바꿔도 양측 승인 전 확정 상태가 되지 않는다.
- **검증** — 이전 합의 보존·동시 수정·권한 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 예산·산출물·일정 수정안을 버전으로 남기고 양측 확인 전 확정으로 표시하지 않는다.
- **차단 요인** — 운영 적용(U004)은 운영자 게이트. 합의 변경 알림 연동은 범위 밖.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D050/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D050/ (이번 검증 기록 위치) · harness/evidence/D050/20261126/README.md
- **Figma 노드** — [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [09 · 캠페인 지원 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1002) · [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [09 · 캠페인 지원 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1039) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483)
- **검증 범위** — 2026-11-26 main 격리 로컬: agreement_offers/events + RPC(20261126120000), 상대 동의 전 미확정·기존 합의 보존·기대 버전·멱등 키·동시 제안 단일 반영·외부인/직접 쓰기 거부·종료 협업 읽기 전용, agreements REST PASS, E2E desktop/mobile 2/2.
- **이전 기록** — IN_PROGRESS

## D051 · 메시지 페이지·첨부·스팸 방지

DEV-B · P0 · S0 출시 차단 · CHAT · TESTED · 5 SP · ACTIVE

- **현재 문제** — 격리 브라우저에서 대화 내역과 재전송 계약을 확인했다. 운영 참가자·네트워크 끊김·첨부의 전체 흐름이 남았다.
- **재현·관찰** — 격리 대화를 다시 열고 새 메시지, 정렬, 페이지 경계, 응답 유실, 다른 계정 거부를 확인한다.
- **화면** — /api/messages · /dashboard
- **관련 코드** — src/app/api/messages/route.ts · src/app/dashboard/page.tsx
- **DB·RPC** — messages, proposal_reads, user_blocks, notification outbox
- **기대 동작** — 페이지네이션·중복 전송 방지·속도 제한·신고·참여자 접근과 안전한 첨부를 제공한다.
- **구현** — message idempotency key·cursor pagination·길이 한도·참여자·차단 상태 검사를 서버에 둔다. 첨부는 D027 재사용한다.
- **변경 파일** — src/app/api/messages/route.ts · src/app/dashboard/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049 · D027 · D076
- **영향** — /dashboard · /api/messages
- **보안** — 미리 만들어 둔 signed URL만으로 다른 방의 첨부를 영구 열람하지 못한다.
- **검증** — XSS·다른 방 접근·재시도 중복·대량 발송 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 페이지네이션·중복 전송 방지·속도 제한·신고·참여자 접근과 안전한 첨부를 제공한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D051/README.md · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/DEV-A-SCHEMA-20261120/rate-security.json · harness/evidence/D051/ (이번 검증 기록 위치)
- **Figma 노드** — [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483)
- **이전 기록** — LOCAL_VERIFIED

## D052 · 미읽음·인앱 알림·실시간 갱신

DEV-B · P0 · S0 출시 차단 · CHAT · TESTED · 5 SP · ACTIVE

- **현재 문제** — 미읽음·채팅 컴포넌트가 있으나 운영의 두 역할 실시간 수신과 reconnect가 완주되지 않았다.
- **재현·관찰** — 두 브라우저 세션과 제3자 계정으로 권한 분리, 새 메시지·미읽음, 중복·재접속을 검증한다.
- **화면** — /api/read · /dashboard
- **관련 코드** — src/app/api/read/route.ts · src/app/dashboard/page.tsx · src/lib/notifications
- **DB·RPC** — messages, proposal_reads, user_blocks, notification outbox
- **기대 동작** — 단순 읽음 버튼을 넘어 이벤트·미읽음 수·읽음 커서·알림함을 구현한다.
- **구현** — notification event unique와 per-user read cursor를 저장한다. 읽음 시각의 단조 증가·정확한 unread 집계를 보장한다.
- **변경 파일** — src/app/api/read/route.ts · src/app/dashboard/page.tsx · src/lib/notifications
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049
- **영향** — /dashboard · /api/messages
- **보안** — realtime은 갱신 신호이고 권한 검사는 서버/DB에서 다시 수행한다. polling fallback을 제공한다.
- **검증** — 복수 탭·중복 이벤트·다른 계정 구독·재로그인 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 단순 읽음 버튼을 넘어 이벤트·미읽음 수·읽음 커서·알림함을 구현한다.
- **차단 요인** — 운영 앱 배포와 실환경 두 역할 실시간 수신 검증은 운영자 승인(U005·U019) 전까지 BLOCKED. null 견적 공개 프로필이 캠페인 상세 카탈로그를 깨는 D026/D033 교차 이슈를 DEV-A에 인계. 2026-11-25 DEV-A D037이 notifications를 additive 확장(kind saved_search, proposal_id nullable, saved_search_id/new_count, 서비스 이메일 트리거 제외) — 기존 제안 알림 계약 불변, DEV-B 확인 요청.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D052/ (이번 검증 기록 위치) · harness/evidence/D052/20261125/README.md · harness/evidence/D037/ALERTS_20261125.md
- **Figma 노드** — [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **검증 범위** — 2026-11-25 origin/main d5a9b9b 격리 로컬 복제본: /api/read 커서·대시보드 배지 복원, REST(원천 1건·정확한 미읽음·단조 커서·타 계정/anon 거부·realtime 본인4/타인0)와 E2E desktop/mobile 6/6(2탭 실시간·재로그인·오래된 커서 재전송·polling fallback). 운영 미검증.
- **이전 기록** — OPEN

## D053 · 이메일 알림 outbox·수신 설정

DEV-B · P1 · S1 주요 부족 · CHAT · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 인증 메일과 서비스/마케팅 메일을 구분하고 발송 재시도·동의·수신거부를 관리한다.
- **재현·관찰** — /dashboard · /api/messages에서 먼저 중복 발송·실패·해지·설정 후 실제 배달 확인을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/notifications, supabase/migrations.
- **화면** — /dashboard · /api/messages
- **관련 코드** — src/lib/notifications · supabase/migrations
- **DB·RPC** — messages, proposal_reads, user_blocks, notification outbox
- **기대 동작** — 인증 메일과 서비스/마케팅 메일을 구분하고 발송 재시도·동의·수신거부를 관리한다.
- **구현** — outbox unique event+recipient+channel, retry/dead-letter, preference lookup, template version을 설계한다.
- **변경 파일** — src/lib/notifications · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D052 · U007
- **영향** — /dashboard · /api/messages
- **보안** — SMTP 인증메일 설정과 앱 알림메일 발송 어댑터는 별도임을 문서화하고 공급자 설정 전 실제 발송 성공을 주장하지 않는다.
- **검증** — 중복 발송·실패·해지·설정 후 실제 배달 확인 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 인증 메일과 서비스/마케팅 메일을 구분하고 발송 재시도·동의·수신거부를 관리한다.
- **차단 요인** — 2026-11-26: 격리 계약·권한 검증 통과(증빙 참조). 실제 메일 공급자 설정과 배달 확인(U007)이 남아 있어 완료 표시하지 않는다. 2026-11-27: 앱 알림 메일 Resend API 어댑터 구현(configuredSender: RESEND_API_KEY+ADME_MAIL_FROM, Idempotency-Key, 오류는 상태·고정 이름만). 단위 9/9, 전체 608, 빌드 PASS. Vercel 키 등록(U006/U007)과 실수신 확인 대기 — 그 전에는 발송 0.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D053/ (이번 검증 기록 위치) · harness/evidence/D053/20261126/README.md · harness/evidence/D053/20261127/README.md
- **Figma 노드** — [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510)
- **이전 기록** — OPEN

## D054 · 결과물 버전·수정 요청·승인

DEV-B · P0 · S0 출시 차단 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 운영에는 delivery_transition RPC가 없어 최신 결과물 버전 전이를 그대로 승격할 수 없다.
- **재현·관찰** — 운영 RPC 존재 여부와 staging 복제본을 대조. 승인·중복·오래된 revision·거부·수정 요청을 검증한다.
- **화면** — /api/proposals
- **관련 코드** — src/components/deal-controls.tsx · src/app/api/proposals/route.ts
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 링크 제출을 버전·검토 의견·승인 근거·광고 표시 체크로 확장한다.
- **구현** — submission/review version·수정 사유·활성 버전·승인자·시각을 보존한다. 단순 URL 등록에서 검토 상태를 분리한다.
- **변경 파일** — src/components/deal-controls.tsx · src/app/api/proposals/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049 · D029
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 구버전 승인이 새 제출본을 완료 처리하지 않는다.
- **검증** — 수정 중복·확정 버전 불변·참여자별 승인 권한 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 링크 제출을 버전·검토 의견·승인 근거·광고 표시 체크로 확장한다.
- **차단 요인** — 운영 delivery_transition 적용(U004)은 운영자 게이트. playwright.local deliverables.spec(TLS·프로덕션 빌드 환경)은 미실행 — 같은 규칙을 DB 스위트·golden path로 확인.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D054/PLAN_20261120.md · harness/evidence/D054/README.md · harness/evidence/D054/verification.json · harness/evidence/D054/ (이번 검증 기록 위치) · harness/evidence/D054/20261125/README.md · harness/evidence/D054/20261126/README.md
- **Figma 노드** — [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **검증 범위** — 2026-11-26 main 격리 로컬: local-delivery-security 10/10(중복 수정 요청·구버전 승인 차단·확정 불변·참여자 권한·광고 표시 확인), service golden path desktop/mobile PASS(빈 DB), proposals REST 수정 요청 경로 PASS.
- **이전 기록** — LOCAL_VERIFIED

## D055 · 일정·마일스톤·지연 알림

DEV-A · P1 · S1 주요 부족 · MARKETPLACE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 캠페인·협업별 마감·타임존·캘린더·리마인더를 제공한다.
- **재현·관찰** — /dashboard에서 먼저 시간 경계·일정 변경·중복 알림 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/dashboard/page.tsx, src/lib/schedules.ts.
- **화면** — /dashboard
- **관련 코드** — src/app/dashboard/page.tsx · src/lib/notifications.ts
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 캠페인·협업별 마감·타임존·캘린더·리마인더를 제공한다.
- **구현** — 마일스톤 완료 조건·타임존·기한 변경 이력·중복 리마인더 방지를 정의한다.
- **변경 파일** — src/app/dashboard/page.tsx · src/lib/notifications.ts
- **신규 파일** — 새 일정 도메인이 필요할 경우 src/lib/schedules.ts 및 실시간 일정 회귀 테스트
- **선행 티켓** — D041 · D052
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 외부 calendar 연동 없이 내부 달력과 기한 필터부터 완주한다.
- **검증** — 시간 경계·일정 변경·중복 알림 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 캠페인·협업별 마감·타임존·캘린더·리마인더를 제공한다.
- **차단 요인** — 기존 private calendar/일정 계약과 B D052 milestone/지연 event cursor·outbox·opt-in·중복·해지·삭제 통합 필요. 운영 알림 전달은 미검증. 2026-11-25: 진행 중 협업의 제작·게시 마감 24시간 전 인앱 리마인더(양측 1회, 기한 변경 시 재알림, 중복·동시 실행 방지, KST 표시) 구현 — 복제 DB 9그룹·브라우저 desktop/mobile PASS. 남음: 모집 마감(캠페인 단위)·기한 필터, 이메일 D053, 운영 마이그레이션 승인. 2026-11-25: 기한 변경 이력(추가 전용, 트리거 기록, 소유자·협업 당사자만 열람, KST 표시) 구현 — 복제 DB 6그룹·브라우저 desktop/mobile PASS. 남음: 모집 마감 리마인더·기한 필터·이메일, 운영 마이그레이션 승인(#27). 2026-11-25: 브랜드 모집 마감 24시간 전 리마인더(recruit_until·terms 중 이른 시각, 소유자만, 마감·비공개·데모 제외) 구현 — 복제 DB 10그룹·mutation·브라우저 6/6 PASS. 캠페인·협업 마감, KST, 캘린더, 리마인더, 변경 이력 로컬 수용. 남음: 이메일(D053/U007), 운영 마이그레이션 승인(#24·#27·#28).
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D055/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D055/ (이번 검증 기록 위치) · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/D055/REMINDERS_20261125.md · harness/evidence/D055/HISTORY_20261125.md · harness/evidence/D055/RECRUITMENT_20261125.md
- **Figma 노드** — [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **이전 기록** — IN_PROGRESS

## D056 · 양측 대시보드·성과 내보내기

DEV-B · P1 · S1 주요 부족 · UX · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 활성 제안·진행·대기 검토·완료를 실데이터로 집계하고 결과 CSV를 제공한다.
- **재현·관찰** — /dashboard · /api/export에서 먼저 목록-집계 일치·다른 사용자 통계·수식 주입 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/dashboard/page.tsx, src/app/api/export/route.ts.
- **화면** — /dashboard · /api/export
- **관련 코드** — src/app/dashboard/page.tsx · src/app/api/export/route.ts
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 활성 제안·진행·대기 검토·완료를 실데이터로 집계하고 결과 CSV를 제공한다.
- **구현** — 리스트와 집계에 동일 상태 정의·권한 범위를 사용한다. 성과는 직접 확인된 결과물/일정이며 광고 전환을 임의 추정하지 않는다.
- **변경 파일** — src/app/dashboard/page.tsx · src/app/api/export/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049 · D054
- **영향** — / · /pricing · /dashboard
- **보안** — 저장된 필터/새로고침/역할 전환 후 집계가 실제 row와 일치한다.
- **검증** — 목록-집계 일치·다른 사용자 통계·수식 주입 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 활성 제안·진행·대기 검토·완료를 실데이터로 집계하고 결과 CSV를 제공한다.
- **차단 요인** — 운영 실데이터 확인은 운영 적용(U004) 후.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D056/ (이번 검증 기록 위치) · harness/evidence/D056/20261126/README.md
- **Figma 노드** — [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: pipeline.spec.ts desktop/mobile PASS. 브랜드·크리에이터 각각 단계별 개수 = 단계 아래 목록 행 수(새로고침 후에도), CSV 행 일치, 참여한 협업만 표시.
- **이전 기록** — OPEN

## D057 · 근거 기반 이슈·검토 워크플로

DEV-A · P0 · S0 출시 차단 · ADMIN · TESTED · 8 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 출처·확인/미확인·당사자 입장·담당자·검토일을 관리하고 무근거 의혹을 위험 점수화하지 않는다.
- **재현·관찰** — /admin에서 먼저 검토 전 공개 제한·정정 버전·권한·감사 로그을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/components/report-form.tsx, src/app/admin/page.tsx, supabase/migrations.
- **화면** — /admin
- **관련 코드** — src/components/report-form.tsx · src/app/admin/page.tsx · supabase/migrations
- **DB·RPC** — reports, audit_log, administrator_grants, ops_dashboard
- **기대 동작** — 출처·확인/미확인·당사자 입장·담당자·검토일을 관리하고 무근거 의혹을 위험 점수화하지 않는다.
- **구현** — issue/evidence/response/review 상태와 공개 범위를 모델링한다. 타인의 주장·확인 사실·공식 정정을 별도 보관한다.
- **변경 파일** — src/components/report-form.tsx · src/app/admin/page.tsx · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D073
- **영향** — /admin · /admin/intelligence · /reports
- **보안** — 미검증 의혹을 자동 위험 점수나 검색 배제로 연결하지 않는다.
- **검증** — 검토 전 공개 제한·정정 버전·권한·감사 로그 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 출처·확인/미확인·당사자 입장·담당자·검토일을 관리하고 무근거 의혹을 위험 점수화하지 않는다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D057/PLAN_20261120.md · harness/evidence/D057/README.md · harness/evidence/D057/review-security-20261120.json · harness/evidence/D057/ (이번 검증 기록 위치) · harness/evidence/D075/REPORT_FIX_20261125.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** —  2026-11-25 관리자 "검토 완료" 회귀(23514) 복제본에서 수정·검증(D075 증빙).
- **이전 기록** — LOCAL_VERIFIED

## D058 · 신고·정정·삭제·이의신청 큐

DEV-B · P0 · S0 출시 차단 · ADMIN · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 접수번호·처리 기한·임시 조치·답변·재심·처리 로그와 요청자 확인을 제공한다.
- **재현·관찰** — /api/reports에서 먼저 익명 남용·상태 전이·삭제 후 재수집 차단을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/reports/route.ts, src/components/admin-review.tsx.
- **화면** — /api/reports
- **관련 코드** — src/app/api/reports/route.ts · src/components/admin-review.tsx · src/components/admin-search.tsx
- **DB·RPC** — reports, audit_log, administrator_grants, ops_dashboard
- **기대 동작** — 접수번호·처리 기한·임시 조치·답변·재심·처리 로그와 요청자 확인을 제공한다.
- **구현** — 접수번호·요청 유형·본인 확인·처리 기한·임시 조치·재심을 설계하고 요청자에게 자기 처리 상태만 공개한다.
- **변경 파일** — src/app/api/reports/route.ts · src/components/admin-review.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D057
- **영향** — /admin · /admin/intelligence · /reports
- **보안** — 신고가 공개돼 개인정보/명예 훼손의 새 통로가 되지 않는다.
- **검증** — 익명 남용·상태 전이·삭제 후 재수집 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 접수번호·처리 기한·임시 조치·답변·재심·처리 로그와 요청자 확인을 제공한다.
- **차단 요인** — 2026-11-26: 계약 추천안(D057 공존) 구현·검증 완료 — 요청 유형·접수번호·기한·내 요청·재심, 공개 참조 해석(20261125240000), reports REST PASS, E2E 4/4. DEV-A 공존/흡수 합의와 운영 적용(U004) 대기라 완료 표시 보류. 2026-11-27: 사용자 결정으로 공존안 채택(DEV-A 회신 없음, 계약 문서에 결정 기록). 운영 검색 reports 범위에 접수번호·유형·기한·임시 비공개 표시(20261127110000). reports REST PASS, 단위 602, E2E reports+safety 6/6, 빌드 PASS. 운영 적용(U004)은 운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D058/ (이번 검증 기록 위치) · docs/handoff/D058_D057_REPORT_CONTRACT_20261125.md · harness/evidence/D058/20261126/README.md · harness/evidence/D058/20261127/README.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — OPEN

## D059 · 정지·비공개 운영 잠금

DEV-A · P0 · S0 출시 차단 · ADMIN · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 관리자 비공개 조치를 소유자가 재공개로 우회하지 못하게 별도 moderation 상태로 강제한다.
- **재현·관찰** — /api/admin/moderate · /api/profile에서 먼저 직접 PostgREST·프로필 API 재공개 우회 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/admin/moderate/route.ts, src/app/api/profile/route.ts.
- **화면** — /api/admin/moderate · /api/profile
- **관련 코드** — src/app/api/admin/moderate/route.ts · src/app/api/profile/route.ts
- **DB·RPC** — reports, audit_log, administrator_grants, ops_dashboard
- **기대 동작** — 관리자 비공개 조치를 소유자가 재공개로 우회하지 못하게 별도 moderation 상태로 강제한다.
- **구현** — owner publication과 admin moderation lock을 독립 컬럼으로 유지한다. 공개 가능 여부는 두 조건을 모두 만족해야 한다.
- **변경 파일** — src/app/api/admin/moderate/route.ts · src/app/api/profile/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D016
- **영향** — /admin · /admin/intelligence · /reports
- **보안** — 직접 PostgREST/RPC/수정 폼 어느 경로에서도 운영 정지를 풀 수 없다.
- **검증** — 직접 PostgREST·프로필 API 재공개 우회 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 관리자 비공개 조치를 소유자가 재공개로 우회하지 못하게 별도 moderation 상태로 강제한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D059/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D059/ (이번 검증 기록 위치)
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — LOCAL_VERIFIED

## D060 · 운영 통합 검색·감사·지원

DEV-B · P1 · S1 주요 부족 · ADMIN · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 회원·캠페인·수집 작업·신고·TEST 주문을 제한된 관리자 DTO로 찾고 변경 사유를 남긴다.
- **재현·관찰** — /admin · /api/admin에서 먼저 감사 위변조 방지·민감값 비노출·관리자 최소권한을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/admin/page.tsx, src/app/api/admin/route.ts.
- **화면** — /admin · /api/admin
- **관련 코드** — src/app/admin/page.tsx · src/app/api/admin/route.ts
- **DB·RPC** — reports, audit_log, administrator_grants, ops_dashboard
- **기대 동작** — 회원·캠페인·수집 작업·신고·TEST 주문을 제한된 관리자 DTO로 찾고 변경 사유를 남긴다.
- **구현** — 관리자 DTO 최소화·페이지네이션·변경 사유·append-only audit를 제공한다. 관리자 작업도 actor/action/target/requestId를 기록한다.
- **변경 파일** — src/app/admin/page.tsx · src/app/api/admin/route.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D075 · D059
- **영향** — /admin · /admin/intelligence · /reports
- **보안** — 운영자 자신의 권한 변경·대량 반출에 별도 재인증/정책을 둔다.
- **검증** — 감사 위변조 방지·민감값 비노출·관리자 최소권한 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 회원·캠페인·수집 작업·신고·TEST 주문을 제한된 관리자 DTO로 찾고 변경 사유를 남긴다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D060/VERIFY_READY_20261122.md · harness/evidence/DEV-A-READY-20261122/verification.json · harness/evidence/D060/ (이번 검증 기록 위치)
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — LOCAL_VERIFIED

## D061 · 안전성 체크리스트·선정 승인

DEV-B · P1 · S1 주요 부족 · MARKETPLACE · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 브랜드별 체크 항목·검토 메모·수동 승인 게이트를 비공개로 보관한다.
- **재현·관찰** — /campaigns/[id]에서 먼저 공개 프로필 누출·승인 전 선정·권한 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/notes, src/app/campaigns/[id]/page.tsx.
- **화면** — /campaigns/[id]
- **관련 코드** — src/app/api/notes · src/app/campaigns/[id]/page.tsx
- **DB·RPC** — campaigns, brand_products, proposals, proposal_events, marketplace_action, delivery_transition
- **기대 동작** — 브랜드별 체크 항목·검토 메모·수동 승인 게이트를 비공개로 보관한다.
- **구현** — 브랜드별 검토 체크리스트와 완료 여부·검토자·선정 게이트를 저장한다.
- **변경 파일** — src/app/api/notes · src/app/campaigns/[id]/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049
- **영향** — /jobs · /campaigns · /dashboard · /collaborations/[id]/deliverables
- **보안** — 검토 메모를 크리에이터 공개 평판 데이터로 재활용하지 않는다.
- **검증** — 공개 프로필 누출·승인 전 선정·권한 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 브랜드별 체크 항목·검토 메모·수동 승인 게이트를 비공개로 보관한다.
- **차단 요인** — 운영 적용(U004)은 운영자 게이트. 2026-11-26: E2E fixture 자립화(D084 권고) — 단독 실행 PASS, desktop·mobile 2/2.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D061/ (이번 검증 기록 위치) · harness/evidence/D061/20261126/README.md · harness/evidence/D061/20261126b/README.md
- **Figma 노드** — [09 · 캠페인 지원 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1002) · [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [09 · 캠페인 지원 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1039) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** — 2026-11-26 main 격리 로컬: 공개 참조 게이트웨이(20261126100000)로 선정 검토 섹션 복원, 체크리스트·메모·승인, 미승인 선정 409 안내, 메모 비공개, selection-review REST PASS, E2E desktop/mobile 2/2.
- **이전 기록** — OPEN

## D062 · 사용자 차단·사칭·악용 대응

DEV-B · P0 · S0 출시 차단 · CHAT · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 차단 관계·신고 누적·스팸·사칭 검토 및 연락 제한을 적용한다.
- **재현·관찰** — /api/messages · /api/reports에서 먼저 차단 후 메시지·다계정 속도 제한·부당 자동제재 방지을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/messages/route.ts, src/app/api/reports/route.ts, supabase/migrations.
- **화면** — /api/messages · /api/reports
- **관련 코드** — src/app/api/messages/route.ts · src/app/api/reports/route.ts · supabase/migrations
- **DB·RPC** — messages, proposal_reads, user_blocks, notification outbox
- **기대 동작** — 차단 관계·신고 누적·스팸·사칭 검토 및 연락 제한을 적용한다.
- **구현** — block 관계가 제안·메시지·알림에 일관되게 적용되도록 단일 권한 helper를 만든다. 사칭은 수동 검토/이의신청을 제공한다.
- **변경 파일** — src/app/api/messages/route.ts · src/app/api/reports/route.ts · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D059 · D076
- **영향** — /dashboard · /api/messages
- **보안** — 신고 수만으로 자동 영구 제재하지 않는다.
- **검증** — 차단 후 메시지·다계정 속도 제한·부당 자동제재 방지 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 차단 관계·신고 누적·스팸·사칭 검토 및 연락 제한을 적용한다.
- **차단 요인** — 운영 적용(U004)·실계정 검증은 운영자 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D062/ (이번 검증 기록 위치) · harness/evidence/D062/20261125/README.md · harness/evidence/D062/20261126/README.md
- **Figma 노드** — [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** — 2026-11-26 main 격리 로컬: 정의자 RPC 경로의 차단·연락 제한·스팸 한도(20261125180000·20261125230000), safety REST PASS, contact-guard PASS, 관리자 7일 제한→이의신청→해제 E2E desktop/mobile 4/4(D060 검색 신고 결과).
- **이전 기록** — OPEN

## D063 · 통계·도움말·문의 운영

DEV-B · P1 · S1 주요 부족 · UX · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 실제 이용량·오류·신고 처리량과 사용법·데이터 한계·문의 접점을 제공한다.
- **재현·관찰** — /admin · /about에서 먼저 가상 통계 제외·PII 없는 집계·문의 접수 확인을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/admin/page.tsx, src/app/about/page.tsx, src/app/help.
- **화면** — /admin · /about
- **관련 코드** — src/app/admin/page.tsx · src/app/about/page.tsx · src/app/help
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 실제 이용량·오류·신고 처리량과 사용법·데이터 한계·문의 접점을 제공한다.
- **구현** — 활동·신고·오류 통계 정의·기간·집계 기준과 사용자 도움말/문의 접점을 구현한다.
- **변경 파일** — src/app/admin/page.tsx · src/app/about/page.tsx · src/app/help
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D006 · D058
- **영향** — / · /pricing · /dashboard
- **보안** — 가상 이벤트/테스트 계정은 실서비스 운영 지표에서 제외한다.
- **검증** — 가상 통계 제외·PII 없는 집계·문의 접수 확인 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 실제 이용량·오류·신고 처리량과 사용법·데이터 한계·문의 접점을 제공한다.
- **차단 요인** — 운영 지표 실측은 운영 적용(U004) 후.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D063/ (이번 검증 기록 위치) · harness/evidence/D063/20261126/README.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: help.spec.ts desktop/mobile PASS, ops-metrics REST PASS. 관리자 전용 집계, 예약 도메인 테스트 계정과 데모 제외, PII 없는 오류 집계, 문의는 서버 전용 저장과 한도, 소유자·관리자만 조회, 관리자 답변 감사. E2E: 도움말·데이터 한계, 익명(회신 메일)·회원 문의, 관리자 답변, 정의가 붙은 기간별 지표.
- **이전 기록** — OPEN

## D064 · 콘텐츠·계정 운영 runbook

DEV-A · P0 · S0 출시 차단 · ADMIN · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 사칭·개인정보 노출·명예 훼손 우려·침해·계정 탈취 상황별 담당·조치·증빙 절차를 문서화한다.
- **재현·관찰** — /admin · /admin/intelligence · /reports에서 먼저 가상 사고 모의훈련·처리 기록 검토을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: docs/operations, docs/user-tickets.
- **화면** — /admin · /admin/intelligence · /reports
- **관련 코드** — docs/operations · docs/user-tickets
- **DB·RPC** — reports, audit_log, administrator_grants, ops_dashboard
- **기대 동작** — 사칭·개인정보 노출·명예 훼손 우려·침해·계정 탈취 상황별 담당·조치·증빙 절차를 문서화한다.
- **구현** — 사고별 탐지→접수→임시 차단→증빙→통지 검토→복구→재발 방지 절차와 담당·연락 경로를 문서화한다.
- **변경 파일** — docs/operations · docs/user-tickets
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U001
- **영향** — /admin · /admin/intelligence · /reports
- **보안** — 개인정보 침해 통지/신고 의무의 적용은 실제 상황·최신 규정으로 확인하며 임의 기한을 법적 확정값처럼 쓰지 않는다.
- **검증** — 가상 사고 모의훈련·처리 기록 검토 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 사칭·개인정보 노출·명예 훼손 우려·침해·계정 탈취 상황별 담당·조치·증빙 절차를 문서화한다.
- **차단 요인** — 외부 선행 U001의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D064/README.md · harness/evidence/D064/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D064/ (이번 검증 기록 위치)
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — LOCAL_VERIFIED

## D065 · 무료·TEST 요금제 분리 정비

DEV-B · P0 · S0 출시 차단 · UX · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 운영 CTA는 무료 베타의 공고 초안으로 연결한다. 별도 시연/유료 정식 상태가 혼동되지 않는지 계속 확인해야 한다.
- **재현·관찰** — /pricing에서 구매 숨김과 체험/실제 청구 여부, 격리에서 실제 TEST CTA·승인 실패 문구 확인.
- **화면** — /pricing
- **관련 코드** — src/lib/billing.ts · src/app/pricing/page.tsx · src/components/checkout.tsx · src/components/pricing-plans.tsx · tests/e2e/premium-visual.spec.ts
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 무료 실서비스에서 결제 약속을 제거하고 TEST 전용 Pro/Agency/HOT/크레딧 설명과 가격을 일치시킨다.
- **구현** — 현 상품 ID를 유지할지 버전 변경할지 정하고 server service mode로 TEST 주문 가능 범위를 통제한다. Figma 전환 · 공개 요금제에서 TEST 상품·금액과 구매 CTA를 숨긴다. 격리 결제 카탈로그 및 서버 가격 계약을 유지한다.
- **변경 파일** — src/lib/billing.ts · src/app/pricing/page.tsx · src/components/checkout.tsx · src/components/pricing-plans.tsx · tests/e2e/premium-visual.spec.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D001 · D002
- **영향** — / · /pricing · /dashboard
- **보안** — 실서비스에서 URL 직접 접속으로 TEST 구매 경로가 열리지 않는다.
- **검증** — 실서비스 구매 경로 미노출·TEST 고지·라이브 키 거부 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 무료 실서비스에서 결제 약속을 제거하고 TEST 전용 Pro/Agency/HOT/크레딧 설명과 가격을 일치시킨다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D065/README.md · harness/evidence/D065/VERIFY_20261121.md · harness/evidence/DEV-A-P0-FINISH-20261121/verification.json · harness/evidence/D065/ (이번 검증 기록 위치) · docs/design/visual-review.md
- **Figma 노드** — [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 기록** — LOCAL_VERIFIED

## D066 · Toss SDK v2 실제 TEST 완주

DEV-B · P0 · S0 출시 차단 · BILLING · BLOCKED · 5 SP · ACTIVE

- **현재 문제** — 기존 TEST 결제 성공 이력과 격리 주문 방어는 있으나 현재 SDK부터 실패/승인 복구/취소 전체 실제 provider 증거는 없다.
- **재현·관찰** — 별도 TEST URL의 정확한 상점 세트로 구매→성공/실패→원장과 권한 비교. 업무 범위의 LIVE 요청은 없다.
- **화면** — /pricing · /billing · /jobs · /dashboard
- **관련 코드** — src/components/checkout.tsx · src/components/payment-confirm.tsx · supabase/functions/payment-confirm/index.ts
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — SDK·키 종류·승인 API 조합을 공식 호환 기준으로 점검하고 성공·실패·사용자 취소를 실제 확인한다.
- **구현** — SDK v2와 결제 제품/키 조합·success/fail origin을 확인한다. 실제 TEST 인증은 U019가 수행하고 개발자가 승인지표를 검증한다.
- **변경 파일** — src/components/checkout.tsx · src/components/payment-confirm.tsx · supabase/functions/payment-confirm/index.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D065 · U015 · U006
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — 개발자센터 거래 결과와 DB 주문/권한을 대조해야 완료다.
- **검증** — 사용자 TEST 키 등록 후 공급자 거래 증빙; mock 성공은 불인정 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — SDK·키 종류·승인 API 조합을 공식 호환 기준으로 점검하고 성공·실패·사용자 취소를 실제 확인한다.
- **차단 요인** — U015의 테스트 상점·등록, U006 격리 및 U019의 브라우저 인증 참여. 테스트 계약 구현은 U019 완료 이전 진행한다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D066/ (이번 검증 기록 위치)
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [20 · 결제 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2183) · [20 · 결제 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2257) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 기록** — OPEN

## D067 · 주문 승인·복구·중복·금액 방어

DEV-B · P0 · S0 출시 차단 · BILLING · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 주문 금액·소유권 방어 코드와 격리 증거가 있다. 실제 결제 성공 이후 네트워크 결과 유실과 대사까지는 미검증이다.
- **재현·관찰** — 격리에서 금액 일치·소유권·연속 confirm·응답 유실을 검증. 동일 주문의 provider 결과와 재대조한다.
- **화면** — /api/billing/orders · /api/billing/confirm
- **관련 코드** — src/app/api/billing/orders/route.ts · src/domains/billing/orders.server.ts · src/app/api/billing/confirm/route.ts · supabase/functions/payment-confirm/index.ts
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — 기존 서버 금액·소유권·원자적 권한 부여를 회귀하고 승인 중단 복구·위조 콜백을 검증한다.
- **구현** — 서버 상품 가격/주문 소유권/고유 키/잠금/한 번만 entitlement 부여를 유지한다. 공급자 성공-DB 실패 복구 조회를 검증한다.
- **변경 파일** — src/app/api/billing/orders/route.ts · src/domains/billing/orders.server.ts · src/app/api/billing/confirm/route.ts · supabase/functions/payment-confirm/index.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D066
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — 브라우저 success URL 방문만으로 paid 상태를 만들지 않는다.
- **검증** — DB 회귀 및 실제 TEST 승인 후 재요청·금액 변조 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 기존 서버 금액·소유권·원자적 권한 부여를 회귀하고 승인 중단 복구·위조 콜백을 검증한다.
- **차단 요인** — 2026-11-26: 격리 단위 16/16·test-cancel·usage-ledger REST·billing-cancel/fail E2E 통과. 실제 Toss TEST 승인 후 재요청·금액 변조·복구·위조 콜백은 U015 키·U006 격리 대기.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D067/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D067/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D067/20261126/README.md
- **Figma 노드** — [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [20 · 결제 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2183) · [20 · 결제 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2257) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 기록** — IN_PROGRESS

## D068 · TEST 취소·취소 후 권한 회수

DEV-B · P0 · S0 출시 차단 · BILLING · BLOCKED · 5 SP · ACTIVE

- **현재 문제** — 운영에 취소 관련 RPC 이름은 확인됐지만 Toss 취소·부분 실패·혜택 회수 완료 증거는 없다.
- **재현·관찰** — 격리 TEST 결제→취소→권한/송장 확인. 이미 사용한 이용권·같은 요청·응답 유실 조건도 검증한다.
- **화면** — /pricing · /billing · /jobs · /dashboard
- **관련 코드** — supabase/functions/payment-confirm/index.ts · src/app/api/billing
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — 공급자가 허용한 TEST 취소·거래 상태 동기화·오류 복구·감사 이력을 처리한다.
- **구현** — TEST 취소는 서버 권한·현재 거래 상태·멱등키·권한 회수 정책으로 처리한다. webhook 사용 시 공급자 공식 인증 방식을 확인한다.
- **변경 파일** — supabase/functions/payment-confirm/index.ts · src/app/api/billing
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D067
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — 결제 키만 알고 있는 다른 사용자는 취소할 수 없다.
- **검증** — 실제 TEST 취소·중복 취소·사용한 크레딧 처리 규칙 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 공급자가 허용한 TEST 취소·거래 상태 동기화·오류 복구·감사 이력을 처리한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D068/ (이번 검증 기록 위치)
- **Figma 노드** — [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 기록** — OPEN

## D069 · TEST 이용권 만료·usage·크레딧

DEV-B · P0 · S0 출시 차단 · BILLING · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 서버 usage ledger와 만료·중복 차감 방지·관리자 수동 발급 사유를 구현한다. 실서비스 무료 권한과 분리한다.
- **재현·관찰** — /admin에서 먼저 동시 사용·만료 경계·부정 발급·취소 회수 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/billing.ts, supabase/migrations, src/app/admin/page.tsx.
- **화면** — /admin
- **관련 코드** — src/lib/billing.ts · supabase/migrations · src/app/admin/page.tsx
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — 서버 usage ledger와 만료·중복 차감 방지·관리자 수동 발급 사유를 구현한다. 실서비스 무료 권한과 분리한다.
- **구현** — usage ledger·reservation/finalize/release·expires_at·grant reason을 설계한다. 서버 현재시각으로 만료를 판정한다.
- **변경 파일** — src/lib/billing.ts · supabase/migrations · src/app/admin/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D067
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — 동시 요청으로 크레딧 음수·만료 이용권 재활성·중복 차감이 발생하지 않는다.
- **검증** — 동시 사용·만료 경계·부정 발급·취소 회수 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 서버 usage ledger와 만료·중복 차감 방지·관리자 수동 발급 사유를 구현한다. 실서비스 무료 권한과 분리한다.
- **차단 요인** — 실제 Toss TEST 승인과 연계한 회수는 D067/D068(U015·U006) 대기. 실서비스 무료 권한과는 분리되어 있다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D069/ (이번 검증 기록 위치) · harness/evidence/D069/20261126/README.md
- **Figma 노드** — [09 · 캠페인 지원 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1002) · [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [09 · 캠페인 지원 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1039) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: entitlements.spec.ts desktop/mobile PASS, usage-ledger REST PASS. 동시 reserve 10건 중 6건만 성공(음수 불가), 같은 키 1회 차감, finalize/release 멱등, 만료 정리, DB 시계 만료(환불·연장·부활 없음), 관리자 발급은 역할과 사유 필수, 회수 시 주문 취소. E2E: 사유 없는 발급 거부 → 회원 화면 표시 → 회수 후 제거.
- **이전 기록** — OPEN

## D070 · HOT 독립 슬롯·광고 고지

DEV-B · P0 · S0 출시 차단 · BILLING · TESTED · 3 SP · ACTIVE

- **현재 문제** — 운영에 별도 슬롯 RPC 이름이 있지만 승인·활성·만료·비인증/환불 제외 전체는 확인하지 못했다.
- **재현·관찰** — 격리 TEST 창구에서 검증 채널만 HOT 자격을 얻고, 종료 시 스폰서 노출 종료와 organic 순서 유지 확인.
- **화면** — /
- **관련 코드** — src/app/page.tsx · src/lib/data.ts · src/lib/catalog.ts
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — TEST 프로모션만 별도 슬롯에서 기간·소유권·노출 이력을 표시한다. 실서비스 유료 HOT은 비활성이다.
- **구현** — promotion DTO는 최소 공개 필드와 유효기간으로 제한한다. organic retrieval/scoring과 분리된 slot API를 사용한다.
- **변경 파일** — src/app/page.tsx · src/lib/data.ts · src/lib/catalog.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D069
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — HOT 사용자가 순위 입력/가중치를 변경할 수 없다.
- **검증** — 만료·일반 추천 순위 불변·광고 표시 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — TEST 프로모션만 별도 슬롯에서 기간·소유권·노출 이력을 표시한다. 실서비스 유료 HOT은 비활성이다.
- **차단 요인** — 실서비스 유료 HOT은 비활성(TEST 결제 플래그). 실제 TEST 결제 연동은 D066~D068 게이트.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D070/ (이번 검증 기록 위치) · harness/evidence/D070/20261126/README.md
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: promotion.spec.ts desktop/mobile PASS, promotions REST PASS. 서비스 전용 최소 DTO(3개 이하), 구 RPC 차단, 일반 정렬 불변, 노출 시에만 집계, 소유자·관리자만 이력 조회, 비공개·만료·회수 건 미노출. E2E: "광고 · TEST HOT" 표시 슬롯, 일반 결과 불변, 소유자 기간과 노출 이력.
- **이전 기록** — OPEN

## D071 · 무료 Agency 팀·초대·테넌트

DEV-A · P1 · S1 주요 부족 · SECURITY · IN_PROGRESS · 8 SP · GATED

- **현재 문제** — 현재 원장 IN_PROGRESS이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 팀 관리자/구성원·초대 만료·탈퇴·브랜드 전환·팀 자료 범위를 구현하고 유료 청구는 제외한다.
- **재현·관찰** — /settings에서 먼저 테넌트 간 RLS·초대 탈취·마지막 관리자 탈퇴 테스트을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/teams, supabase/migrations, src/app/settings/page.tsx.
- **화면** — /settings
- **관련 코드** — supabase/migrations · src/app/settings/page.tsx
- **DB·RPC** — profiles, ownership grants, auth sessions, Storage policies, private RPCs
- **기대 동작** — 팀 관리자/구성원·초대 만료·탈퇴·브랜드 전환·팀 자료 범위를 구현하고 유료 청구는 제외한다.
- **구현** — workspace/membership/invite·역할·팀 전환을 모델링한다. user owner 모델과의 하위 호환 및 개인/팀 자료 이동 정책을 명시한다.
- **변경 파일** — supabase/migrations · src/app/settings/page.tsx
- **신규 파일** — 별도 팀 운영 범위 승인 후 src/app/api/teams에 신규 계약 추가
- **선행 티켓** — D075 · D011
- **영향** — /settings · /admin · 권한 API
- **보안** — 요금 결제 없이 무료 팀 기능을 제공하고 cross-tenant 직접 REST를 테스트한다.
- **검증** — 테넌트 간 RLS·초대 탈취·마지막 관리자 탈퇴 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 팀 관리자/구성원·초대 만료·탈퇴·브랜드 전환·팀 자료 범위를 구현하고 유료 청구는 제외한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D071/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D071/ (이번 검증 기록 위치)
- **Figma 노드** — [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510)
- **이전 기록** — IN_PROGRESS

## D072 · 수수료 가정 계산·결제 이력

DEV-B · P2 · S2 개선 · BILLING · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 선택적 시뮬레이터를 가정으로 명시하고 TEST 거래 이력만 제공한다. 실제 수납·정산 기능은 연결하지 않는다.
- **재현·관찰** — /pricing · /dashboard에서 먼저 가정 표시·입력 경계·다른 주문 열람 차단을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/pricing/page.tsx, src/app/dashboard/page.tsx.
- **화면** — /pricing · /dashboard
- **관련 코드** — src/app/pricing/page.tsx · src/app/dashboard/page.tsx
- **DB·RPC** — products, orders, entitlements, credit_ledger, create_test_order, begin_test_cancel, active_hot_creators
- **기대 동작** — 선택적 시뮬레이터를 가정으로 명시하고 TEST 거래 이력만 제공한다. 실제 수납·정산 기능은 연결하지 않는다.
- **구현** — 선택적 계산기에 가정 수수료·수납 없음·면책 안내를 제공하고 주문 이력은 TEST 표식을 유지한다.
- **변경 파일** — src/app/pricing/page.tsx · src/app/dashboard/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D065
- **영향** — /pricing · /billing · /jobs · /dashboard
- **보안** — 시뮬레이터 결과를 실제 미수금/매출 지표로 집계하지 않는다.
- **검증** — 가정 표시·입력 경계·다른 주문 열람 차단 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 선택적 시뮬레이터를 가정으로 명시하고 TEST 거래 이력만 제공한다. 실제 수납·정산 기능은 연결하지 않는다.
- **차단 요인** — 운영 적용(U004)은 운영자 게이트. 실제 수납·정산은 연결하지 않음.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D072/ (이번 검증 기록 위치) · harness/evidence/D072/20261126/README.md
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492)
- **검증 범위** — 2026-11-26 main 격리: fees E2E desktop/mobile PASS(가정 표시·입력 경계·서버 호출 없음), test-cancel REST에 TEST 주문 소유자 전용 열람 단언 추가 PASS.
- **이전 기록** — OPEN

## D073 · 개인정보·이용약관·동의 버전

DEV-A · P0 · S0 출시 차단 · COMPLIANCE · BLOCKED · 5 SP · ACTIVE

- **현재 문제** — 운영 약관 주소가 서비스 안내로 이동한다. 동의 버전과 운영자·처리 근거 확정이 필요하다. U001의 운영자 확인과 가입·정정 정책 적용 검증이 모두 필요하다.
- **재현·관찰** — 공개 문서·운영 동의 정책·프로필/가입/철회 경계를 대조한다. 실제 문구는 U001 결정 후 승인본을 사용한다.
- **화면** — /privacy
- **관련 코드** — src/app/privacy/page.tsx · src/app/terms · src/app/actions.ts
- **DB·RPC** — source_runtime_policies, consent_log; 사용 정책은 검토 버전으로 관리
- **기대 동작** — 수집 출처·목적·법적 근거 검토·보존·처리위탁·국외이전 해당 여부·권리 행사·운영자 연락처를 정책과 구현에 맞춘다.
- **구현** — 정책 version/purpose/accepted_at와 수집 목적·위탁·국외이전·보존·연락처를 실제 처리 흐름과 대조한다.
- **변경 파일** — src/app/privacy/page.tsx · src/app/terms · src/app/actions.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U001
- **영향** — /about · /privacy · /licenses
- **보안** — 법적 문서 초안은 U001 확정 전 최종 승인/준법 완료로 표시하지 않는다.
- **검증** — 사용자 정책 확정 후 동의 버전·철회·필수/선택 분리 검증 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 수집 출처·목적·법적 근거 검토·보존·처리위탁·국외이전 해당 여부·권리 행사·운영자 연락처를 정책과 구현에 맞춘다.
- **차단 요인** — 외부 선행 U001의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D073/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D073/VERIFY_PUBLICATION_20261121.md · harness/evidence/D073/ (이번 검증 기록 위치)
- **Figma 노드** — [17 · 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-379) · [17 · 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1546) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **이전 기록** — BLOCKED_EXTERNAL

## D074 · 개인정보 열람·수정·반출

DEV-B · P0 · S0 출시 차단 · PRIVACY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 본인 확인 후 자기 자료만 내보내고 처리 요청과 수집 프로필 삭제 경로를 제공한다.
- **재현·관찰** — /settings에서 먼저 다른 사람 반출 차단·내보내기 만료·민감 정보 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/api/privacy, src/app/settings/page.tsx.
- **화면** — /settings
- **관련 코드** — src/app/api/privacy · src/app/settings/page.tsx
- **DB·RPC** — account_deletion_requests, privacy requests, source tombstones, Storage object references
- **기대 동작** — 본인 확인 후 자기 자료만 내보내고 처리 요청과 수집 프로필 삭제 경로를 제공한다.
- **구현** — 본인 확인·요청 상태·본인 데이터 export·민감필드 제거·다운로드 만료·접근 이력을 설계한다.
- **변경 파일** — src/app/api/privacy · src/app/settings/page.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D073
- **영향** — /settings · /privacy · /reports
- **보안** — 동일 협업의 타인 비공개 자료는 자기 자료 반출에 포함하지 않는다.
- **검증** — 다른 사람 반출 차단·내보내기 만료·민감 정보 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 본인 확인 후 자기 자료만 내보내고 처리 요청과 수집 프로필 삭제 경로를 제공한다.
- **차단 요인** — 양 역할 현재-session AMR/live-session 재인증·자기 자료 JSON 반출/foreign deny/일회 race/만료/24h quota 및 local119→120 검증. U001/D073 정책·hosted120/지문·실제 요청 처리 수용은 BLOCKED_EXTERNAL; 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D074/ (이번 검증 기록 위치) · harness/evidence/D074/SESSION_EXPORT_20261124.md · harness/evidence/D074/verification-20261124.json
- **이전 기록** — OPEN

## D075 · RLS·RPC·Storage 전수 권한 감사

DEV-A · P0 · S0 출시 차단 · SECURITY · TESTED · 8 SP · ACTIVE

- **현재 문제** — 운영 public 기본 테이블 47개가 RLS를 사용하지만 정책 동작·GRANT·권한별 RPC·Storage 전수 검증이 끝나지 않았다.
- **재현·관찰** — 격리 복제본 권한 테스트로 다른 계정·역할 변경·미확인 관리자·비공개 파일을 검증하고 각 접근이 차단되는지 확인한다.
- **화면** — /settings · /admin · 권한 API
- **관련 코드** — supabase/migrations · tests/security.mjs · src/lib/api.ts · src/shared/server/http.ts
- **DB·RPC** — profiles, ownership grants, auth sessions, Storage policies, private RPCs
- **기대 동작** — 직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.
- **구현** — 기존 public 테이블/RPC/storage 권한 행렬을 작성하고 SECURITY DEFINER의 execute grant/search_path/auth checks를 검토한다.
- **변경 파일** — supabase/migrations · tests/security.mjs · src/lib/api.ts · src/shared/server/http.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018
- **영향** — /settings · /admin · 권한 API
- **보안** — 모든 advisor 경고를 무조건 수정됐다고 선언하지 말고 의도/남은 위험/테스트를 각각 남긴다.
- **검증** — 익명/브랜드/크리에이터/관리자 권한 행렬 통합 테스트 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.
- **차단 요인** — 기본 즐겨찾기/CSV/서비스 슬롯과 실제 로컬 Storage·역할 회귀 완료. B D036/D038 named-list/import 공개DTO 계약 및 B D049 전체 경로, 운영 DB/앱 적용과 실환경 권한 전수 검증 필요. 2026-11-25: 관리자 '검토 완료'(admin_review_report reviewed)가 reports_status_check로 실패하고 review_report 4인자 경로가 요청ID/지원감사 없이 in_review 전환을 허용 — D057(A)/D060(B) 계약 합의와 신규 마이그레이션 필요. 2026-11-25 전체 로컬 권한 스위트 38개 중 33개/186건 PASS(관리자 지원 회귀1, 업그레이드4는 패킷DB 필요). submit_report duplicate_open 동시성 경합(동일 대상 열린 신고 5건) — 마이그레이션·D057/D060 합의 필요. 2026-11-25 *-upgrade 스위트 4개는 2026-11-20 과거 패킷(23/24·30·31 마이그레이션) 업그레이드 검증이며 패킷 DB 준비 스크립트가 Windows 경로(C:/projects/AD-Me, cmd.exe)에 고정 — macOS 실행 BLOCKED, 현재 main 권한 커버리지 아님. 운영자: 20261125120000 운영 적용 및 지문 13fc6e60… 승인 전까지 운영 배포 보류. 2026-11-25 TESTED 근거: 로컬 수락 범위(정의자·search_path·권한 감사 가드, 역할 행렬 34/38 스위트, 관리자·중복 신고 회귀 수정) 충족. 남은 것은 B D036/D038 미구현 기능 검토(감사 가드가 신규 anon definer 차단), 운영 적용·실환경 검증 — VERIFIED 아님.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D075/README.md · harness/evidence/D075/PLAN_20261120.md · harness/evidence/D075/creator-read-security-20261120.json · harness/evidence/D075/ (이번 검증 기록 위치) · harness/evidence/D075/BOUNDARY_20261123.md · harness/evidence/D075/permissions-109-20261123.json · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/D075/PRODUCT_OPERATION_20261124.md · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D075/WINDOWS_GRAPH_20261124.md · harness/evidence/D075/GUARD_20261125.md · harness/evidence/D075/SUITES_20261125.md · harness/evidence/D075/REPORT_FIX_20261125.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** — 109-source 로컬98 RLS테이블/371함수/4비공개버킷 메타데이터와 core7·brand7·creator-read8·정규화storage9 그룹 통과. 기본 저장·서비스HOT 통합 결함 전진 수정. 함수 전수 행위/운영은 미완료.116 추가 상품 queue/owner/삭제·만료/결정 CAS/기존 텍스트 호환9그룹,113→116 원자 패킷/비어 있지 않은 이력 보존 및 fresh0→116 통과. Windows 경로 감사의 false-green 수정, 실제317 파일/직접 DB 라우트9개·순환0/위반0와 CLI 행위2계약 통과. 명명 목록/import·전수 DB 수용은 별도. 2026-11-25 main42e1143 복제본: 106테이블/414함수/5버킷, anon 실행 definer 35개 검토 허용목록과 profiles.role 자가 승격 가드 추가(주입 회귀 2건 FAIL 확인), core7·brand7 PASS. 2026-11-25 ccaf44f 복제본 전체 스위트 33/38 PASS, 오래된 테스트 3건(신고 RPC 경로·은퇴 테이블·fixture 누수) 수정. 2026-11-25 마이그레이션 20261125120000: 관리자 검토 완료→resolved 위임, submit_report 중복 경합 직렬화 — 복제본 34/38 스위트·188건 PASS, desktop/mobile PASS.
- **이전 기록** — LOCAL_VERIFIED

## D076 · 속도 제한·봇·리소스 남용

DEV-A · P0 · S0 출시 차단 · SECURITY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- **재현·관찰** — /settings · /admin · 권한 API에서 먼저 동시 요청·IP/계정 한도·복구·정상 사용자 흐름을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/rate-limit.ts, src/app/api.
- **화면** — /settings · /admin · 권한 API
- **관련 코드** — src/lib/rate-limit.ts · src/app/api
- **DB·RPC** — profiles, ownership grants, auth sessions, Storage policies, private RPCs
- **기대 동작** — 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- **구현** — 서버 환경에서 원자적으로 동작하는 한도를 사용한다. 인메모리 map만으로 다중 인스턴스 보호가 된다고 하지 않는다.
- **변경 파일** — src/lib/rate-limit.ts · src/app/api
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D004
- **영향** — /settings · /admin · 권한 API
- **보안** — 사용자/작업/공급원 별 키·윈도우·retry-after·상한을 검증한다.
- **검증** — 동시 요청·IP/계정 한도·복구·정상 사용자 흐름 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D076/README.md · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/DEV-A-CONTINUE-20261120B/verification.json · harness/evidence/D076/ (이번 검증 기록 위치)
- **이전 기록** — LOCAL_VERIFIED

## D077 · 웹 보안·외부 URL·파일 경계

DEV-B · P0 · S0 출시 차단 · SECURITY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. CSP·CSRF·보안 헤더·XSS·SSRF·외부 URL 검사·의존성 취약점을 검토한다.
- **재현·관찰** — /settings · /api/uploads에서 먼저 보안 스캐너·악성 URL/입력·리다이렉트·파일 회귀을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: next.config.ts, src/lib/api.ts, src/lib/uploads.ts.
- **화면** — /settings · /api/uploads
- **관련 코드** — next.config.ts · src/lib/api.ts · src/shared/server/http.ts · src/lib/uploads.ts
- **DB·RPC** — creators, storage.objects, upload reference; signed URL
- **기대 동작** — CSP·CSRF·보안 헤더·XSS·SSRF·외부 URL 검사·의존성 취약점을 검토한다.
- **구현** — CSP의 SDK/임베드 허용 범위를 최소화하고 origin/redirect/URL fetch/DNS rebinding 경계를 점검한다.
- **변경 파일** — next.config.ts · src/lib/api.ts · src/shared/server/http.ts · src/lib/uploads.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D076
- **영향** — /settings · /api/uploads
- **보안** — CSP 수정으로 Toss/인증 기능이 깨지지 않는지 격리 TEST 환경에서도 확인한다.
- **검증** — 보안 스캐너·악성 URL/입력·리다이렉트·파일 회귀 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — CSP·CSRF·보안 헤더·XSS·SSRF·외부 URL 검사·의존성 취약점을 검토한다.
- **차단 요인** — Toss 실제 결제창 CSP 확인은 U015/U006, 운영 응답 헤더는 D088.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D077/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D077/20261125/README.md
- **검증 범위** — 2026-11-25 main 32ca3d1 격리 로컬: CSP·헤더·CSRF·리다이렉트·XSS·SSRF(승인 web 수집기만 원시 HTTP 허용 가드 추가, 변이 확인)·npm audit 0·CSP E2E desktop/mobile PASS. 운영 헤더·Toss 결제창 미검증.
- **이전 기록** — OPEN

## D078 · 비밀값·로그·키 교체 대응

DEV-B · P0 · S0 출시 차단 · SECURITY · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 클라이언트 번들·저장소 이력·오류 로그 비밀값 검사를 자동화하고 사용자 키 교체 후 검증 절차를 제공한다.
- **재현·관찰** — /settings · /admin · 권한 API에서 먼저 시크릿 스캔·마스킹·실패 로그·환경 분리 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: harness/secret_scan.py, src/lib/api.ts, .gitignore.
- **화면** — /settings · /admin · 권한 API
- **관련 코드** — harness/secret_scan.py · src/lib/api.ts · src/shared/server/http.ts · .gitignore
- **DB·RPC** — profiles, ownership grants, auth sessions, Storage policies, private RPCs
- **기대 동작** — 클라이언트 번들·저장소 이력·오류 로그 비밀값 검사를 자동화하고 사용자 키 교체 후 검증 절차를 제공한다.
- **구현** — 현재와 Git 이력·빌드 번들·아티팩트·trace·로그를 검사한다. 키 교체는 U006, 개발자는 키 이름·버전 상태로 검증한다.
- **변경 파일** — harness/secret_scan.py · src/lib/api.ts · src/shared/server/http.ts · .gitignore
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D003
- **영향** — /settings · /admin · 권한 API
- **보안** — .env.local/.accounts.local.json/.vercel 토큰과 인증된 trace를 공개 산출물에 포함하지 않는다.
- **검증** — 시크릿 스캔·마스킹·실패 로그·환경 분리 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 클라이언트 번들·저장소 이력·오류 로그 비밀값 검사를 자동화하고 사용자 키 교체 후 검증 절차를 제공한다.
- **차단 요인** — 2026-11-25 로컬 범위만 TESTED: 스캐너 로캘 무관 UTF-8·비UTF-8 파일 검사와 webhook/LLM/GitHub PAT/DB URL 패턴, 로그 mask 깊이 초과 원문·토큰/필드명/서버 env 값·api_error operation·이메일 공급자 오류 redaction 회귀 테스트, 키 교체 후 검증 절차(docs/operations/KEY_ROTATION.md). 운영 키 교체·환경변수 등록·이전 키 401·배포 런타임 로그 검사는 운영자 U006 게이트로 BLOCKED_EXTERNAL이며 전체 DONE/VERIFIED 아님.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D078/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D078/20261125/README.md · docs/operations/KEY_ROTATION.md
- **이전 기록** — OPEN

## D079 · 데이터 보존·삭제·복구 정책 실행

DEV-B · P0 · S0 출시 차단 · PRIVACY · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 프로필·메시지·로그·파일·백업의 보존 규칙과 삭제 작업을 적용하고 복구 시 삭제 요청을 재적용한다.
- **재현·관찰** — /settings · /privacy · /reports에서 먼저 삭제 재시도·백업 복구 후 tombstone 재적용 검사을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/lib/privacy-retention.ts, supabase/migrations.
- **화면** — /settings · /privacy · /reports
- **관련 코드** — src/lib/privacy-retention.ts · supabase/migrations
- **DB·RPC** — account_deletion_requests, privacy requests, source tombstones, Storage object references
- **기대 동작** — 프로필·메시지·로그·파일·백업의 보존 규칙과 삭제 작업을 적용하고 복구 시 삭제 요청을 재적용한다.
- **구현** — 필드별 보존정책·작업 상태·audit 최소화·backup 복원 후 tombstone 재적용을 정의한다.
- **변경 파일** — src/lib/privacy-retention.ts · supabase/migrations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D018 · D073
- **영향** — /settings · /privacy · /reports
- **보안** — 삭제 요구 증거와 삭제해야 할 원문을 같은 영구 로그에 넣지 않는다.
- **검증** — 삭제 재시도·백업 복구 후 tombstone 재적용 검사 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 프로필·메시지·로그·파일·백업의 보존 규칙과 삭제 작업을 적용하고 복구 시 삭제 요청을 재적용한다.
- **차단 요인** — 2026-11-26: 보존 작업·툼스톤·복원 후 재적용·권한 차단은 REST·E2E 통과. 개인정보 페이지 보존 기간 표는 운영자 승인 정책 문서(U001/D073) 확정 대기 — 미승인 기간을 사실처럼 표시하지 않음. 운영 적용 U004. 사용자 결정(2026-11-26): retention E2E 스펙은 표 계약 그대로 유지, U001 승인 뒤 승인 정책 문서 기반 표 복원 시 CI(D085)와 함께 해소.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D079/ (이번 검증 기록 위치) · harness/evidence/D079/20261126/README.md
- **이전 기록** — OPEN

## D080 · 접근성·청소년·민감 데이터 경계

DEV-A · P0 · S0 출시 차단 · UX · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 초기 성인 서비스 범위·정책을 확정하고 주민번호·민감 추정·얼굴 인식·사적 연락처 수집을 배제한다.
- **재현·관찰** — /signup에서 먼저 연령 안내·수집 필드·입력·반출 자료 점검을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/signup/page.tsx, src/lib/schemas.ts, docs/operations.
- **화면** — /signup
- **관련 코드** — src/app/signup/page.tsx · src/lib/schemas.ts · docs/operations
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 초기 성인 서비스 범위·정책을 확정하고 주민번호·민감 추정·얼굴 인식·사적 연락처 수집을 배제한다.
- **구현** — 성인 베타 범위를 알리고 운영 정책과 입력 허용 필드를 맞춘다. 나이 안내가 실제 연령 검증이라고 주장하지 않는다.
- **변경 파일** — src/app/signup/page.tsx · src/lib/schemas.ts · docs/operations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — U001
- **영향** — / · /pricing · /dashboard
- **보안** — 민감 추정·얼굴 인식·주민번호/사적 연락처를 데이터 계약에서 제외한다.
- **검증** — 연령 안내·수집 필드·입력·반출 자료 점검 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 초기 성인 서비스 범위·정책을 확정하고 주민번호·민감 추정·얼굴 인식·사적 연락처 수집을 배제한다.
- **차단 요인** — 외부 선행 U001의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D080/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D080/ (이번 검증 기록 위치)
- **Figma 노드** — [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [22 · 캠페인 내비게이션 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1099)
- **이전 기록** — LOCAL_VERIFIED

## D081 · 실데이터 메인·로고·신뢰 표시

DEV-A · P0 · S0 출시 차단 · UI · VERIFIED · 5 SP · ACTIVE

- **현재 문제** — 현재 원장 LOCAL_VERIFIED이지만 이 범위의 운영 수용 증거를 재확인해야 한다. 제공 로고·차콜/오프화이트/라임을 유지하고 실제 확보 수·출처·무료 베타 한계에 맞춰 메인을 정비한다.
- **재현·관찰** — /에서 먼저 모바일·데스크톱 스크린샷 및 과장 수치 점검을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/page.tsx, src/app/globals.css, public/brand/ad-me-logo.png.
- **화면** — /
- **관련 코드** — src/app/page.tsx · src/app/globals.css · public/brand/ad-me-logo.png · src/components/figma-navigation.tsx · src/app/figma-theme.css
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 제공 로고·차콜/오프화이트/라임을 유지하고 실제 확보 수·출처·무료 베타 한계에 맞춰 메인을 정비한다.
- **구현** — 현재 제공 로고 형태/색을 유지하고 실제 집계가 없는 숫자·로고·성공사례를 삭제한다. 정보 위계와 핵심 CTA를 재설계한다. Figma 전환 · Figma 원본 자산과 밝은 라벤더 홈을 적용했다. 운영 대조와 전체 화면 승격을 별도로 검증한다.
- **변경 파일** — src/app/page.tsx · src/app/globals.css · public/brand/ad-me-logo.png · src/components/figma-navigation.tsx · src/app/figma-theme.css
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D024 · D002
- **영향** — / · /pricing · /dashboard
- **보안** — 실제 서비스 데이터 없을 때 샘플을 실데이터로 위장하지 않는다.
- **검증** — 모바일·데스크톱 스크린샷 및 과장 수치 점검 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 제공 로고·차콜/오프화이트/라임을 유지하고 실제 확보 수·출처·무료 베타 한계에 맞춰 메인을 정비한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다. 2026-11-25 Figma 리디자인(d662a3d)에서 빠진 실집계 표시 복구, --muted 대비 4.3→4.86(DEV-B figma-theme 공유 변경). 운영 대조 미완료.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D081/README.md · harness/evidence/DEV-A-CONTINUE-20261120B/verification.json · harness/evidence/D081/VERIFY_20261121.md · harness/evidence/D081/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · docs/design/visual-review.md · harness/evidence/D084/LOCAL_BROWSER_20261125.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [22 · 캠페인 내비게이션 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1099)
- **검증 범위** — 현재 운영 공개 홈, 실제 공개 채널 10개, 로고·데이터 출처 브라우저 검증 범위.
- **이전 기록** — LOCAL_VERIFIED

## D082 · 전 화면 반응형·접근성·상태

DEV-A · P0 · S0 출시 차단 · ACCESSIBILITY · TESTED · 5 SP · ACTIVE

- **현재 문제** — 최근 감사의 주요 화면 접근성 점검은 유효하나 역할별 404, 동적 업무·세션 만료·키보드 전체 흐름은 남았다.
- **재현·관찰** — 라우트 원장별 desktop/tablet/mobile, 키보드, 오류·빈·만료 상태와 확대 200%를 확인한다.
- **화면** — / · /pricing · /dashboard
- **관련 코드** — src/app · src/components · tests/e2e · src/app/figma-theme.css · tests/e2e/light-surface.spec.ts
- **DB·RPC** — profiles, campaigns 또는 products 중 담당 기능의 기존 소유권 계약
- **기대 동작** — 키보드·포커스·스크린리더·대비·폼 오류·로딩·빈 상태·복구 UX를 전 흐름에 적용한다.
- **구현** — 320/390/768/1440px·키보드·포커스·라벨·대비·loading/error/empty를 점검한다. 애니메이션 reduced-motion을 지원한다. 이전 발견 항목의 결함 수정과 접근성 회귀는 병렬 진행한다. 새 시안 또는 공통 토큰 변경은 운영자 O001의 기준서로 작업하고 실제 화면 증거를 넘긴다. Figma 전환 · 1440/390 브라우저 및 감소 모션을 대조한다. 전체 역할·오류·시트 및 다중 폭은 후속 검수 대상이다.
- **변경 파일** — src/app · src/components · tests/e2e · src/app/figma-theme.css · tests/e2e/light-surface.spec.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D081
- **영향** — / · /pricing · /dashboard
- **보안** — 주요 흐름의 화면 캡처와 접근성 도구 결과를 증빙한다.
- **검증** — axe·모바일 뷰포트·키보드 수동 점검 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 키보드·포커스·스크린리더·대비·폼 오류·로딩·빈 상태·복구 UX를 전 흐름에 적용한다.
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D082/VERIFY_NEXT_20261121.md · harness/evidence/DEV-A-P0-NEXT-20261121/verification.json · harness/evidence/D082/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · docs/design/visual-review.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [06 · 캠페인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-809) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [06 · 캠페인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-840) · [22 · 캠페인 내비게이션 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1099)
- **이전 기록** — LOCAL_VERIFIED

## D083 · SEO·공유·인덱싱 공개 경계

DEV-B · P1 · S1 주요 부족 · SEO · TESTED · 3 SP · ACTIVE

- **현재 문제** — 현재 원장 OPEN이지만 이 범위의 운영 수용 증거를 재확인해야 한다. canonical·sitemap·robots·OG·구조화 데이터를 정비하고 사적/미검토 자료를 noindex와 인증으로 보호한다.
- **재현·관찰** — /robots.txt · /sitemap.xml · /creators/youtube/[id]에서 먼저 비공개 URL 접근 차단·메타·사이트맵 검증을 수행하고, 실제 데이터/fixture 및 현재 운영 응답을 기록한다. 다음 파일에서 구현 조건을 대조한다: src/app/sitemap.ts, src/app/robots.ts, src/app/layout.tsx.
- **화면** — /robots.txt · /sitemap.xml · /creators/youtube/[id]
- **관련 코드** — src/app/sitemap.ts · src/app/robots.ts · src/app/layout.tsx
- **DB·RPC** — public creator DTO의 verification·visibility projection
- **기대 동작** — canonical·sitemap·robots·OG·구조화 데이터를 정비하고 사적/미검토 자료를 noindex와 인증으로 보호한다.
- **구현** — 공개 검토된 프로필만 sitemap/OG에 포함한다. 미공개는 서버 인증/권한 검사로 보호한다.
- **변경 파일** — src/app/sitemap.ts · src/app/robots.ts · src/app/layout.tsx
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D005 · D025
- **영향** — /robots.txt · /sitemap.xml · /creators/youtube/[id]
- **보안** — robots/noindex는 접근 제어의 대체가 아니다.
- **검증** — 비공개 URL 접근 차단·메타·사이트맵 검증 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — canonical·sitemap·robots·OG·구조화 데이터를 정비하고 사적/미검토 자료를 noindex와 인증으로 보호한다.
- **차단 요인** — 운영 도메인 sitemap·robots 실측은 배포(U005) 후.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D083/ (이번 검증 기록 위치) · harness/evidence/D083/20261126/README.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402)
- **검증 범위** — 2026-11-26 main 252dfdd 격리 빈 DB: seo.spec.ts desktop/mobile PASS. 비공개 경로 noindex 헤더, 공개 페이지 canonical·OG, 데모 환경 비색인, noindex와 별개로 비공개 페이지·미공개 프로필 접근 거부. 크리에이터 상세 generateMetadata noindex(D085 1차 복원)를 포함한다.
- **이전 기록** — OPEN

## D084 · 회귀 테스트·실제 수집 계약 테스트

DEV-A · P0 · S0 출시 차단 · QA · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 현재 로컬 단위·운영 주요 회귀 증거가 있고 GitHub 최신 CI는 별도 상태다. 격리 전체 핵심 E2E를 완료로 표시할 근거가 없다.
- **재현·관찰** — 정확한 main에서 로컬 단위+RLS+Playwright, 복제 DB 호환 릴리스 계약과 provider 증거를 분리해 기록한다.
- **화면** — / · 역할 로그인 · 핵심 E2E
- **관련 코드** — tests/matching.test.ts · tests/security.mjs · tests/e2e/service.spec.ts
- **DB·RPC** — 격리 clone에서만 roles/fixture와 production migration 계약 대조
- **기대 동작** — 기존 6개 E2E를 가입·삭제·수집·정정·권한·모바일·결측·동시성까지 확장한다. 외부 연동은 실제/계약 테스트를 구분한다.
- **구현** — 계약/unit/DB권한/E2E를 구분하고 독립 fixture 생성/정리를 사용한다. 실제 공급자 테스트는 opt-in으로 실행한다.
- **변경 파일** — tests/matching.test.ts · tests/security.mjs · tests/e2e/service.spec.ts
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D049 · D075
- **영향** — / · 역할 로그인 · 핵심 E2E
- **보안** — 인증된 trace/비밀번호는 공유하지 않는다. 실패를 skip으로 바꿔 전체 통과라 하지 않는다.
- **검증** — lint/typecheck/unit/integration/build/E2E 통과와 실패 증거 기록 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 기존 6개 E2E를 가입·삭제·수집·정정·권한·모바일·결측·동시성까지 확장한다. 외부 연동은 실제/계약 테스트를 구분한다.
- **차단 요인** — 최종 로컬504unit/43Python/lint/typecheck/build/영향 desktop-mobile6/fresh0→116/113→116 원자 패킷 통과. 전체 E2E 및 B D049/D075 전수, 실제 provider/메일/Toss TEST·복구·운영 적용과 최신 remote CI는 별도 미완료. 2026-11-25 keyless E2E 9건 실패(오래된 스펙 3종·잘못된 설정) 정리 및 잘못된 범위 URL에서 결과 수 무한 로딩(D034 UI) 수정 — keyless 18/18, DB catalog-filters 6/6 PASS. 소유자 env E2E·실제 연동·원격 CI 미완료. 2026-11-25 DB local-browser 전체 76/22→98/98, free 12/12 PASS(복제 DB·Mailpit 56324): 대비·홈 실집계 회귀·YouTube 임베드 CSP 수정, fixture 순서/쿼터 정리. 소유자 env E2E·실제 연동·원격 CI 미완료. 2026-11-25 CI migrations E2E: 일회용 ci-e2e 스택에서 CI 실패 재현, DEV-A 배정분(D033 페이지네이션, D044 추천 정책 표시·스펙) 복구 — 전체 E2E 84/30→89/25, 신규 실패 0. claims는 D025 계약 결정, service 수락 게이트·나머지는 DEV-B D085 표. 2026-11-25: CI security DB suite 복구 — completed 제안 의존 제거(임의 제안), 병합 50f6aa7에서 누락된 신고 fixture 복원(동의 포함), 관리자 aal2(TOTP) 승격 후 검토. ci-e2e 재현 FAIL→PASS×2. 나머지 DB suite 17종·service 수락 게이트는 DEV-B 티켓. 2026-11-26: DEV-B CI 원인 분석 — DB suite는 252dfdd에서 해소, e2e retention 2건은 D079 표 보류와 spec 계약 불일치(DEV-B 결정 필요). 2026-11-26: 전체 E2E 로그인 한도(D076) 실패를 테스트 실행기 globalSetup으로 해소 — ci-e2e 새 DB 10→2 failed(retention 2, DEV-B). 원격 CI 재확인 필요. 2026-11-26: 계정 삭제 요청 흐름을 CI E2E로 승격(재인증·응답 유실 재전송·접근 차단·위조 접수번호, brand/creator × desktop/mobile) — ci-e2e 새 DB 116 passed/2 failed(retention, DEV-B). 실제 영구 파기·Auth 삭제는 D014/D079/U001 대기. 2026-11-27: 계정 비의존 로컬 spec 4종(catalog-filters 결측·privacy-session 재인증·publication-save 응답 유실·search-proposal-scope)을 CI E2E로 승격 — ci-e2e 새 DB 130 passed/2 failed(retention). account-email·email-signup(메일 템플릿)·session-lifecycle(런타임 키)·decision-retry(원인 미확정)는 미승격. DEV-B spec 3종 공개 크리에이터 누수 정리 권고. 2026-11-27: 계정 비의존 공개 spec 5종(demo-boundary·license-notices·main-integration·public-catalog·public-embed-recovery)을 CI E2E로 승격 — ci-e2e 새 DB 146 passed/2 failed(retention), 복제 DB 10/10. 계정 의존 21종은 별도. 2026-11-27: 계정 의존 local spec 14종을 CI E2E로 승격(localAccounts로 CI 계정 사용, youtube-campaign 공유 계정 인증 상태 고정) — ci-e2e 새 DB 190 passed/4 failed(retention 2, youtube-campaign 2→수정 후 통과). 남은 local 전용: deadline-reminders·schedule-history·p0-finish·ready-p1·ops·p0·account-email·email-signup·session-lifecycle·decision-retry. 2026-11-27: CI에서 반복되던 카탈로그 '더 보기' 실패 원인(dev StrictMode 마운트 정리가 진행 중 요청을 취소) 재현(2/16)·수정(32/32), deadline-reminders·schedule-history fixture(새 DB에 비데모 캠페인 없음) 수정, p0-finish 포함 3종 CI E2E 승격 — ci-e2e 새 DB 200 passed/2 failed(retention). 남은 local 전용: ready-p1·ops·p0·account-email·email-signup·session-lifecycle·decision-retry. 2026-11-27: ready-p1(fixture 계정·실패 시 정리 누락)·session-lifecycle(CI JWT_SECRET 부재) 원인 수정 후 CI E2E 승격, 복제 DB 관리자 권한 만료로 실패하던 관리자 spec 3종 복구 — ci-e2e 새 DB 206 passed/2 failed(retention), 원격 CI 6158a53 200 passed/retention만. 남은 local 전용: ops·p0·account-email·email-signup·decision-retry. 2026-11-27: 원격 CI의 product-condition 재시도 실패 원인(저장 요청 조회가 첫 제출보다 늦게 끝나 폼 잠김) 수정 — 조회 완료 전 추출 버튼 비활성(PR-001 UI). ops(실행마다 가상 staff 생성·삭제)·p0 CI E2E 승격 — ci-e2e 새 DB 214 passed/2 failed(retention). 남은 local 전용: account-email·email-signup·decision-retry. 2026-11-27: a5829d9 원격 CI 214 passed(retention만 실패). 로컬 스택 config.toml에 token-hash 메일 템플릿 적용, account-email CI 승격(복구 CI 실행, 이메일 변경 이중 확인은 CI autoconfirm 때문에 CI에서만 skip·복제 DB에서 실행) — 새 DB 216 passed/2 failed(retention). 남은 local 전용: email-signup·decision-retry. 2026-11-27: 46413fe 원격 CI 216 passed(retention만 실패, 계정 복구 CI 통과). decision-retry CI 승격 — 실시간 구독 완료 시 대시보드 새로고침이 응답 유실 뒤 확정 상태를 보여 재시도 버튼이 사라지던 경쟁, spec에서 realtime 소켓 차단. 남은 local 전용: email-signup.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D084/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D084/ (이번 검증 기록 위치) · harness/evidence/D084/FRESH_113_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/DEV-A-PRODUCT-CONDITIONS-20261124/verification.json · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/DEV-A-MAIN-FOLLOWUP-20261124/verification.json · harness/evidence/D084/E2E_KEYLESS_20261125.md · harness/evidence/D084/LOCAL_BROWSER_20261125.md · harness/evidence/D084/CI_E2E_20261125.md · harness/evidence/D084/SECURITY_SUITE_20261125.md · harness/evidence/D084/DEVB_CI_ROOTCAUSE_20261126.md · harness/evidence/D084/AUTH_BUDGET_20261126.md · harness/evidence/D084/ACCOUNT_DELETION_E2E_20261126.md · harness/evidence/D084/PROMOTE_LOCAL_SPECS_20261127.md · harness/evidence/D084/PROMOTE_PUBLIC_SPECS_20261127.md · harness/evidence/D084/PROMOTE_ACCOUNT_SPECS_20261127.md · harness/evidence/D084/LOAD_MORE_RACE_20261127.md · harness/evidence/D084/READY_P1_SESSION_20261127.md · harness/evidence/D084/OPS_P0_PRODUCT_RACE_20261127.md · harness/evidence/D084/ACCOUNT_EMAIL_CI_20261127.md · harness/evidence/D084/DECISION_RETRY_CI_20261127.md
- **검증 범위** —  최신 main1710f23 후속517unit/43Python/lint/typecheck/keyless build/영향 desktop-mobile10 및 Windows 실제 그래프 검증. Docker/모델 확인 요청 정책 차단으로 현 DB·모델·전체 역할 E2E 재실행 없음.
- **이전 기록** — IN_PROGRESS

## D085 · CI·배포 산출물·마이그레이션 안전

DEV-B · P0 · S0 출시 차단 · DEVOPS · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 운영 DB 원장 41행, main SQL 105개이며 여러 버전이 원격에서 다른 번호로 기록됐다. 최신 RPC 부재로 현재 main 앱 단독 승격 불가다.
- **재현·관찰** — 마이그레이션 본문·이름·현재 계약을 매핑한 후 복제 DB dry-run, 세션·공개 DTO·checkout·rollback 검사. APPLIED migration은 불변이다.
- **화면** — /api/health · 릴리스 환경
- **관련 코드** — .github/workflows/ci.yml · vercel.json · supabase/migrations · docs/handoff
- **DB·RPC** — supabase_migrations.schema_migrations; release, environment 및 실제 적용 RPC 매핑
- **기대 동작** — CI 검사·마이그레이션 순서·롤백/forward fix·환경 설정 목록·사용자 배포 체크리스트를 준비한다.
- **구현** — 검증 CI는 유지하되 사용자 승인 없는 배포 workflow를 추가하지 않는다. expand→backfill→switch→contract 순서를 release manifest에 기록한다. 빌드·마이그레이션·롤백 패킷과 증거를 운영자 U004/U005에게 전달한다. 운영자의 실제 승격 여부를 코드 작업의 완료 증거와 구분한다.
- **변경 파일** — .github/workflows/ci.yml · vercel.json · supabase/migrations · docs/handoff
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D003 · D075 · D087
- **영향** — /api/health · 릴리스 환경
- **보안** — 로컬 통과와 실제 DB 적용/실제 URL 검증을 별도 상태로 기록한다.
- **검증** — 격리 DB 마이그레이션·롤백 모의·CI 실행; 외부 적용은 사용자 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — CI 검사·마이그레이션 순서·롤백/forward fix·환경 설정 목록·사용자 배포 체크리스트를 준비한다.
- **차단 요인** — 2026-11-25: CI checks 복구·운영 미적용 패킷 작성 후 merge a5f3326 회귀 복원 — 빈 DB ci-db.sh E2E 50→84/118(38건 해결, 신규 실패 0), DB 스위트 9/27 PASS. 남은 실패는 D025·D058·D061·D046·D044·D033·D026·D068·D070·D062·D041/D049 티켓 범위(evidence D085/20261125 README 표). 운영 적용·지문 등록·배포는 U004/U005. 2026-11-26: 빈 DB ci-db.sh DB 스위트 27/27, E2E 112/118. 원격 CI 9f42a95 checks 성공·migrations 실패(ci-db.sh) — DEV-A D084 재현으로 남은 실패는 retention 스펙 2건(desktop·mobile)뿐. 사용자 결정(2026-11-26): 스펙을 완화하지 않고 U001 승인 후 D079 보존 기간 표 복원으로 해소 — 그때까지 retention 2건은 예상된 실패로 두고 D085는 IN_PROGRESS 유지. 2026-11-26: restore_drill Windows npx ENOENT 수정(npm 번들 npx-cli.js 직접 실행), asset-provenance 테스트 Windows 경로 수정 — 전체 복구 드릴 재실행은 다음 빈 DB 검증 때. 2026-11-26 3차 빈 DB 검증(bfa2314): 마이그레이션 139 PASS, E2E 118/124(실패는 retention 2건뿐), DB 스위트 29/29, restore_drill Windows PASS(RTO 데이터 1.3s). 남은 것은 retention 2건(U001/D079). 2026-11-27 4차 빈 DB 검증(4aff8b0): 마이그레이션 141 PASS, E2E 136/142(실패는 retention 2건뿐), DB 스위트 29/29, restore_drill PASS(데이터 RTO 0.92s). 원격 CI 2차 시도(DEV-A 기록)와 동일. 2026-11-27: U004/U005용 릴리스 패킷 작성(docs/handoff/release-20261127) — 대기 37개 순서·체크섬·STOP 가드, 읽기 전용 검증 SQL 생성기(객체 145개, 로컬 0행·음성 검사 통과), Edge 재배포·환경값 이름·지문 등록·롤백 순서. 운영 적용·지문 등록은 사용자(U004/U005) 승인 대기.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D085/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D085/20261125/README.md · harness/evidence/D085/20261126b/README.md · harness/evidence/D084/DEVB_CI_ROOTCAUSE_20261126.md · harness/evidence/D085/20261126c/README.md · harness/evidence/D085/20261126d/README.md · harness/evidence/D085/20261127/README.md · docs/handoff/release-20261127/RELEASE_PACKET.md
- **이전 기록** — OPEN

## D086 · 관측·오류 추적·상태·비용 알림

DEV-B · P0 · S0 출시 차단 · OBSERVABILITY · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — GET /api/health 200과 admin 참조는 확인했다. 실제 알림 채널, SLO, 장애 훈련과 비용 경보는 미검증이다.
- **재현·관찰** — 조용한 격리 환경에서 provider 오류·Cron 미실행·워커 지연으로 알림과 복구 경로를 테스트한다.
- **화면** — /api/health · /admin/intelligence
- **관련 코드** — src/lib/observability.ts · src/app/api/health · docs/operations
- **DB·RPC** — adme_ops.jobs, ops health, error ledger
- **기대 동작** — PII 없는 요청 추적·오류 알림·health·가용성·API 한도·무료 리소스 한도를 관측한다.
- **구현** — health 공개 응답은 최소화하고 연결 상세·통계는 관리자만 본다. 오류/쿼터/비용 알림 수신 경로를 U018와 맞춘다. 워커·상태·경보 코드 기준을 PR-003 운영 담당자에게 넘기고 운영 채널 연결은 U018에서 다룬다.
- **변경 파일** — src/lib/observability.ts · src/app/api/health · docs/operations
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D078 · U018
- **영향** — /api/health · /admin/intelligence
- **보안** — 알림을 테스트로 실제 수신했는지와 로그 PII 제거를 확인한다.
- **검증** — 모의 장애·알림 전달·로그 마스킹·외부 설정 후 확인 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — PII 없는 요청 추적·오류 알림·health·가용성·API 한도·무료 리소스 한도를 관측한다.
- **차단 요인** — 2026-11-26: 격리 계약·권한 검증 통과(증빙 참조). 외부 오류 추적·알림 채널 설정과 모의 장애 알림 전달 확인(U018)이 남아 있어 완료 표시하지 않는다. 2026-11-27: 운영자 모의 알림 드릴(scripts/alert-drill.mjs) 추가 — 실제 장애 없이 [DRILL] 1건을 서버 alert() 경로로 발송, URL 비노출. 단위 2/2(로컬 수신기). U018 웹훅 설정 뒤 운영자 실행·채널 캡처 대기.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D086/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D086/20261126/README.md · harness/evidence/D086/20261127/README.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — OPEN

## D087 · 백업·복원·성능·용량

DEV-B · P0 · S0 출시 차단 · PERFORMANCE · TESTED · 5 SP · ACTIVE

- **현재 문제** — 운영 스키마 차이를 안전하게 바꿀 수 있는 최신 복구 가능한 백업·파일 복원·RTO/RPO 검증이 남았다.
- **재현·관찰** — 격리 백업을 PostgreSQL+Auth+Storage 대상에 복원하고 role·FK·object checksum·회복 시간을 대조한다.
- **화면** — /api/health · Supabase Backups
- **관련 코드** — docs/operations · tests/load · harness/evidence
- **DB·RPC** — public, auth, storage, migration ledger 전체 복원
- **기대 동작** — 무료 플랜의 백업 한계를 확인하고 최소 백업·복원 절차·대표 부하·검색/수집 용량 기준을 검증한다.
- **구현** — 무료 플랜의 실제 백업/복원 가능 범위와 사용자 보관 위치를 확인한다. SQL/파일 백업 범위 및 Auth/Storage 누락을 명시한다.
- **변경 파일** — docs/operations · tests/load · harness/evidence
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D079 · U003 · U018
- **영향** — /api/health · Supabase Backups
- **보안** — 실서비스 복원은 하지 말고 격리 환경 복원 증거·RPO/RTO 측정·부하 p95 기준을 남긴다.
- **검증** — 격리 환경 복구 모의·성능 보고·자동 백업 비용 미발생 확인 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 무료 플랜의 백업 한계를 확인하고 최소 백업·복원 절차·대표 부하·검색/수집 용량 기준을 검증한다.
- **차단 요인** — 운영과 같은 설정에서의 전체 복구 훈련 및 모니터링 수용 검증이 남았다.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/AUTH_PROVIDER_EXECUTION.md · harness/evidence/D087/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · docs/production-readiness/FIGMA_RELEASE_20261124.md
- **검증 범위** — 동일 CLI 스택에서 앱 데이터 225행·파일 1개를 백업하고 초기화·복구했다. 로그인·파일 소유자 접근·바이트 일치·삭제 재적용 성공. 운영 DB 새 백업은 별도로 보관한다.
- **이전 기록** — PARTIAL_VERIFIED

## D088 · 사용자 배포 후 출시 승인 검증

DEV-B · P0 · S0 출시 차단 · QA · IN_PROGRESS · 5 SP · ACTIVE

- **현재 문제** — 운영 호환 배포는 존재한다. 최신 main, DB, 가입·결제·실제 추천의 전체 출시 승인 증거는 없다.
- **재현·관찰** — 릴리스 체크리스트에 코드 SHA·DB mapping·Vercel ID·역할 성공/거부를 연결하고 각 모드별 GO를 별도 승인한다.
- **화면** — / · 역할 로그인 · 핵심 E2E
- **관련 코드** — tests/e2e/service.spec.ts · docs/user-tickets/U020.md · harness/evidence
- **DB·RPC** — 격리 clone에서만 roles/fixture와 production migration 계약 대조
- **기대 동작** — 사용자가 배포한 URL에서 가입→추천→비교→광고 이력→제안→수락→대시보드와 보안·모바일을 확인한다.
- **구현** — 사용자가 지정한 정확한 deployment URL/commit/환경에서 핵심 흐름·권한·실데이터 출처·모바일을 검증한다.
- **변경 파일** — tests/e2e/service.spec.ts · docs/user-tickets/U020.md · harness/evidence
- **신규 파일** — 기존 파일 및 계약 테스트 우선. 새 파일이 필요하면 담당자가 범위 확정
- **선행 티켓** — D024 · D081 · D082 · D084 · D085 · D086 · D087 · U004 · U005 · U006 · U019 · PR-001
- **영향** — / · 역할 로그인 · 핵심 E2E
- **보안** — 실제 새 배포가 없으면 기존 배포를 새 기능 검증 결과로 재사용하지 않는다.
- **검증** — 공개 URL E2E·실제 데이터 출처·운영 체크리스트 증빙; 배포 실행은 사용자 · 운영 증거와 격리 결과를 구분한다.
- **완료 조건** — 사용자가 배포한 URL에서 가입→추천→비교→광고 이력→제안→수락→대시보드와 보안·모바일을 확인한다.
- **차단 요인** — 외부 선행 U004, U005, U006, U019의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다. 2026-11-26: 익명 읽기 전용 출시 스모크(release-smoke lib·CLI, 단위 7/7) 구현. 로컬 14/14, 운영 be-celeb.org 13/14 — /terms가 307→/about(D073 약관 페이지 09ccc80이 운영 출시 14980c8 이후라 운영 배포가 main보다 뒤처짐). 역할 흐름·모바일·Toss TEST·출시 결정은 U004/U005/U006/U019/U020 대기.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D088/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · docs/production-readiness/FIGMA_RELEASE_20261124.md · harness/evidence/D088/20261126/README.md
- **검증 범위** — be-celeb.org에서 Figma 공개 화면을 1440px·390px Chromium으로 검수했다. 인증 후 운영 캠페인 E2E는 별도다.
- **이전 기록** — OPEN

## U001 · 서비스 운영 범위·정책·운영자 확정

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 공개 운영 책임과 개인정보 처리 문서 승인이 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 무료 성인 베타·수집 목적·권리 행사 연락처·처리 기한·정책 문구를 확정한다. 필요하면 전문 검토를 받는다.
- **구현** — 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- **차단 요인** — 공개 운영 책임과 개인정보 처리 문서 승인이 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U002 · GitHub 조직·저장소·앱 권한 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — main 푸시가 가능하지만 Git 연동 배포는 비활성이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 저장소 권한·보호 규칙·Vercel GitHub 앱 연결 및 외부 워크플로 승인을 수행한다.
- **구현** — GitHub 접근과 Vercel 앱 권한을 소유자가 검토한다. 자동 배포를 즉시 켜지 말고 D085에 승인·공개 순서·권한 증빙을 전달한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — GitHub 접근과 Vercel 앱 권한을 소유자가 검토한다. 자동 배포를 즉시 켜지 말고 D085에 승인·공개 순서·권한 증빙을 전달한다.
- **차단 요인** — main 푸시가 가능하지만 Git 연동 배포는 비활성이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U003 · Supabase 환경·계정·리전·한도 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 운영 원장과 저장소 차이, 격리 및 복원 보관 범위가 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발/실서비스 환경·소유권·무료 한도·보존/백업 가능 범위를 확인한다. 기존 프로젝트의 준비 상태도 기록한다.
- **구현** — 운영·스테이징·TEST 프로젝트 식별 관계, 리전·한도·보존·복원 가능한 백업을 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 운영·스테이징·TEST 프로젝트 식별 관계, 리전·한도·보존·복원 가능한 백업을 확인한다.
- **차단 요인** — 운영 원장과 저장소 차이, 격리 및 복원 보관 범위가 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U004 · Supabase 외부 환경·DB 변경 적용

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 현재 호환 릴리스만 동작한다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발자가 제공한 검토된 마이그레이션·RLS·Storage·Edge Function 변경을 외부 서비스에 적용한다. 적용 로그만 공유한다.
- **구현** — D085/D087의 복제본 검증과 롤백 증거를 검토한 뒤 승인된 순서로 SQL·Storage·함수를 적용한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D085 · D087
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D085/D087의 복제본 검증과 롤백 증거를 검토한 뒤 승인된 순서로 SQL·Storage·함수를 적용한다.
- **차단 요인** — 현재 호환 릴리스만 동작한다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U005 · Vercel 프로젝트·Git 연결·배포 실행

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 현재 도메인은 운영 호환 Vercel 배포를 사용한다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 배포 사이트의 프로젝트 설정·프로덕션/프리뷰·Git 연결·배포/재배포·승격/롤백을 직접 수행한다.
- **구현** — D085 승인된 소스의 preview/production 분리, 빌드·도메인·롤백 이력을 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — U004
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D085 승인된 소스의 preview/production 분리, 빌드·도메인·롤백 이력을 확인한다.
- **차단 요인** — 현재 도메인은 운영 호환 Vercel 배포를 사용한다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U006 · 환경변수·시크릿 등록과 교체

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 등록된 키의 실제 값은 승인 문서나 코드에 필요하지 않다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발자 제공 변수명 목록에 따라 Supabase/Vercel/CI에 키를 직접 등록한다. 값은 채팅·티켓에 올리지 않는다.
- **구현** — 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D003
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- **차단 요인** — 등록된 키의 실제 값은 승인 문서나 코드에 필요하지 않다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U007 · SMTP 계정·키·발신 도메인 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 가입·복구 실제 수신 이력이 있으나 새 가입·운영 발송 경보 재검증이 필요하다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 메일 공급자 가입·키 발급/등록·발신자 인증·SPF/DKIM/DMARC·Supabase SMTP 연결을 직접 수행한다.
- **구현** — 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- **차단 요인** — 과거 가입·복구 실제 수신 이력이 있으나 새 가입·운영 발송 경보 재검증이 필요하다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **Figma 노드** — [17 · 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-379) · [17 · 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1546) · [21 · 가입 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2206) · [21 · 가입 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2271) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **이전 담당 기록** — USER
- **이전 기록** — VERIFIED_AUTH_SMTP

## U008 · Auth 외부 콘솔 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 운영 MFA 전용 경로와 재발송 화면 미지원. 기존 callback 결과는 역사 증거다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 사이트 URL·허용 콜백·메일 템플릿·세션/MFA/비밀번호 보호 설정을 환경별로 적용한다.
- **구현** — host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- **차단 요인** — 운영 MFA 전용 경로와 재발송 화면 미지원. 기존 callback 결과는 역사 증거다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [16 · 로그인 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-361) · [17 · 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-379) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528) · [16 · 로그인 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1537) · [17 · 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1546) · [17b · 크리에이터 회원가입 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2416) · [17b · 크리에이터 회원가입 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2444)
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U009 · YouTube 프로젝트·API 키 발급/등록

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 공식 YouTube 원본 수집은 동작한다. 키 제한과 쿼터 소유자의 증빙이 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — Google 프로젝트·API 활성화·키 제한·무료 쿼터 확인·서버 키 등록을 수행한다.
- **구현** — YouTube Data API 전용 제한, 무료 quota, 키 회전 주체 및 호출 결과를 값 없이 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — YouTube Data API 전용 제한, 무료 quota, 키 회전 주체 및 호출 결과를 값 없이 확인한다.
- **차단 요인** — 공식 YouTube 원본 수집은 동작한다. 키 제한과 쿼터 소유자의 증빙이 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U010 · YouTube 이용 정책·파생 지표 승인

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 파생 지표·콘텐츠 태그 용도의 명시적 승인 증거가 없다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 유스케이스·보관/갱신·파생 지표 요건을 확인하고 필요한 정책 개정 수락·심사·쿼터 신청을 수행한다.
- **구현** — 프로젝트의 허용 목적, API 필드, 보존, 승인·심사 필요 여부를 검토해 처리 근거와 적용 범위를 명시한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 프로젝트의 허용 목적, API 필드, 보존, 승인·심사 필요 여부를 검토해 처리 근거와 적용 범위를 명시한다.
- **차단 요인** — 파생 지표·콘텐츠 태그 용도의 명시적 승인 증거가 없다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_USER_DECISION

## U011 · 웹 수집 대상의 허용 근거 확보

OPERATOR · P1 · S1 조건부 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 공식 API 외 소재의 사용권·허용 범위가 확인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 대상 도메인 약관·라이선스·필요한 허가와 개인 정보 처리 근거를 확인하고 허용 목록을 승인한다.
- **구현** — domain/path/필드/출처/권리/철회·삭제를 문서로 승인한다. 미승인 소스는 비활성이다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — domain/path/필드/출처/권리/철회·삭제를 문서로 승인한다. 미승인 소스는 비활성이다.
- **차단 요인** — 공식 API 외 소재의 사용권·허용 범위가 확인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_SOURCE_PERMISSION

## U012 · Instagram 앱·OAuth·심사·키

OPERATOR · P2 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ARCHIVED

- **현재 문제** — Meta는 출시 범위 밖이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — Meta 앱·계정 유형·승인 scope·개인정보 URL·철회 콜백·심사·키 발급/등록을 직접 진행한다.
- **구현** — 계정 발급·OAuth 작업을 수행할 필요가 없다. 역사적 기록만 보관한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 업무 범위 밖으로 유지하며 신규 연동하지 않는다.
- **차단 요인** — Meta는 출시 범위 밖이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_IMPLEMENTATION_AND_ACCESS

## U013 · TikTok 앱·OAuth·심사·키

OPERATOR · P2 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ARCHIVED

- **현재 문제** — TikTok은 출시 범위 밖이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — TikTok 앱·Display API scope·심사·콜백·키 발급/등록을 직접 진행한다.
- **구현** — 계정 발급·OAuth 작업을 수행할 필요가 없다. 역사적 기록만 보관한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 업무 범위 밖으로 유지하며 신규 연동하지 않는다.
- **차단 요인** — TikTok은 출시 범위 밖이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_IMPLEMENTATION_AND_ACCESS

## U014 · 실제 크리에이터 시범 참여·운영 동의

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 실제로 등록·인증한 참가자의 동의와 두 역할 협업 QA가 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 파일럿 참여자·권리 증명·협업 수신 동의·소유권 분쟁 연락 창구를 확보한다. 무단 제안 메일 대량 발송은 하지 않는다.
- **구현** — 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- **차단 요인** — 실제로 등록·인증한 참가자의 동의와 두 역할 협업 QA가 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_PARTICIPATION

## U015 · Toss TEST 계정·호환 키·등록

OPERATOR · P1 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 TEST 승인 이력이 있다. 이번 릴리스 실패·취소·복구 완주에는 별도 격리 환경의 확인이 필요하다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 사용 가능한 TEST 상점/문서 체험 키 범위와 SDK v2 호환성을 확인하고 클라이언트·서버 TEST 키를 직접 등록한다. 라이브 키는 제외한다.
- **구현** — 같은 TEST 상점의 SDK v2 세트와 isolated 환경 등록을 확인한다. 키는 비공개 설정에만 넣는다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 같은 TEST 상점의 SDK v2 세트와 isolated 환경 등록을 확인한다. 키는 비공개 설정에만 넣는다.
- **차단 요인** — 과거 TEST 승인 이력이 있다. 이번 릴리스 실패·취소·복구 완주에는 별도 격리 환경의 확인이 필요하다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U016 · 선택적 LLM 계정·키·비용 상한

OPERATOR · P1 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · GATED

- **현재 문제** — Local AI가 실행되며 외부 LLM은 현재 출시 필수가 아니다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 키·처리 조건·국외이전 해당 여부·예산 한도를 직접 설정한다. 미설정 시 fallback으로 운영한다.
- **구현** — 외부 공급자를 추가하기로 한 경우에만 비용 상한·처리 조건·보존/이전을 검토한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 외부 공급자를 추가하기로 한 경우에만 비용 상한·처리 조건·보존/이전을 검토한다.
- **차단 요인** — Local AI가 실행되며 외부 LLM은 현재 출시 필수가 아니다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — OPTIONAL_NOT_ENABLED

## U017 · 도메인·DNS·TLS·소유권

OPERATOR · P1 · S1 조건부 · OPERATIONS · VERIFIED · 외부 SP · ACTIVE

- **현재 문제** — 공개 도메인 TLS 및 www→apex 이동을 확인했다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 필요 시 도메인 소유권·DNS·서비스 주소를 설정한다. 도메인 구매는 선택 사항이며 무료 URL로 시작할 수 있다.
- **구현** — ownership/DNS 기록을 유지한다. HTTPS 200, www 308, canonical 및 만료/연장 소유자를 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — ownership/DNS 기록을 유지한다. HTTPS 200, www 308, canonical 및 만료/연장 소유자를 확인한다.
- **차단 요인** — 공개 도메인 TLS 및 www→apex 이동을 확인했다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md · docs/production-readiness/OPERATOR_EXECUTION_20261124.md
- **검증 범위** — 운영 DNS/TLS, www→apex 308, 홈 canonical
- **이전 담당 기록** — USER
- **이전 기록** — VERIFIED_CUSTOM_DOMAIN

## U018 · 관측·알림·백업 외부 계정 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 복구 이력은 있으나 최신 SQL+Auth+Storage의 외부 보관과 연락 경보는 확인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 무료 플랜 한도·수신 채널·외부 토큰·백업 위치·접근 권한을 설정한다. 유료 전환은 별도 판단한다.
- **구현** — 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- **차단 요인** — 과거 복구 이력은 있으나 최신 SQL+Auth+Storage의 외부 보관과 연락 경보는 확인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U019 · 실제 테스트 참여·브라우저 승인

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 기존 사용자 인증·TEST 이력과 현재 합격 기준은 별개다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — OAuth·이메일 링크·2FA·TEST 결제 인증 등 사용자만 가능한 화면을 수행하고 테스트 결과를 확인한다.
- **구현** — 필요할 때 실제 가입, 잠금/MFA, 운영자 QR 확인 및 격리 TEST 승인·취소를 수행하고 결과만 공유한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — U015
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 필요할 때 실제 가입, 잠금/MFA, 운영자 QR 확인 및 격리 TEST 승인·취소를 수행하고 결과만 공유한다.
- **차단 요인** — 기존 사용자 인증·TEST 이력과 현재 합격 기준은 별개다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U020 · 공개 베타 출시·사고 연락·운영 책임

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 정식 출시 전 책임과 사고 대응 범위가 승인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 정책/실제 데이터/보안/복구 증빙을 확인한 뒤 사용자 본인이 출시를 결정하고 지속 운영 담당·지원 시간을 정한다.
- **구현** — D088의 기술 증거를 검토하고 무료 베타와 유료 운영 각각의 책임자, 지원·장애 기준, GO/NO-GO를 기록한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D088 · U001 · U014
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D088의 기술 증거를 검토하고 무료 베타와 유료 운영 각각의 책임자, 지원·장애 기준, GO/NO-GO를 기록한다.
- **차단 요인** — 정식 출시 전 책임과 사고 대응 범위가 승인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — NO_GO

## PR-001 · 브랜드 상품 설명을 추천 입력으로 변환

DEV-A · P0 · S0 출시 차단 · AI · TESTED · 8 SP · ACTIVE

- **현재 문제** — 현재 홈은 선택한 주제·예산으로 후보를 고르지만 상품과 타깃 원문을 모델이 분석해 승인 가능한 조건으로 바꾸지는 않는다.
- **재현·관찰** — 운영 홈에서 주제·예산을 고정하고 상품/타깃만 바꿔 결과와 추천 근거를 비교한다. 로컬 draft()와 실제 추천 입력 계약이 연결되지 않은 것을 확인한다.
- **화면** — / · /brand/products · /campaigns/[id]/recommendations
- **관련 코드** — src/app/recommend-creators.ts · src/components/recommendation-brief.tsx · src/app/jobs/actions.ts · scripts/intelligence_worker.py
- **DB·RPC** — brand_products, adme_ops.jobs, versioned recommendation snapshot
- **기대 동작** — 한국어 상품 5개에서 근거가 있는 구조만 생성, 입력 확인 전 지출/공개 없음, 타 계정 상품 차단, 관련 없는 후보와 가짜 채널 0, 모델 중단 때 수동 추천 유지.
- **구현** — 브랜드 소유 상품의 원문에서 후보가 되는 태그·카테고리·대상을 근거와 함께 Zod 구조로 추출한다. 사용자 확인 후 기존 필터를 실행한다. 잠재 조건과 확정·거부 태그를 분리하고 실패 시 수동 폼이 바로 동작하게 한다.
- **변경 파일** — src/app/recommend-creators.ts · src/components/recommendation-brief.tsx · src/app/jobs/actions.ts · scripts/intelligence_worker.py
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — D039 · D044 · D048
- **영향** — / · /brand/products · /campaigns/[id]/recommendations
- **보안** — 민감한 사람 특성 추론과 원본 원고 유출을 차단한다. raw output을 UI에 곧바로 표시하지 않는다.
- **검증** — 한국어 상품 5개에서 근거가 있는 구조만 생성, 입력 확인 전 지출/공개 없음, 타 계정 상품 차단, 관련 없는 후보와 가짜 채널 0, 모델 중단 때 수동 추천 유지.
- **완료 조건** — 한국어 상품 5개에서 근거가 있는 구조만 생성, 입력 확인 전 지출/공개 없음, 타 계정 상품 차단, 관련 없는 후보와 가짜 채널 0, 모델 중단 때 수동 추천 유지.
- **차단 요인** — 운영에는 신규 RPC와 일부 접근·큐 보안 의존성이 없다. 운영 스키마의 데이터 이관, 권한 전환, 유지 기간 및 운영 모델 연결을 확인한 뒤 적용한다.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/PR-001/ (신규 검증 기록 위치) · harness/evidence/PR-001/PROMPT_FIX_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/PR-001/WORKFLOW_20261124.md · harness/evidence/PR-001/FIGMA_FALLBACK_20261124.md · docs/production-readiness/FIGMA_RELEASE_20261124.md
- **Figma 노드** — [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 116-source 격리 소유 상품→기존 예산 큐→검토/확인·거부→명시적 검색. 실제 로컬 SQL/REST와 합성 모델 결과; desktop/mobile 각1 시나리오. 실제 모델/운영 수용은 미검증. Figma home의 현행/과거 앵커와 스트리밍 후 수동 추천 이동·keyless 실패/입력 보존 desktop/mobile2 검증. 인증 상품 DB 시나리오는 이번 미재실행. 운영 원장 41건을 재현한 격리 스키마에서 상품 조건 RPC, 예산 큐, 역할 권한, 삭제와 만료 및 레거시 초안 계약 9개를 재검증했다.

## PR-002 · 허용된 콘텐츠 태그의 저장·검토·공개 파이프라인

DEV-A · P0 · S0 출시 차단 · AI · IN_PROGRESS · 8 SP · ACTIVE

- **현재 문제** — 실제 모델은 합성 자료에서 태그를 만들었으나 작업 큐·자료 권리·관리자 승인·공개 채널 연결은 없다.
- **재현·관찰** — content_tags.py로 creator_provided 샘플에서 태그가 나오고 youtube_raw 입력이 거부되는지 확인한다. 운영에 검토 승인/저장된 태그 계약이 없는지 비교한다.
- **화면** — /settings/youtube · /admin/intelligence · /creators/youtube/[id]
- **관련 코드** — scripts/content_tags.py · scripts/intelligence_worker.py · src/app/admin/intelligence/page.tsx
- **DB·RPC** — 신규 승인 소스 식별자 및 tag_review projection; 작업 큐 lease와 버전별 idempotency
- **기대 동작** — 실제 모델로 허용된 자료 실행, 2차 작업 중복 없음, 원본 YouTube와 비승인 자료 차단, 승인 뒤만 태그 공개, 철회와 데이터 삭제 시 미표시.
- **구현** — 승인 근거, 자료 버전, 출처 및 소유자 동의 스냅샷을 저장한다. AI가 생성한 태그는 큐로 전달하고 사람이 검토한다. 승인된 제한 필드만 공개해서 철회 시 캐시와 태그를 회수한다.
- **변경 파일** — scripts/content_tags.py · scripts/intelligence_worker.py · src/app/admin/intelligence/page.tsx
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — D017 · D021 · D048
- **영향** — /settings/youtube · /admin/intelligence · /creators/youtube/[id]
- **보안** — 출처·권리 확인 없는 분석을 차단하며 공개 증거에 개인 원문을 복제하지 않는다.
- **검증** — 실제 모델로 허용된 자료 실행, 2차 작업 중복 없음, 원본 YouTube와 비승인 자료 차단, 승인 뒤만 태그 공개, 철회와 데이터 삭제 시 미표시.
- **완료 조건** — 실제 모델로 허용된 자료 실행, 2차 작업 중복 없음, 원본 YouTube와 비승인 자료 차단, 승인 뒤만 태그 공개, 철회와 데이터 삭제 시 미표시.
- **차단 요인** — 제한 vocabulary/출처·근거/버전/검토 대기 계약과 실제 합성 입력 시험. B D017 실제 승인 소스·동의, durable 큐/검토/공개 projection/철회·삭제 미구현; raw YouTube 분석은 U010 전 제외.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/PR-002/ (신규 검증 기록 위치) · harness/evidence/PR-002/SCHEMA_FIX_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md
- **Figma 노드** — [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)

## PR-003 · Local AI 호스트·모델 가동 및 장애 복구 승인

OPERATOR · P1 · S1 주요 부족 · AI · IN_PROGRESS · 외부 SP · ACTIVE

- **현재 문제** — 호스트에서 Qwen과 임베딩 모델이 실제 동작했으나 운영 p95·시간 제한·부하·재시작 복구가 입증되지 않았다.
- **재현·관찰** — Ollama loopback에서 짧은 한국어 JSON·임베딩과 동시 2건을 재측정한다. 운영 출력과 별도로 격리 환경의 재기동·서킷 차단을 확인한다.
- **화면** — /admin/intelligence · /api/health
- **관련 코드** — scripts/intelligence_worker.py · docs/operations · src/components/youtube-ops-summary.tsx
- **DB·RPC** — adme_ops.jobs lease, model version, failure code, retry cap
- **기대 동작** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **구현** — 기존 Ollama·모델·systemd 서비스의 버전, 보호된 로컬 연결, 실행 주체와 가용 자원을 점검한다. D048의 실행 파일과 D086의 큐·경보 계약을 인수한다. 승인된 격리 런타임에서 실제 모델로 재시작·타임아웃·복구를 검증하고 모델 버전과 p50/p95·실패 건수를 보관한다. 앱 코드 수정 사항은 각 담당에게 재현과 함께 인계한다.
- **변경 파일** — docs/operations/local-model-recovery.md · 운영 서비스 설정 및 비공개 상태 기록
- **신규 파일** — 격리 모델 결과와 승인된 운영 활성화 기록
- **선행 티켓** — D048 · D086
- **영향** — /admin/intelligence · /api/health
- **보안** — 호스트 포트 공개 금지, 고객 입력 대신 합성 자료로 부하 측정, 권한·결제 로직에 LLM 사용 금지.
- **검증** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **완료 조건** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **차단 요인** — 공유 GPU와 기존 워커의 실행 상태를 확인한다. 재시작 시험은 격리 환경에서만 하고 운영 활성화는 안전 한도·관측·릴리스 승인 후에 한다.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/PR-003/ (신규 검증 기록 위치) · harness/evidence/PR-003/TRANSPORT_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · docs/production-readiness/OPERATOR_EXECUTION_20261124.md
- **검증 범위** — 기존 격리 CPU 모델과 복구 시험 증빙을 인수한다. 운영 호스트 장애 복구와 최종 활성화는 별도로 확인한다.
- **이전 담당 기록** — DEV-A

## PR-004 · 라이브 판매 전원장·대사·환불 출시 게이트

DEV-B · P0 · S0 출시 차단 · BILLING · BLOCKED · 8 SP · GATED

- **현재 문제** — 현재 코드와 운영은 무료 또는 TEST 전용이다. 정식 상점 승인과 운영 원장·증빙·대사가 존재하지 않는다.
- **재현·관찰** — 정식 라이브 URL을 가정하더라도 /pricing에서 실제 수납이 비활성이고 별도 상점 계약이 없음을 확인한다.
- **화면** — /pricing · /billing/* · /admin/intelligence
- **관련 코드** — src/app/api/billing · src/lib/billing.ts · supabase/functions/payment-confirm
- **DB·RPC** — 운영 별도 merchant orders/entitlements ledger, provider event IDs, refund/reconciliation
- **기대 동작** — 운영자와 공급자 승인 증빙, TEST/실거래 데이터 상호 차단, 승인·취소·환불·영수증·대사 완주, 이상 시 fail-closed와 운영 대응 기록.
- **구현** — 승인 이후 별도 환경에서 상품 정보·영수증·승인/취소 webhook 및 reconciliation 원장을 정의한다. 환경·상점 일치, 금액·소유권·멱등 대조를 격리 테스트한다. 활성화는 운영자 승인 후 별도 배포 작업이다.
- **변경 파일** — src/app/api/billing · src/lib/billing.ts · supabase/functions/payment-confirm
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — D067 · D068 · U021 · U022
- **영향** — /pricing · /billing/* · /admin/intelligence
- **보안** — 등록되지 않은 상점 또는 키에서 fail-closed. 실제 결제·환불을 감사 중 실행하지 않는다.
- **검증** — 운영자와 공급자 승인 증빙, TEST/실거래 데이터 상호 차단, 승인·취소·환불·영수증·대사 완주, 이상 시 fail-closed와 운영 대응 기록.
- **완료 조건** — 운영자와 공급자 승인 증빙, TEST/실거래 데이터 상호 차단, 승인·취소·환불·영수증·대사 완주, 이상 시 fail-closed와 운영 대응 기록.
- **차단 요인** — 현재 사업자등록 계획이 없으므로 라이브 판매는 범위 차단.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/PR-004/ (신규 검증 기록 위치)
- **Figma 노드** — [11 · 요금제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-271) · [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [11 · 요금제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1492) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [20 · 결제 완료 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2183) · [20 · 결제 완료 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2257) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)

## U021 · 유료 판매 사업 주체와 상품·환불 정책 승인

OPERATOR · P0 · S0 출시 차단 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 현재 사업자등록 계획이 없고 별도 라이브 유료 판매 요건을 승인한 자료가 없다.
- **재현·관찰** — 운영자가 현재 무료 베타 범위를 확인하고 정식 판매 추진 여부를 기록한다.
- **화면** — 운영 의사결정 문서
- **관련 코드** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **DB·RPC** — 정식 판매 주체와 보존 책임 체계
- **기대 동작** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **구현** — 정식 판매를 추진할 때만 자격·등록·운영자 공개 정보와 고지·환불 기준을 전문가 및 공급자와 확인한다.
- **변경 파일** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — U001
- **영향** — 운영 의사결정 문서
- **보안** — 민감한 서류는 공개 저장소에 보관하지 않는다.
- **검증** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **완료 조건** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **차단 요인** — 사업자등록 미추진 방침. 무료 베타와 별도.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/U021/ (신규 검증 기록 위치)
- **Figma 노드** — [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 담당 기록** — BUSINESS

## U022 · Toss 라이브 상점 계약 및 환경 승인

OPERATOR · P0 · S0 출시 차단 · BILLING · BLOCKED · 외부 SP · GATED

- **현재 문제** — 정식 운영 상점·라이브 계약·운영 키 증빙이 없다.
- **재현·관찰** — Toss 개발자센터/운영 관리자에서 승인된 상점·결제수단·환경 분리 증빙을 검토한다.
- **화면** — Toss 상점관리자 · 운영 환경 설정
- **관련 코드** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **DB·RPC** — 운영 상점 식별자와 정산 책임을 환경별로 분리
- **기대 동작** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **구현** — U021 후 계약과 카드사 심사를 확인하고 승인된 운영자만 키를 비공개 환경에 등록한다. 이번 감사에서는 키 발급이나 환경 활성화를 수행하지 않는다.
- **변경 파일** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — U021
- **영향** — Toss 상점관리자 · 운영 환경 설정
- **보안** — 키 자체·카드 데이터·정산 자료를 저장소에 올리지 않는다.
- **검증** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **완료 조건** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **차단 요인** — 유료 판매 승인 이전에는 진행하지 않는다.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/U022/ (신규 검증 기록 위치)
- **Figma 노드** — [12 · 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-289) · [12 · 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1501) · [12b · 크리에이터 결제 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2348) · [12b · 크리에이터 결제 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-2388)
- **이전 담당 기록** — BUSINESS

## O001 · 웹디자인 시안·브랜드 기준 및 반영 승인

OPERATOR · P1 · S1 시각·사용성 검수 · UI · IN_PROGRESS · 외부 SP · ACTIVE

- **현재 문제** — 기존 시각 감사와 화면 개선을 바탕으로 운영자가 변경할 디자인의 범위·우선순위·승인 기준을 명시해야 한다.
- **재현·관찰** — 홈·탐색·채널 상세·공고·대시보드·요금제를 열어 현행 화면과 시안의 차이를 비교하고, 모바일 390px과 데스크톱 1440px에서 CTA·상태·가독성을 점검한다.
- **화면** — / · /creators · /creators/youtube/[id] · /jobs · /dashboard · /pricing
- **관련 코드** — docs/DESIGN_SYSTEM.md · docs/design/visual-audit.md · src/app/marketplace-theme.css · docs/design/figma-frame-map.json · docs/design/visual-review.md
- **DB·RPC** — 화면 설계와 시각 검수는 DB 변경 없음. 공개 프로필과 결측 표시는 기존 데이터 계약을 사용한다.
- **기대 동작** — 웹디자인 시안과 공통 원칙이 승인되고, 구현 담당자와 배포 전에 확인할 판정 기준이 명시된다.
- **구현** — 운영자가 페이지별 우선순위와 시안(링크 또는 이미지)을 확정한다. 로고·타이포·색상·여백·CTA·모바일 및 로딩/빈/오류 상태를 인계서에 명시한다. B가 공통 레이아웃·토큰·UI를 반영하고 A가 탐색·추천·콘텐츠 근거를 검토한다. 운영자는 프리뷰 실화면을 확인하고 채택 또는 수정 요청의 근거를 남긴다. Figma 전환 · AD ME 원본 49개 최상위 프레임과 새 Production Extensions 13개를 연결했다. 디자인·운영 승인은 증빙이 필요하다.
- **변경 파일** — docs/design/visual-audit.md · 승인한 웹디자인 시안과 운영 인계 기록 · docs/design/figma-frame-map.json · docs/design/visual-review.md
- **신규 파일** — harness/evidence/O001/ 디자인 결정과 공개 가능한 브라우저 비교 증거
- **선행 티켓** — D081
- **영향** — 공통 내비게이션, 브랜드 탐색, 광고 공고, 업무 화면, 요금제
- **보안** — 시안·캡처에 개인 QA 데이터와 비밀 설정을 넣지 않는다. TEST 고지, 스폰서 표식, 출처 문구, 권한 실패 안내를 확인한다.
- **검증** — 390px과 1440px에서 공개/로그인 상태, 주요 CTA와 로딩/빈/오류 화면을 비교한다. 키보드 포커스와 명암비의 개발자 회귀 결과를 인수한다.
- **완료 조건** — 시안과 적용 범위가 확인되고 담당 개발자·프리뷰 URL·캡처·승인 결과가 하나의 기록으로 연결된다.
- **차단 요인** — 밝은 UI 및 모션의 로컬 검증과 별도로 운영 디자인 확인 및 운영 릴리스 승인이 필요하다.
- **증빙** — docs/design/visual-audit.md · harness/evidence/VISUAL-REDESIGN-20261123/verification.json · docs/production-readiness/OPERATOR_EXECUTION_20261124.md · docs/design/visual-review.md · docs/production-readiness/FIGMA_RELEASE_20261124.md
- **Figma 노드** — [01 · 홈페이지 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-91) · [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [03 · 크리에이터 프로필 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-127) · [01 · 홈페이지 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1402) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [03 · 크리에이터 프로필 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1420) · [22 · 캠페인 내비게이션 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-1099)
- **검증 범위** — be-celeb.org의 공개 Figma 호환 릴리스를 배포·검증했다. 전체 화면 적용과 신규 main DB는 별도다.
