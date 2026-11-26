# D085 — 빈 DB 전체 재검증 3차 (2026-11-26, DEV-B)

- 기준: origin/main `bfa2314`. D024 pilot-quality 스위트, D088 스모크, Windows restore_drill 수정이 반영된 상태다.
- 명령: `tests/ci-db.sh`. CI `migrations` job과 같은 스크립트다.
- 로그: `ci-db.txt`.
- 환경: 격리 로컬 Supabase만 사용했다.

| 항목 | 2차 (`252dfdd`) | 3차 (`bfa2314`) |
|---|---|---|
| 마이그레이션 + migration_check | 137 PASS | **139 PASS** |
| E2E (desktop+mobile 124건) | 112 통과 / 2 실패 / 4 건너뜀 | **118 통과 / 2 실패 / 4 건너뜀** |
| DB 권한 스위트 | 27/27 | **29/29** (pilot-quality 포함) |
| restore_drill | Windows `npx` ENOENT | **PASS**. 데이터 복원 RTO 1.3초, 스키마 재생성 40초, RPO 정책은 일일 덤프 ≤ 24h |

## 남은 실패
- `retention.spec.ts:26` (desktop·mobile): 개인정보 페이지에 보존 기간 표가 없다.
  - 사용자 결정(2026-11-26)에 따라 U001 승인 뒤 승인된 정책 문서로 표를 복원할 때 해소한다(D079).
  - 이 2건 때문에 스크립트는 `exit=1`로 끝난다.

## 재실행 사유 (1차 시도 무효)
- 같은 날 첫 시도에서 E2E가 85건 실패했다.
- 원인은 D088 스모크 확인용으로 띄웠던 개발 서버였다. 작업은 중지했지만 자식 프로세스가 3000 포트에 남아 있었다.
- Playwright가 `reuseExistingServer`로 이 서버를 재사용했다. 이 서버에는 `SERVICE_MODE=test_demo`와 기능 플래그가 없었다.
- 서버를 종료하고 다시 실행한 결과가 위 표다. 무효 로그는 커밋하지 않았다.
- 1차 시도에서 notifications DB 스위트가 한 번 `realtime delivered own notifications (0)`로 실패했지만, 3차에서는 PASS였다. 다시 나오면 realtime 지연을 조사한다.

## 남은 게이트
- D085 완료 조건(원격 CI `migrations` job 통과)은 retention 2건, 즉 U001/D079에 달려 있다.
- 운영 적용(U004)과 배포(U005)는 운영자 게이트다.
