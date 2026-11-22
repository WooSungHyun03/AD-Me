# D038 — CSV 가져오기·내보내기 보강 (2026-11-22)

상태: 구현·검증 완료. DB 변경 없음(기존 `saved_lists`/`saved_list_items` RLS 사용).

범위: 후보 그룹 CSV를 내보내고 다시 가져오는 왕복.
- 크리에이터 프로필 대량 등록은 하지 않는다. 그건 D018(DEV-A) 수집 정책 게이트 대상이다.
- CSV 속 링크(URL)는 어떤 경우에도 가져오거나 수집하지 않는다.

## 구현
- `src/lib/csv.ts`
  - `parseCsv`: RFC 4180(따옴표, `""`, CRLF/LF, BOM). 닫히지 않은 따옴표는 오류로 처리한다.
  - `provenance`: DEMO / 본인 등록 / 미인증 수집 라벨과 근거.
  - `readImport` 파일 단위 검사: 100KB, 500행, 필수 열(ID·출처), UTF-8 깨짐(U+FFFD) 감지.
  - 행별 오류: ID 빈칸, **URL(수집하지 않음 안내)**, ID 형식(수식 `=HYPERLINK` 등 거부), 출처 빈칸, 파일 내 중복.
- `src/app/api/import/route.ts`
  - `POST {action: preview|commit, listId, csv}`. preview는 아무것도 쓰지 않는다. commit은 서버에서 같은 검증을 다시 한 뒤 **유효 행만** upsert(ignoreDuplicates)한다.
  - DB 대조: 공개 프로필만 받는다(free_beta에서는 데모 제외). **출처가 실제 출처와 다르면 오류**, 그룹에 이미 있으면 "이미 있음"으로 표시한다.
  - 다른 계정의 그룹은 RLS로 보이지 않아 404다.
  - `GET`: 템플릿 CSV.
- `src/app/api/export/route.ts`: 열은 `ID, 이름, 분야, 분위기, 최소견적, 출처, 출처 근거`. 고유 ID와 권한 근거를 담아 그대로 다시 가져올 수 있다. 수식 주입 방지(`'` 접두)는 기존 `csvCell` 그대로다.
- `src/components/lists.tsx` `ImportCsv`, `/lists`: 그룹마다 "CSV로 후보 가져오기" → 파일 선택 → 미리보기(행별 상태와 사유) → "확인 후 추가" → 부분 실패 결과를 안내한다.

## 검증
- `tests/csv-import.test.ts`(5개):
  - 한글·따옴표·쉼표·줄바꿈 왕복, 수식 5종(`= + - @ \t`) 무력화, CRLF/BOM, 닫히지 않은 따옴표.
  - 바이트·행 한도, 헤더 누락, 인코딩 깨짐.
  - 행별 오류(URL·수식·출처 누락·중복·빈 ID), 유효 행은 유지.
  - provenance 라벨.
- `tests/e2e/csv-import.spec.ts`(desktop+mobile):
  - 5행 중 1개 추가 가능·오류 4개 미리보기. 출처 불일치와 "수집하지 않음" 사유가 나온다.
  - 미리보기 후 새로고침해도 그룹은 비어 있다(쓰기 없음).
  - 확인하면 1명만 추가되고 "오류 4행은 추가하지 않았습니다"가 뜬다.
  - 내보내기 헤더에 ID·출처·출처 근거가 있고, 내보낸 파일을 다시 미리보면 `{ok:0, exists:1, error:0}`이다.
  - **다른 계정(creator)**: 이 그룹에 import commit하면 404, export는 헤더만 받는다. 잘못된 파일은 422다.
- 전체 회귀: E2E 54/54, DB 테스트 16개, 복원 모의 PASS. vitest 104, lint/typecheck/build 0 오류, secret_scan --all PASS.
- 스크린샷: `import-preview-{desktop,mobile}.png`. 처음엔 모바일 표가 좁아 사유가 읽히지 않아서 목록형으로 바꾸고 재촬영했다.
