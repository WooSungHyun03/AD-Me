# D059 — 소유자 공개 선택과 운영 잠금

DEV-A · 2026-11-19 KST · root HEAD 4437eb1 / codex/dev-a-p0-continue (미커밋)

SQL 005에서 creator/campaign moderation_status를 publication과 분리했다. 공개 조회·제안 INSERT·HOT에 잠금을 반영하고 직접 REST 변경과 삭제/재등록 우회를 트리거로 거부한다. 운영자도 사유와 최근 MFA가 있는 RPC로만 잠금을 바꾸며 변경 이력은 append-only다. 잠금 해제는 소유자 비공개를 유지한다. 구형 사유 없는 RPC는 변경을 거부한다.

API 사유·권한, creator/campaign 직접 REST 재공개/삭제/잠금 해제/제안 우회, 해제 후 비공개 유지, 두 뷰포트 실제 UI를 실행했다. [공통 결과](../DEV-A-P0-CONTINUE/verification.json), [creator 검사](../DEV-A-P0-CONTINUE/local-security.json), [campaign 검사](../DEV-A-P0-CONTINUE/local-brand-security.json).

**LOCAL_VERIFIED**: D016 외부 적용·교차 리뷰·실제 URL 검증이 남았다. 계정 전체 정지·대량 사칭 탐지 등 D062/D014 범위까지 완료했다고 주장하지 않는다.
