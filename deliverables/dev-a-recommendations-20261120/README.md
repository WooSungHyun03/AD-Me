# D045 추천 기록 USER 적용 패킷

기존 정확한31개 migration에026/027/028을 원자 추가한다. source는 MANIFEST.json의 실제 source_head, SQL SHA256은 UTF-8 LF 기준이다. 기존 SQL/ZIP을 대체하거나 재생성하지 않는다. 새 키/설정/activation은 없다. 실제 콘솔과 배포는 USER가 수행하며 agent는 외부 실행하지 않았다.

1. USER가 기존 복구 지점을 확인하고 SQL Editor에서00_preflight_current_31.sql을 실행한다. 오류면 다음 파일을 실행하지 않고 개발자가 실제 schema를 읽어 맞는 패킷을 준비한다. 이력 임의 편집/삭제로 통과시키지 않는다.
2.01_apply_current_31.sql 전체 실행. lock5초/statement60초, 실패 시 전체 rollback이며 재시도 전 DB 상태를 확인한다. 기존 creator/campaign/profile/message/delivery boundary를 변경하지 않는다. 기존31개 source SQL과 혼합·중복 적용하지 않는다.
3.02_verify.sql 실행: application 이력34, snapshots RLS=true/authenticatedSELECT=false, public gateways invoker/volatile, campaign FK confdeltype=c를 확인한다. 기존 USER 정책OFF/무료·TEST 모드 설정을 그대로 둔다.
4. USER가 manifest source_head를 포함하는 source를 배포한다. 실제 URL에서 본인 캠페인 → 추천 기록 링크 → 명시적 저장 → 새로고침 유지 → 입력 변경 후 이전 데이터 안내 → 재계산 → 과거 기록 확인, 타인403/404와 공개 철회 숨김을 확인한다. D044 steward도 [인계 계약](../../docs/handoff/DEV-A_RECOMMENDATIONS_20261120.md)을 리뷰한다.

기존 owner 캠페인 삭제는 해당 추천 이력도 함께 삭제한다. 재계산은 원본 기록을 덮어쓰지 않는다. 직접 이력 수정/삭제는 거부한다. 문제 발생 시 이전 앱으로 복귀해 기존 기능을 쓰고 새 페이지를 사용하지 않으며, SQL은 검토된 additive 수정으로 복구한다. schema DROP/기존 이력 조작을 사용하지 않는다. 전체 계정 삭제·보존 정책은 별도 후속이다.

이 기능은 현재 공개 목록 최대1000명의 기존 태그·예산 모델을 저장한다. 상한 초과 시 저장을 거부한다. 외부 플랫폼 데이터/실제 성과/광고 적합성 검증이 아니며 HOT는 입력에서 제외한다. 사용자에게 코드 수정/패키지 설치/터미널 작업을 요구하지 않는다.
