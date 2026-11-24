# D010 — 이메일 변경과 현재 세션 재인증

- 기준 main `24254050c334c5c664943fdd5e30a454cd54ef6b`, 기존 독립 트리 재사용. fetch/status/HEAD 확인. D010 IN_PROGRESS의 독립 로컬 범위를 우선 처리하며 D009/U007/U008 운영 게이트는 유지한다.
- 재현: 설정에 EmailForm 미연결. 실제 로컬 Auth에서 현재 세션 AMR만20분 과거로 만든 뒤 다른 기기 로그인·현재 세션 토큰 갱신을 수행했다. 계정 last_sign_in_at와 JWT iat는0초, 현재 password AMR은1201초였다. 기존 action은 변경 허용(unit1 FAIL). 시간 변경은 새 합성 계정에만 적용하고 삭제했다.
- 수정: 설정의 mail-enabled EmailForm 연결, 현재 사용자 getUser + 검증된 getClaims/sub/session_id/명시 AMR의 `0≤age<600초`로 변경 요청 제한. 미래·누락·잘못된 값·refresh/iat는 인정하지 않는다. 기존 recentSignIn/D013·개인정보 export 경로는 보존한다.
- secure email_change 첫 주소 확인은 대기 상태, 두 번째 확인은 /settings로 이동한다. GET은 증표를 쓰지 않으며 기존 recovery POST/일회 증표 계약을 보존한다. email_change token-hash 템플릿과 로컬 QA 초기화만 추가. 새 SQL/키/환경변수 없음. 마이그레이션119 검증은 D005 증빙을 재사용한다.
- DEV-A가 shared actions/auth 계약·최종 소스를 읽기 전용 리뷰했으며 추가 차단/예약/변경 없음 확인. 이후 제품 소스 변경 없음.
- 단위 영향42 PASS: 현재 세션·다른 사용자·위조/누락/미래·10분 경계, mail OFF, 보류/최종 확인 및 기존 인증·복구 계약.
- `npm run test:e2e -- --config playwright.local.config.ts tests/local-browser/account-email.spec.ts`:desktop/mobile4 PASS. 브랜드·크리에이터 실제 Auth 로그인→오래된 세션 거부→재로그인→실제 Mailpit 기존/새 주소2개 확인→기존 주소 로그인 거부/새 주소 로그인 성공, 역할/UID 보존·재사용 거부.
- 같은 실행 환경의 기존 `tests/e2e/auth-recovery.spec.ts`:desktop/mobile4 PASS. 새 시나리오도 실제 expired/reused recovery, 다른 역할 세션에서 증표 소유자의 비밀번호만 변경, 기존 암호 거부/새 암호 성공, 다른 계정 암호 유지·이전 refresh session 거부를 확인했다. 처음 새 테스트4건은 Next route-announcer와 alert locator 충돌로 실패했으며 제품 alert로 좁혀 재실행했다. 보안 assertion은 유지했다.
- Playwright hook의 production `next build` PASS. 같은 최종 소스를 대상으로 빌드를 반복하지 않는다. 모든 실행은 합성 로컬 PostgreSQL/Auth/Mailpit이며 실제 SMTP 배달/운영 계정 검증이 아니다. 제어되지 않은 외부 발송 없음. 기존119 DB를 volume 보존 재시작해 템플릿만 연결했으며 전체 DB reset을 반복하지 않았다.
- 최종 lint/typecheck 및 Vitest91files/552tests PASS. 첫 전체 실행은 기존 secret-scan의5초 timeout1건(실제 scan22.7초)으로 실패했으며 코드/timeout 변경 없이 재실행552 PASS. 원시 실패 로그 output/d010-unit.log, 최종 output/d010-unit-final.log 보존. source/bundle/artifact secret scan도 별도 확인한다.
- 공개 screenshot2개는 테스트 주소/입력 필드를 마스킹했다. desktop1440×900/mobile390×664에서 폼/확인 상태를 검증한다. 원시 링크·암호·Auth 토큰·메일 원문은 ignored output에만 있다.
- **운영 BLOCKED_EXTERNAL:** email_change 템플릿·secure 양쪽 확인·SiteURL/허용 URL, 실제 SMTP/계정 수용은 U007/U008·운영자 승인 필요. 앱 이메일 변경 action의10분 제한이며 직접 Supabase Auth API 전체의 동일 제한을 주장하지 않는다. 기존 recentSignIn의 계정 전체 시각 문제는 D013/D074 후속이다. 운영 변경·실결제·외부 승인 실행 없음, 전체 DONE/VERIFIED 아님.
- 적용·복구 인계: `deliverables/d010-email-session-20261124/README.md`. 이전 기록 불변.
