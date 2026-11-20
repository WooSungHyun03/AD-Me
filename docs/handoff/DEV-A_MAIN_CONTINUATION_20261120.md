# DEV-A — main 통합 후 P0 인계 (2026-11-20)

기준 main `65063c8`, 이전 DEV-A `3182ff0`. 작업 브랜치 `codex/dev-a-p0-20261120`에서 두 이력을 보존했다. main의 YouTube 소유권/동의, private operations schema, 역할별 콘솔, 작업 큐를 이어받았다. 기존 브랜드 연락처 분리·관리자 초대/OTP·운영 차단을 유지했다. 원격 main/외부 환경은 수정하지 않았다.

|티켓|커밋|이번 변경|
|---|---|---|
|D004/통합|69935f1|main 병합, 새 API 오류/입력/출처 계약 연결|
|D016|7466c65|위임 운영 역할에도 만료 승인·철회·최근OTP, 일반 계정 역할 유지|
|D051 부분|93ce710|메시지와 제안의 kind를 혼동하던 RLS 수정|
|D076 부분|48e8451|공유 DB 원자 쿼터·429/Retry-After·작업/공급원 예산·기본OFF|
|D059|6e36d58|YouTube 검색에서도 독립 운영 차단, DTO/검색 한도|
|D008|0aa6dd3|실제 큐 어댑터와 앱 플래그/설정 진단 연결|
|D084|`test(D084): verify integrated main…`|실제 로컬 Auth 회귀, fixture 분리, Windows/로컬 QA 도구, 적용 패킷 검증|

검증: Node22 lint/typecheck/생산 build, Vitest138(16파일), Harness5/백로그 구조, 직접 REST28그룹과 SQL fixture3개, 실제 로컬 Auth 포함 desktop/mobile E2E26, keyless4 통과. [실행·실패 수정·한계](../../harness/evidence/DEV-A-MAIN-20261120/verification.json). 스크린샷은 실제 로컬 화면을 확인했고 OTP secret을 포함하지 않는다. fixture worker는 실제 lease/finish RPC를 사용하지만 공급자를 호출하지 않는다. 실제 YouTube·모델 성능·공급자 성공으로 보고하지 않는다.

신규 SQL은 `202611200006_ops_mfa`, `007_rate_limits`, `008_youtube_moderation`, `010_message_policy`다. 적용된 main001~005와 이전 DEV-A190004~007은 수정하지 않았다. 009는 사용하지 않았다. main만 적용된 환경에는 이전 DEV-A4개도 먼저 필요하다. 생성 패킷은 두 기준 각각의 preflight/완성 SQL/검증/중지 파일을 제공하며 별도 로컬 DB에서 두 경로 모두 검증했다. 잘못된 기준/부분/중복 적용은 중단한다. USER가 대상 환경·백업·릴리스 시점을 확인하고 콘솔 적용·환경 등록·배포를 수행한다. 사용자에게 코드 수정·설치를 요구하지 않는다.

DB `resource_controls`와 앱 플래그는 모두 기본OFF다. main에서 켜 둔 discovery도 새 SQL 적용 시 중지된다. 기존 역할만 있던 staff는 승인을 갱신하기 전 접근할 수 없다. 초대된 staff는 자신의 OTP를 등록해 담당 범위만 사용한다. classic admin 승인과 위임 역할은 서로 승격시키지 않는다. 정지는 `03_pause.sql` 및 앱 플래그 off이며 진행 중 외부 호출은 완료될 수 있다. 감사·동의·업무 자료를 삭제하거나 MFA를 제거하는 자동 롤백은 제공하지 않는다.

DEV-B 인계: D033은 기존 카탈로그 검색을 새 서버 검색 경계로 옮기며 신뢰 IP/계정 제한을 연결해야 한다. D004의 `fail`은 예외를 던지며 새 API는 `apiRoute`를 사용한다. `safeOrigin`은 내부 함수다. public `ops_*` wrapper는 SECURITY INVOKER이고 실제 권한/쿼터는 private DB 구현에서 검사한다. D049 이후 D051 페이지/첨부/스팸 UX를 이어야 한다. 실제 수집 identity/metrics 정규화(D018/D021)와 CampaignBrief 저장/UI(D041)도 기존 계약만으로 완료된 것이 아니다.

남은 D076: 가입/로그인의 신뢰 IP·계정/CAPTCHA·직접 Auth 설정, 기존 카탈로그, direct `ops_draft_get` polling 제한. 앱의 polling120/min을 직접 RPC 전체 보호로 표현하지 않는다. 익명 YouTube 검색300/min은 공유 전역 fallback이며 사용자별 IP 제한이 아니다. 고정 UTC 윈도우는 경계 양쪽 burst를 허용한다. 실제 provider 쿼터·정책·운영 환경 검증은 USER 적용 후 별도다.

어느 티켓도 이번 작업만으로 DONE으로 올리지 않았다. 전체 P0/U 출시 게이트는 미완료다. push/외부 배포 없이 로컬 티켓 커밋과 검토 패키지를 남긴다.
