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

## GitHub Actions (main, 공개 API로 읽기 전용 조회, 2026-11-26)
- 최근 완료 실행(`252dfdd`, `2665cb4`, `baa9e05`, …)은 모두 `checks` job **success**, `migrations` job **failure**(단계 `Run bash tests/ci-db.sh`)였다.
- job 로그는 인증이 필요해 직접 보지 못했다. 같은 스크립트의 로컬 재현에서 실패는 `retention.spec.ts`(D079 정책 문서 대기)뿐이다. 그 밖에는 Windows 한정인 restore_drill npx 문제가 있었다. CI 실패도 retention 스펙이 원인일 가능성이 높지만, 로그로 확인되지는 않았다.
- 확인 방법: 저장소 Actions 탭에서 최신 main 실행의 `migrations` 로그를 보면 된다(사용자 권한 필요).
