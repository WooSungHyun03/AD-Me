# ChatGPT Desktop 재개 프롬프트

이 프로젝트는 AD Me 개발용 하네스를 사용하고 있다. 현재 열린 프로젝트 루트의 `AGENTS.md`, `README.md`, `docs/HARNESS.md`, `harness/tasks.json`, `harness/session_log.md`를 순서대로 읽어라. 현재 파일/DB/실행 가능 상태를 실제로 조사하고, 앞선 세션의 성과를 추측하지 마라. `python3 harness/selftest.py`, `python3 harness/loop.py status`, `git status --short`를 실행하라. 이미 `in_progress`인 작업이 있으면 해당 작업을 먼저 테스트·수리하고, 없으면 `python3 harness/loop.py next`로 다음 P0 작업을 고른다.

이후 코드 작성 → unit/lint/types/E2E/build 확인 → 보안·UI 비판 → 수정 → 증거 기록 → 작업 완료 표시를 반복한다. **일반 채팅 설명만 하는 대신 실제 로컬 파일을 편집**하라. 테스트하지 않은 사항은 완료로 보고하지 않는다. 사용자가 명시적으로 실제 배포를 요청했으므로 Vercel + Supabase에 에이전트가 직접 배포하고 URL을 검증하라. Toss 테스트키만 사용하고 신규 유료 과금 또는 실제 결제는 하지 않는다. OAuth 및 비밀키 입력 등 사용자만 할 수 있는 조치만 요청하라. 세션이 종료될 때 `harness/session_log.md`에 재개 정보를 반드시 적는다.
