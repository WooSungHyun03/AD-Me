# D086 — 관측·오류 추적·상태·비용 알림 (2026-11-22)

상태: 구현·로컬 모의 장애 검증 완료. **외부 채널 실제 수신 확인은 BLOCKED(U018)**: webhook·업타임 모니터·콘솔 비용 알림은 사용자 설정이 필요하다.

## 구현
- `src/lib/observability.ts`:
  - `mask()`: 이메일·전화·카드·사업자번호·JWT·API 키·URL token/code 값을 가리고, 민감 필드명(password/token/secret/cookie/email/phone/body/brief/reason)은 통째로 치환한다.
  - `log()`: JSON 한 줄.
  - `requestId()`: `x-vercel-id`, 형식 검증, 없으면 UUID.
  - `alert()`: `ALERT_WEBHOOK_URL` https만(로컬 테스트용 localhost 예외), 같은 키는 10분에 1회, 실패하면 "failed"를 반환하고 throw하지 않는다.
  - `reportError()`.
  - `FREE_LIMITS`(참고값)와 `usage()`(80% 경고).
- `src/instrumentation.ts` `onRequestError`: Next가 잡는 모든 서버 오류를 마스킹해 로그와 알림으로 보낸다.
- `reportError` 추가: 결제 승인 연결 실패, 보존 작업 실패(입력 형식 오류는 제외), 업로드 정리 실패.
- `GET /api/health`:
  - 익명·일반 사용자에게는 `{"status"}`만, 200/503, `no-store`. 장애 시 알림(중복 억제).
  - 관리자 세션에는 DB 지연, 모드, 리전, 커밋, 키 설정 여부(boolean만), `ops_stats`, 한도 사용률. 80% 이상이면 알림.
- `supabase/migrations/202611190016_ops_stats.sql`: `ops_stats()` 관리자·service 전용. 크기와 건수만 반환한다. manifest에 expand로 기록.
- `/admin` "서비스 상태" 섹션(DB 상태와 응답시간, 마이그레이션, 알림 설정 여부, 한도 3종 사용률, 참고값 고지).
- `.env.example` `ALERT_WEBHOOK_URL`. 문서 `docs/operations/OBSERVABILITY.md`(관측 항목, 마스킹, U018 설정 4단계, 설정 후 확인 절차).

## 검증
- **모의 장애**(프로덕션 build, 로컬 webhook 수신기 127.0.0.1:4599):
  - 정상 `{"status":"ok"}` 200.
  - `docker pause` DB 후 `{"status":"down"}` 503(4.0초 타임아웃) 두 번 → **webhook 수신 1건**(`[AD Me test_demo] 헬스체크 실패: db_error`, 두 번째는 중복 억제).
  - unpause 후 200 복구.
  - 서버 로그는 `event:"alert"` JSON 2줄이고 개인정보는 없다.
- `tests/observability.test.ts`(vitest 7건):
  - 마스킹 9종이 새지 않고, 로그 JSON이 마스킹된다. request id 검증.
  - 알림: 미설정 / 전송 / 10분 중복 억제 / 창이 지나면 재전송 / 본문 마스킹 / HTTP 500·네트워크 오류는 failed / http 외부 URL 거부.
  - reportError에 PII 없음, 80% 경고.
  - `onRequestError`가 마스킹된 본문으로 webhook을 호출한다.
- `tests/ops.mjs`(직접 REST): anon·브랜드·크리에이터는 `ops_stats` 거부, 관리자·service는 허용, 결과에 이메일 없음.
- `tests/e2e/health.spec.ts` desktop·mobile PASS: 익명과 브랜드는 `{status:"ok"}`만 받는다. 관리자 상세에 마이그레이션 버전, boolean 설정값만 있고 키·이메일 문자열이 없다. 관리자 화면에 "DB 정상", 한도 3행.
- 스크린샷 `admin-health-{desktop,mobile}.png`, 가로 스크롤 없음.
- 전체 회귀 `tests/ci-db.sh`(0001–0016 처음부터): E2E 46/46, DB 테스트 14종 PASS. vitest 87, lint·typecheck·build·secret_scan `--all` PASS.

## 미검증·후속
- 실제 Slack/Discord 수신, 업타임 모니터, Supabase·Vercel 비용·사용량 알림은 U018(사용자 설정) 이후 D088에서 확인한다.
- 한도 값은 참고값이다(콘솔 확인 필요). Vercel 함수·대역폭 사용량은 앱에서 조회하지 않는다(콘솔 알림 사용).
- YouTube 쿼터 알림: 수집이 라우트에 연결되지 않아 미배선(정책 승인 후 `reportError` 연결).
- 중복 억제는 인스턴스별 메모리다(`shortcut:` 표기).
