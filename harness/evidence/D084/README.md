# D084 — 로컬 회귀 하네스 확장

DEV-A · 2026-11-19 KST · root HEAD 4437eb1 / codex/dev-a-p0-continue (미커밋)

setup:qa:local은 표식 있는 별도 Docker 프로젝트에 마이그레이션·가상 fixture·실제 로컬 Auth/TOTP·Mailpit·TLS를 준비한다. hosted 계정/키/DB에는 연결하지 않는다. Playwright는 두 역할 흐름, 브랜드 프라이버시/운영 잠금/OTP 등록/메일 가입·재발송·증표 재사용 거부를 검증하고 인증 trace를 끈다.

[현재 결과](../DEV-A-P0-CONTINUE/verification.json): desktop/mobile 실제 로컬 DB E2E 18개, 직접 REST 13개. 외부 SMTP/Toss/수집 결과로 보고하지 않는다. 이전 실패를 보존하고 실행기·라벨·assertion을 수정했으며 skip하지 않았다.

**IN_PROGRESS**: D049/D075 및 실제 수집·계정 삭제·경합 전 범위는 미완료다.

## 2026-11-20 main regression continuation
- Real local production build + Supabase Auth/DB/Mailpit: E2E26/26 desktop/mobile; keyless free build4/4 using installed Chrome. Unit138/16, lint/typecheck, Harness5, backlog validation PASS.
- Main's provider-dependent scenarios now explicitly distinguish local fixture lease/finish from opt-in actual worker runs; no skip or mock-as-provider claim. Added actual delegated Auth OTP enrollment and scoped permission checks.
- Local harness shutdown headers guarded; Windows readers explicitly UTF-8; repeated security results go to ignored output before copying dated evidence, preserving earlier snapshots.
- Actual generated console SQL verified on second local Supabase container for both main-only and integrated DEV-A baselines,16 migrations/RLS/privileges/default-off/reapply rejection PASS. Both source and SQL are secret-free local review artifacts, not hosted execution.
- Evidence and failures resolved: ../DEV-A-MAIN-20261120/verification.json. Full ticket remains IN_PROGRESS for external provider and missing service workflows. No authenticated traces/OTP secrets shared.

## 2026-11-20B — continued local validation
- Final Node22: unit150/18, lint/typecheck, production builds; complete local Auth/DB E2E30, free-beta/no-Toss-key campaign4, keyless4 PASS. Direct REST35 groups and SQL3 fixture transactions PASS. New D041 screens and D081 provenance labels visually checked on desktop/mobile.
- Regression fixtures now use a dedicated creator account rather than a primary account retained for collaboration history; SQL queue order is explicit and finance array checks allow unrelated TEST orders. No tests skipped/deleted to pass. Initial failures and corrected results are preserved in DEV-A-CONTINUE-20261120B/verification.json.
- New optional developer QA mode free_beta verifies actual campaign flow while direct TEST orders are404. No deployment setting/key change. USER console SQL validated for3 exact prior baselines,18 total migrations, unchanged old briefs, wrong/duplicate baseline denial.
- Full D084 remains IN_PROGRESS for unimplemented delete/privacy/collaboration/provider workflows and actual target release verification. No provider success or legal/payment approval claimed from fixtures.

## 2026-11-20C — normalized storage regression
- [New verification](../DEV-A-SCHEMA-20261120/verification.json): Node22 unit156/19, explicit actual local SQL/RPC→server TypeScript adapter1, lint/typecheck/production build, desktop/mobile actual local Auth/DB E2E30, free-beta4, keyless4 PASS. SQL/REST44groups (existing35+newD0189), SQL rollback fixture3 and four generated SQL baseline drills PASS.
- `vitest.storage.config.ts` runs only `tests/local-db-contract/*.spec.ts`; normal unit CI remains keyless. This validates PostgreSQL timestamp/JSON output against the actual storage adapter and preserves nullable versus zero without importing synthetic legacy counts. Private runtime must be exact loopback, private credentials/traces stay ignored.
- JSON key order and initial Vitest config array-merge findings are recorded with corrections; no skip/deleted assertions. D084 remains IN_PROGRESS for missing service workflows and actual providers/release. Other developer/USER ledger entries and old screenshots/ZIPs remain unchanged.

## 2026-11-20D — attachment review, filters and public app DTO
- [Verification](../DEV-A-FILTERS-20261120/verification.json): Node22 unit181/22, SQL/RPC→TS1, lint/typecheck, production builds. Full actual local Auth/DB E2E32 passed after route-wait correction. After the final D034 synchronous URL-store fix, affected local discovery/RSC4 and keyless10 passed again; unaffected free-beta4 passed. Direct SQL/REST44 and rollback fixtures3 pass for their specified cases.
- Captures/keyboard/overflow checked for catalog at320/390/768/1440. Legacy owner placeholder0 becomes unavailable/null and injected private JSON canaries are absent from actual RSC output. D033 cancellation boundary tests are standalone; no fictional endpoint/provider claimed.
- Initial build-lock, navigation-wait and mobile controlled-state failures are recorded with real fixes. No test skip/assertion deletion/sleep/force retry. Known direct REST/legacy-public-ID disclosures remain explicit release blockers; passing44 covered security groups does not claim all DB paths are safe. Full D084/D018/D034 remain IN_PROGRESS.

## 2026-11-20E — 공개 읽기 경계 최종 회귀
- DEV-A-READ-20261120/verification.json: unit190/24·실제 DB→TS2·lint/typecheck/build, 로컬 Auth/DB 전체32·최종017 영향4, free4/keyless10, SQL/REST54·rollback3, 생성 SQL5기준→23 PASS. 검증 시점/실패와 수정/fixture 구분을 명시했다. 전체 D084 IN_PROGRESS와 외부/미구현 게이트를 유지한다.

## 2026-11-20G — 근거 검토·광고 이력 회귀
DEV-A-EVIDENCE-20261120/verification.json: unit210/27·신규13·lint/typecheck/build, 실제 DB17·새 desktop/mobile4+기존 golden2, 실제 USER SQL23/24→30 원본 message/report/profile hash·legacy INSERT/read boundary 보존 PASS. 검증 시점/locator 실패/새 부정 조건을 구분했다. 전체 historical32/실제 provider/출시 전수 검증을 이번에 재수행했다고 주장하지 않는다.
