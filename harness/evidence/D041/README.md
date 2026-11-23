# D041 KST 기간·KRW·산출물 계약

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- D012 브랜드/소유 계약 완료 전, 브리프 v2의 날짜·현금/제품 제공·산출물 스키마와 부정 테스트를 독립 작성한다.
- 로컬 입력은 KST, 저장 계약은 UTC ISO 문자열이다. 모집 상태와 모집 시작·종료는 별개다. 슬롯 중첩은 허용하고 모집·제작·게시의 시작 순서를 검증한다.
- 기존 campaignSchema·캠페인 폼·DB는 아직 v1을 사용한다. D012 이후 호환 폼/저장 migration에 연결하고 D044와 추천 입력을 검토해야 한다.
- Vitest로 KST 자정의 전일 UTC 변환, 유효하지 않은 달력 날짜, 시간 순서, 정수 KRW, 수량 및 현금/제품 제공 조건을 확인했다.

## 2026-11-20B — forms, API and persistent v2 terms
- Implemented optional brief.terms.version2: KST minute input converted once to canonical UTC; recruitment/production/posting windows, unknown/cash/product/mixed compensation, integer KRW ranges, product counts and up to20 deliverable kinds with usage/exclusivity.
- New UI creates v2; legacy rows/clients retain total budget and no fabricated dates. Legacy edit can opt in. v2 omission by an old update is rejected422, including direct REST. Dates do not auto-change publication status. Existing moderation/RLS/collaboration references remain.
- Additive202611200012 validates nested types/ranges/phase order/nonblank rights and preserves existing briefs exactly. No new private table/key/provider call/payment/business registration gate.
- Node22 unit150/18 files, lint/typecheck/production builds; real local Auth desktop/mobile E2E30 and explicit free_beta/no-Toss-key campaign4 PASS. Free mode denies direct TEST orders404 while campaign creation/edit/publication succeeds. Direct REST4 D041 groups (including22 corruptions/ownership/legacy/upgrade) PASS; total security35 groups and SQL3 fixtures PASS. Synthetic JWT and fixture results are not real provider or legal-contract verification.
- Technical state LOCAL_VERIFIED, not DONE. USER target application/deployment, DEV-B D042/D043/D044/D050/D055 contract review and actual release verification remain. Existing total budget remains required and separate from per-offer unknown/ranges; this is not a full normalized CampaignBrief/matching snapshot implementation.
- Dated complete results, screenshots, application packet baselines and resolved test failures: ../DEV-A-CONTINUE-20261120B/.
