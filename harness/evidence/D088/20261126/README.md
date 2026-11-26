# D088 — 익명 읽기 전용 출시 스모크 (2026-11-26, DEV-B)

## 구현 (배포와 독립인 부분)

- `src/lib/release-smoke.ts`: 판정 규칙 14개.
  - health가 `{status}`만 노출하는지 확인한다(D086 계약).
  - 공개 페이지 6개가 200이고 비밀 표지(service_role, sb_secret_, Toss 비밀키 접두어)가 없는지 확인한다.
  - 보안 헤더를 확인한다: CSP, nosniff, frame DENY, referrer policy, https에서는 HSTS.
  - robots.txt가 비공개 경로를 막고, sitemap에 비공개 경로가 없는지 확인한다.
  - `/dashboard`·`/admin`이 익명 방문자를 로그인으로 보내고(3xx 또는 스트리밍 리다이렉트) noindex인지 확인한다.
  - 익명 비공개 API가 401과 no-store로 응답하는지 확인한다.
- `scripts/release-smoke.mjs <URL> [--commit] [--deployment] [--out]`: 실행 CLI.
  - GET 요청만 보낸다. 로그인, 쿠키, 쓰기, 결제는 하지 않는다.
  - 커밋과 배포 ID는 공개 health가 노출하지 않으므로, 운영자가 알려 준 값으로만 기록한다.
- `tests/release-smoke.test.ts`: 7/7 PASS.

## 결과

| 대상                                    | 결과                            | 파일                    |
| --------------------------------------- | ------------------------------- | ----------------------- |
| 로컬 dev(main `ee4fd2e` 기반)           | 14/14 PASS                      | `local-anon-smoke.json` |
| https://be-celeb.org (운영, 익명 GET만) | **13/14**, `public:/terms` 실패 | `prod-anon-smoke.json`  |

- 운영의 `/terms`는 `307 → /about`이다.
  - 약관 페이지는 D073(`09ccc80`, 2026-11-21)에서 추가됐다.
  - 이 커밋은 마지막으로 기록된 운영 출시 PR #3(`14980c8`)에 포함되지 않았다.
  - 따라서 운영 배포가 현재 main보다 뒤처진 것으로 판단한다. main 코드의 결함은 아니다.
  - 운영 마이그레이션 적용(U004)과 새 배포(U005) 뒤 같은 스크립트로 다시 확인해야 한다.
- 나머지 13개는 운영에서도 통과했다: health 최소 노출, 보안 헤더와 HSTS, robots/sitemap, 관리자·대시보드 차단, 익명 API 401.

## 남은 게이트 (완료 표시하지 않음)

- 운영 적용·배포: U004, U005.
- 역할별 가입 → 추천 → 비교 → 제안 → 수락 → 대시보드 흐름과 모바일: 사용자가 배포한 정확한 commit/URL에서 확인해야 하며, 운영 계정 생성은 하지 않는다.
- Toss TEST: U006, U019.
- 출시 결정: U020.
