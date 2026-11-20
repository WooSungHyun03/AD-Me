# D008 기능 공개 플래그

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- 서버 설정에서 메일 발송과 TEST 결제를 제어하고, 화면에서도 같은 상태를 소비한다. 수집·LLM은 공급자 인계 전까지 비활성이다.
- Supabase Edge Function 직접 호출에도 별도 설정 가드를 적용한다. DB 주문 RPC와 데이터 환경 분리는 D001과 연동해야 한다.
- 기본 OFF, 오입력, 직접 API/함수 경계와 데스크톱·모바일 상태를 검증한다.
- Vitest에서 직접 앱 API 핸들러와 Edge 설정 함수 테스트가 통과했다. Chrome 정적 렌더링 1440px·390px에서 무료·메일 비활성 상태를 확인했다. [공통 검증 결과](../DEV-A-LOCAL/verification.json)

## 2026-11-20 main adapter compatibility
- main's implemented queue adapters now resolve flag-on+valid DB config as enabled (queue capability, not worker/provider health). Flag-off denies direct new-work API requests and shows paused forms. Existing draft result, consent withdrawal and unlink remain accessible.
- D076 adds independent DB default-off resource controls and worker lease/enqueue gates. Merely setting app flags cannot enable provider work. No hosted values or keys changed.
- Feature tests verify default/off/missing config; integrated API unit checks direct404 while off. Local production browser fixtures deliberately opt in both controls; real supplier verification is still separate. USER chooses release and activation.
