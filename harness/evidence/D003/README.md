# D003 환경 설정 검증

후속: 정확한 잠금 의존성·Node 22 계약·운영 빌드·실제 로컬 DB E2E로 이전 캐시/빌드 차단을 해소했다. 외부 키 조회/등록 없음. [현재 원장](../DEV-A-P0-CONTINUE/verification.json).

DEV-A · 기준 d1b2aa5 · 2026-11-19 KST

- 변경 계획은 Zod 환경 스키마, 서버 전용 설정, Supabase 연결·프록시와 인증 리다이렉트 소비 위치, 값 없는 진단을 묶는다.
- DB 스키마 변경은 없다. 예상 검증은 누락/오입력, 환경별 origin, Supabase 권한 키 혼동, Toss 라이브 키 거부 및 관련 인증 회귀다.
- `npm run check:config` 및 Vitest 환경 계약 통과. 누락 이름·상태만 표시하며 운영자 환경을 조회하지 않았다. [공통 검증 결과](../DEV-A-LOCAL/verification.json)

## 2026-11-20 push preflight
- A fresh run of the existing CI handoff validator exposed cp949 decoding on Windows and the worker-token consumer recorded as a composite description rather than one real source path.
- Explicit UTF-8 reads and a real primary consumer path fix these metadata checks; database_guard retains the private RPC reference. No key values/settings, runtime feature flags or application behavior changed.
- `python harness/validate_handoff.py` PASS across A43/B45,20 USER runbooks, runtime/consumer paths and local links. Existing source/SQL ZIPs remain point-in-time snapshots; this small follow-up is in the pushed repository.
