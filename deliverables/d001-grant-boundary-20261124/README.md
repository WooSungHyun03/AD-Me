# D001 검토·운영 인계 — 2026-11-24

무료 환경에서 관리자 수동 TEST 이용권 발급을 차단한다. 로컬 검증 자료이며 운영 변경 승인이 아니다.

- 소스: `supabase/migrations/20261124074917_test_entitlement_grant_boundary.sql`(118). 기존117을 포함한 전체 선행 스키마가 대상에 검증되어 있어야 한다. 기존 운영41 ledger에118 단독 적용 금지. D085의 운영 스키마 전환/백업·복원·지문 승인과 함께 검토한다.
- 새 설정명/키 없음. 기존 서버 `ADME_SERVICE_MODE`와 `ADME_FEATURE_TEST_BILLING` 및 DB billing boundary를 사용한다. free_beta는 발급404. 격리 test_demo는 서버 feature와 DB TEST boundary 모두 승인 활성 상태에서만 발급 가능하다. 운영 무료 DB의 TEST boundary를 켜지 않는다.
- API 서명/성공 응답 변경 없음. 비활성 발급은404 `NOT_FOUND`/requestId. 회수 API와 기존 원장·감사·MFA 검사는 유지한다. SQL은 같은 기존 함수에 체크만 더하므로 구버전 앱에도 DB 보호가 적용된다.
- 운영자 승인 후 적용 순서: 대상의 선행117 소스와 실제 DB 일치/백업 확인 → 기존 release runner로118 원자 적용 → 직접 RPC OFF 거부/관리자·일반역할·회수 확인 → 검증된 전체 마이그레이션 지문에 맞는 앱 배포 → 실제 URL 역할 회귀. 이 세션은 운영 적용·키 등록·live 결제를 수행하지 않았다.
- 적용 전 로컬 증빙: rollback/실패 주입 시 함수 정의·ACL 불변,117→118 전환, 역할별 REST와 desktop/mobile 무료·TEST 흐름. 세부 범위/실패/차단은 `harness/evidence/D001/GRANT_BOUNDARY_20261124.md`.
- 복구 조건: 무료 환경 grant가200이거나 일반역할 발급이 가능하면 출시 중단. 기존 서버 배포로 롤백하되 DB 발급 차단은 유지한다. 회수/역사 조회는 계속 가능하다. 적용된 migration을 편집/삭제하지 않고 문제가 있으면 검토된 후속 SQL로 수정한다.
- 상대 담당: DEV-A 권한/공유계약 리뷰, DEV-B D085 릴리스 통합, OPERATOR 운영 대상 승인/실환경 검증. 기존 패킷/증빙 불변, ZIP 중복 생성 없음.
