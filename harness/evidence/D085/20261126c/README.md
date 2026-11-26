# D085 — Windows 로컬 검증 호환 (2026-11-26, DEV-B)

## restore_drill
- 문제: `harness/restore_drill.mjs`가 `execFileSync("npx", …)`를 호출하는데, Windows에는 `npx.cmd`만 있어 `ENOENT`로 실패했다.
  - 그래서 `tests/ci-db.sh`를 로컬 Windows에서 끝까지 돌릴 수 없었다.
  - GitHub Actions(Linux)에는 영향이 없었다.
- 수정: Windows에서는 Node에 포함된 npm의 `npx-cli.js`를 현재 `node`로 직접 실행한다.
  - 셸을 거치지 않으므로 공백이 들어간 경로도 한 인자로 유지된다.
  - Linux는 기존 `npx` 그대로다.
  - `ADME_RESTORE_CLI` 지정 시 동작도 그대로다.
- 확인(같은 호출 방식):
  - 기존 `execFileSync("npx", ["--version"])`: `ENOENT`
  - 새 방식 `… npx-cli.js --yes supabase@2.122.1 --version`: `2.122.1`
- 전체 복구 드릴은 로컬 DB를 리셋하므로 이번에는 실행하지 않았다. 다음 빈 DB 전체 검증 때 함께 확인한다.

## asset-provenance 단위 테스트 (D007 테스트, 이식성 수정만)
- 문제: `new URL("..", import.meta.url).pathname`이 Windows에서 `/C:/…`가 되어 `C:\C:\…` 경로 오류가 났다.
  - 그래서 Windows에서는 테스트 파일 자체가 로드되지 않았다.
- 수정:
  - 경로는 `fileURLToPath`로 구한다.
  - 상대 경로 구분자를 `/`로 바꿔 인벤토리와 비교한다.
  - 검사 규칙 자체는 바꾸지 않았다.
- 확인: `npx vitest run tests/asset-provenance.test.ts` 2/2 PASS (수정 전에는 Windows에서 로드 실패).
