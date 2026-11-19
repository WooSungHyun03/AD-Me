# AD Me 바이브코딩 전달 패키지

**개발자 A에게:** [A 실행 티켓](DEV-A_VIBECODING_TICKETS.md) + [공유 실행 계약](SHARED_EXECUTION_CONTRACT.md)을 저장소와 함께 전달한다.

**개발자 B에게:** [B 실행 티켓](DEV-B_VIBECODING_TICKETS.md) + [공유 실행 계약](SHARED_EXECUTION_CONTRACT.md)을 저장소와 함께 전달한다.

**사용자:** [20개 외부 작업 인덱스](../backlog/USER_ACTIONS.md)에서 개발자가 준비물을 제공한 작업부터 수행한다. 비밀값을 채팅으로 공유하지 않는다.

## 포함 문서

|문서|용도|
|---|---|
|DEV-A_VIBECODING_TICKETS.md|43개·219SP, 시작 프롬프트·티켓별 코드 위치/구현/수용 기준/테스트/인계|
|DEV-B_VIBECODING_TICKETS.md|45개·219SP, 같은 형식|
|SHARED_EXECUTION_CONTRACT.md|기존 코드 기준선·DB/API 계약·공유 파일 병합·상태·검증 규칙|
|ENVIRONMENT_CONTRACT.md|현재 변수/런타임 제공 값/선언만 된 값/구현 예정 값·등록 위치|
|RELEASE_PACKET_TEMPLATE.md|개발자가 작성해 사용자가 외부 적용할 릴리스 자료 양식|
|../user-tickets/U001.md ~ U020.md|외부 작업별 준비물·사용자 절차·증거·실패 대응·공식 자료|
|../../harness/handoff/runtime-status.json|새 작업 상태 원장. 작성 직후 미완료 상태로 초기화|
|../../harness/handoff/environment-manifest.json|값 없는 환경 계약 상태 목록|

## 현재 상태를 해석하는 방법

이 패키지는 **구현과 외부 설정을 실행하기 위한 명세**다. 외부 설정·승인·새 기능 구현이 완료된 결과물이 아니다. 기존 실행 가능한 코드를 토대로 작성했으며 신규 파일은 각 티켓에 `[신규]`로 표시했다. 앱을 초기화하거나 가상 데이터로 새 구현을 완료한 것처럼 보고하지 않는다.

자기 담당 P0부터 선행 조건에 맞춰 진행한다. 각 티켓은 독립적으로 구현·검증 가능한 단위이며 외부 승인 대기는 별도로 표시한다. 전체 티켓의 “완료”는 실제 검증 증거가 있어야 한다.

무료 베타가 Vercel Hobby의 사용 조건에 자동 적합하다고 보장하지 않는다. 사용자 U005에서 용도 적합성과 필요 비용을 결정한다. 사업자 미등록이라는 이유만으로 모든 플랫폼 심사가 가능하거나 불가능하다고 단정하지 않는다.
