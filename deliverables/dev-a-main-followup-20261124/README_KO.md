# DEV-A 최신 main 후속 검토 인계 ·2026-11-24

기준 main1710f23의 Figma·도메인 개편을 기존 A 브랜치에 반영했다. SQL 추가/편집, DB/계정/모델 서비스 설정, 외부 키 등록은 없다. 이전113→116 패킷과 적용 증거는 변경하지 않았다.

이번 변경은 운영 지문 계산의 CRLF→LF 표준화와 UTF-8 검증, API의 소비된 빈 요청 복원, Windows 도메인 검사 경로 정규화, 수동 추천 앵커·스트리밍 이후 이동, YouTube 서비스 안내다. 명시적인 운영 지문 승인은 여전히 필요하며 main 자동 빌드 설정과 배포 순서를 변경하지 않았다. 로컬/preview 빌드는 기존처럼 독립 가능하다.

산출 지문과116개 Git SQL/Windows 체크아웃 일치 증거는 harness/evidence/DEV-A-MAIN-FOLLOWUP-20261124/schema-fingerprint.json에 있다. 지문은 비밀키가 아니며 운영 승인본도 아니다. OPERATOR/B D085·D087가 실제 운영 DB·복구·RPC·권한과 대조해 승인하기 전에는 ADME_PRODUCTION_SCHEMA_SHA256에 등록하지 않는다. Linux LF 기준 승인값은 유지되지만 이전 Windows 원시 CRLF 승인값은 다시 검토한다. 스크립트가 양쪽 값이나 누락된 승인을 자동 허용하지 않는다.

517개 단위·43개 Python·lint·typecheck·free-keyless Next production-mode build 및 영향 desktop/mobile10 검증 범위를 배치 증빙에 기록한다. DB/모델 동작을 합성 통과로 대체하지 않는다. Docker Desktop 시작 및 후속 모델 포트 확인이 자동 승인 검토에서 정책상 거부되어 현재 DB·실제 모델·전체 양측 흐름은 재검증하지 못했다. U001/D017/D052/D079와 실제 호스트·메일·Toss TEST·복구·운영 수용은 해당 담당 선행으로 유지한다.
