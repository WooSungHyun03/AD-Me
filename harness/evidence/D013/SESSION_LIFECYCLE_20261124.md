# D013 — 로그아웃 실패·만료·다중 탭

- 기준 main `922f34d96a1905c89ccc8e5553c88979f5d5cb71`, 기존 독립 작업트리 재사용. fetch/status/HEAD 확인. D009의 운영 메일 게이트와 별개로 로컬 인증 범위를 진행했다.
- 재현: logout action은 Auth signOut의 error 반환을 무시하고 홈으로 이동했다. provider 거부/transport 실패/성공 단위3건 중 기존 코드3 FAIL(`output/d013-before.log`).
- 변경: 기존 global 로그아웃 범위를 명시하고 provider 거부·연결 실패는 안전한 `/login?error=logout` 안내로 이동한다. 내부 오류/세션 값은 표시하지 않는다. 성공 시 기존 홈 이동 유지. 인증/쿠키 구현 및 허용 next 목록은 보존한다.
- 실제 로컬 Auth의 브랜드/크리에이터별 서로 다른2개 세션과 같은 브라우저2개 탭: 로그아웃 후 두 번째 세션 refresh 거부, 기존 탭 설정 재요청→로그인, 개인정보 API401, admin→로그인. 철회된 실제 refresh token과 **명시적인 로컬 서명 만료 JWT fixture**를 설치해 만료 쿠키 갱신 실패→로그인→요청한 설정 복구→민감 API201을 확인했다. 자연 TTL 경과를 기다린 운영 시험으로 주장하지 않는다.
- `tests/logout.test.ts`3 PASS. D010 현재 세션 재인증 단위/이메일 변경·복구 회귀와 D074 export 재인증은 이번 최종 배치 소스를 대상으로 함께 검증한다. 과거 README의 계정 last_sign_in_at 설명은 D010/D074의 검증된 현재-session AMR 정책으로 대체한다. 남아 있는 recentSignIn 함수는 해당 민감 경로에서 사용하지 않는다.
- 명령/공통 결과: `verification-20261124.json`. 첫 신규 Playwright4 PASS, 동일 production build를 재사용한 최종 인증·메일·복구·계정 삭제 회귀16 PASS(desktop/mobile). 삭제 요청 후 기존 세션의 계정 변경 차단은 기존 account-deletion 시나리오를 재실행했다. 기존 데이터/영구 삭제를 실행하지 않는다.
- lint/typecheck, Vitest93files559tests, production build, SQL120 static 및 source/client/artifact secret scan PASS. 기존 snapshot은 테스트가 만든 줄바꿈 변화만 복원했다. UI는 기존 로그인 레이아웃에 오류 안내를 추가했으며 screenshot2개에서 한글/desktop/mobile 배치를 직접 확인했다.
- **BLOCKED_EXTERNAL:** D009/U007/U008 실제 운영 Auth TTL·기기·메일·계정/배포 URL 수용. 글로벌 로그아웃의 refresh 철회와 다음 요청 복구를 확인했으며 이미 발급된 모든 access JWT의 즉시 전역 폐기를 주장하지 않는다. D074 SQL은 내보내기에 live-session 검사를 추가한다. 운영 migration/키/라이브 결제/외부 승인 대행 없음. TESTED/LOCAL_VERIFIED이며 전체 DONE/VERIFIED 아님.

이전 증빙은 불변. 이번 SQL 인계는 `deliverables/d074-session-export-20261124/README.md`에 한 번만 작성한다.

DEV-A의 최종 미커밋 소스 정적 리뷰: 추가 blocking finding 및 공유 파일 변경/번호 예약 없음. 현재 세션/actor/quota·consume 보존을 확인했고 JWT 즉시 전역 폐기는 주장하지 않는 범위로 합의했다.
