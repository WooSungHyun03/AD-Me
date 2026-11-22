# D078 — 비밀정보 스캔·로그·키 교체 절차 (2026-11-22)

상태: 로컬 스캔·검증 완료. **배포 환경(Vercel/Supabase 호스트) 키 교체 실행은 사용자 콘솔 작업이 필요해 미실행**(절차만 문서화).

## 스캐너 `harness/secret_scan.py`
값은 절대 출력하지 않는다. 파일명, 종류, 지문(sha256 앞 8자)만 출력한다.
| 옵션 | 범위 |
|---|---|
| (기본) | 추적 파일과 미추적이지만 ignore되지 않은 파일(커밋 직전 실수 포착) |
| `--history` | 전체 Git 이력의 모든 blob |
| `--bundle` | `.next/static` 클라이언트 번들 |
| `--artifacts` | `playwright-report`, `test-results`(trace zip 내부 항목까지), `harness/evidence`. evidence 안에 trace/HAR/storage state 파일이 있으면 실패 |
| `--logs F…` | 지정 로그 파일 |
| `--keys` | 키 존재·길이·지문·JWT role만 표시(교체 확인용). Toss 키가 `test_`가 아니면 `NOT-TEST(refuse)` |

탐지 대상:
- 패턴: GitHub·Supabase secret·Toss secret(test/live)·Toss live client·Google API·개인키·Vercel 토큰, service_role JWT.
- `.env.local`의 서버 전용 변수 **실제 값** 문자열 일치(`NEXT_PUBLIC_*` 제외).

## 결과 (2026-11-22)
- `python3 harness/secret_scan.py --all` PASS:
  - 추적·미추적 268개, Git 이력 blob 321개, 클라이언트 번들 31개, test-results·evidence 46개.
  - 발견 0. evidence에 trace/storage 파일 없음.
- `.gitignore`가 `.env*`(예시 제외), `.accounts.local.json`, `.vercel`, `test-results/`, `playwright-report/`를 덮는다. 테스트로 `git check-ignore` 확인.
- 앱 로깅: `src`와 Edge Function에 `console.*` 호출 0건. 오류 응답은 고정 한국어 문구이며 토큰·키·원문 예외를 반환하지 않는다.
  - 예외: `lists`·`claims` 라우트가 RPC 오류 문자열을 매핑에 쓰지만 응답은 매핑된 고정 문구다.
- Playwright `trace: retain-on-failure` 산출물은 `test-results/`(ignore)에만 생기고 `--artifacts`가 내부까지 검사한다. 인증 trace는 공개 evidence로 복사하지 않는다(스캐너가 강제).
- 로컬 키(`--keys`): anon·service_role 모두 로컬 Docker 스택용이다. Toss·YouTube 키는 없다.

## 테스트
`tests/secret-scan.test.ts` (vitest 6건). 가짜 값은 런타임에 조립해 저장소에는 남지 않는다.
- 깨끗한 저장소는 PASS.
- 미추적 파일 속 Toss secret을 탐지하고, 출력에 값이 없다.
- trace zip 내부의 service_role JWT와 서버 env 실제 값을 탐지한다. evidence 안 trace.zip은 실패하고 값은 출력되지 않는다.
- 로그 파일 탐지.
- `--keys`는 지문만 출력한다.
- 비공개 파일이 gitignore 대상이다.

## 키 교체(rotation) 절차 — 노출 의심 시
1. **범위 확인**: `secret_scan.py --all`과 `--logs <의심 로그>`로 어디에 어떤 종류가 노출됐는지 확인한다(값은 출력되지 않음).
2. **즉시 무효화**(사용자 콘솔):
   - Supabase: Project Settings → API에서 service_role/JWT secret을 재발급한다. 재발급 시 anon 키도 바뀐다.
   - Toss: 개발자센터 TEST 시크릿 키를 재발급한다. live 키는 이 프로젝트에서 사용 금지.
   - YouTube: Google Cloud에서 API 키를 삭제하고 재생성한다. HTTP referrer/API 제한도 다시 건다.
   - GitHub·Vercel 토큰: 해당 설정에서 revoke.
3. **새 값 배치**:
   - Vercel 환경변수: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `YOUTUBE_API_KEY`.
   - Supabase Edge Function secret: `TOSS_SECRET_KEY`.
   - 로컬 `.env.local`.
   - 저장소에는 절대 커밋하지 않는다.
4. **재배포 후 확인**:
   - `secret_scan.py --keys`로 지문이 바뀌었는지 확인한다(로컬).
   - 배포 URL에서 로그인·업로드·결제 TEST 스모크(D088).
   - 이전 키로 REST 호출이 401인지 확인한다.
5. **이력에 커밋된 경우**: 키 무효화가 우선이다(이력 재작성은 보조). 필요하면 `git filter-repo`로 제거하고 강제 푸시하는데, 이는 사용자 승인 후에만 한다.
6. **기록**: 이 폴더에 날짜, 종류, 지문(이전·이후 앞 8자), 조치를 남긴다. 값은 남기지 않는다.

## 남은 범위
- Vercel 런타임 로그 검사는 배포 접근 권한이 필요하다(D088에서 `vercel logs` 출력을 `--logs`로 검사).
- 호스트 DB의 service_role 키를 Vercel에 등록하는 작업은 사용자 담당(D027 연계).
