# D009 — 현재 소스 가입 회귀와 외부 SMTP gate

상태 BLOCKED_EXTERNAL 유지. 새 account access gate/전역 RLS를 포함한 전체64 browser 회귀에서 desktop/mobile 신규 가입·local Mailpit 수신·인증/재발송·GET 비소비·증표 재사용 거부가 통과했다. free/keyless mail-disabled 동작도 검증했다. 외부 SMTP/실제 신규 외부 이메일 수신을 실행하지 않았으며 local sink를 외부 provider 성공으로 보고하지 않는다.

남음은 이번 source/USER 적용 대상의 U007/U008 외부 SMTP·발신/리다이렉트 설정과 실제 가입 E2E다. 외부 콘솔/키·메일 발송을 대신 수행하거나 사용자에게 터미널/소스 수정을 요구하지 않았다. [검증](../DEV-A-P0-ALL-20261121/verification.json) · [커밋](../DEV-A-P0-ALL-20261121/commits.json).
