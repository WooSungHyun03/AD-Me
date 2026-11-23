# Architecture Decision Records

- ADR-001: Next.js App Router + TS를 전체 스택으로 선택해 2인 바이브코딩 통합 부담을 줄인다.
- ADR-002: Supabase PostgreSQL/Auth/Storage를 사용한다. 배포 환경에서 로컬 SQLite를 운영 데이터로 사용하지 않는다.
- ADR-003 (2026-11-19 수정): 에이전트가 직접 Vercel + Supabase를 배포하고 실제 URL을 검증한다. 사용자 OAuth/계정 연결 및 테스트키 제공이 필요할 수 있으며 유료 신규 계약/실결제는 제외.
- ADR-004: 추천 점수는 deterministic 규칙·근거·결측치 재정규화, 선택적 LLM 설명만. 28/25/20/15/12 가중치는 초기 가설.
- ADR-005: Toss v2 SDK 테스트 일회성 결제 이용권. 자동갱신은 별도 billing API로 P2.
- ADR-006: 사용자가 제공한 AD Me 로고 원본을 라이트 배경에서 활용. 블랙+라임 색상 토큰.
- ADR-007: 48명/8개 synthetic seed로 동작 검증; 실제 SNS 데이터는 출처/권한 조건 충족 시만.
- ADR-008: 허위 이슈·확인되지 않은 광고 계약 정보를 실제 인물에게 귀속시키지 않는다.
- ADR-009: 경쟁사 기능은 아이디어/제품 UX 패턴만 참고하고 경쟁사 소스·자산·데이터 무단 복제하지 않는다.
- ADR-010: 2인 14일은 P0 골든패스 우선. P1/P2는 실행가능 backlog로 유지한다.

작업 중 새 결정을 할 때 날짜, 배경, 결정, 근거, 대안, 영향, 관련 task ID를 이 파일에 누적한다.

- ADR-011 (2026-11-19): Actual external services provisioned in user's existing organization/team; Supabase Seoul project `ivtdfioypmzknlhinstg`, Vercel CLI project `prj_BzLpbB8hBOXmjzbg9iJI2kp3Zu7C`. No paid resource purchase or live payments.
- ADR-012: Core search/matching/collaboration remains free during TEST demonstration. Paid products create a 30-day TEST access record; Agency team features and advanced AI credit consumption are explicitly marked unavailable rather than sold as implemented.
- ADR-013: Creator profile deletion clears its public profile and unpublishes while retaining collaboration/payment references. Auth account and transaction record deletion are separate operations, not silently cascaded.
- ADR-014: Do not disable email confirmation to work around default SMTP. Full external signup delivery remains BLOCKED until configured SMTP/approved OAuth.
- ADR-015: Provider payment confirmation runs in Supabase Edge Function, using its built-in server-only service role for the restricted finalization RPC. Vercel never needs a service-role key; its confirmation route authenticates the user and forwards the authenticated request. Toss secret only belongs in Edge Function secrets.

## 2026-11-19 — 실제 서비스 v2 범위·사용자 외부 작업

- 사용자의 최신 요청에 따라 배포 사이트·외부 콘솔·실제 배포·API 키 발급/등록/교체를 USER 전담 U 티켓으로 분리한다. 이전 자율 배포·키 조회 권한보다 우선한다.
- 사업자등록을 하지 않는 조건의 무료 실제 데이터 베타를 목표로 한다. TEST 결제만 격리 검증하며 실제 유료 상품·수수료·정산은 보류한다. 무료 서비스도 개인정보·데이터 권리 의무는 검토한다.
- 실제 인플루언서는 허용된 공식 API/웹 수집 및 본인 등록으로 확보한다. 소유권·출처·갱신·삭제 전파를 구현하고 비동의 프로필에 협업 의사를 부여하지 않는다.
- 기존 코드·40개 Harness 작업·검증 기록을 보존하고 v2 88개 개발 티켓을 두 사람에게 각 219SP로 배분한다. 직군별 분리가 아니다. 116개 원 요구 매핑과 사용자 작업 20개·보류 6개를 기록한다.
