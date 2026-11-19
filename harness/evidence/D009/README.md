# D009 이메일 가입 완주

후속: 실제 격리 로컬 Auth와 Mailpit에서 신규 가입·인증 전 로그인 거부·재발송·GET 미소비·인증·실제 증표 재사용 거부를 desktop/mobile로 확인했다. 외부 SMTP 수신·이 소스 배포 검증은 여전히 필요하며 BLOCKED_EXTERNAL을 유지한다. [현재 원장](../DEV-A-P0-CONTINUE/verification.json).

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- U007의 이전 SMTP 증거와 U008의 부분 상태를 유지한다. 이번 버전의 외부 수신·재발송·인증은 승인된 격리 프로젝트에서 별도로 검증해야 한다.
- 기존 한국어 템플릿의 `/auth/confirm?token_hash=…&type=email` 흐름에 맞춰 가입·재발송을 연결한다. 기존 callback 주소는 오류 안내로 연결하고 migration은 추가하지 않는다.
- 중복 응답, 리다이렉트, 메일 기능 차단, 증표 만료 및 재사용 실패를 로컬에서 확인한다.
- 가입·재발송 모의 SDK 계약과 기존 복구 회귀가 통과했다. Chrome 정적 렌더링으로 가입·재발송·복구 상태를 확인했다. 실제 새 이메일·만료 토큰·재사용은 U008 격리 환경에서 필요하다. [공통 검증 결과](../DEV-A-LOCAL/verification.json)
