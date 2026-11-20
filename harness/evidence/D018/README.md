# D018 인플루언서 식별·관측 계약

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- D017 공급원 정책 및 마이그레이션 번호 인계 전 독립 계약을 작성한다. `src/lib/ingestion/creator-contract.ts`는 공급자 ID/핸들 분리, nullable 관측값, 공개 DTO 최소 필드를 정의한다.
- D019 소비 전 D017의 provider·보존·정책 버전 계약과 맞춘다. 기존 JSON 행을 자동으로 공급자 실데이터로 승격하지 않는다.
- 테이블/RLS/backfill/read switch는 스키마 협의 후 별도 migration이 필요하다. 이번 검증은 TypeScript 계약과 DTO 출력 범위다.
- Vitest로 핸들 변경 시 식별자 유지, null/0 구분, 비공개·제한 프로필 억제와 DEMO 협업 차단을 확인했다.

## 2026-11-20C — private normalized storage, stage 1

- `202611200013_creator_identity.sql`: private `adme_creator` records/identities/metric_observations, UUID bridge, provider+external_id unique, source/policy/time/nullable value/original-derived fields. Three tables use RLS default deny and revoke all direct browser/service-role table privileges.
- Backfill creates UUID mappings only. Existing 48 fictional JSON profiles remain unchanged; no SNS ID, metric, owner consent or approved SourcePolicy is invented. New legacy rows map automatically; owner transfer resets claim/consent/publication, provenance reclassification is rejected, delete cascades normalized rows.
- `my_creator_identity_snapshot()` is a public SECURITY INVOKER wrapper over private owner-authorized code. No UID parameter or anonymous/admin-wide access. At most50 identities and200 observations each, stable order and explicit truncation. Parent moderation/publication overrides identity output. No public catalog read switch or new HTTP endpoint.
- `creator-storage.ts` is server-only and validates storage responses, preserves legacy fields in a separate compatibility adapter, and never substitutes legacy synthetic followers for missing observations. Unit6 new / total156 pass. [Nine direct SQL/REST groups](normalization-security-20261120.json) pass, including uniqueness, handle changes, null/0, invalid metrics/URLs, private access, ownership and cascade.
- [Four generated SQL baselines](packet-terms_18-20261120.json) verified: main8→19, integrated12→19, previous16→19, terms18→19. Legacy profile hash unchanged, three new RLS tables, wrong/duplicate baseline rejected. Optional snapshot pause verified and rolled back. See other packet JSON files in this directory.
- **IN_PROGRESS** remains: D017 approved fields/purpose/retention/redistribution and policy enforcement, D019 ingestion writer/main YouTube migration, public safe DTO/read switch, DEV-B review and USER target application. Private staged storage does not make a provider approved or D018 complete.
- Existing18 migrations, old ZIP3, DEV-B/USER ledgers and original v2 planning preserved. Shared interface/number reservation is in [plan](NORMALIZATION_PLAN_20261120.md); actual local browser regression evidence belongs to D084.
