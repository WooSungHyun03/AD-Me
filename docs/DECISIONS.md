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
