# D073 — 정책 버전과 서버 동의 원장

상태 BLOCKED_EXTERNAL. 검토본 snapshot/hash·약관/개인정보 안내·처리 흐름 대조표, 개별 미선택 필수3확인, 선택 공개 분리, 본인 기록/철회를 구현했다. 047/053/054는 immutable 원장·정책 hash/버전·서버UTC·본인 접근·멱등 철회와 기존/정규화/채널 공개 중단을 적용한다. metadata/client timestamp 수정으로 이력을 덮지 못한다. 신규 승인 기본 OFF, 구계정 동의 소급 생성 없음. staging과 단방향 strict 활성화를 구분한다.

실제 로컬 GoTrue/PostgREST4개 보안 그룹과 signup unit, desktop/mobile 체크박스·동의/네트워크 ACK 유실 재시도·반복 오류 focus 검사를 통과했다. 철회 뒤 기존 공개 체크가 서버 상태로 갱신되고 unrelated 재저장으로 재공개되지 않는 회귀도 추가했다. 로컬 가상 승인만 사용했으며 외부 SMTP·준법 승인이 아니다.

남음: U001 실제 보존 항목/근거/기한·위탁/국외이전·권리 절차 승인. 확정 내용을 개발자가 새 snapshot/hash/추가 SQL로 준비해야 한다. D079 계정 파기/보존 계약 및 USER 실제 URL·DEV-B 검토도 남는다. 검토본을 승인 없이 운영 정책으로 열지 않는다.

최종 대조: 가입3목적과 설정의 전역 공개 철회는 원장에 연결됐다. 기존 프로필/브랜드 저장의 공개 선택은 여전히 각 기존 owner_consent/published 계약을 사용한다. 해당 저장 경로의 공개 동의 부여/철회를 버전 원장에 원자적으로 연결하는 추가 구현·직접 REST 회귀는 남는다. API에 true 기록 기능이 있다는 사실을 모든 공개 저장 경로의 원장 연결 완료로 보고하지 않는다. BLOCKED_EXTERNAL은 정책 승인 대기를 포함한 부분 진행 상태이며 D073 로컬 구현 전체 완료가 아니다.

공통 결과/소스: [verification](../DEV-A-P0-NEXT-20261121/verification.json), [commits](../DEV-A-P0-NEXT-20261121/commits.json). USER 패킷: [README](../../../deliverables/dev-a-p0-next-20261121/README.md).
