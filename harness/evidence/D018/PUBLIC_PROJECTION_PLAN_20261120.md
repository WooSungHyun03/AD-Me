# D018 steward 인계안 — 공개 앱 DTO 보수

- 첨부 문서 대조 중 c450619의 publicCreators가 owner_id 및 raw profile 전체를 클라이언트 Catalog props로 넘기는 것을 확인했다. D018 private 저장소와 공개 read 경로가 아직 분리되어 있으므로 기존 코드에서도 앱 경계의 최소 권한 보수가 필요하다.
- D034 필터 커밋 뒤 별도 D018 커밋: 신규 creator-public-profile.ts allowlist/검증, data.ts 공개 매핑, catalog.ts의 매칭 입력을 필요한 공개 필드만 받도록 타입 분리, Catalog/필터/비교/상세의 nullable 지표 대응. 원본 private Creator/DB JSON·소유자 저장/API·추천 점수는 바꾸지 않는다. unknown 지표를0으로 변환하지 않는다.
- owner UUID, owner_consent, 이메일/OAuth/검토 메모/알 수 없는 JSON 키는 공개 앱 DTO에서 제외한다. 동의하지 않은 SNS/portfolio/source 링크도 제외하고, 외부 공개 정보의 승인이나 실제 지표를 추정하지 않는다. 실제 스키마/수집 read switch는 미완료로 유지한다.
- 새 DB migration/RLS 전환은 이번 작은 보수에 포함하지 않는다. 기존 직접 REST published creators 읽기의 owner_id/raw profile 노출은 D033/D075 출시 차단으로 기록한다. 이를 닫으려면 공개 read RPC와 제안/저장/운영 DB 권한을 함께 이관해야 하므로 앱 DTO만 고쳤다고 전 경로 보안 완료로 보고하지 않는다. DEV-B 교차 리뷰 필요.
- 기존 공개 ID `user-<Auth UUID>` 자체에도 UUID가 들어 있다. 링크 호환을 임의 파괴하지 않고 opaque 공개 ID/alias 이관을 D018/D033/D075 잔여 게이트로 남긴다. 앱 projection이 모든 경로의 UUID를 숨긴다고 주장하지 않는다.
- 검증: unknown/private 필드·악성 extra JSON·동의 철회·nullable/0·가상48개 호환 단위, 실제 로컬 RSC props 비밀 fixture 제외 테스트, public discovery/비교/제안/이메일/브랜드/운영 권한 회귀. 실제 제공자/대상 환경 검증과 혼동하지 않는다.
