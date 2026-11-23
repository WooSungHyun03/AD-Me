# 경쟁사 → AD Me 기능별 구현법 상세 매트릭스

| 기능 묶음 | 레퍼런스 제품 | AD Me 구현 패턴 | 핵심 라이브러리/DB | 현실적 범위 |
|---|---|---|---|---|
| 이미지·분위기 태그 기반 검색 | Modash AI Discovery | 다대다 태그 + AND/OR filter + 가중점수 | Postgres join, TypeScript matcher | P0 |
| 카테고리/플랫폼/견적 필터 | 피처링, Modash | URL query filter + 서버 쿼리 | Next.js, Supabase query | P0 |
| 인플루언서 분석 카드 | HypeAuditor | 제공된 지표, 최신 갱신일, 출처·데모 여부 | Postgres; Recharts optional | P0/P1 |
| 과거 광고 협업 연혁 | Modash, CreatorIQ | 확인된 광고 및 단순 브랜드 언급 분리 | ad_collaborations, source URL | P0 |
| 브랜드 안전성 | CreatorIQ SafeIQ | 운영자 검토한 사실·출처·당사자 입장만 | safety_reviews + moderator workflow | P0/P1 |
| AI 매칭 순위 | 피처링, Modash | 하드 필터 + 점수 분해 + 데이터 coverage | pure TS function + Vitest | P0 |
| 유사 인플루언서 | Modash | 태그 Jaccard/벡터 유사도 | JS/Jaccard, pgvector optional | P1 |
| 자연어 검색 | Modash, 피처링 | LLM이 Zod schema 필터로만 변환 | Zod + provider adapter | P1 |
| AI 캠페인 기획안 | 피처링 AI, GRIN Gia | 등록된 brief·태그만 바탕으로 초안 생성 | LLM adapter; output validation | P1 |
| 추천 후보 저장/공유 | 피처링 | shortlist, 소유권, compare | saved_lists + saved_list_items + RLS (D036) | P0 |
| CSV 인플루언서 업로드 | 피처링 | 업로드→검증→중복 미리보기→commit | PapaParse or csv-parse | P1 |
| 다수 후보 비교 | Modash, HypeAuditor | 동일 요건으로 비교 + 누락 데이터 별도 | custom comparison UI | P0 |
| 브랜드 캠페인 생성 | 레뷰 Direct | Stepper / validated form | React Hook Form + Zod | P0 |
| 공개 캠페인 지원 | 레뷰, Aspire | Application state machine | applications table | P0 |
| 제안 수락/거절 | Collabstr, GRIN | Dual-role proposals / audit | proposals table + role guards | P0 |
| 협업 CRM 보드 | GRIN, 피처링 | statuses, owner lists and notifications | Postgres + kanban optional | P0 |
| 메시징 | Collabstr | 인앱 thread; third party DM isn't default | proposal_messages | P0 |
| 외부 DM/이메일 연동 | 피처링 | 향후 사용자 허용 OAuth/API & rate caps | approved provider only | P2 |
| 콘텐츠 제출·검수 | 레뷰, Collabstr | 링크 등록/검토 상태/수정 요청 | deliverables | P0/P1 |
| 성과 리포트 | 피처링, HypeAuditor | 집계 데이터+출처로 차트 | Recharts; SQL aggregates | P1 |
| 예상 효과 계산 | HypeAuditor | 검증된 지표만 계산; 없으면 '데이터 없음' | explicit scoring formula | P1 |
| 검색 HOT 슬롯 | 사용자 BM | Sponsored label, separate top slot, no organic rank boost | promotions | P1 |
| SaaS Pro 이용권 | 사용자 BM | SKU + order + entitlement + expiry | Toss Payments SDK v2 | P0 |
| 크레딧 모델 | 피처링 Credits, 사용자 BM | balance + debit transaction when AI invoked | entitlements ledger | P0/P1 |
| 결제 이력/환불 | Collabstr | test payment confirm/status/refund | Toss server API | P0/P1 |
| 매칭 수수료 | 사용자 BM, Collabstr | hypothetical 8% estimate; no payout | pure calculation | P0/P1 |
| 대행사 팀 관리 | 피처링 Agency | organizations, members, permissions | Postgres organizations RLS | P2 |
| SNS 동기화 | 피처링, Modash | 공식 API provider adapters and permissions | YouTube Data API, IG Business, TikTok One | P2 |
| 운영자 데이터 검토 | CreatorIQ-inspired governance | human review, provenance, appeal | admin API + audit | P0 |

**실현 불가능/불확실 영역 정직하게 표시:** 타사의 사유 데이터 기반 fake-follower 탐지, 수억 명 실시간 검색, 성과 추적, SNS 내 직접 메시징, 실거래 에스크로/정산은 API 계약/권한/실제 데이터가 필요하며 2주 P0가 아니다.
