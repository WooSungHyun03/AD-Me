# D014 — 실제 재인증·접수·접근 제한·파일 격리

기존 순수 계약에서 실제 런타임으로 확장했다. 상태 IN_PROGRESS 유지. 비밀번호와 등록 TOTP 재인증, private receipt hash/요청·lease/checkpoint, DataAPI hook+public/Storage restrictive RLS·쓰기 guard, Auth ban 검증, 검증된 private 파일 copy→원래 경로 제거·재시도를 구현했다. 소유 수집 lease는 접수 시 취소한다. 온라인 intake는 기본 OFF다.

실제 local GoTrue/PostgREST/Postgres/Storage에서 stale JWT의 직접 DB/RPC/파일 거부, 실제 signed 원본 경로 제거, 보관 bytes 일치·비공개, 재유입 거부, copy/remove 중단 후 재개·expired lease 거부·미확인 파일의 검토 대기와 intake OFF를 검사했다. 신규 실제 DB tests3개와 두-role desktop/mobile4개(MFA 포함), 공통 보안127그룹/브라우저64개에 연결했다. 가상 계정/파일/정책만 사용했고 checkpoint 응답 실패 주입은 실제 서비스 장애 성공으로 보고하지 않는다.

**영구 파기·Auth 삭제·D079 보존/shared 기록/backup replay 및 주기 worker·receipt 분실 복구는 미구현이다.** 새 런타임은 요청·격리 후 waiting_retention/review로 멈춘다. AuthRestricted는 ban을 확인한 값이며 모든 session row 파기/모든 JWT 즉시 만료가 아니다. 이미 캐시/다운로드된 사본·호스팅 CDN까지 즉시 회수했다는 증거도 아니다.

058 후속 수정이 섞인 것을 발견해 적용 ledger와 일치하는 원본으로 복구했고 권한 수정은059, 소유 작업 취소는060 forward fix로 분리했다. 최종 packet-integrity에서58~60 실제 적용 source를 대조한다. [운영 범위](../../../docs/operations/account-deletion-runtime.md) · [최종 검증](../DEV-A-P0-ALL-20261121/verification.json) · [티켓 커밋](../DEV-A-P0-ALL-20261121/commits.json).
