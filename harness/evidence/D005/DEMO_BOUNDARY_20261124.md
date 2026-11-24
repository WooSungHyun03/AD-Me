# D005 — 무료·시연 공개 데이터 경계 복원

2026-11-24 KST · DEV-B · 기준 main `a78610e9667eb173b0a4399270a228a09bf3080a`. 이전 D001 독립 트리/브랜치 재사용, 시작 fetch/status/HEAD 일치 및 깨끗한 작업 트리 확인. AGENTS·공유 계약·원장·기존 세션 증빙을 확인했다. 선행 D001은 로컬 TESTED이며 운영 승인은 승계하지 않는다.

## 재현과 변경

- DB 공개 DTO 전환 뒤 `data.ts`의 free 모드 필터가 누락돼 공통 목록·상세에 DEMO가 포함됐다. baseline 단위5건 중2건 실패. 직접 로컬 DB 호출은 demo detail=true, home(p_demo=true)=48, legacy search(p_include_demo=true)=24, 공개 demo campaigns=4였다.
- `publicCreators/publicCreator`는 free_beta에서 DEMO를 제외하고, CSV도 같은 서버 모드를 적용한다. legacy 캠페인 목록/상세의 무료 fixture fallback을 제거하고 실제 질의에 is_demo=false를 추가한다. 명시 test_demo의 가상 표식/구주소/함수 서명은 유지한다.
- CLI3.2.0 `migration new demo_catalog_boundary`로119(`20261124080724`) 생성. 기존 SQL/행 불변. private `adme_release.catalog_boundary`는 RLS/권한 회수, 기본 OFF. setter는 DB 소유자 전용이며 관리자 JWT/service_role에도 실행권한이 없다.
- 중앙 `catalog_dto`의 기존 개인정보 검사·opaque reference·STABLE/고정 search_path를 보존하고 demo 공개 승인 검사를 추가했다. 이를 쓰는 상세·목록·필터·집계·저장 후보·기존 추천 재조회에 적용된다. 중앙 DTO를 사용하지 않던 legacy 검색/개수의 공통 필터에도 연결해 include flag 우회를 막는다.
- 캠페인 restrictive SELECT 정책은 OFF의 공개 DEMO를 차단하면서 소유자·승인 관리자 비공개 이력을 보존한다. 공개 페이지는 소유자라도 무료 모드에 DEMO를 표시하지 않는다.
- 데이터 경계는 TEST 결제 경계와 독립적이다. 무료 운영 DB는 OFF, 별도 격리 TEST DB만 명시 ON으로 설정한다. 같은 DB를 두 앱이 동시에 공유하는 환경 분리를 이 플래그가 대신하지 않는다. 앱 모드 필터는 별도로 유지한다.
- marked local QA 준비/서버 및 loopback 전용 CI fixture에서만 명시 opt-in. seed와 기존 적용 migration은 편집하지 않았다. 새 환경변수/키 없음.
- DEV-A와 구현 전 계약/SQL119 순번 공유, 정적 교차 리뷰 후 수정. 공유 인터페이스 충돌/상대 SQL 예약 없음. 원장은 D005만 갱신한다.

## 로컬 검증

실제 로컬 PostgreSQL/PostgREST/Auth를 사용하며 계정·프로필·캠페인은 합성 fixture다. 운영 DB나 외부 공급자를 호출한 증거가 아니다. 원시 로그는 ignored output/d005-*에 보존한다.

- baseline unit: mixed list/상세2 FAIL → 해당14건 PASS(서버 모드, DB 없음, 실제형식 DTO, CSV, 캠페인 fallback 포함).
- `node scripts/verify-local-demo-migration.mjs`:118→119 명시 rollback/실패 주입 뒤 함수 정의/ACL·정책·테이블 존재가 기존과 같음. CLI local upgrade PASS.
- `npm run setup:qa:local`:fresh0→119 PASS. 기존 표시된 일회용 환경을 재사용, 운영 접속 없음.
- `node tests/local-demo-boundary-security.mjs`:3그룹 PASS. anon/brand/creator/fresh-admin 직접 목록·상세·구/신 검색·개수·홈에서 OFF 우회 차단, 실제형식 프로필 양성 검사. setter/제어 테이블 권한 거부. billing OFF에서도 별도 승인 DEMO ON 조회 가능. OFF 재전환/반복 요청, 저장 DTO null·추천 결과 보류, 원본48행 해시/스냅샷/소유자·관리자 이력 보존, 반대역할 거부 확인. catalog/billing 제어 행은 중첩 finally에서 전체 복원/동일성 검사.
- 기존 `local-creator-read-security.mjs`, `local-recommendation-policy-security.mjs`:PASS. 역할/RLS·참조·개인정보·제안·HOT·스냅샷 재시도/불변/삭제 회귀.
- 첫 새 DB 회귀의 필터 입력이 현재 minEngagement 계약을 충족하지 못해22023 발생. 유효한 빈 minEngagement를 추가한 뒤 재실행 PASS, 기존 assertion/보안 검사를 완화하지 않았다.
- `npm run test:e2e -- --config playwright.free-local.config.ts tests/local-free/demo-boundary.spec.ts tests/local-free/entitlement-boundary.spec.ts`:desktop/mobile4 PASS. 실제형식 등록 프로필 양성·DEMO 상세404·구/신 검색/위조 인자·비교CSV·캠페인 fallback·sitemap 검사 및 D001 역할별 재시도 거부.
- `npm run test:e2e -- --config playwright.local.config.ts tests/local-browser/demo-boundary.spec.ts tests/local-browser/entitlement-boundary.spec.ts`:desktop/mobile4 PASS. 명시 TEST 데이터의 가상 표식/구주소/CSV와 실제 로컬 OTP 관리자 발급·DB OFF 재시도·회수 회귀.
- `$env:ADME_BROWSER_CHANNEL='chrome'; npm run test:e2e -- --config playwright.keyless.config.ts tests/browser/demo-isolation.spec.ts`:desktop/mobile2 PASS. 첫 실행은 Playwright 번들 Chromium 미설치로 시작 실패. 기존 설정이 지원하는 설치된 Chrome 채널로 재실행해 연결 준비/503·캠페인 빈 상태·상세404를 확인했다. 브라우저 검사를 생략하지 않았다.
- `/creators`·`/creators/creator-001`의 desktop1440×900/mobile390×664(DPR3)와 키 없는 화면 캡처6개를 같은 디렉터리에 보존했다. 공개 가상/등록 형식 QA 데이터만 포함하며 직접 시각 검토했다. 무료/TEST 데이터 구분, 한글 가독성 및 가로 넘침 검사를 통과했다. UI/CSS 변경 없음.
- 최종 소스 `npm run lint`, `npm run typecheck`, `npm test`(90files/533tests), `npm run build`:PASS. 브라우저와 공유 출력에 경합하지 않도록 직렬 실행. `python -X utf8 harness/migration_check.py`:119 PASS, `python -X utf8 -m unittest discover -s harness -p '*test*.py'`:11 PASS, production_readiness 생성/검사 PASS.

## 남은 게이트

- 운영118→119 적용/대상 지문 승인 및 별도 환경 확인·실제 사용자 계정/관리자 URL은 BLOCKED_EXTERNAL. D005 전체 VERIFIED/DONE 또는 배포 완료 주장은 하지 않는다.
- 기존 legacy search_creators의 일반 raw-profile denylist/내부 ID 투영은 D075/D033 별도 출시 게이트다. 이번 변경은 DEMO 우회를 차단하며 그 일반 공개 DTO 감사까지 완료하지 않는다. DEV-A와 범위를 합의했다.
- 이전 D001에서 기록한 넓은 catalog GET 기대405/실제400 회귀는 코드 변경/해결 증거가 없어 재실행하지 않았다. 해당 실패를 통과로 바꾸지 않는다.
- Figma 원본 접근 거부는 D001 증빙을 참조한다. 새 UI/스타일을 설계하지 않았으며 기존 레이아웃의 실제/빈/DEMO 상태를 desktop/mobile에서 검증한다.
- 적용/복구 인계: `deliverables/d005-demo-boundary-20261124/README.md`. 기존 패킷·증빙은 불변.
