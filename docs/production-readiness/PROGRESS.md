# 작업 현황

[ALL_TICKETS.json](ALL_TICKETS.json)을 현재 원장으로 사용한다. 상태는 TODO → IN_PROGRESS → IMPLEMENTED → TESTED → INTEGRATED → DEPLOYED → VERIFIED다. 외부 승인·환경 증거가 없으면 BLOCKED로 둔다. VERIFIED는 명시된 검증 범위에 한정한다.

- 과거 개발 88개와 USER 20개를 보존하고 신규 개발·운영 6개를 보존하고 웹디자인 승인 O001을 추가해 전체 115개로 정리했다. 기존 로컬/부분 증거에서 재오픈한 티켓 8개를 구분했다.
- ACTIVE 미완료 공수는 DEV-A 36개 197SP, DEV-B 47개 212SP, 운영자 16개다. 운영자 문서는 검증 완료·조건부·과거 기록을 포함해 24개를 담는다. P0는 A 30개, B 33개다. 승인 조건부·과거 보존 및 검증 범위 완료 행은 공수에서 제외했다.
- ACTIVE 전원장에는 외부 액션을 포함해 미완료 99개가 있다. P0 76, P1 21, P2 2, P3 0이다. 별도로 GATED 10개, ARCHIVED 4개, 검증 완료 2개를 유지한다.
- D085/D087에서 먼저 DB·복원 기준을 고정한다. D075/D016, D019/D021과 D043/D052는 격리 환경에서 병렬 진행한다. 운영 권한 전환과 유료 활성화는 승인 시점까지 차단한다.
- 이번 main 변경의 기능 범위는 요금제·구매 CTA·공고·도움말 문구와 Checkout 내부 오류 노출 축소다. 최신 운영에 승격하지 않고 원장에 별도 표시했다.
- 변경 시 원장 수정 후 python3 harness/production_readiness.py로 산출물을 생성한다. --check는 스키마·중복·의존성 순환·공수 균형·파생 파일 동기화를 검증한다.

## 실행 문서

- [개발자 A](DEV_A_TICKETS.md) · YouTube·추천·AI 호출 코드와 데이터 경계
- [개발자 B](DEV_B_TICKETS.md) · 협업·결제·관리자, 디자인 구현과 릴리스 패킷
- [운영자](OPERATOR_TICKETS.md) · Local AI 설치·운영, 운영 배포·키 등록, 웹디자인 시안·승인, 외부 조치

## 2026-11-24 운영 개편

[운영자 실행 기록](OPERATOR_EXECUTION_20261124.md) 및 [개발자 영향표](REFACTOR_IMPACT.md)를 추가했다. 개발자 티켓 91개를 검토했고 16개에 경로 또는 검증 범위를 추가했다. 운영 새 배포 검증은 대기 중이다.
