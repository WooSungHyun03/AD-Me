# USER 적용 패킷 — 독립 구현

정확히 검토된67개 migration 이력에서68(저장 검색)만 추가합니다. main의8개 이력에 바로 적용하지 않습니다. 이전 패킷과 적용 DB의 source/history가 다르면 중지하고 개발자가 호환성을 검토합니다. 기존 자료·migration·권한은 변경하지 않으며 새 private 검색 조건 schema/RPC만 추가합니다.

USER가 Supabase SQL Editor에서00_preflight.sql을 확인하고01_apply_current_67.sql을 한 번 적용한 뒤02_verify.sql을 확인합니다. 사용자가 소스 수정/터미널/패키지 설치를 할 필요는 없습니다. 오류는 전체 트랜잭션을 롤백하며 재적용/변경 이력/커스텀 hook은 STOP합니다. 성공 후 되돌림이 필요하면 기능 접근을 중단하고 개발자 forward fix를 사용합니다. 실제 저장 검색 자료를 DROP하지 않습니다.

알림·크롤러·Instagram·팀·추천 실험은 활성화하지 않습니다. 별도 API키/새 환경 변수는 없습니다. main과 A branch Git 배포 hold를 유지하고 USER가 DB/설정을 맞춘 뒤 배포를 조율합니다. 이 패킷은 배포하지 않으며 정책·보존·DEV-B 교차 검토·실제 공급자 검증 완료를 뜻하지 않습니다.
