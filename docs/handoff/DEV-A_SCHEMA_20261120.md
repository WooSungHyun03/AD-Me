# DEV-A 정규화 저장소 계속 기록 — 2026-11-20C

기존 `codex/dev-a-p0-continue`에 4977225까지의 모든 커밋을 fast-forward로 보존하고 이어서 작업했다. 새 브랜치는 만들지 않았다. origin/main65063c8의 변경도 이미 포함돼 있으며 이번에 main 병합/배포 명령은 실행하지 않았다.

D018 migration013은 `adme_creator` 비공개 저장소 3개와 기존 creator UUID 연결을 추가한다. provider/external_id unique, 변경 가능한 handle, 수집/관측 시각·출처/정책 버전, nullable 시계열 관측·original/derived를 분리한다. 기존 JSON 필드와 가상48개를 바꾸지 않고 UUID 연결만 backfill한다. 기존18개 SQL은 수정하지 않았다.

권한은 기본 거부다. anon/authenticated/service_role의 직접 테이블 읽기·쓰기는 모두 불가하다. `public.my_creator_identity_snapshot()`은 invoker wrapper이고 private 함수가 auth.uid()로 본인 legacy row만 찾는다. 관리자도 타인의 normalized snapshot을 이 RPC로 읽지 못한다. 별도 수집 write RPC나 공개 검색 API를 추가하지 않았다. 소유자 변경은 claim/consent/publication을 초기화하고, DEMO 여부 재분류는 저장된 identity가 있으면 거부한다. 삭제는 하위 지표까지 cascade한다.

DEV-B 인계 계약: `src/lib/ingestion/creator-storage.ts`의 snapshot version1, identity는 기존 TypeScript 계약을 따른다. 최대50 identities/각200개 최신 관측이며 truncation을 명시한다. `legacyCreatorCompatibility`는 기존 profile을 별도로 유지하고 normalized 결측을 legacy followers나0으로 채우지 않는다. 현재 공개 catalog/매칭은 이전 JSON 읽기를 유지한다. 실제 제공자 수집/공개 전환 전 D017 승인·필드/보존/목적/재배포 계약을 연결하고 D019 writer와 운영 YouTube 자료의 이관을 따로 검토해야 한다. DB owner의 private staging은 정책 승인이 아니다.

Node22 lint/typecheck/unit156/19files/build, 직접 SQL/REST44그룹(기존35+신규9), 실제 로컬 Auth desktop/mobile E2E30, free-beta4, keyless4, SQL rollback fixture3, Harness5/백로그/인계/secret scan 통과. 실존 제공자 호출·SMTP/Toss 재검증·호스팅 배포를 포함하지 않는다. 새 UI가 없으며 기존 두 역할 흐름/폼/권한을 브라우저에서 회귀했다.

사용자 적용 자료는 [새 패킷 안내](../../deliverables/dev-a-schema-20261120/README_KO.md). 8/12/16/18 migration 기준을 별도 로컬 DB에서 각각19로 검증했다. 잘못된/중복 기준 거부, 기존 JSON hash와 feature 상태 유지, 세 RLS 테이블/권한 차단을 확인했다. USER가 적용 환경/백업/시점을 확인하고 SQL Editor/배포를 수행한다. 터미널·코드 편집을 요구하지 않는다. 새 snapshot만 중단하는 선택 SQL을 포함하며 데이터/이력은 삭제하지 않는다.

D018/D084는 IN_PROGRESS다. D017 승인과 D019 연결·공개 전환, 대상 환경 적용·교차 리뷰 전 DONE 아님. DEV-A43개 상태 수량은 이전 보고서와 같고, 이전 [남은 티켓 표](DEV-A_PUSH_STATUS_20261120.md)의 D018 저장소/백필 미구현 설명만 이 기록으로 갱신한다. 다음 독립 P0는 D073/D080의 정책/동의 버전 준비 또는 D075 권한 감사이며 외부 정책 승인과 실제 제공자 검증은 별도로 남는다.
