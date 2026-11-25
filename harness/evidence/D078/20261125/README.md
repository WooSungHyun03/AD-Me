# D078 — 비밀값·로그·키 교체 대응 (2026-11-25)

- 기준 소스: origin/main `69abc71`. 변경은 이 티켓 커밋 한 건이다.
- 범위: 로컬 저장소·이력·빌드 번들·아티팩트 스캔과 서버 로그 redaction. fixture 값은 테스트 런타임에 조립한다. 저장소에는 실제 키도 가짜 키도 남기지 않는다.
- 상태: **TESTED (로컬)**. 운영 키 교체 실행과 배포 런타임 로그 검사는 **BLOCKED — 운영자 U006 게이트**. 이번 세션은 키 조회·등록·교체, 배포, 호스트 DB 작업을 하지 않았다. 로컬 Supabase와 E2E는 다른 세션이 사용 중이어서 실행하지 않았다(이 티켓은 DB·E2E가 필요 없다).

## 재현 (변경 전 main `69abc71`)

| # | 결함 | 재현 | 결과 |
|---|---|---|---|
| R1 | Windows 기본 로캘(cp949)에서 한글이 든 파일 전체를 조용히 건너뜀 | 한글 줄과 Toss TEST secret 형태 값을 미추적 파일에 쓰고 `PYTHONUTF8=0 python harness/secret_scan.py` 실행 | `PASS`(탐지 누락). `PYTHONUTF8=1`이면 `FAIL` |
| R2 | UTF-8이 아닌 바이트가 1개라도 있으면 파일 전체를 건너뜀(이력 blob 포함) | 같은 파일 앞에 `0xFF 0xFE`를 추가하고 `PYTHONUTF8=1` 실행 | `PASS`(탐지 누락) |
| R3 | 스캐너 패턴 누락 | Slack·Discord webhook URL, `sk-ant-`/`sk-proj-`, `github_pat_`, 비밀번호 포함 DB URL | 신규 테스트가 구 스캐너에서 `expected 0 to be 1`로 실패 |
| R4 | 로그 `mask()`가 깊이 5를 넘는 객체를 **검사 없이 원문 그대로** 반환 | `{a:{b:{c:{d:{e:{f:{password, note: ghp_…}}}}}}}` | 직렬화 결과에 비밀번호와 토큰 원문이 남음 |
| R5 | 로그 문자열 패턴 누락 | GitHub·Vercel·LLM 토큰, 불투명 `Bearer`, PEM 개인키, Slack·Discord webhook | `mask()` 출력에 원문이 남음 |
| R6 | 자격증명 필드 이름 누락 | `serviceRoleKey`, `service_role_key`, `SUPABASE_SERVICE_ROLE_KEY`, `clientKey`, `credentials`, `privateKey`, `connectionString`, `jwt` | 값이 `[redacted]` 처리되지 않음 |
| R7 | 서버 전용 환경변수 실제 값 | `ALERT_WEBHOOK_URL` 값이 오류 문장에 포함됨 | 로그에 원문이 남음 |
| R8 | `logApiFailure`(`src/shared/server/logging.ts`)가 `operation`을 마스킹 없이 기록 | 토큰이 섞인 operation 라벨 | `console.error` 인자에 원문이 남음 |
| R9 | 이메일 outbox가 공급자 오류 원문을 `finish_email.p_error`에 저장 | 공급자 예외 메시지에 수신 주소와 Bearer 토큰 | 저장 인자에 주소와 토큰 원문이 남음 |

- R4~R8: `tests/log-redaction.test.ts` 5건이 변경 전 소스에서 모두 실패했다.
- R1~R3: 변경 전 스캐너로 `tests/secret-scan.test.ts`를 돌리면 신규 2건이 실패하고 기존 6건은 통과했다.
- merge 회귀 확인: CI(`.github/workflows/ci.yml`)에는 기본·`--bundle`·`--artifacts` 스캔이 그대로 있다. `src`와 Edge Function의 직접 `console.*`는 `observability.ts`와 `logging.ts`뿐이다. API 오류 응답은 `fail()`의 고정 문구만 반환하며, RPC 원문(`lists`·`claims` 등)은 매핑 키로만 쓰인다.

## 변경

- `harness/secret_scan.py`
  - 모든 입력(작업트리·이력 blob·zip 항목·로그·`.env.local`)을 로캘과 무관하게 UTF-8로 읽는다. 잘못된 바이트는 무시하고 계속 검사한다(R1·R2).
  - 탐지 종류 추가: `github fine-grained token`, `llm provider key`, `webhook url`, `database url with password`. 로컬 스택 공개 기본값 `postgres:postgres@`는 제외한다(R3).
  - 출력 형식과 옵션은 그대로다.
- `src/lib/observability.ts` `mask()`
  - 개인키 블록, `Bearer` 토큰, GitHub·Vercel·LLM 키, DB URL 비밀번호, Slack·Discord webhook 문자열 마스크를 추가했다(R5).
  - 깊이 제한을 넘는 객체는 `"[truncated]"`로 바꾼다(R4).
  - 필드 이름에 `credential`, `private_key`, `connection_string`, `dsn`, `jwt`와 `…Key`, `…_key`, `…_KEY` 접미사를 추가했다. 단독 `key`(alert 중복 제거 키)는 그대로 읽힌다(R6).
  - 이름에 `KEY`·`SECRET`·`TOKEN`·`PASSWORD`·`WEBHOOK`·`DATABASE_URL`·`DSN`이 들어간 서버 전용 환경변수(`NEXT_PUBLIC_` 제외, 12자 이상)의 실제 값은 `[server-env]`로 바꾼다(R7).
- `src/shared/server/logging.ts`: `operation` 라벨이 `mask()`를 거친다(최대 120자). 기존 `console.error("api_error", {...})` 형태와 필드는 유지했다(R8). `src/shared/server/http.ts`는 이 함수만 호출하므로 수정하지 않았다.
- `src/lib/notifications/email.ts`: 공급자 오류는 `mask()`를 거친 뒤 200자로 잘라 저장한다(R9).
- `docs/operations/KEY_ROTATION.md`: 사용자 키 교체 후 검증 절차를 정리했다. 기준 지문, 노출 범위, 콘솔별 무효화, 배치, 교체 후 6단계 검증표, 이력 커밋 시 대응을 다룬다.
- 테스트
  - `tests/log-redaction.test.ts` 신규 5건.
  - `tests/secret-scan.test.ts` 2건 추가(총 8건). 로캘 강제 검사와 신규 패턴을 확인하며, 로컬 기본 DB URL은 PASS여야 한다.
  - `tests/email.test.ts` 1건 추가.

## 명령별 결과 (Windows, 최종 소스)

| 명령 | 결과 |
|---|---|
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0. 첫 실행에서 테스트 헬퍼의 `ProcessEnv` 타입 오류 2건이 나와 `Record<string,string>`로 수정했고, 재실행은 0 |
| `npx vitest run --testTimeout=60000` | 580/580 tests pass. 96/97 files. 실패 1파일 `tests/asset-provenance.test.ts`는 main의 기존 Windows `C:\C:\` 경로 결함으로 이번 변경과 무관(0 test 수집) |
| `npx vitest run tests/log-redaction.test.ts tests/observability.test.ts tests/api-errors.test.ts` | 38/38 |
| `npx vitest run tests/secret-scan.test.ts` | 8/8 (구 스캐너에서는 2 fail) |
| `npx vitest run tests/email.test.ts` | 5/5 |
| `npm run build` | exit 0. 첫 시도는 작업트리에 `node_modules/next`가 없어 Turbopack이 실패했다(환경 문제). 작업트리에서 `npm ci` 후 재실행해 통과 |
| `PYTHONUTF8=1 python harness/secret_scan.py --all` | PASS: 1829 tracked/untracked files, 3369 history blobs, harness/evidence 568 files. `.next`·test-results 없음 |
| `PYTHONUTF8=1 python harness/secret_scan.py --bundle` (빌드 후) | PASS: client bundle 49 files |
| R9 재현: 변경 전 `email.ts`로 `tests/email.test.ts` | 1 fail / 4 pass. 변경 후 5/5 |
| D078 관련 5파일 재실행(`email`·`log-redaction`·`secret-scan`·`observability`·`api-errors`) | 51/51 |
| `PYTHONUTF8=0 python harness/secret_scan.py --history` | PASS. cp949 로캘에서도 신규 패턴의 오탐 0 |

## 남은 게이트

- **BLOCKED (운영자 U006)**: 운영 Supabase·Toss TEST·YouTube·webhook 키 교체 실행, Vercel·Edge 환경변수 등록, 이전 키 401 확인, 배포 URL 스모크. 절차는 `docs/operations/KEY_ROTATION.md` 4단계에 있다.
- **BLOCKED (운영자 배포 로그 접근)**: Vercel 런타임 로그 검사. 운영자가 내려받은 파일을 `secret_scan.py --logs`로 검사한다.
- 이 세션에서 `--keys` 로컬 지문은 `.env.local`이 없어 모두 `absent`다. 실제 키를 보유하거나 조회하지 않았다.
