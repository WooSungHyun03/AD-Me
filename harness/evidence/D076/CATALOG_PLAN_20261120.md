# D076 공개 catalog RPC 쿼터 — 2026-11-20E

- D075014 경계가 로컬에서20 migration으로 적용·검증된 뒤 별도 additive `202611200015_creator_catalog_quota.sql` 예약.014를 수정하지 않는다.
- 기존 DB 원자 fixed-window quota를 사용해 authenticated60/min(UID별), anon300/min(shared)으로 공개 catalog POST RPC를 제한한다. scope/subject/limit은 DB에서 결정하며 클라이언트 인자를 받지 않는다.
- 기존 read 구현은 private leaf로 이름을 바꾸고 실행 권한을 모두 회수한다. 공개 wrapper/새 gateway는 volatile, invoker/private-definer 경계를 유지한다. GET 우회는 거부된다. paging/DTO/ID/기존 private own read 및 다른 서비스 한도는 바꾸지 않는다.
- 검증: 독립 가상 UID로65회 동시 직접 RPC →60성공/5정확한429·Retry-After, 다른 계정 격리, private leaf 실행 거부, 원본 테이블 우회 거부. 실제 공급자 호출은 없다.
- 가입/로그인 신뢰IP·Auth 설정, 나머지 자원 경계/UX 및 D033 실제 서버 검색 연결은 미완료다. 본 변경으로 전체 D076 DONE이라고 보고하지 않는다.
