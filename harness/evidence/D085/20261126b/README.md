# D085 — 빈 DB 전체 재검증 2차 (2026-11-26, DEV-B)

기준: origin/main `252dfdd`(D061·D046·D025 반영). 명령은 `tests/ci-db.sh`(CI `migrations` job과 동일)이고, 로그는 `ci-db-final.txt`다. 환경은 격리 로컬 Supabase만이다.

| 항목 | 1차 (`0413c92`) | 2차 |
|---|---|---|
| 마이그레이션 + migration_check | 136 PASS | **137 PASS** |
| E2E (desktop+mobile 118건) | 106 통과 / 8 실패 / 4 건너뜀 | **112 통과 / 2 실패 / 4 건너뜀** |
| DB 권한 스위트 | 27/27 | **27/27** |
| restore_drill | Windows `spawnSync npx` ENOENT | 같음(로컬 환경 한정, Linux CI에서 확인 필요) |

## 남은 E2E 실패
- `retention.spec.ts`(desktop·mobile): 개인정보 페이지에 `retention-table`이 없다. 현재 화면은 운영자가 승인한 정책 문서(D073)만 렌더링하고, 승인되지 않은 보존 기간 표는 다시 넣지 않는다 → D079, U001·운영자 정책 승인 대기.

## 남은 게이트
- 운영 적용(U004)·지문 등록·배포(U005)는 운영자 게이트. pending 패킷은 `docs/handoff/RELEASE_MANIFEST.md`에 있다.
- D085 완료 조건(CI `migrations` job 통과)은 retention 정책 결정과 Linux CI의 restore_drill 확인에 달려 있다 → IN_PROGRESS.
