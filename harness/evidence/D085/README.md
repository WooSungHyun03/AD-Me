# D085 — CI·배포 산출물·마이그레이션 안전 (2026-11-22)

상태: 로컬 검증 완료. **GitHub Actions 실제 실행 안 됨**(push는 사용자 승인 필요). **호스트 DB 적용·배포 안 됨**(사용자 체크리스트로 인계).

## 변경
- `docs/handoff/RELEASE_MANIFEST.md`(신규):
  - 환경별 상태를 분리 기록했다(로컬 격리 DB 0001–0015 PASS / 호스트 DB 0001–0003만 / 운영 URL 신기능 미검증).
  - 15개 마이그레이션 각각에 단계(expand·backfill·switch·contract), 구버전 앱 영향, 롤백 또는 forward fix를 적었다.
  - 환경변수와 설정 위치 목록, 사용자 배포 체크리스트 8단계.
  - contract: 0008(saved_creators drop), 0011(`review_report(uuid,text)` 시그니처 제거). DB 적용 직후 앱을 바로 배포해야 한다.
- `harness/migration_check.py`(신규):
  - 정적 검사: 이름·순서·중복, 새 테이블 RLS, SECURITY DEFINER의 search_path 고정, 파괴적 SQL(drop table/column, type 변경, rename, truncate)은 manifest가 contract로 표시한 파일에서만, manifest와 파일 1:1(drift 방지).
  - `--rollback-sim`(로컬 격리 DB만): N-1로 reset한 뒤 마지막 마이그레이션을 확인한다.
    - `begin…rollback` 후 스키마 해시가 동일하다.
    - 실패를 주입(`select 1/0`)하면 부분 변경이 남지 않는다.
    - 그 다음 실제로 적용한다.
- `harness/migration_check_test.py`: 규칙 위반 5종 탐지와 저장소 PASS(unittest 6건).
- `.github/workflows/ci.yml`: **검증 전용, 배포 workflow 없음**.
  - checks: 이력 비밀 스캔, 마이그레이션 검사와 테스트, lint/typecheck/test/build, 번들 비밀 스캔.
  - migrations: 일회용 로컬 Supabase에 처음부터 적용하고 `tests/ci-db.sh`로 E2E와 DB 권한 테스트. 끝나면 artifacts 비밀 스캔. 저장소 secret은 쓰지 않는다.
- `tests/ci-db.sh`(신규): reset, migration_check, QA 계정, 관리자, E2E, DB 테스트 13종. 로컬 Supabase URL이 아니면 거부한다.
- `tests/provision-admin.mjs`(신규): 기존 scratchpad 스크립트를 저장소로 옮겼다. 관리자 승격은 DB owner(psql)로만 한다.
- `package.json` `typecheck`: `next typegen && tsc --noEmit`.
  - **CI에서 실제로 깨질 버그를 수정**했다: 깨끗한 checkout에서는 `.next/types`가 없어 `RouteContext` TS2304 오류가 2건 났다. 재현 후 해결.
- `tests/secret-scan.test.ts`: `.env.local`이 없는 CI에서도 동작한다.
- `docs/DEPLOYMENT.md`: manifest 참조와 호스트 DB 상태 한 줄.
- `vercel.json`: 변경 없음. 자동 배포나 cron을 추가하지 않았다.

## 검증 (로컬)
- `python3 harness/migration_check.py` PASS(15개). `migration_check_test.py` 6/6.
- `--rollback-sim` PASS: 0015에서 rollback 후 해시 `e5c14d61` 동일, 실패 주입 시 부분 변경 없음, 적용 후 `dd481d45`.
  - 이어서 CLI 전체 `db reset` 결과도 `dd481d45`로 같다. 수동 적용과 CLI 적용의 스키마가 동일하다.
- **CI checks 모의**: `.env.local`과 계정 파일이 없는 깨끗한 복사본에서 secret_scan `--history`, selftest, migration_check와 그 테스트, vitest 80/80, lint, typecheck(수정 후) PASS.
  - build는 복사본의 symlink node_modules 때문에 Turbopack이 거부했다. 본 저장소 build PASS.
- **CI migrations 모의**: `bash tests/ci-db.sh` 로컬 실행 exit 0. 0001–0015 처음부터 적용, E2E 44/44, DB 테스트 13종 모두 PASS.
- `secret_scan.py --all` PASS.

## 미검증·사용자 작업
- GitHub에서 workflow 실제 실행: push 후 Actions 결과 확인 필요(사용자 승인).
  - Node 24, `supabase start`, Playwright 설치 시간은 GitHub 러너에서 처음 확인하게 된다.
- 호스트 DB `supabase db push`(0004–0015)와 Vercel 배포: manifest 체크리스트 1–8 → D088.
