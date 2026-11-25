# D079 — 데이터 보존·삭제·복구 정책 실행 (2026-11-26, DEV-B)

빈 DB 전체 검증(`harness/evidence/D085/20261126b/ci-db-final.txt`, main `252dfdd`) 기준이다.

## 통과
- `node tests/retention.mjs` PASS:
  - 삭제 경로 3가지에 툼스톤 기록(ID·해시만)
  - 복원 모의 후 원장 재적용
  - 재시도 멱등
  - 본인 재등록 유지
  - 보존 작업과 실행 기록
  - 사용자 접근 거부
- `tests/e2e/retention.spec.ts` "retention controls"(desktop·mobile): 비관리자는 실행·스냅샷·재적용이 403이고, 관리자는 작업 실행과 재적용이 된다.

## 실패 (정책 결정 대기)
- `retention.spec.ts` "privacy notice lists retention periods"(desktop·mobile): `/privacy`에 `retention-table`("종료 후 3년" 등)이 없다.
- 현재 개인정보 페이지는 운영자가 승인한 정책 문서(`src/lib/policy-document.json`, D073)의 `retention` 문구만 렌더링한다. 승인되지 않은 보존 기간 표를 코드로 다시 넣으면 확정되지 않은 법적 고지를 사실처럼 표시하게 되어 재삽입하지 않았다.
- 필요한 것: 운영자(U001)가 보존 기간을 확정하고 정책 문서 버전을 새로 승인하는 것. 승인되면 표를 정책 문서에서 렌더링하고 스펙의 기대 문구를 승인본에 맞춘다.
