# D062 — 차단·연락 제한 우회 차단 (2026-11-25, DEV-B)

Base: origin/main `802b31f`. 환경: 격리 로컬 Supabase만. 운영 DB 미적용.

## 재현 (보안 결함)
- 연락 제한·차단 트리거 `public.guard_contact`는 `current_user`가 `authenticated`/`anon`일 때만 동작했다.
- 현재 채팅(`conversation_send` → `adme_messaging.send`)과 제안(`create_creator_proposal`)은 SECURITY DEFINER로 함수 소유자 권한에서 insert한다. 그래서 트리거가 아무 검사 없이 통과했다.
- `tests/contact-guard.mjs` 최초 실행 결과: 관리자 연락 제한이 걸린 사용자의 `conversation_send`가 **성공**했다 → FAIL.
- 차단 시 화면 메시지: 제안이 거절 상태가 되면서 마켓 가드가 먼저 일반 오류를 냈고, API는 "메시지를 저장하지 못했습니다."만 반환했다(E2E `safety.spec.ts` 137행 FAIL).

## 변경 (최소 호환)
- 마이그레이션 `20261125180000_d062_contact_guard_definer_paths.sql`(switch):
  - `auth.uid()`가 있는 정의자 경로에서도 `contact_denied`(차단·연락 제한)를 강제한다.
  - 직접 REST 경로의 `contact_check`(발송량 한도 포함)는 그대로다. 소유자 SQL·서비스 작업(`auth.uid()` 없음)은 영향이 없다.
  - 가드 트리거를 `a00_guard_contact`로 바꿔 다른 BEFORE 트리거보다 먼저 실행한다.
  - 원래 번호 `20261125170000`이 DEV-A D055와 겹쳐 push 전에 `180000`으로 옮겼다.
- `/api/messages`, `/api/proposals`: DB 사유가 `blocked`/`contact_restricted`이면 공용 문구(`recruitingErrors`, 누가 차단했는지 드러나지 않음)로 403을 반환한다.
- 새 REST 스위트 `tests/contact-guard.mjs`(`tests/ci-db.sh` 등록).

## 결과
| 명령 | 결과 |
|---|---|
| `node tests/contact-guard.mjs` | PASS 6: 기준 허용, 제한 중 `conversation_send` 거부, 해제 후 허용, 차단당한 쪽·차단한 쪽 모두 메시지 거부, 차단 상태 새 제안 RPC 거부 |
| `safety.spec.ts` "block from collaboration" desktop+mobile | 2/2 PASS (`e2e-block.txt`) |
| typecheck·lint | PASS |

## 남은 것
- `safety.spec.ts` "admin temporary restriction…"은 관리자 신고 패널(`admin-report`)에 의존한다. DEV-A D057 큐로 바뀐 신고 흐름과의 D058 계약이 필요하다.
- `tests/safety.mjs`(직접 insert 기반 488줄)는 RPC 계약으로 재작성해야 한다.
- 운영 적용은 U004.
