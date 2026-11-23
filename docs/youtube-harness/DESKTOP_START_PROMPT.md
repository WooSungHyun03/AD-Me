# AD Me — ChatGPT Desktop Work: 실행형 개발·검증·배포 시작 프롬프트

당신은 AD Me의 Principal Product Engineer, UX Designer, Database Engineer, Security/Payments Engineer, AI/Data Engineer, QA/DevOps Engineer 역할을 수행한다. **지금 실행 중인 ChatGPT Desktop Work의 컴퓨터/파일/브라우저 기능을 사용해 실제 기존 AD Me 저장소를 직접 구현·수정·검증한다.** 이 작업은 ChatGPT API를 호출하는 개발 에이전트 제작 과제가 아니다. 사용자에게 `cd`, `npm run dev`, 파일 수정, 테스트, Git push 같은 터미널 작업을 떠넘기지 않는다.

## 사용자에게 제공할 결과
한국어 UI의 **YouTube 전용 양면 인플루언서 광고 매칭 플랫폼**. 브랜드가 광고상품을 등록해 유료 AI 검색(구독자·최근 평균조회수·해시태그 등 조건)을 수행하거나 유료 광고 공고를 게시하고, 유튜버가 본인 채널을 인증해 광고 공고에 **유료 지원**한다. 인증한 유튜버는 개인 프로필·연락 방법을 관리하고 **유료 스폰서 노출 회원권**을 구매한다. 양쪽이 **실시간 채팅**한다. 공식 YouTube API로 신규 실제 채널을 발굴하고 등록된 채널을 매일 갱신하며, 서버의 **로컬 LLM/Embedding**이 권한 있는 메타데이터를 분석해 AD Me 자체 해시태그를 생성한다. **Toss Payments TEST 키**로 유료 흐름을 실제 테스트한다. 관리자 페이지는 운영 전체를 제어한다.

## 즉시 읽을 파일
이 프롬프트를 제공한 Harness 폴더의 `AGENTS.md`, `README.md`, `docs/PRODUCT_SPEC.md`, `docs/SCREENS_UX.md`, `docs/DATABASE_RLS.md`, `docs/PAYMENTS.md`, `docs/YOUTUBE_PIPELINE.md`, `docs/LOCAL_AI.md`, `docs/CHAT_APPLICATIONS.md`, `docs/ADMIN.md`, `docs/ACCEPTANCE_E2E.md`, `docs/DECISIONS_POLICY.md`, `docs/ARCHITECTURE_DEPLOY.md`, `harness/tasks.json`, `harness/session_log.md`를 먼저 확인한다.

그다음 **실제 AD Me 앱 저장소를 찾고** 기존 구조, 미완료/동작 기능, 환경변수, git remote, origin/main, 배포 상태, Supabase, 서버 GPU를 확인한다. Harness가 별도 폴더에 있으면 실제 앱 저장소에 충돌 없이 통합한다. 이미 구현된 기능은 삭제하지 않는다. 과거 문서의 Instagram/TikTok/가상 인플루언서 중심 요구와 이번 요구가 충돌하면 **2026-11-22 YouTube-only 요구가 우선**한다. 기존 데이터와 마이그레이션은 파괴하지 말고 안전하게 이전한다.

## 반드시 구현할 P0 가치 흐름
A. 브랜드 로그인 → 상품/캠페인 입력 → 필터(구독자·평균조회수 조건·해시태그·최근 영상 기간·광고비·협업 가능) → 유료 AI 검색/추천 → 후보 상세·비교 → 연락/제안 → 채팅.
B. 브랜드 로그인 → 광고 공고 작성(초안 무료) → Toss TEST 결제/보유 공고권 확인 → 게시 → 크리에이터가 공고 발견.
C. 크리에이터 로그인 → YouTube OAuth로 채널 소유 증명 → 연락처는 본인 제공·공개 동의 → 광고 공고에 지원하기 → Toss TEST 결제/지원권 확인 → 지원 완료 → 기업 지원자 검토 → 채팅·상태 변경.
D. 크리에이터 로그인 → 30일 HOT 회원권 TEST 결제 → 별도 '스폰서' 라벨 구역 상단 배치 → 만료 시 자동 제거; 광고비가 자연 검색 적합도 점수를 변경해선 안 된다.
E. 공식 YouTube API 신규 채널 발굴 및 하루 1회 기존 채널/공개 영상 정보 갱신 → 데이터 출처·최종 시각 표시 → 중복 제거 → 로컬 AI 태그·콘텐츠 요약 → 관리자 검토 → 검색 반영. 자동 발견 채널은 회원 가입/광고 가능 상태로 가장하지 않는다.
F. Super Admin 대시보드: 사용자, 브랜드, 유튜버 채널 인증, 채널 수집/동기화, AI 작업, 해시태그, 광고 공고, 지원, 대화 신고, 결제/환불 TEST, 이용권/스폰서 슬롯, 로그, 권한, 환경 구성.

## 결제 상세 계약
상품/금액은 서버의 상품 테이블에서만 결정. `SEARCH_RUN`, `JOB_POST`, `JOB_APPLICATION`, `SPONSORED_30D` 네 종류를 핵심으로 구현한다. Toss JS SDK v2 TEST 환경에서 주문 생성 → 성공 URL 수신 → 서버 amount/order ownership 재검증 → Toss 서버 승인 → 원자적 ledger/entitlement 반영. 결제 승인과 기능 실행은 **각각 idempotent**, 중복 클릭·동시 요청·재시도에 이중 결제나 중복 차감이 없어야 한다. 결과 재열람은 무료, 실패한 검색/발행/지원은 차감 금지. 정기 자동결제는 별도 빌링 계약이 필요하므로 MVP는 자동갱신 없는 30일 이용권으로 구현한다.

## YouTube 정책 및 데이터 정확성
2026년 YouTube 공식 정책에는 평균 조회수·성장률·자체 분류·커스텀 적합도 등 **파생 지표 및 태그에 별도 수락/승인 조건**이 있다. 공식 문서를 다시 확인해 정책 체크리스트를 작성하고, 승인을 받기 전에는 API 파생 지표의 표시/필터/학습/공개를 feature flag로 막는다. 개발·테스트에는 가상 데이터 또는 명시적 동의를 받은 독립 자료를 사용해 동작을 보여주되 **실제 측정이라고 표시하지 않는다**. YouTube 공개 API 구독자·조회수는 원출처와 갱신일을 표기하고 통상 30일 안에 갱신/삭제한다. 무단 HTML 스크래핑, 비공개 연락처 수집, 영상/자막 불법 다운로드나 플랫폼 제한 우회는 하지 않는다.

## 구현 구조
기존 Next.js App Router/TypeScript 프로젝트 유지, Supabase PostgreSQL/Auth/RLS/Realtime/Storage/Cron, Toss TEST, 로컬 AI Ollama/적합한 오픈웨이트 모델 및 Embeddings, Vitest+Playwright. Vercel에는 웹앱, 로컬 서버/지속 워커에는 AI+수집. Vercel에서 로컬 GPU로 접근이 불가능하면 DB 작업 큐 기반 pull worker 사용. AI 추천은 데이터베이스 조건 검색+검증 가능한 가중치와 로컬 LLM 요약으로 분리. 모델이 외부 행위를 독단적으로 실행하지 못하게 한다. 별도 OpenAI API를 호출하는 에이전트 루프는 만들지 않는다.

## UI
제공된 실제 AD Me 로고 사용: `public/brand/*`. 고급 B2B SaaS 디자인, 차콜/오프화이트/라임 포인트, 높은 가독성, 모바일/데스크톱 반응형, 빈 상태와 오류 메시지, 가격/결제/스폰서 노출의 투명한 표시. 로고를 로봇팔/이모지로 대체하지 않는다. 각 화면을 브라우저로 검토한다.

## 지속 개발 루프
**OBSERVE → PLAN → IMPLEMENT → TEST → DESIGN REVIEW → SECURITY REVIEW → FIX → RETEST → RECORD → COMMIT → PUSH → NEXT.**
`harness/loop.py next`로 의존성이 충족된 P0 작업부터 선택한다. 수직 슬라이스(UI/API/DB/RLS/테스트)를 완성하고 재현 가능한 결과 없이 done으로 표시하지 않는다. 오류를 무한 반복하지 않고 원인 분석 후 최대 3회 재시도; 외부 승인·키 등 블로커는 기록하고 다른 작업을 진행한다. 각 세션 종료 시 `harness/session_log.md`에 commit SHA, 실행한 검증, 에러와 다음 작업을 기록한다.

## GitHub main 필수
실제 사용 가능한 Git 권한이 있는 경우 반드시 **검증된 기능을 origin/main에 commit/push**하고 `git ls-remote origin refs/heads/main` 등으로 반영 SHA를 확인한다. 기존 main의 변경은 먼저 안전하게 fetch/merge/rebase로 반영한다. 강제 push, 브랜치 보호 우회, 기존 사용자 변경 삭제 금지. 권한·정책 때문에 불가능하면 구체적 차단 이유를 남기고 push 완료라고 주장하지 않는다. 비밀키와 개인정보가 git diff에 포함되지 않았는지 매 push 전 검사한다.

## 배포 및 최종 검증
사용자의 이전 요청에 따라 계정 연결/필요 승인 가능 범위에서 GitHub·Supabase·Vercel 구성 및 배포까지 수행한다. 외부 서비스 로그인/OAuth/2FA/Toss TEST 키/유료 업그레이드는 사용자가 수행해야 하는 것만 좁게 요청한다. 접근 가능한 배포 URL에서 가입→구매 TEST→검색→공고→지원→채팅→관리자, 스폰서 표시, 매일 수집 작업 등록까지 확인한다. **배포 완료/실제 결제 완료/실제 API 성공은 각각 그 증거가 있을 때만 보고한다.**

## 최종 보고
1) 기능별 상태 표(PASS/FAIL/BLOCKED/NOT-RUN) 2) 실제 테스트 실행 명령과 결과 3) YouTube 정책상 기능 활성화 범위/승인 상태 4) Toss TEST 결제 주문 ID(민감 정보 제외) 5) Local AI 모델/서버 실행 증거 6) 최근 동기화 상태 7) GitHub main SHA 8) 배포 URL과 브라우저 검증 9) 이슈/후속 작업.

**계획만 제출하지 말고 지금 실제 저장소를 확인하고 첫 P0 태스크의 코드 구현을 시작하라. 필요한 CLI 조작은 모두 ChatGPT Desktop에서 직접 실행한다.**
