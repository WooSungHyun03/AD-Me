# D010 운영자 검토 인계

- 신규 SQL/키/환경변수 없음. 코드·실제 로컬 Auth/Mailpit 검증만 완료했다. U007/U008 운영 인증·메일 수용은 별도 승인이다.
- 준비된 `supabase/templates/email_change.html`을 기존 이메일 변경 템플릿으로 검토·적용한다. 기존 confirmation/recovery 템플릿은 변경하지 않았다. secure email change의 기존·새 주소 양쪽 확인을 유지하고, SiteURL과 앱의 NEXT_PUBLIC_APP_URL 및 정확한 /auth/confirm 허용 경로를 대조한다. 설정은 이 세션에서 운영에 적용하지 않았다.
- 승인 후 실제 참가자가 설정→메일 변경→두 주소 확인→기존 주소 로그인 거부·새 주소 로그인 성공을 검증한다. 기존 세션의 로그인 시각과 다른 기기 로그인은 별개이며 앱은 검증된 현재 AMR만 인정한다. 직접 Auth API를 같은 앱 정책으로 제어한다고 해석하지 않는다.
- 실패 시 이전 앱 배포로 복귀하고 메일 변경 진입을 닫는다. 기존 사용자·주소·메일 증표를 수동 SQL로 변경하지 않는다. 완료되지 않은 요청은 기존 주소 상태를 확인하고 새 요청으로 재시도한다.
- 증빙: `harness/evidence/D010/EMAIL_SESSION_20261124.md`, 같은 디렉터리 verification 및 마스킹된 desktop/mobile 캡처. 기존 SQL119/릴리스 패킷은 수정하지 않았다.
