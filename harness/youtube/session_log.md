# Durable development checkpoint

Harness documents created. **No AD Me web app implementation is claimed.**

## Session template
- Timestamp / operating machine:
- Actual repository path / branch / `origin/main` SHA:
- Task ID / current state:
- Changed files / migrations:
- Tests executed, commands, exit statuses:
- Browser URLs/screenshots checked:
- YouTube API / derived metrics approval status:
- Local LLM hardware/model/actual inference:
- Toss TEST provider confirmation status:
- Push result and remote SHA:
- Deploy URL and evidence:
- Blockers / next independently ready task:

## 2026-11-22 — 실제 저장소 연결 및 YouTube 마켓플레이스

- 기준 저장소는 기존 ADMe_Desktop_Harness, origin/main 시작점은 65063c8. 별도 개발 브랜치의 검토 대기 변경은 합치지 않았다. 원본 로고가 첨부 패키지와 바이트 단위로 일치한다.
- Next.js 16.4.6 / Node 22.23.2. Supabase 운영 DB에서 이전 TEST 승인 1건, 실제 채널 7개, 일일 작업 성공 3건, 실제 소유권 인증 0개를 확인했다. 가장 최근 자동 동기화는 11월 22일 04:00:14 KST. RTX 4080 16,376MiB. 운영 Ollama·워커 서비스 활성.
- 신규 마켓플레이스는 /brand/products, /jobs, /explore에 연결. 기존 캠페인·제안·회원권의 이력을 보존하며 새 /jobs는 전용 게시권 및 지원권을 사용한다. 같은 작업 재요청, 검색 무결과, 타 계정 접근, 공개 철회 후 이전 결과 유효성은 격리 DB에서 검증했다.
- 새 카탈로그는 검색 3천원, 공고 5천원, 지원 1천원, HOT 9,900원의 TEST 값. 서버 카탈로그와 기존 Toss 승인 및 이용권 발급을 사용한다. 신규 상품의 실제 결제 승인은 별도 확인한다.
- 평균 조회수와 YouTube API 파생 태그는 승인 미확인 상태. 검색은 원본 구독자 수, 최근 공개 영상, 본인 등록 분야·태그·형식 및 광고비를 사용한다. 자연어 검색 모델 연결, 플랫폼 내 실시간 채팅·차단, OAuth 방식 소유 검증, 고급 운영은 남았다.
- lint, typecheck, Vitest 38건, production build, supabase/tests/youtube_marketplace.sql 통과. Supabase youtube_marketplace 마이그레이션 적용 응답 성공. 운영 테스트와 배포 증거는 후속 체크포인트에 기록한다.

- 2026-11-22T11:59:08+00:00 — START A01: 기존 AD Me 저장소/환경/Git remote 실제 감사

- 2026-11-22T11:59:08+00:00 — DONE A01: 2026-11-22 검증 결과 및 실행 범위는 harness/youtube/session_log.md와 docs/youtube-harness에 기록

- 2026-11-22T11:59:08+00:00 — START A02: 요구사항 충돌 제거·작업 계획 정리

- 2026-11-22T11:59:08+00:00 — DONE A02: 2026-11-22 검증 결과 및 실행 범위는 harness/youtube/session_log.md와 docs/youtube-harness에 기록

- 2026-11-22T11:59:08+00:00 — START A03: Next.js 엄격 TS 품질·테스트 실행 기반

- 2026-11-22T11:59:08+00:00 — DONE A03: 2026-11-22 검증 결과 및 실행 범위는 harness/youtube/session_log.md와 docs/youtube-harness에 기록

- 2026-11-22T11:59:08+00:00 — START A19: 서버 GPU·CPU 환경 감사 및 로컬 모델 러너 구성

- 2026-11-22T11:59:08+00:00 — DONE A19: RTX 4080 16376 MiB, Ollama/worker active. 실측 기록 harness/youtube/session_log.md

### 운영 검증과 다음 작업

- 앱 배포 소스 274bbde, Vercel dpl_9VV6gS2HJMig2uDsG1mZwMMDZSN1 READY. be-celeb.org에서 390×844 및 1440×900의 공고 UI와 원본 로고를 직접 확인했다. GitHub Actions 45020506267 통과. 원격 main 직접 푸시는 GitHub의 기존 관리자 예외로 수락되었으며 보호 설정 변경은 하지 않았다.
- Supabase marketplace와 chat 마이그레이션 적용, Realtime publication 메시지 포함 및 비로그인 차감 RPC 차단을 확인했다. 격리 PostgreSQL 검증은 교차 계정, 신규 공고 결제 우회 차단, 지원/검색 중복 차감 방지, 철회, 차단 상대의 전송 및 차단 해제 권한, HOT 노출과 만료를 포함한다. 격리 발급은 TEST 공급자 승인이 아니다.
- 운영 E2E 최초 16/18. 데스크톱과 모바일에 공통으로 채팅 수신이 실패해 구독 전 세션 인증과 열린 대화의 재조회 경로를 보완했다. 최신 배포 재검증은 모바일·데스크톱 상품/공고/중복 주문과 양방향 협업/메시지/읽음 4/4. 별도 자동화에서 수신 브라우저가 Supabase Realtime postgres_changes 이벤트를 받았고, 브라우저의 읽음 카운트도 확인했다.
- 실제 Toss TEST 게시권 결제창 표시, 5,000원 서버 카탈로그, 동시에 재요청한 주문의 동일 ID를 확인했다. 신규 4개 상품 승인 건수 0이다. 이전 Brand Pro 승인 1건은 별개다. TEST 결제창에서 계정 소유자가 필요한 인증을 마치면 승인과 권한 발급을 대조할 수 있다. 운영에 가짜 paid 내역을 넣지 않았다.
- 오늘 04:00:14 KST 일일 동기화 완료. 누적 일일 성공 3건, 실제 채널 7개, 검증 소유자 0명. 새 worker 코드에서 공식 영상 원본 조회수 5건을 조회·저장했다. 평균 조회수와 API 자료 파생 AI 태그는 정책 승인 확인이 필요하다.
- 현재 모델 Qwen3 1.7B Q4_K_M. CPU 모드 한국어 JSON 3회(평균 9,141ms, 관측 p95 25,442ms), EmbeddingGemma 768차원 성공. 실제 운영 E2E의 브랜드 초안을 확인했다. 로컬 모델에 입력된 것은 브랜드 브리프이며, 유료 조건 검색 순위는 본인 입력 태그 기반이다.
- 미완료: 실제 크리에이터의 공개 동의 및 채널 소유 검증, Google OAuth, 자연어 모델 파서·콘텐츠 태그·추천 이유 연동, 공고·지원권의 실제 수납부터 전체 흐름, 상세 운영 관리/소유자 연락처 공개 설정. 기존 /campaigns 경로는 호환성 때문에 별도로 있으며 신규 /jobs의 결제 정책을 사이트 전체에 적용한 상태가 아니다.

## 2026-11-23 — 광고 공고 게시권 Toss TEST 승인 검증 보류

- 사용자가 5,000원 광고 공고 게시권의 Toss TEST 결제창 인증을 이번에는 진행하지 않기로 했다. 공급자 승인 및 승인 후 이용권 발급은 미실행으로 기록한다. 앞서 확인한 결제창 표시, 서버 금액 검증, 중복 주문 방지 결과는 위 체크포인트를 참조한다.

## 2026-11-23 — 가상 인플루언서 삭제 및 인기 YouTube 채널 공개

- 운영 Supabase의 소유자 없는 가상 프로필 48개와 연결된 가상 광고 이력 24건을 삭제했다. 신고 5건은 기존 대상 ID를 기록해 보존했다. 외래키 검토에서 실제 협업과 실제 광고 이력 영향이 없는 것을 확인했다. 일반 시드에서 가상 크리에이터 생성을 제거했다.
- YouTube Data API로 10개 채널 및 공개 영상 50건을 수집했다. 홈페이지와 /creators, 채널 상세에서 공개 채널 출처·갱신 날짜·가입/협업 미확인 상태를 표시한다. 승인 목록을 사용하며 반려 또는 30일이 지난 원본 데이터는 공개 조회에서 제외한다. 광고 추천에는 가입한 프로필 경로를 유지한다.
- 운영 소스 7ec4cdd, Vercel dpl_FJz1z1Fydr29Ekij9KqJX8jnH9Fi READY, GitHub Actions 45079971010 성공. 격리 SQL과 Vitest 38개 및 lint·타입·빌드 통과. 운영 service E2E 최초 5/6. 데스크톱 탐색 1건은 마지막 수집 작업 전 9개가 표시돼 실패했고, 완료 후 데스크톱·모바일 탐색 재실행 2/2 통과. 기존 가상 프로필 주소의 안내 화면도 확인했다.

## 2026-11-23 — YouTube 채널 상세 프로필

- YouTube Data API의 채널 사진·배너·핸들·설명·주제·개설일·기본 언어·원본 통계와 영상별 조회수·좋아요·썸네일을 운영 워커와 Supabase에 연결했다. 공개 채널 10개와 최근 영상 300건을 갱신했다. 실제 일일 작업 경로의 검증 실행은 1회 시도로 완료됐고 공개 채널 10개를 모두 갱신했다. 기존 04:00 KST 일정과 30일 원본 데이터 보관 정책을 유지한다.
- 채널 상세에 12개 영상과 더 보기, 소유권 공개 상태, 검증된 광고만 표시하는 이력, 가입자 협업 흐름, 배너·사진 오류 대체 상태를 적용했다. 관심 채널 저장·해제와 새로고침 유지가 데스크톱·모바일에서 통과했다.
- Supabase 트랜잭션 테스트에서 소유권 확인 직후 동기화, 본인 연락처 공개 동의, 비인증 계정의 연락처 등록 거부, 다른 계정의 관심 목록·비공개 연락처 접근 거부, 공개 동의 철회 후 연락처와 상세 연결 차단을 확인했다. 테스트 프로필은 롤백했다.
- 쯔양, PONY Syndrome, RISABAE에 대해 공식 API 원본, 실제 사진·배너·영상 썸네일 로딩, 상세 이동, 원본 영상 주소, 12+18개 목록, 모바일 가로 넘침을 Playwright 데스크톱·모바일에서 검증했다. lint·타입·Vitest 38건·빌드·Harness 검증이 통과했다.
- 기간별 평균 조회수와 YouTube 자료 기반 Local AI 태그는 권한 근거 확인 전 비활성 상태다. Shorts/롱폼 구분에는 확인 가능한 공식 필드가 없으며 영상 길이로 추정하지 않는다. 운영 DB에 인증 소유자와 검증 광고 이력이 없어 실제 연락처·광고 이력의 공개 사례는 비어 있다.
- 전체 Playwright 회귀 24건과 추가 관심 채널 저장 회귀 2건을 통과했다. 기존 Local AI 광고 초안, 로그인·복구 화면, 브랜드 캠페인·추천·협업, TEST 결제 검증 분기, 관리자 권한을 포함한다.
