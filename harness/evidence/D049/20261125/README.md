# D049 — 새 크리에이터 수락 불가(소유자 등록 미검증) 수정 (2026-11-25, DEV-B)

Base: origin/main `e152d15`. 격리 로컬만. 운영 적용은 U004.

## 재현
- 빈 DB에서 `service.spec.ts`의 두 역할 golden path와 공개 지원 테스트가 실패했다. 수락 시 "크리에이터 프로필이 비공개이거나 본인 확인이 해제되어…"(`creator_unavailable`)가 떴다(`../../D085/20261125/ci-db-final.txt`).
- 원인:
  - `guard_creator_claim`은 소유자 본인 등록(INSERT)을 `verified`로 표시하는데, `current_user`가 `authenticated`일 때만 동작했다.
  - D073 이후 프로필은 SECURITY DEFINER `save_publication`으로 저장되므로, 새 크리에이터는 `unclaimed`로 남았다.
  - D049 수락 자격(`claim_status='verified'`)에서 거부됐다.
  - 로컬 DB에 주인이 있는데 `unclaimed`인 행이 11개 있었다.

## 변경
- 마이그레이션 `20261125190000_d049_owner_registration_claim.sql`(switch/backfill):
  - 로그인한 소유자 본인의 INSERT는 정의자 경로에서도 `verified`로 표시한다.
  - UPDATE 규칙은 그대로라 관리자 청구 심사 RPC에 영향이 없다.
  - 주인이 있는 `unclaimed` 행을 `verified`로 보정한다. 수집 프로필은 청구 승인 전까지 주인이 없으므로 이 상태는 이 결함으로만 생긴다.
- `tests/profile-fields.mjs`: `save_publication` 등록 직후 `verified` 검증을 추가했다.
- `service.spec.ts`:
  - 즐겨찾기 대상은 방금 공개한 프로필 이름으로 검색한다.
  - 관리자 콘솔 진입에 TOTP(aal2) 인증을 추가했다(D016/D060 계약).

## 결과
- `service.spec.ts` 전체 desktop+mobile **6/6 PASS** (`service-e2e.txt`): 공개 탐색·필터·비교, 두 역할 golden path(제안 → 수락 → 버전형 결과물 → 승인 → 완료, 결제 검증, 권한 거부), 공개 지원 → 수락, 즐겨찾기 유지·CSV, 계정 설정, 관리자 운영 패널, 로그아웃.
- `tests/profile-fields.mjs` PASS, `migration_check` 130 PASS.
