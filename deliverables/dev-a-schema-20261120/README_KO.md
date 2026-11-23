# DEV-A 정규화 저장소 1단계 — 2026-11-20C

로컬 검토 산출물이다. USER가 대상·백업·릴리스 시점을 확인하고 SQL Editor와 배포 콘솔을 사용한다. 키 발급/등록, 터미널 실행, 코드 수정은 필요하지 않다. 이전 ZIP3개는 변경하지 않았다.

1. 현재 migration 이력을 에이전트가 읽어 선택한 기준을 사용한다. main65063c8만 적용됐으면 main_8(11개 추가), 초기DEV-A4개+main이면 integrated_12(7개), 직전955bf8c 패킷이면 previous_16(3개), TERMS 패킷까지면 terms_18(1개)이다. 해당00_preflight를 SQL Editor에서 실행한다. 알 수 없는/부분 적용/중복 기준이면 중단하고 결과를 에이전트에게 전달한다.
2. 성공한 기준의01_apply 파일 전체를 실행한다. preflight와 각 migration별 트랜잭션/이력 기록을 포함한다. 중간 실패 시 반복 실행하거나 SQL을 직접 고치지 않는다. 에이전트가 실제 상태에 맞춰 복구안을 준비한다.
3.02_verify로 전체19개, 신규013, 세 테이블 RLS=true, missing_legacy_mapping=0, 권한 네 값=false, 공개 wrapper prosecdef=false를 확인한다. 18개 기준은 기존 feature flags를 유지하고, main/12개 기준은 이전 패킷과 같이 provider 기본OFF다.
4. 이번 단계는 legacy JSON을 그대로 두고 내부 UUID 연결만 backfill한다. 가상48개에서 SNS ID·지표·동의·정책 승인을 발명하지 않는다. 현재 운영 YouTube 저장소도 자동 복사하지 않는다. 새 snapshot은 본인 전용이며 공개 catalog/매칭 read source는 바꾸지 않는다.

D017 정책 승인·허용 필드/보존/재배포 계약, D019 실제 수집 write adapter, 공개 read switch와 DEV-B 교차 리뷰는 미완료다. 이 패킷을 적용해도 실제 공급자 검증이나 D018 DONE이 아니다. 원래 JSON과 정규화 관측을 분리하는 TypeScript 호환 adapter를 제공하며 결측을0이나 가상followers로 채우지 않는다.

복구: 새 snapshot만 중단하려면03_pause_snapshot.sql을 사용한다. 원본 JSON·identity·지표·migration 이력은 삭제하지 않는다. 원래 catalog 동작은 유지된다. 데이터 형식/권한 문제가 있으면 USER가 외부 적용을 중단하고 개발자가 additive forward fix를 준비한다. 배포 후 실제 URL 확인도 개발자가 수행한다. 실제 외부 콘솔/키/배포는 이번 로컬 검증에 포함하지 않았다.
