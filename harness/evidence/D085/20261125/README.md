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

## 2026-11-25 후속 — merge a5f3326 회귀 복원 (같은 날, 이후 실행)

전체 E2E 실패 목록 수집(`census-e2e.txt`, 30초 타임아웃): 118건 중 **50 통과 / 64 실패 / 4 건너뜀**(고유 32개).
연쇄 원인: 공개 카탈로그 파서가 견적 null(D026 "견적 미확인")이나 협업 의사 null 행 하나만 있어도 전체를 throw해서, 캠페인·탐색 화면이 500이 됐다.

### 복원·수정 (DEV-A 설계·권한 경계는 유지)
| 영역 | 변경 | 티켓 |
|---|---|---|
| 공개 DTO | `price_min/max_krw`, `is_available` nullable(함께 null). 상세·카탈로그는 "견적 미확인"/"협업 의사 미확인" 표시 | D026 |
| 대시보드 | TEST 주문 라벨·취소, 회수 이용권 숨김, 온보딩, 연락 제한·이의신청, 파이프라인 단계·CSV, 상태 이력, 차단, HOT 노출 이력 | D068·D069·D011·D062·D056·D049·D070 |
| 관리자 | D060 검색 아래에 `super` 역할 전용 운영 패널(`src/components/admin-operations.tsx`) 복원: 연락 제한, 소유 확인, 프로필·캠페인 운영, 이용권, 회원, TEST 결제, 지표, 문의, 퍼널, 추천 평가, outbox, 상태, 보존, 감사. 신고 검토는 DEV-A D057/D060 큐 사용 | D063·D069·D079·D053 등 |
| 설정 | 비공개 처리 안내, 포트폴리오 파일, 차단 목록·해제, 개인정보 접근 기록 | D027·D062·D074 |
| compare | 비공개 메모·비교 저장·링크 공유 | D040 |
| CSV | 가져오기를 공개 DTO + 일괄 게이트웨이(`20261125160000`)로, 내보내기에 그룹별·파이프라인·재가져오기 열 복원 | D038·D056 |
| 크리에이터 상세 | 없는·미검증 프로필 noindex 메타데이터 | D083 |
| API | `fail()`이 throw로 바뀐 뒤 `try` 안 호출이 네트워크 catch에 삼켜지던 문제(TEST 취소, 보존 작업) | D068·D079 |
| E2E 픽스처 | 게시 동의 트랜잭션·제안 RPC 계약에 맞춤(`tests/support/local-db-fixture.ts`, safety·privacy-export), D041 사용권 필수, HOT 공개 참조 | — |

### 결과 (`ci-db-after.txt`, 빈 DB에서 `tests/ci-db.sh` 전체)
- 마이그레이션 127개 + migration_check PASS.
- E2E **84 통과 / 30 실패 / 4 건너뜀**. 수집 대비 **38건 해결, 새로 깨진 테스트 0건**.
- DB 권한 스위트 27종: 9 PASS(search, lists, lists-public-refs, notifications, uploads, consent, notes, ai-usage + D036/D052), 18 FAIL.
- lint·typecheck·build PASS, vitest 573/573(Windows `asset-provenance` 기존 결함 스위트 제외).

### 남은 실패 → 담당 티켓
| 실패 | 원인 | 티켓·결정 |
|---|---|---|
| claims | 공개 DTO에 소유·청구 상태 없음(수집 프로필도 `owner_registration`) + 관리자 청구 UI | D025 + DEV-A DTO 계약 |
| reports, similar(삭제 요청) | DEV-A D057이 신고 접수를 `review_submit`(issue)로 대체해 요청 유형·접수번호 흐름 단절 | D058 — D057 위에 요청 유형을 얹는 계약 필요(DEV-A와 합의) |
| selection-review, match-feedback | 내부 ID ↔ 공개 참조 읽기 게이트웨이 필요 | D061·D046(P1) |
| matching-policy | 폼 라벨 변경 + 캠페인 상세 "추천 정책" 표시 제거 | D044(DEV-A) |
| retention:26 | 개인정보 페이지가 운영자 승인 정책 문서를 렌더링 — 승인 외 보존 표 재삽입 안 함 | D079(D073·U001 대기) |
| service:20 | 카탈로그 "더 보기" 페이지네이션 제거 | D033(DEV-A) |
| profile-fields | 분야 다중 선택·tiktok 등 구 스펙(YouTube 전용 계약과 충돌) | D026 |
| billing-cancel, promotion, safety, service:88/255 | 취소 오류 문구 대응, HOT 슬롯 API, 차단 메시지 문구, 캠페인 저장·수락 흐름 | D068·D070·D062·D041/D049 |
| DB 스위트 18종 | 대부분 직접 게시 insert 등 낡은 픽스처 | 각 티켓에서 갱신 |
- `consent` E2E 1회 실패는 중단된 이전 실행이 공용 QA 계정 메일 설정을 꺼둔 상태 오염. 빈 DB 재실행에서는 PASS.
