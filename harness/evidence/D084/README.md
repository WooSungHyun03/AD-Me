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
