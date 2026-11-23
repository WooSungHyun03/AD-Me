# D018 정규화 단계 1 · 2026-11-20

- 시작: 4977225, 기존 `codex/dev-a-p0-continue`로 전체 이력 fast-forward. origin/main 65063c8 유지.
- steward 변경안: `adme_creator` 비공개 schema에 legacy creator UUID 연결, provider/external_id identity, 시계열 nullable metric 저장. 새 migration `202611200013_creator_identity.sql` 예약. 기존 18개 migration 및 공개 catalog/profile DTO는 변경하지 않는다.
- legacy backfill은 UUID 연결만 생성한다. handle/platform만 있는 JSON에서 SNS ID·관측값·동의·정책 승인을 추측하지 않는다. 현재 YouTube 운영 저장소의 실존 채널도 D017 승인 인계 전 자동 전용하지 않는다.
- legacy 소유자 변경/삭제/DEMO 변경은 연결 상태와 함께 일관되게 처리한다. identity/metric은 클라이언트 직접 쓰기 불가. 본인 전용 snapshot RPC는 DB auth.uid를 사용하며 공개 목록으로 전환하지 않는다.
- TypeScript 저장 응답 검증과 기존 JSON을 보존하는 호환 adapter를 추가한다. 외부 공개는 기존 DTO allowlist만 사용한다. 정책 승인 검사/수집 write adapter/공개 read switch는 D017/D019 교차 리뷰 후 별도 단계다.
- 검증: 두 번 적용 차단, legacy hash/개수 불변, FK cascade, unique 충돌/핸들 변경/시간순 지표/null과 0/NaN/음수/출처, 직접 REST/역할별 RPC 거부, 모든 lint/typecheck/unit/build 및 로컬 실제 Auth desktop/mobile 회귀.
- USER 산출물: 현재 18 migration 기준 preflight/apply/verify SQL. 이미 공유한 ZIP3개 보존. 대상 환경 외부 적용·DEV-B 검토 전 DONE 아님.
