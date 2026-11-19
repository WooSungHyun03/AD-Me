# DEV-A P0 검토·사용자 적용 자료

전체 실제 데이터 베타 NO-GO. 이번 로컬 소스/SQL은 DEV-B 교차 리뷰 및 격리 QA 적용용입니다. 실제 계정 설정·키 발급/등록·push/배포를 실행하지 않았습니다.

- 상세 구현·검증·남은 조건: source/docs/handoff/DEV-A_P0_CONTINUATION_PACKET.md
- 실제 실행 증빙: source/harness/evidence/DEV-A-P0-CONTINUE/verification.json
- 콘솔 적용: user-apply/00_preflight.sql → 01_apply_all.sql (또는 번호별 파일) → 02_verify.sql. 오류가 있으면 다음 단계를 중단합니다.
- 관리자 승인/철회: console-actions.html을 브라우저로 열고 사용자가 결정한 계정·승인 참조·기한을 입력하면 SQL이 자동 생성됩니다. 외부 통신이나 실행은 하지 않습니다.
- MANIFEST.json은 누적 미커밋 소스와 SQL의 해시 목록입니다. 과거 변경도 포함하며 전부 이번 세션 신규 구현으로 주장하지 않습니다.

사용자에게 터미널/설치/수동 소스 편집을 요구하지 않습니다. 개발 담당이 통합 소스를 준비하고, 조율된 릴리스 시점에 사용자가 외부 적용·배포합니다. 로컬 TLS/계정/키/메일 원문/trace/외부 provider 증거 원문은 포함하지 않습니다. 로고 업로드와 전체 수집·삭제·동의·환경 격리 등 남은 P0는 미완료입니다.
