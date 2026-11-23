# AD Me 환경 설정 계약 — 현재 코드와 예정 설정 구분

2026-11-19 기준. 외부 콘솔·등록·배포는 사용자가 수행한다. 아래에는 공개 및 서버 설정 이름과 안전 기본값을 기록한다. `NEXT_PUBLIC_`에는 공개 가능한 설정만 입력한다.

## 현재 설정

|설정 이름|현재 상태·consumer|등록 위치|누락/주의|
|---|---|---|---|
|NEXT_PUBLIC_SUPABASE_URL|src/lib/config.ts → SSR, proxy, 결제 확인|해당 Vercel Production/Preview 및 로컬 ignored .env.local|공개 프로젝트 origin. 환경별 프로젝트를 구분한다.|
|NEXT_PUBLIC_SUPABASE_ANON_KEY|src/lib/config.ts → SSR, proxy, 결제 확인|동일 환경 Vercel/로컬|공개 anon JWT 또는 publishable 형식만 수락한다. publishable 전환 시 Edge/Auth 호환을 재검증한다.|
|NEXT_PUBLIC_TOSS_CLIENT_KEY|src/lib/config.ts → Checkout|격리된 TEST Vercel 환경|TEST API 개별 연동 클라이언트 형식만 수락한다. U015에서 실제 키 세트를 확인한다.|
|TOSS_SECRET_KEY|구현됨: Supabase payment-confirm Edge Function|해당 Supabase Edge Functions Secrets|TEST 전용 server secret. Vercel/브라우저로 복제할 필요 없다. 미설정이면 실제 TEST 승인 불가.|
|SUPABASE_URL|Edge Function의 기존 런타임 제공 값|Supabase 런타임|payment-confirm이 사용. 프로젝트를 바꾸려고 수동 덮어쓰지 않는다.|
|SUPABASE_SERVICE_ROLE_KEY|Edge Function의 기존 런타임 제공 값|Supabase 런타임만|현재 Vercel에 등록할 필요 없다. RLS 우회 권한이므로 절대 공개하지 않는다. 필요시 해당 런타임의 현행 키 방식과 호환성을 별도 검토한다.|
|NEXT_PUBLIC_APP_URL|src/lib/config.ts → 인증 링크|각 Vercel 환경|해당 환경의 HTTPS origin. Supabase Site URL 및 exact /auth/confirm 경로와 일치시킨다. 로컬 개발에서는 loopback HTTP를 허용한다.|
|ADME_SERVICE_MODE|src/lib/config.ts, payment-confirm|Vercel 서버, 격리 TEST Edge Function|기본 free_beta. test_demo에서만 TEST 결제 가능. 오입력 시 결제 비활성. D001 DB 격리 필요.|
|ADME_FEATURE_MAIL|src/lib/config.ts → 앱 가입·재발송·복구|Vercel 서버/로컬|기본 off. on 및 Supabase·앱 origin 설정 시 발송 진입점 제공. 기존 이메일 증표 검증은 독립.|
|ADME_FEATURE_TEST_BILLING|src/lib/config.ts, payment-confirm|격리 TEST Vercel 서버 및 TEST Edge Function|기본 off. 양쪽 설정이 켜져야 주문 및 승인이 동작한다.|
|ADME_FEATURE_INGESTION|src/lib/config.ts|Vercel 서버/로컬|기본 off. 어댑터·정책 인계 전 on이어도 미가용.|
|ADME_FEATURE_LLM|src/lib/config.ts|Vercel 서버/로컬|기본 off. 어댑터 인계 전 on이어도 미가용. 규칙 기반 초안은 사용 가능.|
|BASE_URL|Playwright 설정이 읽음|개발자 로컬 테스트 프로세스|배포 env 필수 항목 아님. 원격 URL 지정 시 Playwright 웹서버는 시작하지 않는다.|

SMTP host/port/user/password·발신 주소는 **Supabase SMTP 설정 화면**에 등록한다. 앱에 동일 값이 필요한 D053 구현이 추가되면 별도 메일 어댑터 설정 계약을 만든다. API key와 SMTP password가 같은지는 공급자에 따라 다르다.

## 제안 설정 — 코드 구현 전 활성화 금지

|제안 이름|담당 티켓|저장 위치|의도·안전 기본값|
|---|---|---|---|
|YOUTUBE_API_KEY|D003/D019|Vercel 서버만|YouTube API 전용 restriction. 키를 NEXT_PUBLIC_로 바꾸지 않는다.|
|AI_PROVIDER_TOKEN / AI_MODEL_ID|D003/D048|Vercel 서버만|실제 provider 선택 후 이름 확정. 토큰 없이 deterministic fallback.|
|META_APP_ID / META_APP_SECRET|D003/D022|서버만, 선택 공급자 계약에 따름|로그인 방식·scope·callback 구현 후 등록. secret은 브라우저 노출 금지.|
|TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET|D003/D023|서버만, 선택 공급자 계약에 따름|공급자 승인·OAuth 구현 후 등록.|
|ADME_JOB_AUTH_SECRET|D003/D021|검토된 작업 실행 서버만|외부 job endpoint를 실제로 만들 경우에만 필요. 사용자 cron 설정 전 호출 인증·중복 방지를 구현한다.|

이름은 **제안**이다. 개발자는 D003에서 구현 소비 위치를 확정하고 `harness/handoff/environment-manifest.json` 상태를 IMPLEMENTED로 변경한 뒤 사용자에게 등록을 요청한다. secret으로 OAuth 토큰 저장 암호화를 직접 임의 설계하지 말고 지원되는 비밀 관리/암호화 방식을 검토한다.

## 개발 검증과 플래그 적용 기록

- 개발자 진단 `npm run check:config`는 .env.local 및 프로세스 설정에서 이름, 누락·형식 오류, 최종 기능 상태를 출력한다. 키 본문·일부와 URL 값은 출력하지 않는다. 생산 설정을 검증할 때는 `NODE_ENV=production` 기준으로 확인한다.
- 설정 변경은 대상 환경, 적용자, 배포 버전, 시각, 이전·이후 기능 상태를 릴리스 기록에 남긴다. 값을 출력하거나 로그를 공개하지 않는다.
- 결제가 이미 승인됐더라도 기능을 끈 상태에서는 앱·Edge에서 재확인할 수 없다. 격리 TEST에서 다시 활성화한 뒤 기존 주문 ID로 확인한다. Vercel 앱 설정을 끈 뒤 Edge 설정을 끄면 양쪽 경계가 닫힌다.
- 앱의 메일 플래그는 앱의 발송 동작을 제어한다. Supabase Auth 자체의 SMTP·가입·속도 제한은 USER가 해당 콘솔에서 설정한다. 기존 직접 주문 RPC의 격리 검증은 D001에 남아 있다.

## 환경별 매핑 양식 — 값은 비공개

|환경|Supabase ref|Vercel project|app origin|데이터/모드|상태|
|---|---|---|---|---|---|
|현재 공개 배포|ivtdfioypmzknlhinstg|ad-me|https://ad-me-topaz.vercel.app|기존 DEMO 포함, 새 무료 모드 미구현|역사적 기준선|
|로컬 검증|사용자/개발자 합의 후 기록|해당 없음|http://localhost:3000|격리 fixture|미확정|
|무료 실제 베타|U003에서 확정|U005에서 확정|U005/U017에서 확정|실제 허용 데이터/free_beta|미확정|
|격리 TEST 시연|U003에서 확정|U005에서 확정|U005에서 확정|DEMO+TEST/test_demo|미확정|

실제 프로젝트 개수/무료 플랜 가능 여부를 확인하기 전 새 프로젝트가 있다고 가정하지 않는다. 같은 DB를 임시 사용해야 한다면 단순 UI 토글로 격리된다고 판단하지 말고 서버·RLS·데이터 네임스페이스 설계를 재검토한다.

## 변경·교체 체크

2026-11-20 main 통합: `ADME_FEATURE_INGESTION` / `ADME_FEATURE_LLM`은 구현된 작업 큐의 앱 접수를 제어한다. `on`과 유효한 Supabase 설정이면 앱 상태는 enabled이며, worker가 실행 중이거나 공급자 검증을 마쳤다는 뜻은 아니다. DB의 `adme_ops.resource_controls`도 각각 true여야 접수/lease가 열린다. 새 마이그레이션은 두 값을 false로 만들고 discovery를 중지한다. DB owner인 USER가 검토 후 활성화한다. false로 바꾸면 새 lease와 접수를 차단하지만 이미 시작한 외부 호출은 중단하지 않는다. 기존 조회·철회·연결 해제는 유지한다.

main의 worker 설정명은 `ADME_WORKER_TOKEN`(서버 전용64자 무작위 토큰), `YOUTUBE_API_KEY`(YouTube 전용), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`(공개 연결)다. 현재 worker는 기존 특정 프로젝트만 허용하며 로컬 계약 테스트는 별도 fixture 소비자를 쓴다. `--smoke`는 실제 모델을 최대3회 호출하므로 이번 로컬 검증에서는 실행하지 않는다. 키 발급/등록 및 실제 worker 운영은 USER 작업이다.

1. USER가 대상 계정·환경·설정 이름을 확인한다.
2. 공급자에서 발급한 값은 해당 전용 콘솔에 직접 등록한다. 키 일부도 증거에 넣지 않는다.
3. USER가 필요한 새 배포를 실행한다. `NEXT_PUBLIC_`는 빌드 시 반영되므로 기존 배포에서 즉시 바뀐다고 가정하지 않는다.
4. 개발자는 값 자체 대신 기능 연결·인증 실패 처리·로그 마스킹·환경 경계를 검증한다.
5. 노출 시 old key 폐기/교체·배포·연결 확인 순서는 공급자 기능에 맞춰 계획한다. 비밀값을 Git 이력에서만 지워서 해결했다고 판단하지 않는다.

[환경변수 공식 안내](https://vercel.com/docs/environment-variables) · [Supabase 함수 secret](https://supabase.com/docs/guides/functions/secrets) · [Toss 키 종류](https://docs.tosspayments.com/reference/using-api/api-keys)

## 2026-11-19 외부 연결 검증

Resend mail.be-celeb.org 인증 완료, 도메인 전용 sending_access 키로 Supabase SMTP 연결. confirmation/recovery 해시 링크 템플릿 적용. Toss API 개별 연동 test_ck_/test_sk_를 각각 Vercel/Supabase에 등록했고 실물 TEST 결제창 표시 확인. YOUTUBE_API_KEY는 서버 Secret으로 등록·단일 공식 채널 ID 조회만 검증했다. 현재 수집 어댑터 consumer가 없어 자동 수집은 활성화하지 않았다. 상세 증거는 docs/AUTH_PROVIDER_EXECUTION.md 참조.
