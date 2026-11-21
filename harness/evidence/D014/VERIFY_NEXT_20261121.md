# D014 — 독립 가능한 삭제 실행 계약

상태 IN_PROGRESS. `src/lib/account-deletion.ts`와 계약 단위검사5개를 추가했다. 요청 접수 기준5분 이내 재인증, actor/lease/버전·순서 checkpoint, 즉시 접근 차단 확인, 세션 철회, 승인된 항목별 보존 근거/기한과 계획 hash 고정, 재수집 차단→Storage/파생 참조→Auth 마지막 순서를 정의했다. 중단 후 checkpoint 재사용, 동시 worker 단일 claim, 승인 누락·차단/Storage 증명 실패·계획 변경에서 파괴 단계를 진행하지 않는 것을 가상 어댑터로 검사했다.

**프로덕션 어댑터·삭제 요청 API·DB 삭제 작업 원장은 구현하지 않았다.** 실제 재인증/오래된 JWT/Storage signed URL·보존 예외·백업 복구 후 재삭제는 D079와 정책 승인 후 구현·검증이 필요하다. 공개 철회는 별도 기능이다. 이 계약의 mock 통과를 실제 계정 파기로 보고하지 않는다.

공통 결과/소스: [verification](../DEV-A-P0-NEXT-20261121/verification.json), [commits](../DEV-A-P0-NEXT-20261121/commits.json).
