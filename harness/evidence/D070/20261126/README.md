# D070 — HOT 독립 슬롯·광고 고지 (2026-11-26, DEV-B)

이번 변경 없음. 수용 기준을 현재 main(`252dfdd`)의 빈 DB 전체 검증으로 확인했다(`harness/evidence/D085/20261126b/ci-db-final.txt`).

## 결과
- `tests/e2e/promotion.spec.ts`: desktop·mobile PASS.
- `node tests/promotions.mjs` PASS (같은 실행의 DB 스위트 27/27).
- 확인 범위: 서비스 전용 최소 DTO(3개 이하), 구 RPC 차단, 일반 정렬 불변, 노출 시에만 집계, 소유자·관리자만 이력 조회, 비공개·만료·회수 건 미노출. E2E: "광고 · TEST HOT" 표시 슬롯, 일반 결과 불변, 소유자 기간과 노출 이력.

## 남은 것
- 실서비스 유료 HOT은 비활성(TEST 결제 플래그). 실제 TEST 결제 연동은 D066~D068 게이트.
