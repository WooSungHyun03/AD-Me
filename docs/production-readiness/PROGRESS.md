# 작업 현황

[ALL_TICKETS.json](ALL_TICKETS.json)을 현재 원장으로 사용한다. 상태는 TODO → IN_PROGRESS → IMPLEMENTED → TESTED → INTEGRATED → DEPLOYED → VERIFIED다. 외부 승인·환경 증거가 없으면 BLOCKED로 둔다. VERIFIED는 명시된 검증 범위에 한정한다.

- 과거 개발 88개와 USER 20개를 보존하고 신규 개발 4개와 외부 운영 2개를 추가했다. 기존 로컬/부분 증거에서 재오픈한 티켓 8개를 구분했다.
- ACTIVE 미완료 공수는 DEV-A 37개 202SP, DEV-B 47개 212SP다. P0는 A 30개, B 33개다. 승인 조건부·과거 보존 및 검증 범위 완료 행은 공수에서 제외했다.
- ACTIVE 전원장에는 외부 액션을 포함해 미완료 98개가 있다. P0 76, P1 20, P2 2, P3 0이다. 별도로 GATED 10개, ARCHIVED 4개, 검증 완료 2개를 유지한다.
- D085/D087에서 먼저 DB·복원 기준을 고정한다. D075/D016, D019/D021과 D043/D052는 격리 환경에서 병렬 진행한다. 운영 권한 전환과 유료 활성화는 승인 시점까지 차단한다.
- 이번 main 변경의 기능 범위는 요금제·구매 CTA·공고·도움말 문구와 Checkout 내부 오류 노출 축소다. 최신 운영에 승격하지 않고 원장에 별도 표시했다.
- 변경 시 원장 수정 후 python3 harness/production_readiness.py로 산출물을 생성한다. --check는 스키마·중복·의존성 순환·공수 균형·파생 파일 동기화를 검증한다.
