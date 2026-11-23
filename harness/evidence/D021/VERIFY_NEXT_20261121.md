# D021 — 정책별 수집 복구와 재유입 차단

상태 LOCAL_VERIFIED. 049/050/052는 기존 worker RPC OID를 유지하며 checkpoint·heartbeat·lease·최대3회·지수 backoff·TTL·중복 coalescing·캐시 재사용·정책별 내부 예산과 별도 rolling24h search cap·삭제 tombstone을 적용했다. 정책은 기본 비활성이고 old unreviewed cache를 사실로 재승인하지 않는다. Python worker는 이미 완료한 channel을 재호출하지 않고 저장된 candidate만 재개한다. 응답 크기/채널 ID 검증으로 임의 추가 채널을 fetch하지 않는다.

실제 로컬 SQL/PostgREST7개 그룹 PASS: 정책 OFF·동시 claim/중복 합류·중단/429 재개·TTL/opaque 공개 참조·service-only 삭제/tombstone·낮은 내부 예산·별도 검색 cap. Python 네트워크 대체 계약4개 PASS. 실제 provider 응답/키/cron을 사용하지 않았다. 내부 가중치175는 공급자 청구 단위가 아니다([공식 quota](https://developers.google.com/youtube/data/determine_quota_cost)).

남음: D019 정규화 writer 통합, D017 실제 정책/보존 승인, USER 실제 프로젝트 quota/cron·공급자 검증 및 DEV-B review. 기존 legacy cache worker를 정규화 writer 완료로 보고하지 않는다. 전체 수용/외부 gate 전 DONE 아님.

공통 결과/소스: [verification](../DEV-A-P0-NEXT-20261121/verification.json), [commits](../DEV-A-P0-NEXT-20261121/commits.json).
