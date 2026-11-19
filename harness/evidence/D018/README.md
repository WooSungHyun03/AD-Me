# D018 인플루언서 식별·관측 계약

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- D017 공급원 정책 및 마이그레이션 번호 인계 전 독립 계약을 작성한다. `src/lib/ingestion/creator-contract.ts`는 공급자 ID/핸들 분리, nullable 관측값, 공개 DTO 최소 필드를 정의한다.
- D019 소비 전 D017의 provider·보존·정책 버전 계약과 맞춘다. 기존 JSON 행을 자동으로 공급자 실데이터로 승격하지 않는다.
- 테이블/RLS/backfill/read switch는 스키마 협의 후 별도 migration이 필요하다. 이번 검증은 TypeScript 계약과 DTO 출력 범위다.
- Vitest로 핸들 변경 시 식별자 유지, null/0 구분, 비공개·제한 프로필 억제와 DEMO 협업 차단을 확인했다.
