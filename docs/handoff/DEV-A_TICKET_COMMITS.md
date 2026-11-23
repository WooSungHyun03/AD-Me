# DEV-A 티켓별 커밋 기록

기록: 2026-11-19T19:06:42.592352+09:00 · 브랜치 `codex/dev-a-p0-continue`

원본 루트 HEAD `4437eb1` 이후의 문서·외부 실행 이력 6개는 별도 체크아웃의 원래 커밋 그대로 보존했다. 그 다음 DEV-A 변경을 아래 15개 커밋으로 분리했다. 별도 체크아웃과 원래 작업 파일 313개의 내용을 유지했으며, 스테이징 단계에서 공유 파일을 나눴다.

각 커밋의 실제 Git 트리를 별도로 추출해 TypeScript 검사를 통과시켰다. 마지막 티켓 커밋의 추출 트리에서 단위 테스트 115개도 통과했다. 커밋 생성은 수용 기준 완료 선언이 아니며 runtime의 LOCAL_VERIFIED/IN_PROGRESS/BLOCKED_EXTERNAL 상태와 기존 외부 차단을 유지한다. push·배포·외부 설정은 하지 않았다.

|티켓|커밋|변경|상태|
|---|---|---|---|
|D003|`68c8777c9a`|validate server configuration and safe diagnostics|LOCAL_VERIFIED|
|D002|`bfd1866ece`|centralize service features and product descriptions|IN_PROGRESS|
|D004|`3a8a183e01`|unify API validation and sanitized errors|LOCAL_VERIFIED|
|D008|`88469e6731`|enforce disabled feature and TEST payment gates|IN_PROGRESS|
|D065|`48e674da6f`|separate free beta and database TEST catalog|IN_PROGRESS|
|D009|`5a6dac25ae`|complete safe email confirmation and resend flows|BLOCKED_EXTERNAL|
|D007|`7196d26b29`|inventory exact dependency notices and asset rights|IN_PROGRESS|
|D028|`2882507e82`|normalize official social links and consented embeds|IN_PROGRESS|
|D018|`4dbab188e3`|define creator identity and metric contracts|IN_PROGRESS|
|D016|`d7077fe228`|require provisioned administrators and recent TOTP|LOCAL_VERIFIED|
|D059|`e4fca4bc75`|enforce audited moderation locks across REST and UI|LOCAL_VERIFIED|
|D012|`bb35fb57d5`|separate public brands from private contacts|IN_PROGRESS|
|D041|`c817d644bb`|define versioned campaign terms validation|IN_PROGRESS|
|D064|`b6d48389f9`|draft content and account incident runbooks|BLOCKED_EXTERNAL|
|D084|`5c9afd0b65`|add isolated DB MFA mail and browser regressions|IN_PROGRESS|

[파일별 변경·검증 기록](../../harness/evidence/DEV-A-P0-CONTINUE/ticket-commits.json) · [기존 로컬 검증](../../harness/evidence/DEV-A-P0-CONTINUE/verification.json)

이 문서를 기록하는 후속 커밋은 위 티켓 구현을 바꾸지 않는 공통 이력 기록이다. 이전 적용 ZIP·SHA-256과 미커밋 스냅샷 증거는 당시 상태 그대로 보존하며 새 커밋 해시로 소급 변경하지 않는다.


## 2026-11-20 main 통합 계속

|티켓|커밋|내용|
|---|---|---|
|D004/integration|69935f1|merge: integrate main 65063c8 and retain DEV-A API and UI contracts|
|D016|7466c65|fix(D016): enforce expiring approvals and recent OTP for operations roles|
|D051/partial|93ce710|fix(D051): distinguish message kind from proposal kind in RLS|
|D076/partial|48e8451|feat(D076): add atomic database quotas and bounded worker budgets|
|D059|6e36d58|fix(D059): preserve moderation locks in the YouTube directory|
|D008|0aa6dd3|fix(D008): gate main queue adapters through explicit feature controls|
|D084|fee00fd|test(D084): verify integrated main with isolated Auth and fixture workers|

최신 결과/미완료 범위: [main 계속 작업](DEV-A_MAIN_CONTINUATION_20261120.md). source SQL 패킷은 별도 산출물 커밋이며 배포가 아니다.


## 2026-11-20B 캠페인 조건·조회 제한 계속

|티켓|커밋|내용|
|---|---|---|
|D076/partial|a4d9991|fix(D076): enforce draft read quotas at the direct RPC boundary|
|D041|1054bce|feat(D041): persist structured campaign terms through create and edit flows|
|D081/partial|35602e9|fix(D081): label fictional campaign recommendations as DEMO|
|D084|436171c|test(D084): verify free campaign terms and repeatable security fixtures|

최신 인계: [계속 기록](DEV-A_CONTINUATION_20261120B.md). D041 LOCAL_VERIFIED, D076/D081/D084 IN_PROGRESS. 외부 적용/DONE/push/배포 없음.

## 2026-11-20 push 전 인계 검사

D003 후속 `036c83d`: Windows UTF-8 인계 검사와 worker 소비 source 경로/DB guard를 분리해 기존 검증기를 실제 통과시켰다. 실제 설정명·값·앱 동작은 바꾸지 않았다.

[DEV-A43개 남은 범위·우선순위·18개 티켓 커밋 전체표](DEV-A_PUSH_STATUS_20261120.md). 이 표가 이번 push의 현재 상태 기준이며 앞선 기록/ZIP은 당시 스냅샷으로 보존한다.

## 2026-11-20C 기존 브랜치 계속

`codex/dev-a-p0-continue`에4977225까지 fast-forward한 후 아래 커밋을 추가했다. 기존 이력은 보존하며 main65063c8 변동 없음. 새 브랜치는 만들지 않았다.

|티켓|커밋|내용|
|---|---|---|
|D018/partial|4fd47a9|비공개 정규화 저장소·UUID 백필·본인 snapshot·기존 JSON 호환|
|D084/partial|554c681|실제 SQL/RPC→TS adapter 테스트 및 전체 로컬 회귀 증빙|

패키지 source head는554c681이다. source353파일, SQL4기준8/12/16/18→19, 이전 ZIP3개 불변. 이후 산출물 커밋은 새 ZIP/manifest/SQL/전달 메타데이터이며 앱 코드 기준은 바뀌지 않는다. [최신 인계](DEV-A_SCHEMA_20261120.md), [검증](../../harness/evidence/DEV-A-SCHEMA-20261120/verification.json), [패키지](../../deliverables/dev-a-schema-20261120/README_KO.md). D018/D084 IN_PROGRESS, DONE 승격0, 실제 provider/대상 적용·배포 미검증.

## 2026-11-20D 첨부 문서 대조·계속 구현

|티켓|커밋|내용|
|---|---|---|
|공통 검토|28d1d1b|첨부43개 기준/커밋/증거 대조, D051 원장 범위 보수|
|D034/partial|0899fa4|다중 필터·URL/뒤로가기·범위·0/미확보·취소 계약|
|D034/partial|2377cdc|router transition 전에 URL 기반 checkbox 상태 동기화|
|D018/partial|eb65d37|공개 앱 DTO allowlist·null·동의 없는 링크 제외, private 필드 최소화|
|D084/partial|06bb2c1|문서 대조 보수의 실제 로컬 회귀·화면·실패/수정 증빙|

source06bb2c1, 같은 codex/dev-a-p0-continue. 신규 SQL0/기존19개 불변, 이전 검증 SQL을 재사용한 FILTERS 산출물은 후속 커밋에 들어간다. [최신 검토·남은 범위](DEV-A_DOCUMENT_AUDIT_20261120.md). 직접 REST/legacy 공개ID 이관·D033 연결·정책/실제 수집 및 기타 출시 게이트는 미완료다. DONE 승격0.

## 2026-11-21 진행 중 P0 마무리

|티켓|커밋|변경|
|---|---|---|
|D081|7ead15e7c7d3|read current public home counts and provenance|
|D008|7f42cf31fe90|enforce default-off TEST billing in database and Edge|
|D076|771b13871b3d|reserve shared auth and search budgets before provider calls|
|D051|073645c9bcee|verify private image messages and reauthorize downloads|
|D012|a18752177c20|save verified private brand logos with publication checks|
|D034|560f71da48f3|connect filtered cursor search with cancellation and recovery|
|D018|8a0ca616d9f5|expose policy-approved normalized public observations|
|D075|322b4b1ba4eb|hide Auth identifiers behind compatible public references|
|D028|f53ad6b67305|recover optional embeds and denied clipboard sharing|
|D007|d816a372b01b|audit exact artifact notices and lock Edge dependencies|
|D065|33a435e8542d|verify free-mode application and direct database isolation|
|D002|4c9ce8268d9d|verify TEST catalogue quantities prices and role contracts|
|D084|105bbbb73db8|record final P0 regression coverage and remaining gates|

앱/SQL source105bbbb, [상태·수용 결과·남은 gate](DEV-A_P0_FINISH_20261121.md). 대상13 중 LOCAL11/외부1/진행1, DONE 승격0. 후속 artifact commit은 검토된 USER 패킷·source hash·증빙이며 앱 변경 없음.
