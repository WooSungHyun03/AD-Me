# D032 — 유사 프로필·신고·정정 진입 (2026-11-22)

상태: 구현·검증 완료. DB 변경은 없다.

## 기준 (`similarCreators`, `src/lib/catalog.ts`)
- **점수**: 두 프로필에 모두 있는 태그를 센다. 분야는 3점, 형식은 2점, 분위기와 플랫폼은 1점이다.
- **정렬**: 점수 내림차순, 같으면 id 오름차순이라 결과가 결정적이다.
- **제외**: 본인, 미공개(`published=false`), 삭제된 프로필, `owner_removed`. **가상과 실제 프로필은 서로 섞이지 않는다.** 플랫폼만 겹치는 경우도 뺀다(분야나 분위기가 1개 이상 겹쳐야 한다).
- **후보**: `publicCreators()` 공개 DTO만 쓴다(소유자 필드 제외).
- **추천 이유**: 겹친 태그 이름만 보여준다. 팔로워, 가격, 인구통계, 추정 속성은 쓰지 않는다. 화면에 기준과 가중치를 설명했다.
- 기존 `rank()`(캠페인 매칭용, 예산과 팔로워 반영)는 상세 페이지에서 더 쓰지 않는다. 캠페인 페이지는 그대로다.

## 정정·삭제 진입
- 상세 페이지에 "자료 정정·이슈 신고"와 "**이 프로필 삭제 요청**"(`kind=deletion`) 버튼을 둔다.
- 비로그인 상태로 누르면 `/login?next=/reports/new?creator=…&kind=…`로 간다. 로그인 후 같은 프로필과 요청 유형으로 돌아온다. 전에는 `/reports`로 가서 프로필 연결이 끊겼다.
- `safeNext`는 고정 경로 외에 `/reports/new?creator=[A-Za-z0-9_-]{1,80}(&kind=허용값)?` 형태만 허용한다. 외부 URL, `//`, 추가 파라미터는 `/dashboard`로 보낸다.

## 검증
- `tests/similar.test.ts`(10개):
  - 결정성(입력 순서 무관), 본인 제외, 모든 이유가 양쪽 공통 태그이고 민감어가 없음.
  - 실제 프로필에는 가상 후보가 0개이고 그 반대도 같음.
  - 미공개·삭제·owner_removed·플랫폼만 겹침은 제외.
  - safeNext 6개 케이스(허용 2개, 거부 4개).
- `tests/e2e/similar.spec.ts`(desktop+mobile): 데모 상세의 유사 3개가 모두 `creator-NNN`이고 이유는 "공통 태그: 분야…"이며 팔로워·가격 문구가 없다. 삭제 요청 → 로그인 → `creator-001&kind=deletion`으로 복귀하고 요청 유형이 deletion이다.
- 전체 회귀: E2E 52/52, DB 테스트 16개, 복원 모의 PASS. vitest 99, lint/typecheck/build 0 오류, secret_scan --all PASS.
- 스크린샷: `detail-{desktop,mobile}.png`. 가로 스크롤 없음.
