# AD Me — 두 개발자가 공유하는 실행 계약

기준일 2026-11-19. 이 문서와 A/B 문서를 저장소와 함께 전달한다. 문서는 구현 지시서이며 기능 완료 증거가 아니다. “완벽”은 모든 수용 기준을 증거로 충족한다는 뜻이며 외부 승인 성공을 보장한다는 뜻이 아니다.

## 현재 기반과 우선 규칙

- 저장소: https://github.com/WooSungHyun03/AD-Me · 로컬: `/home/m4ml/Desktop/AD Me/ADMe_Desktop_Harness`.
- 기존 공개 주소: https://ad-me-topaz.vercel.app · 코드 분석 기준 `4437eb1`. 작업 시작 시 git HEAD와 변경 내역을 다시 확인한다. 위 URL은 신규 기능이 배포되었다는 증거가 아니다.
- Next App Router/TypeScript/React/Tailwind/Supabase/Zod/Vitest/Playwright. 정확한 버전은 package-lock.json을 따른다. Node 22, 기존 npm scripts를 사용한다. 저장소를 초기화하지 않는다.
- 기존 48개 크리에이터·8개 캠페인은 가상 fixture. 실제 데이터·성과·광고 이력으로 전용하지 않는다. 로그인/기본 캠페인/점수/협업/결제 코드가 이미 존재한다.
- 운영은 무료 성인 베타. TEST 상품은 격리. 사업자등록 없는 유료 운영 가능성을 임의 단정하지 않는다. 실제 결제·정산·전자서명 대행은 보류다.
- 사용자만 외부 콘솔·키 발급/등록/교체·배포를 수행한다. 개발자는 로컬 파일/테스트/릴리스 산출물을 완성한다. 배포를 유발하는 push·merge는 사용자와 릴리스 시점을 맞춘다.
- AGENTS.md, 관련 SKILL.md, docs/REAL_SERVICE_TICKETS.md, harness/service_backlog_v2.json, 세션 로그를 먼저 읽는다. 상충 시 최신 사용자 지시가 우선이다.

## 착수·진행·완료 방법

1. `git status --short`와 현재 HEAD를 확인하고 기존 변경을 보존한다. 각 사람은 독립 브랜치/체크아웃에서 작업한다. 같은 작업 디렉터리를 두 에이전트가 동시에 수정하지 않는다.
2. A/B 담당 티켓의 선행 조건과 상대 담당 티켓을 확인한다. 준비된 P0부터 시작한다. USER 미완료여도 schema/adapter/mock 계약 테스트 등 독립 작업은 진행한다.
3. 해당 티켓에 계획·변경 파일·DB 영향·예상 검증을 기록한다. UI만 만든 뒤 DONE 처리하지 않는다. 기존 API를 먼저 읽고 점진적으로 확장한다.
4. 구현→실행→관련 테스트→브라우저 확인→수정→재검증→증빙 저장 순서로 진행한다. 외부 실제 검증이 남으면 LOCAL_VERIFIED 또는 BLOCKED_EXTERNAL이며 DONE이 아니다.
5. 상태는 `harness/handoff/runtime-status.json`에 자기 담당 항목만 수정한다. 배분/점수 원본 JSON은 요구 변경 합의 없이 바꾸지 않는다. 진행 상태 충돌은 티켓별 evidence 파일로 분리한다.
6. `harness/loop.py`는 **기존 T001~T040만 지원**한다. D/U 티켓을 이 명령으로 완료 처리하지 않는다. 새 runtime manifest 및 세션 로그를 쓴다.
7. 동일 원인으로 3회 실패하면 원인·시도·필요 조치를 기록하고 다른 준비 작업을 진행한다. 테스트를 삭제/skip해서 통과하지 않는다.

상태: OPEN → IN_PROGRESS → LOCAL_VERIFIED → READY_FOR_USER → VERIFIED → DONE. 외부 미완료는 BLOCKED_EXTERNAL(코드 변경은 보존). USER 작업은 USER_ACTION_REQUIRED → USER_REPORTED → VERIFIED; 사용자 확인만으로 기능 전체를 VERIFIED라 하지 않는다.

## 공통 데이터·API 계약 (구현 전 합의할 목표, 현재 구현 아님)

- `SourcePolicy`: provider, policy_version, status(approved/pending/disabled), allowed_fields, purpose, retention/refresh rules, permission_ref. 수집 전 검사한다.
- `CreatorIdentity`: internal UUID, provider+external_id 고유키, canonical_url, claim_status, owner_id(private), publication_status, moderation_status, is_demo. 핸들은 식별 기본키가 아니다.
- `MetricObservation`: metric name, nullable value, unit, observed_at, source_url, policy_version, original/derived 구분. null과 0을 분리한다.
- `CreatorPublicDTO`: 허용된 공개 이름·링크·태그·검증/갱신 정보·지표만 포함. owner_id, 이메일, OAuth 토큰, 내부 검토 메모를 제외한다.
- `CampaignBrief`: owner/workspace, category, platforms, tags, KRW 정수 예산 또는 unknown, 현금/제품 제공, 기간, 산출물, 공개 상태, hard/soft 조건. UTC 저장/KST 표시.
- `MatchSnapshot`: input/model/source versions, eligibility+제외 이유, score nullable, coverage, factor evidence, created_at. HOT은 별도 슬롯이며 organic 입력이 아니다.
- `Collaboration`: 허용 상태 전이, actor, expected_version, idempotency key, event/audit. 참여자·claim·block·moderation을 서버/DB에서 확인한다.
- `PrivateNote`와 `Message`는 별도 권한. `NotificationEvent`는 event/recipient/channel unique 및 read cursor를 사용한다.
- `UploadReference`: owner/workspace, private object path, MIME/bytes, purpose, reference ID, expires/delete state. signed URL은 권한 확인 후 짧게 발급한다.
- `PrivacyRequest/Tombstone`: 요청 상태·검증·삭제 범위·보존 예외·처리 시각. 최소 재유입 차단 식별자에도 보존 정책을 둔다.
- `ApiError`: 기존 error.message를 유지하면서 code/requestId를 추가한다. HTTP 400/401/403/404/409/422/429/503 의미를 합의한다. 자원 존재 노출 위험에 따라 404 사용 가능.
- 검색 API는 cursor+limit 상한, sort allowlist, 안정적 id tie-breaker. 응답은 items/nextCursor/meta이며 메타에 지표 가용성을 포함한다.
- 새 테이블·RPC는 RLS/GRANT/인덱스/체크 제약/공개 DTO/직접 REST 부정 테스트를 함께 만든다. view 기본 RLS 우회·SECURITY DEFINER execute 권한·JWT stale 상태를 점검한다.

## 공유 파일·마이그레이션 병합 계약

- D018(A): creators/source/metrics 핵심 스키마와 TypeScript DTO 계약 steward. D004(A): API 오류 계약. D033(B): 검색 API. D044(B): 추천 함수 계약. D049(B): 협업 상태 계약. D075(A): 보안 검토. D085(B): 릴리스 통합.
- steward는 모든 파일을 혼자 작성한다는 뜻이 아니다. 인터페이스 변경·호환성 리뷰 책임이다. 실제 담당은 티켓 배분을 유지한다.
- 각 티켓 시작 전에 파일 수정 의도를 협업 기록에 남긴다. `src/lib/schemas.ts`, `catalog.ts`, `data.ts`, 공통 폼, migrations 수정은 먼저 인터페이스 변경안을 합의한다.
- 마이그레이션은 CLI 설치 버전/도움말 확인 후 생성하고 번호를 예약한다. 이미 적용된 migration을 수정하지 않는다. additive→backfill→검증→read switch→나중 제거 순서다. 사용자에게 검토된 SQL/적용 순서/검증/복구 설명을 전달한다.
- 외부 키 이름 추가는 D003 환경 계약에 등록한다. 문서에 존재하는 설정명만 추가했다고 기능이 활성화된 것으로 보지 않는다.
- PR/인계에는 changed paths, schema/API version, tests, USER gate, 후속 담당, rollback/forward fix를 포함한다. 상대 담당이 리뷰한다.

## 검증 명령 (개발자가 실행)

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
python3 harness/selftest.py
python3 harness/validate_service_backlog.py
npm run test:e2e
```

- 기존 `tests/security.mjs`는 `.env.local`과 ignored `.accounts.local.json`의 실제 QA 계정을 필요로 한다. 준비 전 실행 실패를 제품 권한 실패/통과로 오인하지 않는다. 담당 개발자가 격리 fixture를 준비한다.
- `BASE_URL`을 지정한 Playwright는 원격 주소를 사용하며 웹서버를 시작하지 않는다. 원격 쓰기 테스트는 사용자와 합의한 QA 환경/계정에만 수행한다.
- Playwright trace에는 세션/PII가 들어갈 수 있다. 인증 trace는 공개 증빙에 커밋하지 않는다. 공개 캡처는 마스킹한다.
- keyless unit/계약 테스트와 실제 provider/SMTP/Toss 테스트를 분리한다. 후자는 U 완료 후 실제 결과를 남긴다.

## 티켓별 완료 증거 템플릿

```text
Ticket / 담당 / commit:
기준 입력·사용자 시나리오:
변경 파일·schema/API version:
테스트 명령·결과·실행 시각:
실제/fixture 데이터 구분:
브라우저 URL·viewport·확인 결과:
권한 거부·실패/빈 상태·경합 확인:
USER gate 및 검증된 외부 설정(값 제외):
남은 문제·복구 방법·다음 담당:
```

위 증빙은 `harness/evidence/<ticket>/`에 비밀값 없는 텍스트로 기록한다. 사진·토큰·메일 원문 등 개인정보는 공개 저장소에 넣지 않는다. 모든 P0와 U 출시 게이트를 통과하기 전에는 “실서비스 준비 완료”라고 보고하지 않는다.
