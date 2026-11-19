## AD Me 기본 주소

**https://be-celeb.org** · www는 기본 주소로 이동합니다. [도메인 연결·검증 기록](docs/DOMAIN_CONNECTION.md). 도메인 연결 완료와 실제 데이터 서비스 전체 출시 완료는 구분합니다.

## 외부 작업 실제 수행 결과 (최신)

[20개 외부 작업 실제 실행 상태](docs/EXTERNAL_EXECUTION_STATUS.md). 최신 사용자 요청으로 기술 외부 작업 직접 수행 권한이 부여되어 GitHub 보호 규칙·Vercel 프로젝트 설정·Supabase Auth URL을 수정하고 운영자 연락처를 실제 배포했다. 신규 실제 데이터 서비스의 출시 조건은 미충족이며 전체 20개 완료가 아니다. 이전 사용자 전용 실행 지침보다 최신 세션 권한·실행 기록을 우선한다.

## 구현 담당자 전달 문서

[전달 패키지 안내](docs/handoff/README.md) · [개발자 A 상세 티켓](docs/handoff/DEV-A_VIBECODING_TICKETS.md) · [개발자 B 상세 티켓](docs/handoff/DEV-B_VIBECODING_TICKETS.md) · [사용자 외부 작업 20개](docs/backlog/USER_ACTIONS.md). 각 문서에 시작 프롬프트·수정 위치·완료 기준·검증·인계/실패 대응을 명시했다. 문서 작성은 실제 외부 설정이나 신규 기능 완료를 의미하지 않는다.

## 실제 서비스 티켓과 작업 분담 (2026-11-19)

전체 기능·수집 가능성·완료 기준·2인 배분: [실서비스 티켓](docs/REAL_SERVICE_TICKETS.md). 기계 판독 목록: [backlog v2](harness/service_backlog_v2.json). 개발 88개(각 219SP), 사용자 전용 외부 작업 20개, 보류 6개. 현재 운영 기준은 무료 실제 데이터 베타이며 TEST 결제는 격리한다. 배포 사이트 설정·외부 콘솔 변경·배포·API 키 발급/등록은 사용자 전담이다. 이 기준이 아래의 과거 자동 배포 안내보다 우선한다.

# AD Me

브랜드와 크리에이터의 탐색·설명 가능한 추천·협업을 연결하는 Next.js 서비스입니다. 대학 프로젝트이며 결제는 Toss Payments **TEST 전용**입니다.

## 구현

- Next.js App Router / strict TypeScript / Tailwind / Radix 기반 버튼 / Zod
- Supabase Auth, PostgreSQL, RLS, 비공개 Storage 정책
- 가상 크리에이터 48명·캠페인 8개·광고 이력. DEMO 표시
- 검색·분위기/분야/플랫폼/예산 필터·정렬, 후보 비교·즐겨찾기
- 브랜드 캠페인 저장·공개 모집, 가중치 기반 추천·근거·결측률
- 크리에이터 본인 프로필, 양면 제안·지원·수락·거절, 메시지·결과물·검토
- 역할별 대시보드, 관리자 신고 검토·회원·주문 조회·감사 로그
- 규칙 기반 콘셉트/제안 초안. 외부 LLM 없이 작동
- Toss v2 SDK, 서버 상품 금액·소유권 검증, Edge Function 승인, 원자적 이용권 활성화/중복 방지

## 검증 상태

로컬 lint/typecheck/build 및 Vitest 12개, 실제 Supabase를 사용하는 데스크톱·모바일 Playwright 6개 통과. TEST 키가 없어 실제 Toss 결제창·승인·이용권 활성화는 아직 검증되지 않았습니다. 주문 금액 조작·타인 수정·익명 요청·관리자 접근 차단은 검증했습니다.

가입은 Supabase 이메일 확인 정책을 따릅니다. 기본 메일 서비스의 발송 제한 때문에 임의의 외부 이메일 가입 전달은 별도 SMTP 설정·검증이 필요합니다. 테스트는 일회용 QA 계정으로 실행했고 비밀번호는 Git에 포함하지 않았습니다.

## 개발·운영

에이전트가 직접 개발·배포합니다. `npm run dev`, `lint`, `typecheck`, `test`, `build`, `test:e2e`를 제공합니다. `.env.example`에 필요한 환경변수 이름이 있습니다. 시크릿은 `.env.local` 또는 공급자 환경변수에만 저장하고 Git에 포함하지 않습니다. Toss 시크릿은 Supabase `payment-confirm` Edge Function의 `TOSS_SECRET_KEY`로 설정합니다.

실제 DB 마이그레이션: `supabase/migrations/`. 가상 seed는 `supabase/seed.sql`. Harness 상태·후속 작업은 `harness/tasks.json`, `harness/session_log.md`와 `docs/PROJECT_STATUS.md`에서 확인합니다. CI는 비밀 없이 린트·타입·단위·빌드 검증을 수행합니다. 실제 DB E2E는 안전하게 준비한 별도 QA 계정 파일이 필요하며 공개 CI에 계정 정보를 넣지 않습니다.

## 아직 제공하지 않는 기능

실제 SNS 데이터 수집·검증, 카드 자동갱신·정산·실결제·전자계약, 팀 초대, 고급 AI 크레딧 소비, SNS API 연동은 구현 완료가 아닙니다. HOT 별도 노출 및 만료 필터는 구현되어 있으며, 실제 TEST 결제는 키 연결 전입니다. 유료 기능의 상세 상태는 작업 기록을 참고하세요. 운영 주체·문의처·정식 개인정보 처리방침은 정식 운영 전에 확정해야 합니다.

원본 로고는 제공된 자산을 사용합니다. MIT 라이선스와 `ASSETS_NOTICE.md`를 참고하세요.
