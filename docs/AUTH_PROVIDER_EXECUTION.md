# 인증·외부 공급자 실행 기록 — 2026-11-19

현재 서비스: https://be-celeb.org . 이번 기록은 외부 20개 티켓의 후속 실행 증거다. 전체 티켓 또는 실제 데이터 베타 출시 완료를 뜻하지 않는다.

## 확인된 실제 결과

- Resend의 mail.be-celeb.org 인증 상태 verified, 서울 리전. 도메인 한정 sending_access 전용 키를 발급해 Supabase SMTP에만 연결했다. SMTP SSL 465 로그인 성공. Cloudflare DNS 변경은 이번에 필요하지 않았다. 부모 도메인 DMARC는 p=none 관측 정책이다.
- Supabase confirmation/recovery 한국어 템플릿, Site URL, exact callback allowlist 적용. config diff의 선언 설정 차이 0. 원격 이메일 확인/MFA 등 미선언 설정은 보존했다.
- 2242798@donga.ac.kr 가입 인증 메일과 복구 메일 모두 Resend delivered 확인. 사용자가 가입 인증 완료를 알렸고 DB email_confirmed 및 brand 프로필 생성 확인. 비밀번호 복구의 사용자 입력·재로그인 결과는 별도 확인 대상으로 유지한다.
- /auth/confirm은 GET에서 증표를 사용하지 않는다. POST의 이메일 증표 검증 후 인증/재설정을 수행한다. 복구는 recovery 유형·비밀번호 확인을 검증하며 로그인 세션만으로 재설정할 수 없다. callback은 PKCE 교환과 dashboard redirect만 허용. auth 경로는 no-referrer/no-store/noindex.
- Toss 초기 gck/sk 혼합 키를 발견해 사용자에게 같은 세트를 요청했다. 수정한 API 개별 연동 test_ck_/test_sk_ 등록 완료. 클라이언트 가드는 gck 및 라이브 키를 거부한다.
- 실제 Toss TEST 결제: Brand Pro 49,000원, 공급자 조회 DONE 및 주문 일치. 사용자가 TEST 동의·인증을 직접 완료했다. 서버 승인 후 paid 주문과 30일 이용권 1개 확인. 이용권 유효 기간은 2026-11-19 06:49:01 UTC부터 2026-12-19 06:49:01 UTC까지다. 결제 처리·paid 저장을 수동 조작하지 않았다.
- 승인 완료 주문의 finalize RPC를 2회 재실행해 동일 이용권 ID 반환·총 1개 유지 확인. 이는 DB 부여 처리의 재시도 검증이며 공급자 인증/결제창의 모든 실패·취소 시나리오 완료를 뜻하지 않는다.
- Google YouTube Data API v3 실제 channels.list 연결 성공. 공식 Google Developers 채널 ID 1건만 조회했고 실제 인플루언서 DB 수입은 0건이다. 서버 Secret 등록은 완료했으나 수집 어댑터·정책 승인·쿼터 제한 콘솔 검증은 미완료다. 브라우저 제어 오류로 Google 콘솔 변경은 사용자가 수행했다.

## 자동 검증

- lint, TypeScript, Vitest 35/35, Resend DNS guard Python 5/5, Next.js build 통과.
- 로컬 실제 Supabase 연결 E2E 10/10 통과.
- https://be-celeb.org 실제 모바일/데스크톱 E2E 10/10 통과: 탐색·필터·비교·광고 이력·두 역할 협업·결과물·권한·재조회·인증 오류 경로.
- 처음 회귀에서 9/10: 키 등록 중 결제 오류가 503(미설정)에서 400(실제 provider 거절)으로 바뀌었다. 기존 성공 가정 테스트를 수정해 실제 provider 거절 및 이용권 미부여 문구를 확인하고 재실행했다. 최초 실패를 성공으로 기록하지 않는다.
- 인증 테스트 초기 locator 충돌 2건은 Next route announcer와 폼 오류 영역의 중복 매칭이었다. 정확한 폼 alert로 수정 후 인증 4/4 및 전체 회귀 통과.
- QA 계정 소유이면서 QA 공개 모집 접두어인 캠페인만 closed로 정리했다. 실제 사용자 주문·이용권·캠페인은 정리 대상에서 제외했다.

## 백업·격리 복원

public schema/data, auth/storage schema/data를 비공개 로컬 파일로 추출했다. 파일은 Git/Vercel 업로드 제외, 디렉터리 700·파일 600이다. 네트워크 none·공개 포트 없는 임시 PostgreSQL 17.11 컨테이너에 복원 후 제거했다.

클라우드 전용 pg_attver 메타데이터는 로컬 PG에서 지원되지 않았다. 원본 덤프를 보존하고 복원용 사본에서 해당 ALTER COLUMN 메타데이터 행만 제외했다(auth/storage 364행, public 78행). auth의 가입 트리거는 public 함수 생성 후 적용했다. 스키마·데이터·트리거 복원 각 단계 exit 0.

복원 결과: public 테이블 13개, RLS 테이블 13개, 외래키 22개, 고아 행 0개, Auth 사용자 5개, Storage object 0개. 덤프 시점 공개 데이터는 프로필 4·크리에이터 49·캠페인 46·주문 22·이용권 0개였다. 현재 실제 TEST 결제는 그 이후 발생했으므로 해당 백업에 없다.

public과 auth/storage는 서로 다른 시점의 덤프다. 원자적 시점 복원, 정기 실행, 외부/암호화 보관, 장애 알림, Storage 파일 백업·복원 검증은 완료하지 않았다. 현재 Storage 파일 수는 0이다. 이 결과를 전체 재해 복구 준비 완료로 해석하지 않는다.

## 남은 외부 조건

- GitHub Vercel 앱의 저장소 접근 실패 해결, 환경 분리 및 호스팅 용도 적합성 확인.
- Google 키 restriction·쿼터 콘솔 설정 증거, YouTube 정책/실제 수집 범위, 실제 참가자·프로필 권리·연락 동의.
- 관리자 MFA/세션 보안, 비밀번호 복구 최종 사용자 확인, TEST 실패·취소 및 격리 환경.
- 개인정보 보존/삭제·국외이전 등 확정 정책, 정기 외부 백업·알림·일관된 복구, 실데이터 개발 선행 기능.
- Instagram/TikTok은 승인/계정 요건 및 개발이 필요한 조건부 범위. 선택 LLM은 비활성.

원본 20개 티켓의 남은 범위는 harness/handoff/runtime-status.json의 user_actions와 docs/EXTERNAL_EXECUTION_STATUS.md를 함께 확인한다. 무료 실제 데이터 베타 출시는 NO-GO 유지.
