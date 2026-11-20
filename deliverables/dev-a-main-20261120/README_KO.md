# DEV-A main 통합 적용 패키지 — 2026-11-20

사용자가 Supabase SQL Editor·설정·배포를 수행한다. 개발자가 검증한 완성 SQL이며 코드 수정/터미널 실행/설치를 요구하지 않는다. 외부 미적용, 출시 준비 완료 아님. 이전 20261119 패키지는 역사 자료로 보존한다.

1. USER가 대상 프로젝트·백업/복원 경로·릴리스 시점을 확인한다. 현재 DB가 main65063c8의 스키마인 경우 `00_preflight_from_main.sql`을 실행한다. 이전 DEV-A4개도 이미 적용했다면 `00_preflight_from_integrated_dev_a.sql`을 사용한다. 실패하면 SQL을 고치거나 강제로 재실행하지 말고 결과를 에이전트에게 전달한다.
2. 성공한 같은 변형의 `01_apply_*.sql`을 전체 실행한다. preflight를 내장했으며 migration별 트랜잭션·이력 기록을 포함한다. 중간 실패는 부분 적용 상태이므로 재실행 전 에이전트가 조사한다. 생성된 원본별 SQL은 검토용이다.
3. `02_verify.sql` 결과를 확인한다. 신규 자원 플래그는 false, 기존 자동 발굴도 중지된다. 기존 역할만 있던 운영자는 새 승인을 받기 전 접근할 수 없다. 새 코드는 OTP 등록 경로를 제공한다.
4. 앱 환경 이름/역할: docs/handoff/ENVIRONMENT_CONTRACT.md. `ADME_FEATURE_INGESTION`, `ADME_FEATURE_LLM` 기본 off. USER가 수집 허용/쿼터/worker/정책/릴리스 조건을 확인한 경우에만 DB resource_controls와 해당 앱 플래그를 켠다. 패키지는 키를 발급/등록하지 않는다.
5. USER 배포 후 에이전트가 실제 URL에서 권한·오류·기능 상태를 재검증한다. 본 패키지의 테스트는 격리 로컬 Auth/DB/fixture이며 실제 YouTube/모델/SMTP/Toss 검증을 대신하지 않는다.

정지/복구: `03_pause.sql`과 앱 플래그 off로 새 작업을 중지한다. 외부 호출이 이미 시작되었다면 완료될 수 있다. 추가 스키마/감사/데이터를 DROP하거나 MFA를 제거하지 않는다. 실패 시 백업과 정확한 적용 이력으로 개발자가 forward fix를 준비한다. 코드 롤백도 USER가 검토 후 실행한다.

남은 범위: D076의 가입/로그인 신뢰 IP·계정 제한과 기존 카탈로그 검색, D051 페이지/첨부/스팸 UX, 실제 공급자·호스팅 적용 및 전체 P0. 어떤 티켓도 이 패키지만으로 DONE이 아니다. 상세 결과는 harness/evidence/DEV-A-MAIN-20261120/verification.json.
