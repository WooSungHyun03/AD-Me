# DEV-A D045 추천 기록 인계 — 2026-11-20

기존 `adme-1.0` 점수의 입력·출처 버전·태그·예산 적합·결측·근거·충족률·순위를 DB가 저장한다. 캠페인 소유 브랜드가 명시적으로 저장/재계산하며 조회는 저장을 만들지 않는다. 이전 기록 ID는 유지하고 현재 입력/공개 목록과 다르면 이전 데이터 안내를 표시한다. source commit은 [manifest](../../deliverables/dev-a-recommendations-20261120/MANIFEST.json)의 source_head다. [검증 기록](../../harness/evidence/D045/verification.json) 참조.

## 경로와 계약

- 신규026~028: `adme_recommendation.snapshots` private RLS/no client grant, immutable snapshot, DB-selected model/input/public source fingerprints/result6/history20. raw JSON/유료 HOT/결제/owner 연락처/클라이언트 점수를 입력하지 않는다. 같은 owner+key는 같은 campaign의 원래 ID, 다른 campaign 재사용은409. 쓰기10/hour, 공유 context120/min은 catalogue scan 전에 검사한다.
- `src/lib/recommendation-snapshots.ts`, `/api/recommendations` POST `{campaignId,clientKey}` → `{ok,id}`, GET `campaignId/snapshotId?` → version1/snapshot/history. 기존 error.message/code/requestId, no-store, strict curated DTO와 sanitized 오류를 사용한다. 현재 DB 역할/owner/moderation을 RPC에서 재검사한다.
- `/campaigns/[id]/recommendations`와 저장 버튼, 캠페인 본인 화면의 기록 링크를 추가했다. 타인의 snapshot 읽기는403/404, 저장 실패·빈 결과·이전 데이터·복구 링크를 제공한다. 다른 방문자의 기존 live 추천은 바꾸지 않았다.
- D044 steward: v1 가중치28/25/20/15/12 및 platform/published/availability 조건을 유지하는 SQL 호환 어댑터다. 48fixture×3입력+견적0 경계145사례에서 기존 TS와 요인/점수/결측/충족률/eligibility가 일치한다. score 없는 충족률0은 저장 DTO에서 null로 표시한다. 순위 tie는 PostgreSQL C 정렬의 creator ID다. 향후 정규화 observation/policy/model 버전은 D044 리뷰 후 새 모델로 추가한다. 현재 공개 카탈로그 상한1000 초과는429이며 전수 D033 검색을 완성했다고 주장하지 않는다.
- D046 후속: private 저장 결과와 sourceVersion/modelVersion으로 오프라인 평가를 연결하되 현재 owner gate를 유지하고 별도 최소 DTO로 확장한다. owner/request key를 외부로 공개하지 않는다.

## 개인정보·삭제 호환

읽을 때 현재 공개 가능한 후보인지 다시 확인한다. 비공개/moderation 후보는 과거 결과에서도 통째로 숨긴다. 저장 당시 URL은 현재 동의된 공개 URL과 같을 때만 반환하고, 동의 철회/변경 시 null이다. snapshot은 당시 최소 추천 입력과 근거만 보존하며 외부 콘텐츠를 복제하지 않는다. 데이터 버전은 DB JSON fingerprint이며 외부 플랫폼의 검증/갱신 완료 증표가 아니다. 본인 등록 정보/가상 자료를 구분하고 실제 성과 예측은 주장하지 않는다.

직접 UPDATE/DELETE는 금지한다. 기존 실제 owner의 캠페인 DELETE가 막히지 않도록027에서 실제 부모 FK cascade만 허용하며 그 캠페인의 snapshot도 삭제한다. 캠페인 단위 삭제는 이력을 보존하는 재계산과 구분된다. 계정 전체 Auth/Storage/파생 데이터 삭제와 보존 기간 확정은 D014/D073 후속이다. 기존 public `user-UUID` 식별자는 보존했으며 opaque ID 전환은 기존 D075 출시 차단으로 남는다.

## USER 적용과 복구

USER만 콘솔/실제 배포를 수행한다. 새 키/환경 변수/activation은 없다. [SQL 패킷](../../deliverables/dev-a-recommendations-20261120/README.md)에서00 기존31 확인 →01 전체 적용 →02 이력34/RLS/client grant/RPC/cascade 확인 → USER 새 source 배포 → 실제 URL의 본인 저장·새로고침·재계산·과거 결과·타인 거부 확인 순서다. 기존 read/delivery boundary·정책OFF·일반 메시지·TEST 결제는 변경하지 않는다. 사용자에게 코드 편집/터미널/설치를 요구하지 않는다.

026/027/028과 기존31 source migration은 적용 후 수정하지 않았다.01 중간 실패는 schema/이력 전체 rollback이다. unknown/부분/중복 적용은 STOP이며 개발자가 실제 상태를 읽고 맞는 additive SQL을 만든다. 문제가 있으면 이전 앱 source로 되돌려 기존 기능을 사용하고 새 snapshot 페이지를 사용하지 않는다. 이력 손실을 일으키는 schema DROP/원본 이력 편집을 자동 복구로 사용하지 않는다.

## 검증과 남은 일

Node22 lint/typecheck/unit225/29·실제 PostgreSQL 모델 parity145·보안/경합11그룹·production build PASS. 실제 local Auth/TLS Chrome desktop/mobile 신규2+기존 두 역할 golden2 통과, 모바일 점수 레이아웃 보정 후 신규2 재검증. 실제 생성 SQL31→34를 별도 DB에 적용해 비어 있지 않은 profile/creator/campaign/message/기존 delivery boundary hash 보존·중간 실패 rollback·unknown/reapply 거부·retry/RLS/cascade를 확인했다.

LOCAL_VERIFIED이며 DONE은 아니다. D044 모델·D033 검색 통합/상대 담당 리뷰, USER 적용/실제 URL 검증, 전체 D084 잔여/실제 공급자/출시 게이트는 남는다. TEST checkout backend503은 예상 거부이며 Toss 성공이 아니다. 이번에 전체 과거 E2E를 모두 재수행하지 않았다.
