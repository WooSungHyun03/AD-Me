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
