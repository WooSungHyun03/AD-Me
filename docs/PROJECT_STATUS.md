## 도메인 연결 완료 — 2026-11-19

기본 주소 https://be-celeb.org 를 AD Me Vercel 프로젝트에 연결하고 www→apex 308, TLS, Supabase Auth URL을 설정했다. [연결 기록](DOMAIN_CONNECTION.md). 기존 메일 MX/SPF 유지. 전체 실제 데이터 베타는 기존 미완료 항목 때문에 출시 완료가 아니다.

## 현재 운영 범위 변경 — 2026-11-19

[실서비스 티켓 전체](REAL_SERVICE_TICKETS.md)와 `harness/service_backlog_v2.json`을 새 작업 기준으로 추가했다. 개발 88개, USER 전용 20개, 보류 6개이며 새 기능 완료 표시는 없다. 무료 실제 데이터 베타를 목표로 하며 기존 48명은 시연 데이터다. 사업자 미등록 조건에서 실제 판매·정산은 보류하고 TEST 시연을 분리한다. 배포·외부 서비스 설정·API 키 발급/등록은 USER 전담으로 변경했다. 기존 배포·테스트 결과는 역사적 증거이며 새 요구 완료를 의미하지 않는다.

# AD Me 실제 구현·검증 상태 — 2026-11-19

## 실제 서비스
- Public URL: https://ad-me-topaz.vercel.app
- GitHub: https://github.com/WooSungHyun03/AD-Me
- Supabase: AD Me / ivtdfioypmzknlhinstg / Seoul ap-northeast-2
- 첫 CLI 배포는 Other 프레임워크로 404 발생. `vercel.json`에 Next.js를 명시하고 재배포하여 해결.
- 공개 URL HTTP 200 및 실제 DB 두 역할 브라우저 E2E 4개 통과 (48.5초). 최종 공개 URL 확장 회귀는 데스크톱·모바일 6/6 통과 (1.2m). 앱 커밋 76cdc15, 배포 dpl_F3ChhRiasCKtfDEA3rwsqdd4eGgR.

## 검증된 핵심 흐름
- 기존 QA 계정 로그인 → 브랜드 캠페인 저장 → 설명 가능한 추천 → 3명 비교 → 광고 이력 확인 → 실제 등록 크리에이터에 제안 → 크리에이터 수락 → 브랜드 대시보드 반영 → 결과물 링크 제출 → 브랜드 승인.
- DB 프로필 저장·수정·공개 설정·새로고침 유지, 검색·필터·정렬·빈 상태, 계정 표시 이름, 후보 즐겨찾기 복원·CSV.
- 공개 캠페인 지원·브랜드 수락, 관리자 로그인·신고 검토·감사 기록.
- 익명 API 차단, 타인 비공개 캠페인 조회·수정 차단, 타인 주문·메시지 격리, 프로필 역할 상승 차단, 결제 확정 RPC 직접 호출 차단.
- DB 자체 이용권 중복 방지·만료·HOT 노출 분리 테스트는 트랜잭션 롤백으로 수행. **실제 Toss 결제 성공을 의미하지 않음.**

## 결제 상태
- 상품 서버 정의, 주문·소유권·금액 검증, Toss SDK v2, 승인 Edge Function, 원자적 이용권 활성화·동일 주문 중복 방지 구현.
- 사용자 확인: TEST 상점·키 준비됨, 에이전트가 키를 확인·등록하도록 승인함.
- BLOCKED: 브라우저 도구가 DOM·스크린샷·탐색 호출에서 내부 `timeoutMs` 오류. 실제 키를 읽거나 환경변수로 등록할 수 없음. TEST 키 없이 결제 성공·이용권 활성화로 가장하지 않음. 실패·누락 키·금액 조작에 이용권 미부여 확인.
- 설정 위치: Vercel ad-me `NEXT_PUBLIC_TOSS_CLIENT_KEY`; Supabase Edge Function secret `TOSS_SECRET_KEY`. 시크릿을 Git/로그/클라이언트에 저장하지 않음.

## 외부 계정/운영 차단
- 외부 이메일 자가가입: Supabase 기본 SMTP 제한으로 실제 이메일 전달 미검증. 조직 구성원 외 사용자 가입에는 custom SMTP 또는 승인된 OAuth 설정이 필요. 이메일 확인을 끄거나 인증을 우회하지 않음. 로그인·DB 역할은 일회용 QA 계정으로 검증.
- Vercel 연결 앱은 생성 403/환경변수 404. 동일 팀 CLI 인증으로 프로젝트 생성·환경변수·배포 성공.
- Vercel GitHub 자동 연결은 CLI에서도 실패. GitHub push와 Vercel 직접 배포는 성공했으나 push마다 자동 배포 연결은 아직 안 됨. Vercel GitHub 앱의 AD-Me 저장소 접근 승인 확인 필요.
- Supabase advisory: 인증된 호출용 SECURITY DEFINER 함수 경고는 의도적 RPC이며 DB 내부 소유권·역할 검사/고정 search_path/제한된 실행권한으로 보호. 역할 조회 helper는 본인 역할만 반환. 유출 비밀번호 검사 옵션은 기본 미활성 상태로 확인; 무료 플랜 제공 여부 확인 필요.

## 구현 범위·한계
- 가상 fixture 48명·8캠페인은 DEMO. 실제 SNS API나 대량 수집 없음. 오디언스·참여율은 미확보로 표시.
- 프로필 포트폴리오는 본인 등록 외부 HTTPS 링크. 비공개 Storage 버킷·정책은 구성했으나 파일 업로드 UI는 미구현.
- AI 콘셉트·메시지는 규칙 기반 초안. 외부 LLM 미사용. 고급 AI 분석/크레딧 소비는 준비 중.
- Brand Pro/Agency/HOT는 TEST 30일 이용권 상품. 핵심 기능은 무료 공개. 팀 초대·독점 유료 기능·카드 자동갱신·실거래 정산·전자서명 미구현.
- 성과 리포트는 실제 이벤트/상태 집계만. 외부 광고 ROI·참여율 추정 생성 없음. 외부 성과 대시보드 미구현.
- 정식 운영 전 개인정보 처리방침의 운영 주체·문의처·보유 기간 확정 필요.

## Harness 해석
T004(자가가입 메일)와 T018(Toss 실제 키 연결)이 차단되어 하위 의존 태스크는 검증된 코드가 있어도 전체 완료로 올리지 않았다. `implementation_status`와 `verification` 필드 및 본 문서에 개별 검증 증거를 보존한다. 완료되지 않은 기존 acceptance를 삭제하거나 테스트를 건너뛰어 GREEN으로 만들지 않는다.
