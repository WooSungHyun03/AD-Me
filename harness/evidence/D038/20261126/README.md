# D038 — CSV 가져오기·내보내기 보강 (2026-11-26, DEV-B)

이번 코드 변경은 없다. 2026-11-25 공개 DTO와 일괄 게이트웨이(`20261125160000`) 이후의 수용 확인이다.

## 결과
- `npx vitest run tests/csv-import.test.ts`: 5/5.
  - 한글·따옴표·쉼표·줄바꿈 왕복
  - 내보내기 수식 무력화
  - 닫히지 않은 따옴표 거부, CRLF·BOM 처리
  - 파일 단위 제한(바이트·행·헤더·인코딩)
  - 행별 오류(URL을 즉시 수집하지 않음, 수식, 출처 누락, 중복)와 정상 행 유지
  - 출처 라벨이 내보내기와 같음
- `tests/e2e/csv-import.spec.ts`: 빈 DB 2차 검증(`harness/evidence/D085/20261126b/ci-db-final.txt`)에서 desktop·mobile PASS.
  - 미리보기(쓰기 없음) → 확인(정상 행만 반영)
  - ID와 출처가 포함된 내보내기 왕복
  - 다른 계정 목록은 가져오기·내보내기 모두 차단
- `node tests/lists-public-refs.mjs` PASS: 일괄 가져오기 전체 성공 또는 전체 실패, 할당량.

## 한계
- 템플릿 다운로드(`GET /api/import`, `adme-import-template.csv`)는 라우트가 있지만 이를 직접 검증하는 테스트는 없다.

## 남은 것
- 운영 마이그레이션 적용(U004).
