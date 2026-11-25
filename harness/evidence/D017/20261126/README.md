# D017 — 플랫폼별 수집 허용 목록·데이터 계약 (2026-11-26, DEV-B)

격리 검증 기준: main 빈 DB 전체 검증(`harness/evidence/D085/20261126b/ci-db-final.txt`). 코드 변경 없음.

## 격리 검증 통과
- `src/lib/ingestion/policy.ts`(docs/data-sources/README.md의 실행본): 공급원별 목적·법적 근거·필드·약관 URL/버전·보존일·갱신주기·재배포 범위·검토자·상태·검토 만료
- `npx vitest run tests/ingestion-policy.test.ts tests/ingestion-jobs.test.ts` PASS: 미등록·대기·미검토·만료 공급원 차단(네트워크 호출 전), 승인 공급원만 허용, 허용 목록 밖 필드 제거, 모든 정책에 보존·목적·근거
- `tests/e2e/youtube-profile.spec.ts` 빈 DB 검증 PASS(격리 YouTube 픽스처, 공급자 성공 주장 없음)

## 남은 게이트
- YouTube 등 외부 공급원 정책이 U001 검토 대기(status pending, terms_version 미기록)라 실제 수집 허용 근거가 없다. 완료 표시하지 않는다.
