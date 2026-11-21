# D073 — 공개 저장 원자 통합

시작0a2be26, DEV-A. 상태 BLOCKED_EXTERNAL 유지. 앞선 VERIFY_NEXT의 남은 profile/brand 동의 저장 경로를 이번 배치에서 구현했다.055/056/057은 기존54 불변 상태에서 scoped event·private hash receipt·strict 경계를 추가한다. API/폼의 현재 버전/hash/멱등키를 SQL에 전달하고 실제 저장·event·결과를 한 트랜잭션으로 처리한다. 원장 history v2는 global/creator/brand를 구분한다.

실제 local PostgREST6개 그룹: 동시6재시도1event·권한/필드 위조·정책 불일치 거부·changed payload key 충돌·stale 저장 receipt 재전송 시 재공개 없음·legacy RPC/direct REST 우회 거부·정책 만료 후 비공개 허용·연락처/로고/민감 입력 rollback·private grants/Auth cascade·오래된 global 철회 receipt가 이후 공개를 취소하지 않음. v2 응답이 현재 철회 여부를 표시하며 stale receipt UI는 실제 상태를 다시 읽는다. 서로 다른 새 요청의 순서는 서버 처리 순서이며 클릭 시각 CAS를 구현했다고 하지 않는다.

실제 GoTrue로 만든 가상 creator/brand의 desktop/mobile 저장 ACK 유실→동일 key 재시도→철회→old save replay 및 global ACK 유실 후 새 공개→old global retry를 브라우저 검증했다. 신규 정책 안내의 대비와 폼 refresh에 의한 저장 확인 유실도 수정했다. 실제 외부 계정/SMTP·법률/공급자 승인은 아니다.

남음: U001 최종 정책/보존 항목·근거·기한·위탁/국외이전·권리 처리 확정 후 새 snapshot/hash 적용, D079 보존·백업 재삭제, USER 대상 적용/URL·DEV-B 검토. 실제 계정 파기 D014는 이 저장 통합으로 완성되지 않는다. [공통 결과](../DEV-A-P0-PUBLICATION-20261121/verification.json) · [티켓 커밋](../DEV-A-P0-PUBLICATION-20261121/commits.json) · [USER 패킷](../../../deliverables/dev-a-publication-20261121/README.md).
