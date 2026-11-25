# D085 — CI·마이그레이션 안전 재검증 (2026-11-25, DEV-B)

Base: origin/main `59f7eba`. 환경: 격리 로컬 Supabase만. 운영 DB 적용·배포·지문 등록 없음.

## 재현
- GitHub Actions: main의 `1d31c9b`~`59f7eba` 8개 커밋 검증이 모두 FAIL.
  - `b312ada` 이후: `checks` job의 `harness/migration_check.py`가 FAIL. `20261125120000_report_review_queue_contract.sql`(DEV-A)의 manifest 행이 없었다. 그 결과 DB/E2E job(`migrations`)이 skipped되어 이후 회귀가 보이지 않았다.
  - `1d31c9b`: `migrations` job의 `tests/ci-db.sh` FAIL(로그는 인증 필요로 미조회 → 로컬 재현).
- `harness/migration_check_test.py`(검사기 규칙 회귀 6건)는 CI 어디에서도 실행되지 않았다. 2026-11-22 증빙은 CI에 포함된 것처럼 적혀 있었다.

## 변경
- `docs/handoff/RELEASE_MANIFEST.md`:
  - `20261125120000` 행 추가(switch, STOP guard, 운영자 승인 필요).
  - "2026-11-25 pending hosted application packet" 절을 추가했다. 운영 원장에 마지막으로 매핑된 `20261123100029` 이후 21개를 버전 순·단계·담당으로 정리했다. contract 단계는 없고, 지문 등록 절차와 STOP guard 처리를 함께 적었다.
  - 머리말 기준일을 갱신했다.
- `.github/workflows/ci.yml`: `python3 -m unittest harness/migration_check_test.py` 추가. 배포 workflow는 추가하지 않았다. `vercel.json`은 변경하지 않았다(스키마 지문 게이트 유지).

## 결과 (로컬)
| 검사 | 결과 |
|---|---|
| `migration_check.py` | PASS 125 (수정 전 FAIL) |
| `migration_check_test.py` | 6/6 |
| CI `checks` 단계의 Python 검사(secret_scan, selftest, unittest, backlog, production_readiness --check, validate_handoff)와 domain boundaries | PASS |
| lint·typecheck·build | PASS (D036/D052 커밋에서 동일 트리 확인) |
| 현재 main 지문 | `112578038d5f2e911f616dfa68ac60f74af7146b7fabf3ae835f17d69ece255b` (로컬 산출, 승인 아님) |

### `tests/ci-db.sh` (CI `migrations` job과 동일) — FAIL, 중단
- 빈 DB에 125개 마이그레이션, QA 계정, 픽스처 적용은 성공했다.
- E2E 13/118건 실행 후 사용자 요청으로 중단했다(`ci-db-before.txt`).
- 실패 4개 스펙만 재실행한 결과 desktop·mobile **8/8 FAIL**로 결정적이었다(`rerun-failed.txt`).

| 스펙 | 원인 | 관련 티켓 |
|---|---|---|
| billing-cancel | merge `a5f3326`이 대시보드의 주문 상태 라벨(`TEST 결제 완료` 등)과 `CancelOrder`를 제거 | D068 |
| claims | 같은 merge가 "미인증 · 협업 의사 미확인" 라벨을 제거 | D025 |
| compare | 같은 merge가 `compare-table` 비교표를 제거 | D040 |
| csv-import | `/api/import`가 `creators`를 직접 조회한다. creator read boundary 하에서 브랜드는 읽을 수 없어 모든 행이 오류가 된다(D075가 남긴 "D038 import 공개 DTO 계약") | D038 |

- `a5f3326`의 삭제 규모: admin 637줄, dashboard 276줄, campaigns/[id] 244줄, catalog 173줄, creators/[id] 170줄, compare 151줄, settings 112줄 등.
- DEV-B 기능(온보딩, 차단·제한 이의신청, 파이프라인 단계, HOT 노출 이력, 관리자 큐 등)이 DEV-A 버전으로 덮어써졌다. D036·D052에서 복원한 것과 같은 계열이다.

## 남은 것
- D085 완료 조건인 CI `migrations` job 통과는 위 회귀 복원이 선행되어야 한다 → D085 **IN_PROGRESS**.
- 운영 적용(U004)·지문 등록·배포(U005)는 운영자 게이트.
