# AD Me 환경 설정 계약 — 현재 코드와 예정 설정 구분

2026-11-19 코드 분석 기준. **이 파일에는 값이 없으며 설정을 실행하지 않는다.** USER만 외부 키 발급·등록·교체를 한다. 개발자는 변수명·consumer·환경·누락 동작을 먼저 구현하고 사용자에게 확정 목록을 준다. `NEXT_PUBLIC_`는 브라우저에 공개된다.

## 현재 설정

|설정 이름|현재 상태·consumer|등록 위치|누락/주의|
|---|---|---|---|
|NEXT_PUBLIC_SUPABASE_URL|구현됨: src/lib/supabase.ts, billing confirm route|해당 Vercel Production/Preview 및 로컬 ignored .env.local|공개 프로젝트 URL. 환경별 DB를 구분한다.|
|NEXT_PUBLIC_SUPABASE_ANON_KEY|구현됨: src/lib/supabase.ts, API billing confirm|동일 환경 Vercel/로컬|현재 코드의 정확한 변수명. public anon 키이며 RLS가 보호한다. publishable 키 전환은 코드·인증 호환 검증과 함께 시행한다. service-role을 넣지 않는다.|
|NEXT_PUBLIC_TOSS_CLIENT_KEY|구현됨: src/components/checkout.tsx|격리된 TEST Vercel 환경|TEST 전용. 실제 상품/SDK 호환 키 세트를 U015에서 확인한다. free_beta에서는 구매 경로를 D001/D065로 차단한다.|
|TOSS_SECRET_KEY|구현됨: Supabase payment-confirm Edge Function|해당 Supabase Edge Functions Secrets|TEST 전용 server secret. Vercel/브라우저로 복제할 필요 없다. 미설정이면 실제 TEST 승인 불가.|
|SUPABASE_URL|Edge Function의 기존 런타임 제공 값|Supabase 런타임|payment-confirm이 사용. 프로젝트를 바꾸려고 수동 덮어쓰지 않는다.|
|SUPABASE_SERVICE_ROLE_KEY|Edge Function의 기존 런타임 제공 값|Supabase 런타임만|현재 Vercel에 등록할 필요 없다. RLS 우회 권한이므로 절대 공개하지 않는다. 필요시 해당 런타임의 현행 키 방식과 호환성을 별도 검토한다.|
|NEXT_PUBLIC_APP_URL|.env.example에만 선언됨; 현재 앱 코드 사용 없음|D003/인증·콜백 구현 후 확정된 환경|값 등록만으로 인증 URL이 변경되지 않는다. Supabase Site URL/redirect 설정도 U008에서 별도 변경한다.|
|BASE_URL|Playwright 설정이 읽음|개발자 로컬 테스트 프로세스|배포 env 필수 항목 아님. 원격 URL 지정 시 Playwright 웹서버는 시작하지 않는다.|

SMTP host/port/user/password·발신 주소는 **Supabase SMTP 설정 화면**에 등록한다. 앱에 동일 값이 필요한 D053 구현이 추가되면 별도 메일 어댑터 설정 계약을 만든다. API key와 SMTP password가 같은지는 공급자에 따라 다르다.

## 제안 설정 — 코드 구현 전 활성화 금지

|제안 이름|담당 티켓|저장 위치|의도·안전 기본값|
|---|---|---|---|
|ADME_SERVICE_MODE|D001/D003|Vercel 서버/로컬|free_beta 또는 test_demo. unknown 값은 실패. 현재 코드 미구현.|
|ADME_FEATURE_INGESTION|D008/D019/D021|Vercel 서버|off 기본. 공급원 정책도 별도 승인되어야 함.|
|ADME_FEATURE_LLM|D008/D048|Vercel 서버|off 기본. fallback은 키 없이 사용 가능.|
|ADME_FEATURE_TEST_BILLING|D008/D065|격리 TEST Vercel 서버|off 기본. service mode와 이중 확인.|
|YOUTUBE_API_KEY|D003/D019|Vercel 서버만|YouTube API 전용 restriction. 키를 NEXT_PUBLIC_로 바꾸지 않는다.|
|AI_PROVIDER_TOKEN / AI_MODEL_ID|D003/D048|Vercel 서버만|실제 provider 선택 후 이름 확정. 토큰 없이 deterministic fallback.|
|META_APP_ID / META_APP_SECRET|D003/D022|서버만, 선택 공급자 계약에 따름|로그인 방식·scope·callback 구현 후 등록. secret은 브라우저 노출 금지.|
|TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET|D003/D023|서버만, 선택 공급자 계약에 따름|공급자 승인·OAuth 구현 후 등록.|
|ADME_JOB_AUTH_SECRET|D003/D021|검토된 작업 실행 서버만|외부 job endpoint를 실제로 만들 경우에만 필요. 사용자 cron 설정 전 호출 인증·중복 방지를 구현한다.|

이름은 **제안**이다. 개발자는 D003에서 구현 소비 위치를 확정하고 `harness/handoff/environment-manifest.json` 상태를 IMPLEMENTED로 변경한 뒤 사용자에게 등록을 요청한다. secret으로 OAuth 토큰 저장 암호화를 직접 임의 설계하지 말고 지원되는 비밀 관리/암호화 방식을 검토한다.

## 환경별 매핑 양식 — 값은 비공개

|환경|Supabase ref|Vercel project|app origin|데이터/모드|상태|
|---|---|---|---|---|---|
|현재 공개 배포|ivtdfioypmzknlhinstg|ad-me|https://ad-me-topaz.vercel.app|기존 DEMO 포함, 새 무료 모드 미구현|역사적 기준선|
|로컬 검증|사용자/개발자 합의 후 기록|해당 없음|http://localhost:3000|격리 fixture|미확정|
|무료 실제 베타|U003에서 확정|U005에서 확정|U005/U017에서 확정|실제 허용 데이터/free_beta|미확정|
|격리 TEST 시연|U003에서 확정|U005에서 확정|U005에서 확정|DEMO+TEST/test_demo|미확정|

실제 프로젝트 개수/무료 플랜 가능 여부를 확인하기 전 새 프로젝트가 있다고 가정하지 않는다. 같은 DB를 임시 사용해야 한다면 단순 UI 토글로 격리된다고 판단하지 말고 서버·RLS·데이터 네임스페이스 설계를 재검토한다.

## 변경·교체 체크

1. USER가 대상 계정·환경·설정 이름을 확인한다.
2. 공급자에서 발급한 값은 해당 전용 콘솔에 직접 등록한다. 키 일부도 증거에 넣지 않는다.
3. USER가 필요한 새 배포를 실행한다. `NEXT_PUBLIC_`는 빌드 시 반영되므로 기존 배포에서 즉시 바뀐다고 가정하지 않는다.
4. 개발자는 값 자체 대신 기능 연결·인증 실패 처리·로그 마스킹·환경 경계를 검증한다.
5. 노출 시 old key 폐기/교체·배포·연결 확인 순서는 공급자 기능에 맞춰 계획한다. 비밀값을 Git 이력에서만 지워서 해결했다고 판단하지 않는다.

[환경변수 공식 안내](https://vercel.com/docs/environment-variables) · [Supabase 함수 secret](https://supabase.com/docs/guides/functions/secrets) · [Toss 키 종류](https://docs.tosspayments.com/reference/using-api/api-keys)
