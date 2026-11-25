# AD Me DEV-A 독립 실행 문서

너는 AD Me의 DEV-A 역할을 수행한다. 이 문서의 담당 티켓을 우선 구현하고 SHARED_CONTRACT를 준수한다. 기존 코드를 보존하고 실제 테스트 증거를 남긴 뒤 main에 push한다. 검증하지 않은 기능은 완료로 표시하지 않는다.

## 시작 프롬프트

> 저장소의 AGENTS.md와 docs/production-readiness/SHARED_CONTRACT.md, 본 문서를 읽어라. git fetch origin main, git status --short, git rev-parse HEAD를 실행해 최신 main 기준의 독립 작업트리를 사용하라. 본 문서에서 선행 조건이 충족된 ACTIVE P0를 한 건 골라 관련 화면·API·DB·테스트를 함께 조사하라. 재현을 기록하고 가장 작은 호환 변경을 구현하라. 로컬 복제 DB에서 역할별 성공·거부·재시도를 확인하고 desktop/mobile evidence를 남겨라. 운영자 작업이 막힌 경우 해당 실제 환경 검증만 BLOCKED로 남기고, 먼저 진행 가능한 계약·단위 테스트를 실행하라. 테스트 후 한 티켓 커밋으로 저장하고 상대 담당과 공유 파일을 통합한 뒤 일반 push로 main에 반영하라. 운영 마이그레이션·라이브 결제·외부 승인 대행은 별도 승인 없이 실행하지 마라.

YouTube 출처·수집, 검색·추천·태그, Local AI 호출 코드와 데이터 투영·권한 기반. 탐색/추천 화면, API, DB 및 테스트를 함께 수정한다.

현재 운영은 https://be-celeb.org 의 YouTube 전용 무료 베타이며 Toss TEST는 격리한다. main과 운영 스키마 차이는 D085에서 다룬다. 테스트 데이터를 운영 공개 목록에 게시하지 않는다. ARCHIVED는 과거 기록으로 유지한다. GATED는 외부 승인 없이 운영에 적용하지 않는다.

미완료 ACTIVE 36건 · 197 SP · P0 30건.

## 착수 순서 및 공유 계약

[AD ME Figma 프레임 매핑](../design/figma-frame-map.json)에서 실제 노드 UX를 확인한 뒤 코드로 구현한다. 적용되지 않은 화면과 데이터 필드는 [미완료 화면 목록](../design/missing-frames.md)을 확인한다.

첫 착수는 D003·D004 환경/API 계약이다. B의 D017 허용 범위가 준비되면 D018·D019로 DTO와 원본 수집을 고정하고 D021·D075를 격리에서 검증한다. D044·D045와 PR-001/002는 승인된 데이터와 D039 조건 변환을 사용한다.

아래 외부 인계를 먼저 확인한다. 디렉터리 전체를 재작성하지 말고 담당 티켓 범위의 실제 계약·테스트를 수정한다. 각 티켓의 `변경 파일`은 진입점이며 실제 코드를 읽어 확정한다. 번호가 할당된 마이그레이션은 편집하지 않으며 CLI로 새 파일을 생성한다. 시간은 UTC 저장/KST 표시, 금액은 정수 KRW, 공개 DTO에는 내부 소유자 ID나 개인정보를 포함하지 않는다.

A→B · 승인 필드와 출처·갱신·결측을 포함한 공개 채널 DTO 및 추천 스냅샷 계약을 전달한다.
B→A · 캠페인 입력, 지원 상태, 결제·이용권 결과와 채팅 참가자 권한을 합의한다.
운영자에게 넘길 모델·배포·키·디자인 작업은 [운영자 실행 문서](OPERATOR_TICKETS.md)에 있다. 운영 변경 전에 마이그레이션 적용과 앱 교체 순서, 무료/TEST 격리, 실패 복구 조건을 교차 리뷰한다.

### 상대 개발자 및 운영자 선행

- D002 ← D001 (DEV-B) · 실서비스는 무료 기능만 노출하고 TEST 상품·시연 데이터는 별도 환경으로 격리한다.
- D009 ← U007 (OPERATOR) · 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- D009 ← U008 (OPERATOR) · host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- D012 ← D011 (DEV-B) · 역할별 필수 항목·진행 상태·재진입을 제공하고 역할 자가 승격을 막는다.
- D014 ← D079 (DEV-B) · 프로필·메시지·로그·파일·백업의 보존 규칙과 삭제 작업을 적용하고 복구 시 삭제 요청을 재적용한다.
- D016 ← U008 (OPERATOR) · host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- D018 ← D017 (DEV-B) · 필드·목적·근거·약관 버전·보존기간·갱신주기·재배포 범위를 공급원별로 정의한다.
- D019 ← U009 (OPERATOR) · YouTube Data API 전용 제한, 무료 quota, 키 회전 주체 및 호출 결과를 값 없이 확인한다.
- D028 ← D026 (DEV-B) · 분야·분위기·형식·플랫폼 다중 선택, 견적 범위·가용성·견적 미확인을 구분한다.
- D033 ← D005 (DEV-B) · is_demo 필터를 서버에 강제하고 실서비스 API·검색·SEO·통계에서 가상 데이터를 제외한다.
- D044 ← D041 (DEV-B) · 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- D064 ← U001 (OPERATOR) · 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- D073 ← U001 (OPERATOR) · 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- D080 ← U001 (OPERATOR) · 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- D081 ← D024 (DEV-B) · 허용된 실제 프로필 50~100개를 목표로 중복·출처·갱신·결측·삭제 대응을 표본 검수한다. 확보 수량은 결과로 기록한다.
- D084 ← D049 (DEV-B) · 제안/지원/수락/거절/취소/수정요청/완료와 중복·경합·참여자 권한을 검증한다.
- PR-002 ← D017 (DEV-B) · 필드·목적·근거·약관 버전·보존기간·갱신주기·재배포 범위를 공급원별로 정의한다.
- D037 ← D052 (DEV-B) · 단순 읽음 버튼을 넘어 이벤트·미읽음 수·읽음 커서·알림함을 구현한다.
- D042 ← D027 (DEV-B) · 파일 크기·실제 MIME·경로·접근권한·삭제를 검증하고 권리 있는 파일만 업로드한다.
- D042 ← D041 (DEV-B) · 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- D042 ← U001 (OPERATOR) · 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- D042 ← D079 (DEV-B) · 프로필·메시지·로그·파일·백업의 보존 규칙과 삭제 작업을 적용하고 복구 시 삭제 요청을 재적용한다.
- D055 ← D041 (DEV-B) · 모집·제작·게시 기간, 현금/제품 제공, 단가 범위, 콘텐츠 수량·사용권·독점 조건을 구조화한다.
- D055 ← D052 (DEV-B) · 단순 읽음 버튼을 넘어 이벤트·미읽음 수·읽음 커서·알림함을 구현한다.
- D047 ← D046 (DEV-B) · 적합/부적합 사유·수락 결과를 저장하고 데이터 희소성·특정 규모 편향을 검토한다.
- D047 ← U010 (OPERATOR) · 프로젝트의 허용 목적, API 필드, 보존, 승인·심사 필요 여부를 검토해 처리 근거와 적용 범위를 명시한다.

## 완료 보고 형식

`ID / 상태 / main SHA / 변경 파일 / SQL·API 계약 / 실행 명령과 통과·실패 / desktop·mobile / 권한·재시도 / 남은 운영자 게이트 / 운영 검증 여부 / 증빙 경로`. 이전 증빙은 새 결과와 구분한다. 상태 변경은 ALL_TICKETS.json에 반영한 뒤 `python3 harness/production_readiness.py`로 파생 원장을 다시 생성한다.

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
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D028/README.md · harness/evidence/D028/VERIFY_20261121.md · harness/evidence/DEV-A-P0-FINISH-20261121/verification.json · harness/evidence/D028/ (이번 검증 기록 위치)
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
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D057/PLAN_20261120.md · harness/evidence/D057/README.md · harness/evidence/D057/review-security-20261120.json · harness/evidence/D057/ (이번 검증 기록 위치)
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **이전 기록** — LOCAL_VERIFIED

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

## D075 · RLS·RPC·Storage 전수 권한 감사

DEV-A · P0 · S0 출시 차단 · SECURITY · IN_PROGRESS · 8 SP · ACTIVE

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
- **차단 요인** — 기본 즐겨찾기/CSV/서비스 슬롯과 실제 로컬 Storage·역할 회귀 완료. B D036/D038 named-list/import 공개DTO 계약 및 B D049 전체 경로, 운영 DB/앱 적용과 실환경 권한 전수 검증 필요. 2026-11-25: 관리자 '검토 완료'(admin_review_report reviewed)가 reports_status_check로 실패하고 review_report 4인자 경로가 요청ID/지원감사 없이 in_review 전환을 허용 — D057(A)/D060(B) 계약 합의와 신규 마이그레이션 필요. 2026-11-25 전체 로컬 권한 스위트 38개 중 33개/186건 PASS(관리자 지원 회귀1, 업그레이드4는 패킷DB 필요). submit_report duplicate_open 동시성 경합(동일 대상 열린 신고 5건) — 마이그레이션·D057/D060 합의 필요. 2026-11-25 *-upgrade 스위트 4개는 2026-11-20 과거 패킷(23/24·30·31 마이그레이션) 업그레이드 검증이며 패킷 DB 준비 스크립트가 Windows 경로(C:/projects/AD-Me, cmd.exe)에 고정 — macOS 실행 BLOCKED, 현재 main 권한 커버리지 아님.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D075/README.md · harness/evidence/D075/PLAN_20261120.md · harness/evidence/D075/creator-read-security-20261120.json · harness/evidence/D075/ (이번 검증 기록 위치) · harness/evidence/D075/BOUNDARY_20261123.md · harness/evidence/D075/permissions-109-20261123.json · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/D075/PRODUCT_OPERATION_20261124.md · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D075/WINDOWS_GRAPH_20261124.md · harness/evidence/D075/GUARD_20261125.md · harness/evidence/D075/SUITES_20261125.md
- **Figma 노드** — [15 · 관리자 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-343) · [15 · 관리자 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1528)
- **검증 범위** — 109-source 로컬98 RLS테이블/371함수/4비공개버킷 메타데이터와 core7·brand7·creator-read8·정규화storage9 그룹 통과. 기본 저장·서비스HOT 통합 결함 전진 수정. 함수 전수 행위/운영은 미완료.116 추가 상품 queue/owner/삭제·만료/결정 CAS/기존 텍스트 호환9그룹,113→116 원자 패킷/비어 있지 않은 이력 보존 및 fresh0→116 통과. Windows 경로 감사의 false-green 수정, 실제317 파일/직접 DB 라우트9개·순환0/위반0와 CLI 행위2계약 통과. 명명 목록/import·전수 DB 수용은 별도. 2026-11-25 main42e1143 복제본: 106테이블/414함수/5버킷, anon 실행 definer 35개 검토 허용목록과 profiles.role 자가 승격 가드 추가(주입 회귀 2건 FAIL 확인), core7·brand7 PASS. 2026-11-25 ccaf44f 복제본 전체 스위트 33/38 PASS, 오래된 테스트 3건(신고 RPC 경로·은퇴 테이블·fixture 누수) 수정.
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
- **차단 요인** — 운영 확인과 격리 재실행이 필요하다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D081/README.md · harness/evidence/DEV-A-CONTINUE-20261120B/verification.json · harness/evidence/D081/VERIFY_20261121.md · harness/evidence/D081/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · docs/design/visual-review.md
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
- **차단 요인** — 최종 로컬504unit/43Python/lint/typecheck/build/영향 desktop-mobile6/fresh0→116/113→116 원자 패킷 통과. 전체 E2E 및 B D049/D075 전수, 실제 provider/메일/Toss TEST·복구·운영 적용과 최신 remote CI는 별도 미완료.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D084/README.md · harness/evidence/DEV-A-P0-CONTINUE/verification.json · harness/evidence/DEV-A-MAIN-20261120/verification.json · harness/evidence/D084/ (이번 검증 기록 위치) · harness/evidence/D084/FRESH_113_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/DEV-A-PRODUCT-CONDITIONS-20261124/verification.json · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/DEV-A-MAIN-FOLLOWUP-20261124/verification.json
- **검증 범위** —  최신 main1710f23 후속517unit/43Python/lint/typecheck/keyless build/영향 desktop-mobile10 및 Windows 실제 그래프 검증. Docker/모델 확인 요청 정책 차단으로 현 DB·모델·전체 역할 E2E 재실행 없음.
- **이전 기록** — IN_PROGRESS

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

## D037 · 저장 검색·신규 후보 알림

DEV-A · P1 · S1 주요 부족 · MATCHING · IN_PROGRESS · 5 SP · ACTIVE

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
- **차단 요인** — D052와 후보 신규성 cursor/outbox·opt-in·중복/해지/삭제 통합 필요. 이메일은 D053 이후, 운영 적용 별도.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D037/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D037/ (이번 검증 기록 위치) · harness/evidence/D037/REVALIDATE_20261123.md
- **Figma 노드** — [02 · 크리에이터 탐색 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-109) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [02 · 크리에이터 탐색 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1411) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510)
- **검증 범위** — 109-source 실제 로컬 Auth/PostgREST/SQL7그룹: 본인 저장/재실행·CAS·해지/삭제·한도. 새 후보 알림은 미구현/미검증.
- **이전 기록** — IN_PROGRESS

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
- **차단 요인** — 소유 상품 operation의 기존 예산 큐 소비/사전·사후 heartbeat/엄격한 출처 계약 연결 완료(f8087d7), PR-001 로컬 end-to-end는 합성 결과로 검증. OPERATOR PR-003 실제 worker/model host, B D086 TTL/전역동시성·실환경 수용 별도; 이번 세션 모델 host 가동 없음.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · docs/implementation-progress.md · harness/evidence/D048/ (이번 검증 기록 위치) · harness/evidence/D048/DEADLINE_20261123.md · harness/evidence/D048/QUEUE_PROVENANCE_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · harness/evidence/D048/OWNED_OPERATION_20261124.md · docs/production-readiness/REFACTOR_IMPACT.md
- **Figma 노드** — [04 · AI 추천 조건 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-145) · [05 · AI 추천 결과 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-163) · [04 · AI 추천 조건 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1429) · [05 · AI 추천 결과 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1438)
- **검증 범위** — 공통 호환 어댑터11건: 취소 무시 provider 절대 응답 제한/늦은 결과 폐기·한도 실패/안전 usage·schema·PII·명시 template. 실제 모델/worker 통합과 별도.
- **이전 기록** — PARTIAL_VERIFIED

## D055 · 일정·마일스톤·지연 알림

DEV-A · P1 · S1 주요 부족 · MARKETPLACE · IN_PROGRESS · 5 SP · ACTIVE

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
- **차단 요인** — 기존 private calendar/일정 계약과 B D052 milestone/지연 event cursor·outbox·opt-in·중복·해지·삭제 통합 필요. 운영 알림 전달은 미검증.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D055/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D055/ (이번 검증 기록 위치) · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md
- **Figma 노드** — [07 · 캠페인 상세 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-870) · [10 · 실시간 채팅 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-253) · [13 · 브랜드 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-307) · [14 · 크리에이터 대시보드 / Desktop](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-325) · [07 · 캠페인 상세 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=25-898) · [10 · 실시간 채팅 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1483) · [13 · 브랜드 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1510) · [14 · 크리에이터 대시보드 / Mobile](https://www.figma.com/design/1JgK1dH2xyFKU4ED0GIXz9/AD-ME?node-id=11-1519)
- **이전 기록** — IN_PROGRESS

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
- **차단 요인** — 외부 선행 U011의 실제 증거가 필요하다. 격리 계약 테스트와 코드 작업은 독립 진행한다.
- **증빙** — docs/handoff/DEV-A_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D020/INDEPENDENT_20261122.md · harness/evidence/DEV-A-INDEPENDENT-20261122/README.md · harness/evidence/DEV-A-INDEPENDENT-20261122/verification.json · harness/evidence/D020/ (이번 검증 기록 위치)
- **이전 기록** — IN_PROGRESS

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
