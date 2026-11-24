# D043 운영자 검토 인계 — 2026-11-24

신규121 `supabase/migrations/20261124125948_campaign_recruitment_window.sql`과 기존 모집 화면/API의 호환 변경이다. 운영 적용 승인이 아니다. 새 키/환경변수·유료 자원·결제 설정 없음.

- 선행: 검토된120 전체 스키마/대상 지문/백업·복구·D085 릴리스 승인. 옛 운영 스키마에121만 단독 적용하지 않는다. D074120 인계 및 기존119까지의 적용 게이트는 별도로 유지한다.
- 순서: 대상·백업 및 과거 brief metadata/실제 모집 열 불일치 검토→121 원자 적용→future/end/만석/마감 신규 지원 거부·기존 요청 retry·양 역할 성공/반대 권한 거부→일치하는 migration fingerprint의 앱→실제 desktop/mobile 모집 필터/조건/지원·선정·마감 수용. 과거 값을 임의로 덮어쓰는 backfill은 포함하지 않는다.
- 새 private 함수/trigger는 공개 직접 실행 불가. 기존 앱과 API/RPC signature·board 조회 범위·협업/지원 기록은 보존한다. board에는 모집 가능 여부·마감·인원 집계만 추가하고 소유자 ID를 추가하지 않는다. 클라이언트 시각/폼 숨김을 권한 기준으로 사용하지 않는다.
- 실패 시 신규 지원을 중단하고 호환 앱으로 복귀하되 DB 경계를 제거하지 않는다. 적용된 SQL 편집/기존 지원 삭제 없이 forward fix를 검토한다.
- evidence `harness/evidence/D043/RECRUITMENT_WINDOW_20261124.md` 및 verification·desktop/mobile 캡처. actual local Auth/PostgreSQL 결과이며 claim/profile은 합성 QA fixture다. 실제 채널 인증·운영 계정 수용·Toss 공급자 승인을 완료하지 않았다.
