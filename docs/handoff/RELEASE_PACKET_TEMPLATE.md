# 사용자 외부 적용용 릴리스 패킷 — D085 작성 양식

이 파일은 **양식**이며 현재 적용 가능한 새 릴리스가 아니다. 모든 빈칸과 자료를 개발자가 채운 뒤 사용자에게 U004/U005/U006/U008로 전달한다. 사용자에게 SQL/코드 수정이나 CLI 명령 실행을 요구하지 않는다.

- Release ID / code commit / 검토자 / 기준일:
- 목적 / 활성화할 기능 / 의도적으로 비활성인 기능:
- Vercel project/team/environment / Supabase ref / 검증 URL / 공개 origin:
- 해당 운영 용도의 호스팅 플랜 적합성·한도 확인:
- 현재 버전→목표 버전 / 하위 호환 여부:

## 사전 증거

- lint/typecheck/unit/integration/build/E2E 명령·시각·결과:
- DB/RPC/RLS/Storage 부정 권한 테스트:
- schema/API 계약 버전·공유 파일 변경·A/B 검토:
- 시연/실제 데이터 분리·source policy·개인정보/라이선스:
- 백업 범위(테이블/Auth/Storage 등)·복구 확인·기존 삭제 요청 재적용:
- 알려진 실패·출시 차단·사용자 작업 의존성:

## 적용 순서 — 매 단계 성공 후 다음 단계

|순서|USER 티켓|정확한 파일/설정/경로|사전 상태·checksum|기대 결과·검증|실패 시 중단/복구|
|---|---|---|---|---|---|
|1|U003/U004|백업/대상 확인|개발자 작성|개발자 작성|개발자 작성|
|2|U004|migration 파일별 순서|개발자 작성|검증 SQL 및 expected 값|실패 범위 확인; 다음 migration 중단|
|3|U004|Edge Function/Storage 변경|개발자 작성|개발자 작성|개발자 작성|
|4|U006/U008|환경값 이름/인증 URL·템플릿|값 제외|개발자 작성|개발자 작성|
|5|U005|검토된 commit 검증용 배포|개발자 작성|READY·commit·URL|이전 검증 배포·DB 호환성 확인|
|6|U019/D088|실제 인증·공개 URL 확인|개발자 작성|핵심 흐름·부정 테스트|실패 시 NO-GO|
|7|U020|공개 판단·관측|GO/NO-GO 기록|사용자 승인·주소 재확인|지원·사고 대응|

앱 rollback과 DB rollback은 별개다. 파괴적 변경은 additive/backfill 단계와 분리한다. SQL Editor 적용 시 migration history 동기화/적용 manifest 처리 계획을 반드시 포함한다. 실행되지 않은 SQL의 결과를 미리 PASS로 채우지 않는다.
