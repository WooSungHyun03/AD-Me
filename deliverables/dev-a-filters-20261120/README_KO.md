# DEV-A 지시서 검토·필터·공개 앱 DTO — 2026-11-20D

로컬 검토 산출물이다. USER가 외부 콘솔/계정/배포를 수행한다. 코드 편집·터미널 실행·패키지 설치를 요구하지 않는다. 이전 ZIP4개는 그대로 보존했다.

1. 이번 변경에는 새 migration이 없다. 이미 이전 SCHEMA 패킷의19개까지 적용됐으면 SQL을 반복 적용하지 않고02_verify.sql의 읽기 전용 검증만 한다. 현재 DB가 무엇인지 모르면 에이전트가 실제 이력을 확인해 적용안을 준비한다.
2. main8 / integrated12 / previous16 / terms18 기준이라면 이전 SCHEMA 패킷에서 네 가지 실제 로컬 적용 검증을 마친 SQL을 **바이트 그대로 복사**해 제공한다. 현재 이력에 맞는00_preflight와01_apply만 사용한다. 다른/부분/알 수 없는 기준이면 중단하고 결과를 에이전트에게 전달한다. 임의 SQL 수정이나 재실행을 요구하지 않는다. 전체19개, 세 private RLS 테이블과 권한을02_verify로 확인한다.
3. source에는 다중 OR/AND 필터·URL restore/back/forward/reset·0/결측·범위 오류·안정 정렬과 공개 앱 DTO allowlist가 포함된다. actual owner-registration 지표는 미확보(null)이며 DEMO만 가상 수치다. 클라이언트에 raw profile/owner_id/owner_consent/연락처/OAuth/내부 메모를 전달하지 않는다. D033 취소/늦은 응답 계약은 독립 테스트이며 실제 서버 검색 연결 완료가 아니다.
4. **출시 차단 유지:** 기존 직접 REST published creators 읽기의 owner_id/raw JSON, user-<Auth UUID> legacy 주소는 별도 D018/D033/D075 read/opaque-ID 이관이 필요하다. 앱 DTO 보수만으로 전 경로 노출을 막았다고 주장하지 않는다. D017 정책/수집 계약·기타 P0/USER 게이트와 대상 환경/교차 리뷰도 미완료다. 이 패킷을 실제 제공자 검증 또는 실서비스 준비 완료로 해석하지 않는다.

복구: 이번 변경은 DB를 바꾸지 않는다. 문제가 생기면 공개 화면 적용을 중단하고 에이전트가 forward fix를 준비한다. 원본 JSON/identity/관측/migration 이력을 삭제하거나 보수 전 raw JSON 공개 경로로 단순 롤백하지 않는다. 기존03_pause_snapshot.sql은 선택적으로 새 본인 snapshot만 중단하며 검색이나 전체 DB 권한 문제를 해결하는 SQL이 아니다. 새 API 키/유료 기능/실제 결제가 필요하지 않다.

검토 보고서 docs/handoff/DEV-A_DOCUMENT_AUDIT_20261120.md, 상세 결과 harness/evidence/DEV-A-FILTERS-20261120/verification.json. source_head 이후 산출물 커밋은 ZIP/SQL 복사/메타데이터이며 소스 기준을 별도로 명시한다.
