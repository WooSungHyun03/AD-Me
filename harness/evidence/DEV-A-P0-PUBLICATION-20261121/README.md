# D073 공개 저장 통합·D084 회귀

시작0a2be26, 기존 codex/dev-a-p0-continue. 원본 v2 배분과 타인 티켓은 변경하지 않는다. 기존54 SQL/과거 증빙·패킷 불변, 새055/056/057. 소스와 티켓별 커밋은 commits.json, 명령/결과는 verification.json에 기록한다.

프로필·브랜드·연락처·로고 저장과 scope별 동의 event 및 actor/key/payload hash receipt를 DB 한 트랜잭션에 묶었다. 원장3필수 signup/global 선택 철회와 creator/brand 저장을 구분한다. 현재 정책 버전/hash·역할·본인·입력 allowlist·실제 로고 권한을 확인한다. 같은 key의 변경 payload는 거부하고 성공 요청 재시도는 receipt만 반환하여 이후 철회를 되돌리지 않는다. 서로 다른 새 key의 동작은 서버 처리 순서이며 클라이언트 클릭 순서/CAS 충돌 해결을 주장하지 않는다.

strict 경계는 기존 direct REST/brand·logo RPC의 공개 갱신 우회를 차단한다. 기존 개인정보 공개를 줄이는 본인 비공개/삭제는 정책 만료 후에도 허용하며 별도 scope false 이벤트를 기록한다. DB-owner fixture는 실제 사용자의 동의를 소급 생성하지 않는다. 권한/RLS/opaque DTO/운영 잠금은 유지한다.057은 기존 global 철회 key도 receipt만 반환하게 하며, 새 v2 응답은 그 기록이 현재 최신 철회인지 구분한다. 이미 후속 공개가 있으면 UI가 현재 상태를 다시 불러오고 이전 철회를 현재 상태로 표시하지 않는다. 모든 액션의 클라이언트 클릭 순서 CAS를 주장하지 않는다.

폼은 동일 payload의 응답 유실 후 key를 유지하고 수정하면 새 key를 사용한다. 성공 global 철회는 체크만 해제하며 일반 router refresh로 저장 확인/미저장 필드를 잃지 않는다. 새 정책 안내 문구의 자동 axe 대비 실패는 색 토큰과 링크 밑줄로 수정했다. 테스트를 skip하거나 assertion을 삭제하지 않았다.

실제 검증에서 발견한055 trigger의 brand record에 없는 profile 필드 참조는056 forward fix로 수정했다.055를 고쳐 쓰지 않았다. 패킷 검증의 forbidden owner_id WHERE 조건은 공개 id로 수정해 private owner 열 권한을 유지했다. CLI raw reset의 CRLF와 이전 packet LF 차이는 함수 fingerprint에서 CRLF→LF만 정규화했으며, unknown history·보안 속성 변경·중간 오류 롤백 negative를 유지했다. 원장 시각은 사용자 timestamp가 아닌 DB clock으로 기록한다.

실제 local GoTrue/Postgres/PostgREST/Storage + 명백한 가상 자료/정책 승인/TEST fixture다. 공급자 호출·법률 승인·외부 SMTP·클라우드 적용·배포·대외 메시지 발송 없음. USER 패킷은 하나의54→57 증분이며 stage는 동의 통합 완료가 아니다. D073은 U001 최종 내용/보존·위탁/국외이전/권리 절차 승인 대기로 유지한다. D014 실제 삭제 어댑터·D079 보존/백업 재삭제와 D084 전체 공급자/출시 게이트는 미완료다. P0 잔여5개를 숫자만 줄이기 위해 DONE 처리하지 않는다.
