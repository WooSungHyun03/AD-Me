# DEV-A 캠페인 조건·조회 제한 계속 패키지 — 2026-11-20B

외부 미적용인 로컬 검토 산출물이다. USER가 대상/백업/릴리스 시점 확인, SQL Editor 적용, 환경 설정과 배포를 수행한다. 코드 수정·터미널·설치를 요구하지 않는다. 이전 패키지는 보존한다.

1. 현재 DB가 이전955bf8c 패킷까지 적용된16 migration이면 from_955bf8c(신규2개), main65063c8만 적용된8개면 from_main(10개), 이전DEV-A4개+main이 적용된12개면 from_integrated_dev_a(6개)를 선택한다. 해당00_preflight를 SQL Editor에서 실행한다. 모르는/부분 적용/다른 버전이면 중단하고 에이전트가 실제 상태를 읽어 적용안을 준비한다.
2. 성공한 변형의01_apply 파일 전체를 SQL Editor에서 실행한다. 파일에 preflight와 migration별 트랜잭션/이력 기록이 들어 있다. 중간 실패 시 재실행하거나 파일을 고치지 말고 결과를 에이전트에게 전달한다. 기존에 잘못된 terms 값이 있다면 검증에서 중단하며 임의 삭제하지 않는다.
3.02_verify 결과: 전체18개/신규011·012, campaign_terms_valid validated=true, public ops_draft_get volatile=v/security-definer=false. main/통합기준 신규 provider flag는 기본false;955bf8c기준은 기존 값을 유지한다. 새 키/비즈니스 가입/유료 기능은 필요하지 않다.
4. USER 배포 후 에이전트가 실제 URL을 재검증한다. 신규 UI는 KST 기간, 미정/현금/제품/혼합 제공, 여러 산출물과 사용권/독점 조건을 저장한다. 기존 v1 캠페인은 날짜/보상을 채우지 않고 표시하며 opt-in 업그레이드한다. v2의 조건을 누락하는 오래된 편집 요청은422로 거부한다.

정지/복구:03_pause.sql 및 앱 플래그off로 새 외부 작업을 중지할 수 있다. 이번 작업은 외부 worker/공급자를 실행하지 않았다. 조건/감사 기록을 DROP하거나 MFA를 해제하지 않는다. UI 문제 시 캠페인 편집을 중지하고 보존된 데이터와 적용 이력으로 개발자가 forward fix를 준비한다. 코드 롤백도 조건을 소거하지 못하며 USER가 검토한다.

이 검증은 격리 실제 로컬 Auth/DB와 명시적 fixture다. 실제 공급자/배포/전체 P0 완료가 아니다. D076의 가입·로그인 신뢰IP/계정 및 기존 카탈로그 검색은 미완료. 상세 증빙: harness/evidence/DEV-A-CONTINUE-20261120B/.
