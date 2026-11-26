# D024 — 실제 데이터 파일럿 품질 게이트 (2026-11-26, DEV-B)

## 구현 (U014와 독립인 부분)

- 마이그레이션 `20261126130000_d024_pilot_quality_samples.sql`: 서비스 롤 전용 `public.pilot_quality_samples()`.
  - 읽기 전용이고 테이블 변경은 없다.
  - 표본마다 불투명 참조, 제목 해시, 필드 유무, 최신성, 정책, 소유자 확인, 툼스톤 여부를 돌려준다.
- `src/lib/pilot-quality.ts`: 순수 판정 함수.
  - 가상 데이터는 제외한다.
  - 수집 허용 근거, 최신성, 결측, 중복, 삭제 대응을 판정한다.
  - 통과 수가 최소치 50 이상일 때만 MET이다.
- `scripts/pilot-quality-report.mjs`: 운영자가 실행하는 CLI. 집계 보고서를 쓰고 원문은 남기지 않는다.
- `docs/evidence/data-pilot/README.md`: 실행 방법과 판정 기준.

## 검증 (로컬 격리 DB, 소스 597783f + 이 변경)

- `npx vitest run tests/pilot-quality.test.ts`: 5/5 PASS.
  - 가상 데이터는 세지 않는다.
  - 미승인 공급원에서는 소유자만 근거로 인정한다.
  - 문제 유형별로 판정한다.
  - 49건 통과는 NOT_MET, 50건 통과는 MET이다.
  - 표본 출력에 제목 해시가 나가지 않는다.
- `node tests/pilot-quality.mjs`: 4/4 PASS. `tests/ci-db.sh`에도 추가했다.
  - anon, brand, 비밀번호만으로 로그인한 admin은 거부된다.
  - 서비스 롤 응답에 원문 채널 ID와 제목이 없다.
  - 중복 제목, 결측, 삭제 후 남은 행을 검출한다.
- CLI를 로컬에서 실행했다(`docs/evidence/data-pilot/local-isolated-20261126.json`).
  - 저장 10건이 모두 가상 데이터다. 후보 0, NOT_MET, exit 3.
  - 미확보 수량을 성공으로 처리하지 않는다.
- `migration_check` PASS(139), tsc, eslint, prettier 통과.
- 전체 vitest: 591/591 테스트 통과.
  - 다만 `asset-provenance.test.ts` 파일은 Windows에서 `C:\C:\` 경로 오류로 로드되지 않는다. 기존 문제이고 이번 변경과 무관하다.

## 남은 게이트

- U014: 실제 참가자와 동의 확보.
- U001: YouTube 공급원 승인.
- U004: 운영 DB에 `20261126130000` 적용.
- 그 뒤 운영자가 CLI로 실제 수량과 실패율을 기록해야 한다. 그 전에는 완료로 표시하지 않는다.
