# D088 — 사용자 배포 후 출시 승인 검증 (BLOCKED, 2026-11-22)

상태: **BLOCKED**. 선행인 U004/U005/U006/U019(사용자 배포·키·DB push)가 아직 없다.
경계에 따라 기존 배포를 새 기능 검증 결과로 재사용하지 않는다.

배포 후 할 일(에이전트):
1. 공개 URL에서 `/api/health` 200을 확인한다.
2. `tests/e2e/service.spec.ts` 공개 URL 스모크를 돌린다.
3. 가벼운 부하로 p95를 재측정한다(D087 기준과 비교).
4. 보안 헤더와 CSP를 확인한다.
5. `secret_scan --bundle`을 돌린다.
6. 결과를 U020에 기록한다.

사용자 체크리스트: `docs/handoff/RELEASE_MANIFEST.md` 8단계.
