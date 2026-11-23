# D073 — USER 미확정 확인·신규 처리 흐름 대조

USER가 이번 세션에 "아직 미확정 — 구현 계속"으로 답했다. 이를 정책 승인으로 해석하지 않고 BLOCKED_EXTERNAL을 유지했다. 신규 삭제 접수/격리의 actor/receipt hash·재인증 시각·작업 단계·보관 bytes 목적과 미확정 기간/예외를 처리 register에 추가했다. 현재 policy snapshot/version/hash·기존 승인 이력은 바꾸지 않았다.

온라인 intake는 기본 OFF이며 최종 정책 고지/보존·위탁/국외이전·권리 절차와 D079 계약을 받은 뒤 개발자가 새 snapshot/hash·실행/적용 검증을 준비한다. USER 패킷의 release-gates JSON은 nullable 미확정 사실 목록이며 활성화/정책 승인 SQL을 포함하지 않는다. 로컬 FICTIONAL intake/정책을 운영에 복사하지 않는다. 기존 signup/global/scoped 동의 회귀는 최종64/127검사에서 유지했다.

[처리 대조](../../../docs/operations/policy-processing-register.md) · [검증](../DEV-A-P0-ALL-20261121/verification.json) · [커밋](../DEV-A-P0-ALL-20261121/commits.json).
