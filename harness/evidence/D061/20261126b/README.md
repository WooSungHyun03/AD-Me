# D061 — 선정 검토 E2E fixture 자립화 (2026-11-26, DEV-B)

## 배경
- DEV-A D084 분석(`harness/evidence/D084/DEVB_CI_ROOTCAUSE_20261126.md` §3)의 권고를 따랐다.
- `selection-review.spec.ts`를 단독으로 돌리면 `creators.owner_id = accounts.creator.id` 행이 없어 실패했다. 앞선 spec이 만든 행에 의존하는 순서 의존성이었다.

## 변경 (테스트만)
- QA 크리에이터의 프로필 행이 있으면 그대로 재사용한다. 기존처럼 공개 여부를 바꿨다가 원래대로 되돌린다.
- 행이 없으면 owner SQL로 프로필 행을 직접 만든다.
  - id는 `qa-sel-review-<ts>`, 소유자는 QA 크리에이터다.
  - `claim_status='verified'`, `is_demo=false`로 만든다. `guard_proposal_acceptance` 조건을 충족해야 하기 때문이다.
  - 프로필은 `creator-001` 내용을 복사한다.
- 직접 만든 행은 끝날 때 제안과 함께 삭제한다.
- 앱 코드, 마이그레이션, 보안 조건은 바꾸지 않았다.

## 결과 (로컬 Supabase, 소스 7ef3673 + 이 변경)
- 행이 없는 상태로 만들어 단독 실행(desktop): PASS. 실행 후 fixture 행은 남지 않았다.
  - 중간 실패 2회는 fixture 조건 문제였고 수정했다: id 중복, 본인 확인 미충족.
- 기존 행 재사용 경로: desktop·mobile 2/2 PASS. 원래 비공개 상태로 복원됐다.
- eslint·prettier·tsc 통과.
