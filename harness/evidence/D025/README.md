# D025 — 미청구 프로필과 본인 프로필 청구 (2026-11-19)

상태: 구현·**격리 로컬 Supabase 검증 완료** / 운영 DB 미적용(마이그레이션 적용은 사용자 배포 단계). OAuth 소유 증명은 미구현(Google OAuth 앱 필요, 사용자 콘솔) — 현재는 일회성 코드 + 수동 검토.

## SQL — `supabase/migrations/202611190004_claims.sql`
- `creators.claim_status` (unclaimed/pending/verified/rejected/disputed), 운영 상태 `published`와 분리. 기존 owner 있는 행은 verified로 backfill.
- 트리거 `guard_creator_claim`: authenticated/anon은 owner_id·claim_status 변경 불가, 본인 등록 insert는 verified 강제.
- `creator_claims` (RLS: 본인/관리자 읽기, 쓰기 정책 없음, `code_hash` 컬럼 select 불가). 청구자·대상별 pending unique.
- `start_claim(creator)`: creator 역할만, 계정당 1프로필, 데모·이미 소유된 프로필 거부, 중복 거부, 동시 pending 3건 제한, 72시간 만료, 코드 1회 반환(DB엔 sha256만).
- `review_claim(claim, approve, code)`: 관리자만, 만료 시 expired 처리, 승인은 **채널에서 확인한 코드의 해시 일치** 필수, 소유 이전 1회, 경쟁 청구 자동 거절, audit_log 기록.
- `proposals_insert`: `claim_status='verified'` 조건 추가 → claim 전 제안/지원 불가.

## 앱
- `src/app/api/claims/route.ts` [신규] POST(청구)/PATCH(관리자 검토), RPC 오류 코드 → 한국어 메시지.
- `src/components/claim.tsx` [신규], `src/app/creators/[id]/page.tsx`(미인증·협업 의사 미확인 표식, 제안 버튼 숨김, 로그인 시 청구 버튼), `src/app/admin/page.tsx`(소유 확인 요청 큐), `src/lib/data.ts`(claim_status 조회).

## 검증 (로컬 Supabase, `supabase db reset`으로 0001~0004 처음부터 적용)
- `tests/claims.mjs` 직접 DB PASS: brand 청구 거부, 데모 청구 거부, 중복, code_hash 읽기 거부, 타인 청구 비노출, REST로 owner_id/claim 상태 변경 불가, 비관리자 승인 거부, 미청구 프로필 제안 거부, 만료 청구 승인 불가, 코드 누락·불일치 거부, 승인 1회·재승인 거부, 소유 후 재청구 거부, 소유자 claim_status 변경 거부, audit 3건.
- `tests/e2e/claims.spec.ts` desktop·mobile PASS: 미인증 표식·제안 버튼 없음 → 청구 코드 표시 → 중복 안내 → 관리자 잘못된 코드 거부 → 올바른 코드 승인 → 본인 연결 표식.
- 회귀: 전체 E2E 10/10(+claims 2), `tests/security.mjs` PASS, vitest 38/38, lint, typecheck, build, secret_scan PASS.

## 상대 담당 인터페이스
- 수집기(D018/D021)는 creators insert 시 owner_id null, `profile.is_demo=false` → 자동 unclaimed. owner_id를 직접 쓰지 말 것(트리거가 서비스 역할은 허용하지만 정책상 금지).
- D083: sitemap/OG는 claim_status·published 조건을 함께 사용.
