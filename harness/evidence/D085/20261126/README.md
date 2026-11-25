# D085 — 빈 DB 전체 재검증 (2026-11-26, DEV-B)

기준: origin/main `0413c92`(D025·D062·D058·D032 반영 후). 명령은 `tests/ci-db.sh`(CI `migrations` job과 동일)이고, 로그는 `ci-db-final.txt`다. 환경은 격리 로컬 Supabase만이다.

## 결과
| 항목 | 2026-11-25 (`e152d15`) | 2026-11-26 |
|---|---|---|
| 마이그레이션 + migration_check | 129 PASS | **136 PASS** |
| E2E (desktop+mobile 118건) | 96 통과 / 18 실패 / 4 건너뜀 | **106 통과 / 8 실패 / 4 건너뜀** |
| DB 권한 스위트 | 11/27 | **27/27 PASS** |
| restore_drill | — | Windows에서 `spawnSync npx` ENOENT(npx.cmd 해석 문제, 로컬 환경 한정). Linux CI에서 확인 필요 |

## 이번에 해결
- 낡은 DB 스위트 16종을 현재 계약으로 갱신했다.
  - 게시: `save_publication`과 owner SQL 픽스처
  - 제안: `create_creator_proposal`
  - 결과물: 버전형 delivery RPC
  - 관리자: aal2 TOTP 세션
  - 공개 가시성: `creator_public_one`
- 이 과정에서 제품 결함 2건을 고쳤다.
  - D025: 소유자 NULL 비교 때문에 게시 가드가 수집 프로필 청구를 막았다(`20261125220000`).
  - D062: 정의자 RPC 경로에 스팸 한도가 없었다(`20261125230000`).
- D058 요청 유형·내 요청 흐름과 D032 유사 프로필을 구현했다. reports·similar·safety 관리자 제한 E2E가 통과한다.

## 남은 E2E 실패 (desktop·mobile 각 1건씩)
| 스펙 | 원인 | 티켓 |
|---|---|---|
| claims | 공개 DTO에 소유·청구 상태 표시와 관리자 청구 UI가 없다 | D025 + DEV-A DTO 계약 |
| selection-review | merge 후 캠페인 상세에서 선정 검토 블록이 빠졌다. 공개 참조 기반 읽기·쓰기 게이트웨이가 필요하다 | D061(P1) |
| match-feedback | 같은 이유로 추천 평가 폼이 빠졌다. `matching_feedback`은 내부 ID 기준이다 | D046(P1) |
| retention | 개인정보 페이지가 운영자 승인 정책 문서만 렌더링한다. 보존 표는 승인 전에 재삽입하지 않는다 | D079(D073·U001 대기) |

## 남은 게이트
- 운영 적용(U004)·지문 등록·배포(U005)는 운영자 게이트다. 운영 원장 `20261123100029` 이후의 pending 패킷은 `docs/handoff/RELEASE_MANIFEST.md`에 있다.
- D085 완료 조건인 CI `migrations` job 통과는 위 4개 스펙에 달려 있다 → **IN_PROGRESS** 유지.
