# 키 교체 후 검증 절차 (D078 · 운영자 U006)

키 발급·재발급·등록·폐기는 **운영자(USER)만** 수행한다(U006). 개발 담당은 아래 검증 명령과 결과 해석만 제공한다. 어떤 단계에서도 키 **값**을 채팅·이슈·evidence·커밋에 남기지 않는다. 기록은 변수 이름, 존재 여부, 길이, `sha256` 앞 8자, JWT `role`/`iat`만 허용한다.

## 0. 교체 전 기준선 (개발 담당, 로컬)

```powershell
$env:PYTHONUTF8 = "1"; python harness/secret_scan.py --keys
```

출력한 지문(앞 8자)을 운영자 기록에 옮긴다. `NEXT_PUBLIC_TOSS_CLIENT_KEY`가 `mode=NOT-TEST(refuse)`이면 즉시 중단한다. 이 프로젝트는 TEST 키만 사용한다.

## 1. 노출 범위 확인 (개발 담당)

```powershell
$env:PYTHONUTF8 = "1"; python harness/secret_scan.py --all
```

- 추적·미추적 파일, Git 이력 전체 blob, `.next/static` 클라이언트 번들, `test-results`·`playwright-report`(trace zip 내부 포함), `harness/evidence`를 검사한다.
- 의심 로그 파일은 `--logs <파일…>`로 추가 검사한다. 배포 로그는 운영자가 내려받은 파일만 대상이다.
- 출력은 `FAIL <위치>: <종류>`뿐이다. 값은 출력되지 않는다.
- 탐지 종류: GitHub(classic·fine-grained), Supabase secret, service_role JWT, Toss secret/live client, Google API, Vercel, LLM provider(`sk-ant-`/`sk-proj-`), Slack·Discord webhook URL, 비밀번호가 포함된 DB 연결 문자열(로컬 기본값 `postgres:postgres` 제외), 개인키, `.env.local`의 서버 전용 변수 실제 값.

## 2. 무효화와 재발급 (운영자 콘솔)

| 종류 | 콘솔 | 영향 |
|---|---|---|
| Supabase service_role / JWT secret | Project Settings → API | JWT secret을 바꾸면 anon 키와 기존 세션도 무효화된다 |
| Toss TEST secret | 개발자센터 TEST 키 | live 키 사용 금지 |
| YouTube Data API | Google Cloud → 사용자 인증 정보 | 삭제 후 재생성, API·referrer 제한 재설정 |
| `ALERT_WEBHOOK_URL` | Slack/Discord 웹훅 설정 | 기존 웹훅 삭제 후 새 URL |
| GitHub·Vercel 토큰 | 각 계정 설정 | revoke |

## 3. 새 값 배치 (운영자)

- Vercel 환경변수: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `YOUTUBE_API_KEY`, `ALERT_WEBHOOK_URL`.
- Supabase Edge Function secret: `TOSS_SECRET_KEY`.
- 로컬 `.env.local`. 저장소에는 절대 커밋하지 않는다.

## 4. 교체 후 검증 (개발 담당 로컬 + 운영자 배포 URL)

| # | 확인 | 명령·방법 | 통과 기준 |
|---|---|---|---|
| 1 | 지문 변경 | `python harness/secret_scan.py --keys` | 교체한 변수의 `sha256` 앞 8자가 0단계와 다르다. `role`이 기대값과 같다(anon/service_role). |
| 2 | 저장소·번들 무노출 | `npm run build` 후 `python harness/secret_scan.py --bundle` | PASS. 새 서버 전용 값이 클라이언트 번들에 없다. |
| 3 | 산출물 무노출 | `python harness/secret_scan.py --artifacts` | PASS. evidence에 trace/HAR/storage state 없음. |
| 4 | 이전 키 거부 | 운영자가 이전 키로 REST 1회 호출 | 401/403. 응답 본문을 evidence에 붙이지 않고 상태 코드만 기록한다. |
| 5 | 새 키 동작 | 배포 URL 로그인·업로드·TEST 결제 스모크(D088) | 성공. 실제 결제 없음. |
| 6 | 로그 마스킹 | 운영자가 내려받은 배포 로그를 `--logs`로 검사 | PASS. 서버 로그는 `src/lib/observability.ts`의 `mask()`를 거친다. |

## 5. 이력에 커밋된 경우

키 무효화가 우선이다. 이력 재작성(`git filter-repo` + 강제 푸시)은 보조 수단이다. 운영자 승인 없이는 실행하지 않는다.

## 6. 기록

`harness/evidence/D078/<YYYYMMDD>/`에 날짜, 종류, 지문(이전·이후 앞 8자), 위 표의 결과만 남긴다.
