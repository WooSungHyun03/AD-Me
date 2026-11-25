# D054 — 결과물 버전·수정 요청·승인 (2026-11-26, DEV-B)

기준: main `252dfdd` 이후이며 결과물 코드 변경은 없다. 환경은 격리 로컬 Supabase만이다.

## 결과
- `node tests/local-delivery-security.mjs`(DEV-A 결과물 보안 스위트): **10/10 PASS** (`local-delivery-security.txt`).
  - 실행 방법: `output/dev-a-db/runtime.local.json`을 이 로컬 스택의 `supabase status -o json`으로 만들었다(`DB_CONTAINER=supabase_db_AD-Me`, gitignore 대상).
  - 익명·외부 접근과 역할 위조 거부
  - 같은 키 동시 업로드 12건 → 스냅샷 1개
  - 중복 수정 요청 → 검토 이벤트 1개, 수정본을 바꾸지 않고 재제출 불가
  - 새 버전이 활성화되면 구버전 승인으로 확정 불가
  - 승인에 근거와 광고 표시 확인 필수, 동시 재시도해도 확정 1회
  - 확정된 스냅샷·선언·이벤트 불변, 완료된 방에 새 업로드 불가
  - 레거시 원시 제출은 확인 없이 제출·승인 불가
  - 차단·운영 제한 대화에서 새 버전 변경 거부
  - 버전 커서 누락·중복 없음
  - 경계 재개방 불가
- `tests/e2e/service.spec.ts` 두 역할 golden path(제안 → 수락 → 제출 v1 → 검토 → 승인 → 완료): 빈 DB 2차 검증에서 desktop·mobile PASS (`harness/evidence/D085/20261126b/ci-db-final.txt`).
- `node tests/proposals.mjs` PASS: 지원 → 수락 → 버전 제출 → 수정 요청 → 새 버전 → 승인. 크리에이터 자기 승인은 거부된다.

## 미실행
- `tests/local-browser/deliverables.spec.ts`(playwright.local): 전체 프로덕션 빌드와 로컬 TLS 프록시 환경(`scripts/serve-local-qa.mjs`)이 필요해 이번에 돌리지 않았다. 같은 규칙은 위 DB 스위트와 golden path로 확인했다.

## 남은 것
- 운영 `delivery_transition` 적용(U004)은 운영자 게이트.
