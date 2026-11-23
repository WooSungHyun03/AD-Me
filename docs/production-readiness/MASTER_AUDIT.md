# AD Me 실서비스 출시 감사

2026-11-23 KST · 감사 시작 main ecb0fa859f679fc7beec8839c18f2d43669e9a97 · [운영](https://be-celeb.org/) · [Vercel 배포](https://vercel.com/sunghyuns-projects-da008879/ad-me/G3S8oSBWEEadE4dShsgjKHjKa854)

**최종 판정은 NO-GO다.** 현재 공개 주소는 무료 호환 빌드다. 새 버전의 권한·DB, 인증된 양측의 협업, 운영 복원, 법적·사업 승인까지 확인해야 신규 출시를 승인할 수 있다.

## 현재 시스템과 감사 범위

Next.js App Router와 Vercel은 화면과 서버 API를, Supabase PostgreSQL·Auth·Storage·Edge Function은 자료·권한·주문을 처리한다. YouTube 수집과 Local AI는 작업 큐를 사용한다. 운영 빌드 소스는 11af311f50e3ff8280ce530879031d636af908ca다. main 자동 배포는 vercel.json에서 비활성이고 GitHub Actions는 검증을 실행한다.

운영 원장 41행과 저장소 SQL 105개를 확인했다. 일부 운영 이력은 다른 버전 번호를 사용하므로 차이 64를 곧바로 적용 대상 목록으로 삼지 않는다. 운영에는 featured_youtube, marketplace_action, marketplace_search, transition_proposal, ops_dashboard, create_test_order, begin_test_cancel, finish_test_cancel이 있다. creator_home_summary, ops_enrollment_role, filtered_creator_catalog, delivery_transition은 조회 당시 운영에 없다. D085에서 SQL 본문·권한·호출 계약·원격 이력을 매핑하고 D087에서 복제를 복원한다. 운영 DB를 변경하지 않았다.

- App Router 화면 템플릿 48개를 자동 분류해 실제 URL 60개, 경로·역할 조합 62개를 탐색했다. 뷰포트 관측 196회, axe 24회, 가로 넘침·페이지 JavaScript 예외·axe 규칙 위반 0건이다. 주요 화면을 360·390·430·768·1024·1280·1440·1920px에서 확인했다.
- 파일 기반 API 69개를 분류했다. 운영 16개 경로를 익명 GET으로 관측했다. 405는 해당 읽기 메서드가 제공되지 않는다는 뜻이다. 404는 기존 배포의 미노출 또는 미지원이며 권한 검증 결과로 해석하지 않는다. 브랜드의 관리자 POST 거부는 운영 E2E에서 별도로 확인했다.
- 운영 Playwright 14건에서 역할별 관리자 접근 제어, 게시권 CTA, 실제 음식·테크 검색 및 홈 추천, 실제 채널 3개의 영상과 미디어를 확인했다. 격리 Playwright 8건에서 브랜드 상품과 비공개 공고 초안, 주문 가격·중복 방어, 채팅 내역·재전송, 미인증 지원 수락의 409를 확인했다.
- 운영 404는 /ad-history/new, /admin/reviews, /admin/security, /saved-searches, /signup/resend다. 캡처는 ignored output/playwright/readiness/에 보관했다. QA 개인 캡처·동적 레코드 ID·인증 trace는 공개 Git에 넣지 않았다.
- 최초 로딩·반응형 렌더는 이번 순회, 키보드·시각 차이는 [직전 디자인 감사](../design/visual-audit.md)의 같은 운영 배포 증거를 참조한다. 새 가입 수신, 모든 계정의 만료·복구·삭제, 실제 OAuth, 실시간 양방향 수신·망 장애, Toss 승인/실패/취소, 다중 브라우저는 일부 또는 전부 UNVERIFIED다. 기존 수집·채팅 상태를 확인하는 과정에서 운영 장애나 파괴적 데이터 변경을 발생시키지 않았다.
- 피처링과 레뷰의 최신 공식 화면을 Chromium에서 열었다. 제품 선택·검색 행동·화면 위계는 [참고 화면 비교](../design/visual-audit.md)와 함께 보존했다. [피처링](https://featuring.co/product-search) · [레뷰코퍼레이션](https://corp.revu.net/) · [레뷰 비즈센터](https://biz.revu.net/)

## 핵심 사용자 흐름

| 기능 | 코드·데이터 | 확인 범위 | 남은 출시 조건 |
|---|---|---|---|
| 가입·세션·삭제 | Auth 메일/callback, settings, consent, deletion | QA 로그인 세 역할. 과거 사용자 가입/복구 증거. 운영 재전송 404 | 신규 외부 수신, 만료, 탈퇴/재인증. D009·D013·D014·D073 |
| 상품→AI 매칭→제안 | recommend-creators, catalog, marketplace_search | 음식/테크 결과 변화. 격리 상품 등록→비공개 초안. 규칙 기반 및 공식 주제 후보 | 상품 원문→모델 조건→후보·비교·스냅샷·실제 제안. D039·D044·D045·PR-001 |
| 광고 공고·지원 | /jobs, marketplace_action, proposals | 격리 초안·타인 비공개 거부, 미인증 수락 409. 운영 목록·작성 진입 | 인증된 채널의 게시·지원·수락·결과물 검토, 경합·차감. D025·D043·D049·D054·D069 |
| 채팅 | dashboard, messages, proposal_reads | 격리 내역·재전송·중복 방어, 운영 화면 일부 접근 | 두 실제 역할 실시간 수신·읽음·재연결·첨부·차단·신고 관리자. D051·D052·D062 |
| Toss TEST | Checkout, orders/confirm, Edge Function, entitlements | 격리 CTA·로그인 방어·서버 금액·중복 주문. 과거 TEST 승인 이력 | 현 환경 실제 승인을 분리 검증. 실패/취소/환불·권한 회수. D066–D069·PR-004 |
| HOT | active_hot_creators, 별도 스폰서 슬롯 RPC | 운영 RPC 이름과 UI 계약 | 인증 채널만 구매, 활성화, 환불·만료·organic 순위 분리. D070 |
| YouTube | 원본 API, adme_ops.jobs, featured_youtube | 공개 채널 10개가 최근 36시간 내 갱신. 11월 23일 04:00 KST 작업과 08:17 추가 실행 완료 | 실제 소유권 신규 인증·쿼터 소진 경보·캐시 TTL·철회·재유입 차단. D019·D021·D024·D025 |
| 평균·태그 | video-insights, content_tags, 상세 날짜 필터 | 원본 영상과 조회수, 기간·영상 개수 필터 동작. 평균·증가량 fixture, 로컬 태그 임시 결과 | 적법한 소스·동일 표본·승인된 시점 스냅샷·태그 승인/철회. D031·D035·PR-002·U010 |
| 관리자·보안 | ops console, MFA, 공개 DTO, SQL/Storage 권한 | 운영 admin 접근·브랜드 403. public 기본 테이블 47개에 RLS, public 정책 56개 | 최신 MFA·신고·감사·실제 백업 복원, RPC와 Storage 권한의 전수 동작. D016·D058–D064·D075·D086 |
| 성능·SEO | canonical, sitemap, robots, 최적화·캐시 | 운영 호환 배포의 이전 Lighthouse 홈 LCP 0.92초. 이번 axe 24회 무위반. 생산 의존성 npm audit 보고 0건 | 현장 INP·다중 브라우저, 배포 직후 캐시·리다이렉트, 세션 종료 및 접근성 전체 검증. D082·D083·D087 |

## Local AI 실제 관측

Ubuntu 24.04.3 LTS Linux 7.0, i7-13700 24 논리 CPU, RAM 62 GiB, RTX 4080 VRAM 16,376 MiB, NVIDIA 드라이버 580.173.02, CUDA 드라이버 표기 13.0, Docker 28.5.1. Ollama 0.32.1은 127.0.0.1:11539로 제한되어 있고 systemd 워커가 enabled/active이며 관측 재시작 횟수는 0이었다. 운영 작업 원장에서 AI 작업 완료 10건을 확인했다. API·Vercel은 직접 GPU를 실행하지 않고 큐를 경유한다.

qwen3:1.7b-q4_K_M에서 합성 한국어 광고 입력 3건으로 실제 구조화 결과를 생성했다. 2,362 / 747 / 794ms, 평균 1,301ms였고 동시 2건은 741 / 1,334ms였다. embeddinggemma 결과는 768차원이다. 허용된 합성 제작 원고에서 근거를 갖는 태그 6개를 생성해 검토 대기 상태를 받았다. 이 결과는 로컬 smoke다. 표본이 3개라 p95를 산출하지 않았다. 장시간 p95, 워커/모델 재시작·타임아웃 복구, 고객 원문 운영 연동, 승인 태그의 DB 게시·철회는 미검증이다. 설치와 실측 증거가 있는 Ollama를 유지한다. llama.cpp는 단일 GGUF 운영 단순화, vLLM은 동시성 개선 비교 후보로 두고 실제 부하 결과로 재평가한다.

| AI 요구 | 현재 증거와 선행 작업 |
|---|---|
| AI-01 상품 이해 | 한국어 JSON 실측. 운영 브랜드 상품·타깃→추천 조건 연결 필요. PR-001 |
| AI-02 자연어 검색 | 명시 필터·구조 입력. 한국어 질의→확인 가능한 필터·오류 검증과 운영 연결. D039 |
| AI-03 브랜드 매칭 | 실제 공개 후보와 등록 조건 기반. 버전·조건·결측·적격성 강화. D044·D045 |
| AI-04 콘텐츠 분석 | 허용된 합성 텍스트 분석. 원본 파생과 자체 제공 자료 권한 구분. PR-002·U010 |
| AI-05 해시태그 | 로컬 태그 6개. 저장·검토·공개·철회 파이프라인 필요. PR-002 |
| AI-06 유사 유튜버 | 임베딩 실측. 적법한 코퍼스 및 유사도 노출 승인 필요. D032·D047 |
| AI-07 광고 이력 | 출처·상태 중심 기존 기능. 광고 추정의 사실 확정 금지. D029·D030 |
| AI-08 캠페인 분석 | 조건·일부 결측 근거. 불일치 설명, 버전 기록 및 상품 원문 연결. D041·D044·PR-001 |
| AI-09 추천 이유 | 규칙 근거 존재. 출처 버전·스냅샷·변경/재계산 후 검증 필요. D045 |
| AI-10 중복 | YouTube channel ID를 기준으로 대조. 임베딩으로 ID를 대체하지 않는다. D018·D019·D024 |
| AI-11 운영 지원 | 큐와 집계 가용. 장애 유형·경보·모델 p95/lease 회수 필요. D086·PR-003 |
| AI-12 품질 | 기본 smoke만 확인. 실제 사람이 채점한 query/candidate fixture·누락률·설명 평가 필요. D046·D047 |

승인된 실제 용도가 확인되기 전 공식 YouTube 원본으로부터 제한된 파생 결과를 제공하지 않는다. 적법한 직접 제공 자료는 권리와 동의에 따라 검토한다. 결제·권한·크레딧 판정은 결정론적 서버 로직을 사용한다. [YouTube 파생 지표 정책](https://developers.google.com/youtube/terms/derived-metrics-policy)

## 사용자 문구와 디자인

| 발견 | 재현·조치 |
|---|---|
| 결제·공고 사용자 화면에 내부 TEST가 반복됨 | /pricing·/help·공고 및 Checkout 사용자 문자열 비교. main에서 CTA를 “이용권 구매하기”로 바꾸고 시연 무과금 고지를 분리했다. 운영 호환 배포의 문구는 기존 상태다. D002·D065 |
| Checkout에서 SDK 및 공급자 에러 상세가 사용자에게 전달됨 | 기존 catch와 응답 메시지 렌더를 확인했다. main에서는 상태별 사용 안내와 일반적인 결제창 오류만 표시한다. 기존 서버 금액 검증과 로그는 보존했다. D002·D004·D067 |
| 내부 API 키·RPC·Worker·Queue·Fixture 표현 | UI 소스에서 찾아 관리·QA 진단과 사용자 안내를 구분했다. 가상 데이터·스폰서·무과금에 필요한 고지는 유지한다. 전체 i18n 검증은 D002 |
| 모바일 CTA와 상태 처리 | 요금제 클릭·가시성·역할 접근 확인. 공고 복잡한 상태·빈 화면, 운영 404 및 모달 전체 키보드 경로는 D082 |

## 영역별 담당 연결

| 영역 | 담당 티켓 |
|---|---|
| PRODUCT / UX / UI / FRONTEND | D002·D011·D034·D081·D082 |
| BACKEND / DATABASE | D004·D018·D085 |
| AUTH / SECURITY | D009·D013·D016·D027·D075–D078 |
| AI / YOUTUBE / MATCHING | D019·D021·D031·D039·D044–D048·PR-001–003 |
| MARKETPLACE / CHAT | D043·D049·D051–D056 |
| BILLING / ADMIN | D058·D060·D065–D070 |
| PRIVACY / COMPLIANCE | D014·D073·D074·D079·U001·U010·U021–022 |
| PERFORMANCE / SEO / ACCESSIBILITY | D082·D083·D087 |
| OBSERVABILITY / DEVOPS / OPERATIONS | D064·D085–D088 |
| QA | D084·D088 |

[전체 티켓](ALL_TICKETS.md) · [공유 계약](SHARED_CONTRACT.md) · [출시 판정](GO_NO_GO.md) · [외부 조건](EXTERNAL_ACTIONS.md). [Toss 입점·제품 준비](https://docs.tosspayments.com/guides/v2/get-started/payment-products) · [Toss TEST 환경](https://docs.tosspayments.com/guides/v2/get-started/environment) · [개인정보 보호법 제30조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1033215151).

## 실행 증빙

- 격리 직접 REST 14건 통과. 예전 테스트의 미인증 프로필 및 직접 INSERT를 사용한 성공 가정을 발견해, 첫 실패를 유지한 뒤 격리 인증 fixture와 실제 앱의 제안 RPC를 사용하도록 복구했다. 차단된 캠페인의 직접 INSERT 및 앱 RPC 거부를 다시 확인했다. 제품의 RLS·권한 설정은 완화하지 않았다.
- 모바일에서 일치 없는 탐색, 브라우저 오프라인 뒤 재접속·새로고침, 로컬 세션 쿠키 제거 뒤 로그인 리디렉션을 확인했다. 자연 만료 시간과 메시지 유실은 별도 검증 대상이다.
- 실제 링크를 확보하지 못한 동적 템플릿은 /campaigns/[id]/copy, /campaigns/[id]/edit, /campaigns/[id]/recommendations, /collaborations/[id]/deliverables이다.
- 격리 TEST 결제 UI 2건과 승인 상태 재확인 2건을 추가 실행했다. 공급자 내부 오류 노출 차단, 불완전한 성공 응답의 재시도, 동일 주문 승인 확인과 실제 무청구 안내를 검증했다.
- [경로별 브라우저·API/모델 원장](../../harness/evidence/PRODUCTION-READINESS-20261123/verification.json)

| 운영 API GET | 응답 |
|---|---:|
| /api/health | 200 |
| /api/creators | 200 |
| /api/account | 405 |
| /api/account/deletion/status | 404 |
| /api/admin/intelligence | 405 |
| /api/notifications | 401 |
| /api/messages | 405 |
| /api/lists | 405 |
| /api/billing/orders | 405 |
| /api/intelligence | 401 |
| /api/observability | 404 |
| /api/privacy/exports | 405 |
| /api/export | 401 |
| /api/compare | 404 |
| /api/safety | 405 |
| /api/reviews/public | 404 |
