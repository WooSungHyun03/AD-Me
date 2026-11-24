# D005 운영자 검토 인계 — 2026-11-24

신규 SQL119 `supabase/migrations/20261124080724_demo_catalog_boundary.sql`은 무료 환경의 공개 시연 데이터 노출을 차단한다. 운영 적용 승인이 아니다.

- 선행: 검토된118 전체 스키마와 대상 DB 일치, D085 백업/복원·지문·앱 호환 승인. 기존 운영 ledger41에 이 SQL 단독 적용 금지. 적용된 SQL 편집 금지.
- 새 키/환경변수 없음. private `adme_release.catalog_boundary`의 기본값은 OFF이며 공개 사용자는 상태를 변경할 수 없다. 소유자 승인 setter `adme_release.set_demo_catalog(boolean,text)`는 운영 릴리스 계정만 실행한다. 무료 운영 DB는 계속 OFF로 유지한다. 격리 TEST DB에서만 검토된 release_ref와 함께 ON을 승인한다. TEST 결제 활성화와 독립적이며 결제/공급자 승인으로 간주하지 않는다.
- 적용 순서: 기존118 대상·백업 확인 →119 원자 적용 → OFF 직접 RPC include 플래그/개수 우회 거부 및 실제 프로필 성공·소유자 이력 보존 확인 → 일치하는 migration fingerprint의 앱 배포 → 실제 URL에서 목록/상세/CSV/캠페인·무료/격리 TEST 회귀.
- 앱은 기존 공개 함수/URL을 유지하고 무료 fallback·DEMO 결과를 제외한다. DB는 공개 projection/search/count/campaign SELECT에 승인 경계를 추가한다. 개인 소유/관리자 이력 및48개 원본 시연 프로필·기존 캠페인·스냅샷은 삭제하지 않는다.
- 실패 시 OFF 유지, 공개 노출 중단 및 앱 롤백. SQL을 제거하지 않고 후속 forward fix를 검토한다. OFF만으로 저장된 실제 행을 삭제하거나 과거 추천을 다시 계산하지 않는다.
- 로컬 검증/초기 실패/범위/차단: `harness/evidence/D005/DEMO_BOUNDARY_20261124.md`, 같은 디렉터리의 verification과 desktop/mobile 캡처. 기존 D001·DEV-A SQL 패킷은 수정하지 않았다.
- D075/D033 legacy 검색의 일반 raw 투영 감사, 외부 운영 적용·계정·독립 환경 확인은 별도 게이트다. 배포/키/라이브 결제/외부 승인을 이 세션에서 실행하지 않았다.
