# AD Me 개발자 A·B와 운영자가 공유하는 계약

원격 최신 main의 독립 작업트리에서 시작한다. UI와 API·DB·테스트를 같은 업무 단위로 책임진다. A는 원본·추천·AI·권한 기반, B는 캠페인·채팅·결제·관리자·릴리스 통합을 맡는다. 실제 소유자·선행은 [원장](ALL_TICKETS.json)을 따른다. 운영자는 Local AI 호스트·모델 가동(PR-003), 사이트 배포·DB·DNS(U 티켓), API 키 발급·등록, 웹디자인 시안·프리뷰 승인(O001)을 맡는다. [운영자 실행 문서](OPERATOR_TICKETS.md)

## 계약·소유권

- YouTube channel ID로 중복을 막고 handle과 식별자를 분리한다. 공개 프로필은 출처·검증·갱신·결측만 포함한다. 연락처는 별도 명시 동의와 권한으로 조회하고 owner ID 및 비공개 로그는 공개하지 않는다.
- SourcePolicy는 공급자·필드·목적·승인 참조·보유/갱신·삭제 상태를 저장한다. MetricObservation은 원본/파생, 단위·asOf·버전·nullable 값을 구분한다.
- CampaignBrief는 신규 YouTube 조건, 정수 KRW, UTC 저장/KST 표시와 공개 범위를 검증한다. MatchSnapshot은 입력·소스/모델 버전, 후보 적격·결측·근거·정렬 tie-break를 저장한다. HOT은 별도 스폰서 위치다.
- API는 기존 오류 메시지에 안전한 code/requestId를 제공한다. 요청 키와 expected_version, 참여자·거부·정지·차단 권한을 서버에서 검증한다. 404로 자원 존재를 숨겨야 하는 API에 403을 섞지 않는다.
- AI 입력·출력은 계약 스키마로 검사하고 작업 소유권·소스·lease·retry·한도를 보존한다. 결제 승인·환불·이용권은 서버 검증과 고유 provider 이벤트로 정리한다.

| 공통 영역 | 소유자 | 교차 확인 |
|---|---|---|
| 환경·오류·공개 데이터, src/lib/config.ts, api.ts, catalog.ts, data.ts, src/app/creators | A D003·D004·D018·D033·D044·D075 | B의 캠페인/결제 상태, UI에서 소비하는 DTO |
| schemas.ts, 캠페인/지원/채팅/결제/관리자 | B D041·D049·D051·D060·D067 | A의 명시적 적격성·참여자 경계·소스 기준 |
| layout, globals.css, marketplace-theme.css, ui 컴포넌트 | B, A는 소비자 리뷰 | 색상·대비·focus·disabled·mobile/empty |
| Supabase migrations, 릴리스/CI, 운영 도메인 | 각 도메인 작성, B D085 통합, A D075 권한 검토 | 번호 예약, SQL 순서, expand/backfill/read switch 분리 |

기존 로고, 차콜 #101311, 행동 라임 #D7FF45, 캔버스 #F7F8F4 및 기존 버튼/설정 토큰을 유지한다. 새 기능에서 Instagram/TikTok이나 AI 스튜디오를 되살리지 않는다.

## 통합과 검증

1. 각자 작업 트리와 파일 범위를 기록하고, 공유 파일을 수정하기 전에 계약과 테스트를 전달한다. 적용된 마이그레이션은 편집하지 않는다.
2. 환경·DB/RLS·복구 → 공개 DTO/인증 → 추천·공고·채팅·격리 결제 → 운영 UI 순으로 승인한다. 스키마 전환 증거 없이 최신 앱만 운영으로 승격하지 않는다.
3. 한 티켓씩 커밋하고 교차 리뷰 뒤 최신 원격 main에 일반 push한다. 충돌은 해당 계약 소유자와 조정하고 force push 또는 권한 우회를 하지 않는다.
4. lint, typecheck, Vitest, build, migration_check, 역할별 REST, Playwright, 범위별 모델·TEST·수집을 실행한다. 작업이 없거나 외부가 승인되지 않은 기능은 VERIFIED로 올리지 않는다.
5. 권한·외부 설정·공급자 인증은 소유자 게이트를 거친다. A는 모델 코드와 시험 근거를 운영자에게 전달한다. B는 배포·복구 패킷을 운영자에게 전달하고 운영자가 승인한 시안과 디자인 토큰을 코드에 반영한다. 증거에는 SHA, 실제 환경/fixture 구분, 테스트 실패, 남은 의존성, 복구 계획만 기록한다.

[기존 공유 계약](../handoff/SHARED_EXECUTION_CONTRACT.md) · [릴리스 체크리스트](RELEASE_CHECKLIST.md)
