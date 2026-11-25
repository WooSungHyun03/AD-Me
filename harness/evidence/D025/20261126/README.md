# D025 — 수집 프로필 소유권 청구 (2026-11-26, DEV-B)

환경: 격리 로컬 Supabase만. 운영 DB 적용·배포 없음.

## 재현
- `node tests/claims.mjs`: 수집(소유자 없는) 프로필에 `start_claim`을 호출하면 `versioned publication transaction required`(42501)로 거부됐다.
- 원인: D073 `adme_consent.publication_guard`의 "메타데이터만 바뀐 UPDATE" 예외가 `new.owner_id=old.owner_id`로 비교한다. 소유자가 NULL이면 비교 결과도 NULL이라 예외가 적용되지 않는다. 그 결과 공개된 수집 프로필의 `claim_status` 변경이 게시 트랜잭션 없는 공개 쓰기로 취급됐다. 수집 채널은 아무도 청구할 수 없었고, 관리자 승인(owner 부여)도 같은 이유로 막혔다.

## 변경
- `supabase/migrations/20261125220000_d025_claim_publication_guard.sql`(STOP 가드 포함 본문 치환):
  - `owner_id`를 `is not distinct from`으로 비교한다.
  - 감사 기록이 남는 관리자 청구 승인(`is_admin()`)은 첫 소유자를 붙일 수 있다. 단, 내용·공개 여부가 그대로이고 `claim_status='verified'`일 때만이다. 새 소유자의 이후 수정은 여전히 게시 트랜잭션을 거친다.
- `tests/claims.mjs`: 수집 프로필 픽스처는 owner SQL(`tests/support/owner-sql.mjs`)로 만든다. 관리자는 aal2 세션(`tests/support/admin-mfa.mjs`)을 쓴다.

## 결과
- `node tests/claims.mjs` PASS: 역할 게이트, 데모 청구 불가, 중복, 코드 해시 비공개, REST 소유권 변경 불가, 청구 전 제안 불가, 만료, 단일 승인, 감사.
- 빈 DB 전체 결과는 `harness/evidence/D085/20261126/README.md`에 있다.

## 남은 것
- claims E2E: 공개 DTO에 소유·청구 상태가 없다(DEV-A DTO 계약).
- 실제 채널 소유 증명: U014 외부 선행.

## 후속 (같은 날) — 수집 프로필 출처 표시와 청구 UI
### 재현
- 공개 DTO(`catalog_dto_legacy_ref`)가 데모가 아닌 모든 행을 `data_source='owner_registration'`으로 내보냈다. 수집 값인 견적(0/0)과 협업 가능 여부(false)도 그대로 전달했다.
- 그래서 소유자 없는 수집 채널이 "본인 등록"과 본인이 적은 견적으로 보였다. 거짓 출처 표시다.
- claims E2E는 프로필 화면에서 "미인증 · 협업 의사 미확인"을 찾지 못했다.
  - 서비스 키 게시 insert가 D073 가드에 거부됐는데 스펙은 그 오류를 확인하지 않았다.
  - 프로필 화면에 청구 버튼이 없었다.

### 변경
- `supabase/migrations/20261126110000_d025_collected_profile_provenance.sql`:
  - 소유자 없는 비데모 행은 `collected_unverified`로 내보내고, 견적과 협업 의사는 null(미확인)로 둔다. 소유자가 있는 행은 그대로다.
  - `start_claim`이 공개 참조를 해석한다.
- 앱:
  - zod enum(`public-profile`, `recommendation-snapshots`)에 `collected_unverified`를 추가했다. 마이그레이션과 같은 배포에 포함한다.
  - 프로필 상세는 "미인증 · 협업 의사 미확인"을 표시하고, "협업 캠페인 만들기"를 숨긴다.
  - 로그인한 사용자에게 "소유 확인 요청"(`ClaimButton`)을 보여 준다.
  - 추천 스냅샷에는 "수집 프로필 · 미인증"으로 표시한다.
- `tests/e2e/claims.spec.ts`:
  - 수집 프로필 픽스처를 owner SQL로 만든다.
  - 승인 후 문구는 현재 DEV-A 라벨("본인 등록 · 외부 검증 전")을 쓴다.
  - 상태 locator는 확인 코드 문구로 범위를 좁혔다.

### 결과
- `npx playwright test tests/e2e/claims.spec.ts`: desktop·mobile 2/2.
  - 미인증 라벨
  - 익명에게 청구·캠페인 버튼 없음
  - 코드 1회 표시와 중복 거부
  - 관리자 잘못된 코드 거부 → 올바른 코드로 승인
  - 본인 등록 표시
- `node tests/claims.mjs` PASS.
- vitest 586/586: DTO에 D025 케이스를 추가했다. Windows `asset-provenance` 기존 결함 스위트는 제외했다.

### 남은 것
- DEV-A 알림: 공개 DTO enum에 값 1개를 추가하는 변경이다. 소유 경계(D020/D075)는 바뀌지 않는다.
- 실제 채널 소유 증명은 U014, 운영 적용은 U004다.
