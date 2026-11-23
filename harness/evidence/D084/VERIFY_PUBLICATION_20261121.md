# D084 — 실제 공개 저장/동의 회귀 확장

상태 IN_PROGRESS 유지. 새 공개 트랜잭션의 실제 SQL/REST와 두-role 브라우저·실패/동시성·동의 scope 검증을 추가했다. 기존 권한/카탈로그/운영 잠금 검사의 정상 저장은 새 승인 RPC를 사용하고, 반대 역할/직접 위조/운영 잠금 거부 단언은 유지했다. 기존 공개 DTO·파일·정규화·수집/복구 검사를 함께 검증한다.

명령·횟수·최종 변경 영향 재검증·실패 수정·실제/fixture 범위는 [verification](../DEV-A-P0-PUBLICATION-20261121/verification.json), 정확한 source는 [commits](../DEV-A-P0-PUBLICATION-20261121/commits.json)에 기록한다. metadata audit는 최종54 tables/227 functions/2 private buckets다.055 trigger의 테이블 필드 오류는056, global retry의 이전 상태 재적용은057로 수정했다. 기존 SQL/과거 증빙을 덮지 않았다.

남음: D014/D079 실제 계정 전체 삭제·보존/백업 복구, 실제 공급자/외부SMTP/실제 대상 URL·USER 적용·DEV-B 통합 검토. mock 계약이나 로컬 fixture 통과를 실제 공급자 승인·릴리스 완료로 보고하지 않는다.
