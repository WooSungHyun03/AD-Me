# D017 — 플랫폼별 수집 허용 목록·데이터 계약 (2026-11-19, local)

상태: 정책 문서·실행 게이트 구현 완료 / **U001(사용자 약관·권리 검토) 대기** → YouTube·TikTok은 pending으로 실행 차단 상태.

- `docs/data-sources/README.md` [신규], `src/lib/ingestion/policy.ts` [신규].
- `tests/ingestion-policy.test.ts` 4건: 미등록·pending·검토자/약관버전 미기록·만료 공급원 거부, 승인 공급원 허용, 허용 외 필드 제거, 모든 정책의 목적·근거·보존 정의.
- vitest 34/34, lint, typecheck PASS.
- 인터페이스(DEV-A D018/D020): 수집기는 `assertSourceAllowed(id)` → fetch → `pickAllowed(policy, raw)` 순서를 지킬 것.
