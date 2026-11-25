# D015 — 계정 설정·관심 분야·알림 동의 (2026-11-26, DEV-B)

이번 변경 없음. 수용 기준을 현재 main(`252dfdd`)의 빈 DB 전체 검증으로 확인했다(`harness/evidence/D085/20261126b/ci-db-final.txt`).

## 결과
- `tests/e2e/consent.spec.ts`: desktop·mobile PASS.
- `node tests/consent.mjs` PASS (같은 실행의 DB 스위트 27/27).
- 확인 범위: 마케팅 기본 미체크, 서비스·마케팅·관심 분야를 따로 저장하고 유지·철회 가능. REST consent: 변경 기록과 철회.

## 남은 것
- 실제 메일 발송 대상 확인은 U007(메일 공급자) 이후.
