# AD Me DEV-B 독립 실행 문서

너는 AD Me의 DEV-B 역할을 수행한다. 이 문서의 담당 티켓을 우선 구현하고 SHARED_CONTRACT를 준수한다. 기존 코드를 보존하고 실제 테스트 증거를 남긴 뒤 main에 push한다. 검증하지 않은 기능은 완료로 표시하지 않는다.

## 시작 프롬프트

> 저장소의 AGENTS.md와 docs/production-readiness/SHARED_CONTRACT.md, 본 문서를 읽어라. git fetch origin main, git status --short, git rev-parse HEAD를 실행해 최신 main 기준의 독립 작업트리를 사용하라. 본 문서에서 선행 조건이 충족된 ACTIVE P0를 한 건 골라 관련 화면·API·DB·테스트를 함께 조사하라. 재현을 기록하고 가장 작은 호환 변경을 구현하라. 로컬 복제 DB에서 역할별 성공·거부·재시도를 확인하고 desktop/mobile evidence를 남겨라. 운영자 작업이 막힌 경우 해당 실제 환경 검증만 BLOCKED로 남기고, 먼저 진행 가능한 계약·단위 테스트를 실행하라. 테스트 후 한 티켓 커밋으로 저장하고 상대 담당과 공유 파일을 통합한 뒤 일반 push로 main에 반영하라. 운영 마이그레이션·라이브 결제·외부 승인 대행은 별도 승인 없이 실행하지 마라.

브랜드·크리에이터 여정, 공고·지원·채팅, 결제·HOT, 운영 화면·웹디자인 구현·릴리스 패킷. 해당 화면, API, DB 및 테스트를 함께 수정한다.

현재 운영은 https://be-celeb.org 의 YouTube 전용 무료 베타이며 Toss TEST는 격리한다. main과 운영 스키마 차이는 D085에서 다룬다. 테스트 데이터를 운영 공개 목록에 게시하지 않는다. ARCHIVED는 과거 기록으로 유지한다. GATED는 외부 승인 없이 운영에 적용하지 않는다.

미완료 ACTIVE 47건 · 212 SP · P0 33건.

## 착수 순서 및 공유 계약

[AD ME Figma 프레임 매핑](../design/figma-frame-map.json)에서 실제 노드 UX를 확인한 뒤 코드로 구현한다. 적용되지 않은 화면과 데이터 필드는 [미완료 화면 목록](../design/missing-frames.md)을 확인한다.

첫 착수는 D001 무료/TEST 분리와 D017 허용 목록의 운영 입력이다. D087 복원과 D085 통합 기준을 격리에서 준비하는 동안 D043·D049 공고·지원 계약을 확정한다. D051·D052 채팅과 D065–D070 TEST/HOT을 해당 선행 뒤 검증한다.

아래 외부 인계를 먼저 확인한다. 디렉터리 전체를 재작성하지 말고 담당 티켓 범위의 실제 계약·테스트를 수정한다. 각 티켓의 `변경 파일`은 진입점이며 실제 코드를 읽어 확정한다. 번호가 할당된 마이그레이션은 편집하지 않으며 CLI로 새 파일을 생성한다. 시간은 UTC 저장/KST 표시, 금액은 정수 KRW, 공개 DTO에는 내부 소유자 ID나 개인정보를 포함하지 않는다.

A→B · 승인 필드와 출처·갱신·결측을 포함한 공개 채널 DTO 및 추천 스냅샷 계약을 전달한다.
B→A · 캠페인 입력, 지원 상태, 결제·이용권 결과와 채팅 참가자 권한을 합의한다.
운영자에게 넘길 모델·배포·키·디자인 작업은 [운영자 실행 문서](OPERATOR_TICKETS.md)에 있다. 운영 변경 전에 마이그레이션 적용과 앱 교체 순서, 무료/TEST 격리, 실패 복구 조건을 교차 리뷰한다.

### 상대 개발자 및 운영자 선행

- D010 ← D009 (DEV-A) · 이메일 인증·재발송·만료 링크·중복 가입·콜백 리다이렉트를 처리한다.
- D011 ← D009 (DEV-A) · 이메일 인증·재발송·만료 링크·중복 가입·콜백 리다이렉트를 처리한다.
- D013 ← D009 (DEV-A) · 이메일 인증·재발송·만료 링크·중복 가입·콜백 리다이렉트를 처리한다.
- D017 ← U001 (OPERATOR) · 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- D024 ← D019 (DEV-A) · 허용된 채널 seed로 공개 프로필·영상·제공 지표를 수집하고 비공개 지표를 추정값으로 채우지 않는다.
- D024 ← D021 (DEV-A) · 체크포인트·지수 백오프·재시도·캐시 만료·일일 한도·삭제 tombstone으로 중복·재수집을 막는다.
- D024 ← U014 (OPERATOR) · 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- D025 ← D018 (DEV-A) · SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- D025 ← U014 (OPERATOR) · 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- D026 ← D018 (DEV-A) · SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- D027 ← D075 (DEV-A) · 직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.
- D041 ← D012 (DEV-A) · 브랜드명·업종·소개·로고·담당자 공개 범위를 관리하며 사업자 인증을 가입 필수로 요구하지 않는다.
- D051 ← D076 (DEV-A) · 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- D054 ← D029 (DEV-A) · 브랜드·기간·형식·경제적 이해관계 표시·증거 URL·제출자·검토 상태를 저장한다. 단순 브랜드 언급을 광고로 확정하지 않는다.
- D058 ← D057 (DEV-A) · 출처·확인/미확인·당사자 입장·담당자·검토일을 관리하고 무근거 의혹을 위험 점수화하지 않는다.
- D062 ← D059 (DEV-A) · 관리자 비공개 조치를 소유자가 재공개로 우회하지 못하게 별도 moderation 상태로 강제한다.
- D062 ← D076 (DEV-A) · 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- D065 ← D002 (DEV-A) · 현재 제공 기능만 안내하고 AI 크레딧 수량·가격 등 문서와 코드의 불일치를 제거한다.
- D066 ← U015 (OPERATOR) · 같은 TEST 상점의 SDK v2 세트와 isolated 환경 등록을 확인한다. 키는 비공개 설정에만 넣는다.
- D066 ← U006 (OPERATOR) · 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- D074 ← D073 (DEV-A) · 수집 출처·목적·법적 근거 검토·보존·처리위탁·국외이전 해당 여부·권리 행사·운영자 연락처를 정책과 구현에 맞춘다.
- D077 ← D076 (DEV-A) · 가입·로그인·검색·메시지·신고·수집·LLM에 서버 측 한도와 비용 상한을 적용한다.
- D078 ← D003 (DEV-A) · 환경값을 Zod로 검증하고 비밀값 없이 누락된 설정명과 비활성 기능을 표시한다.
- D079 ← D018 (DEV-A) · SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- D079 ← D073 (DEV-A) · 수집 출처·목적·법적 근거 검토·보존·처리위탁·국외이전 해당 여부·권리 행사·운영자 연락처를 정책과 구현에 맞춘다.
- D085 ← D003 (DEV-A) · 환경값을 Zod로 검증하고 비밀값 없이 누락된 설정명과 비활성 기능을 표시한다.
- D085 ← D075 (DEV-A) · 직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.
- D086 ← U018 (OPERATOR) · 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- D087 ← U003 (OPERATOR) · 운영·스테이징·TEST 프로젝트 식별 관계, 리전·한도·보존·복원 가능한 백업을 확인한다.
- D087 ← U018 (OPERATOR) · 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- D088 ← D081 (DEV-A) · 제공 로고·차콜/오프화이트/라임을 유지하고 실제 확보 수·출처·무료 베타 한계에 맞춰 메인을 정비한다.
- D088 ← D082 (DEV-A) · 키보드·포커스·스크린리더·대비·폼 오류·로딩·빈 상태·복구 UX를 전 흐름에 적용한다.
- D088 ← D084 (DEV-A) · 기존 6개 E2E를 가입·삭제·수집·정정·권한·모바일·결측·동시성까지 확장한다. 외부 연동은 실제/계약 테스트를 구분한다.
- D088 ← U004 (OPERATOR) · D085/D087의 복제본 검증과 롤백 증거를 검토한 뒤 승인된 순서로 SQL·Storage·함수를 적용한다.
- D088 ← U005 (OPERATOR) · D085 승인된 소스의 preview/production 분리, 빌드·도메인·롤백 이력을 확인한다.
- D088 ← U006 (OPERATOR) · 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- D088 ← U019 (OPERATOR) · 필요할 때 실제 가입, 잠금/MFA, 운영자 QR 확인 및 격리 TEST 승인·취소를 수행하고 결과만 공유한다.
- D088 ← PR-001 (DEV-A) · 한국어 상품 5개에서 근거가 있는 구조만 생성, 입력 확인 전 지출/공개 없음, 타 계정 상품 차단, 관련 없는 후보와 가짜 채널 0, 모델 중단 때 수동 추천 유지.
- D032 ← D033 (DEV-A) · 전체 프로필 브라우저 전송을 없애고 공개 DTO·정렬·페이지 크기 제한·검색 인덱스를 적용한다.
- D038 ← D018 (DEV-A) · SNS 고유 ID·핸들·시계열 지표·수집시각·출처·동의·청구 상태를 필드 수준으로 저장한다.
- D046 ← D045 (DEV-A) · 점수 버전·입력·태그·예산 적합·미확인 항목을 저장하고 광고 슬롯과 순위를 분리한다.
- D053 ← U007 (OPERATOR) · 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- D060 ← D075 (DEV-A) · 직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.
- D060 ← D059 (DEV-A) · 관리자 비공개 조치를 소유자가 재공개로 우회하지 못하게 별도 moderation 상태로 강제한다.

## 완료 보고 형식

`ID / 상태 / main SHA / 변경 파일 / SQL·API 계약 / 실행 명령과 통과·실패 / desktop·mobile / 권한·재시도 / 남은 운영자 게이트 / 운영 검증 여부 / 증빙 경로`. 이전 증빙은 새 결과와 구분한다. 상태 변경은 ALL_TICKETS.json에 반영한 뒤 `python3 harness/production_readiness.py`로 파생 원장을 다시 생성한다.

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
- **차단 요인** — 2026-11-25: CI checks 복구·운영 미적용 패킷 작성 후 merge a5f3326 회귀 복원 — 빈 DB ci-db.sh E2E 50→84/118(38건 해결, 신규 실패 0), DB 스위트 9/27 PASS. 남은 실패는 D025·D058·D061·D046·D044·D033·D026·D068·D070·D062·D041/D049 티켓 범위(evidence D085/20261125 README 표). 운영 적용·지문 등록·배포는 U004/U005. 2026-11-26: 빈 DB ci-db.sh DB 스위트 27/27, E2E 112/118. 원격 CI 9f42a95 checks 성공·migrations 실패(ci-db.sh) — DEV-A D084 재현으로 남은 실패는 retention 스펙 2건(desktop·mobile)뿐. 사용자 결정(2026-11-26): 스펙을 완화하지 않고 U001 승인 후 D079 보존 기간 표 복원으로 해소 — 그때까지 retention 2건은 예상된 실패로 두고 D085는 IN_PROGRESS 유지. 2026-11-26: restore_drill Windows npx ENOENT 수정(npm 번들 npx-cli.js 직접 실행), asset-provenance 테스트 Windows 경로 수정 — 전체 복구 드릴 재실행은 다음 빈 DB 검증 때. 2026-11-26 3차 빈 DB 검증(bfa2314): 마이그레이션 139 PASS, E2E 118/124(실패는 retention 2건뿐), DB 스위트 29/29, restore_drill Windows PASS(RTO 데이터 1.3s). 남은 것은 retention 2건(U001/D079). 2026-11-27 4차 빈 DB 검증(4aff8b0): 마이그레이션 141 PASS, E2E 136/142(실패는 retention 2건뿐), DB 스위트 29/29, restore_drill PASS(데이터 RTO 0.92s). 원격 CI 2차 시도(DEV-A 기록)와 동일.
- **증빙** — docs/handoff/DEV-B_VIBECODING_TICKETS.md (동일 티켓 ID 절) · docs/production-readiness/MASTER_AUDIT.md · harness/evidence/D085/ (이번 검증 기록 위치) · docs/production-readiness/REFACTOR_IMPACT.md · harness/evidence/D085/20261125/README.md · harness/evidence/D085/20261126b/README.md · harness/evidence/D084/DEVB_CI_ROOTCAUSE_20261126.md · harness/evidence/D085/20261126c/README.md · harness/evidence/D085/20261126d/README.md · harness/evidence/D085/20261127/README.md
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
