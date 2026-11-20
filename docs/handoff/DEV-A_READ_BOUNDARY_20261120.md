# DEV-A 공개 읽기·기존 기능 호환 보수 — 2026-11-20E

소스 의존 경로를 조사한 뒤 D075/D076의 독립 가능한 부분을 구현했다. 기존 `codex/dev-a-p0-continue`에서 이어 작업했다. 원본19개 SQL, 데이터 ID/FK/프로필 JSON, 기존 프로필 주소, 협업 API 입력/201 응답과 상태 전이를 보존했다. 외부 키·콘솔·배포는 수행하지 않았다.43개 티켓 전체 완료 보고가 아니다.

## 변경과 커밋

|티켓|커밋|구현|
|---|---|---|
|D075 / D018 계약|`7a553e5`|014: 공개 DB allowlist/cursor, raw 본인·MFA admin 읽기, HOT/saved/후보/제안 RPC와 앱 호출 경로 호환 변경.|
|D076|`1b6fbf0`|015: catalog authenticated60/min·anon shared300/min, DB 원자 한도/429·Retry-After, GET·unmetered leaf 거부. 클릭하지 않은 프로필 prefetch 제거.|
|D075|`891f5a2`|016: 구버전 SQL 먼저 적용 시 기존 읽기 유지, 새 소스 확인 후 owner 전용 일회 활성화. 정책/이력 fingerprint·잠금·중복/부분 적용 방어.|
|D075|`5937456`|017: 타인의 비공개 캠페인과 없는 캠페인의 오류를 같게 유지. NULL kind 명시 거부. 직접 회귀8그룹 재통과.|
|D075 검증|`d85cf28`|기존5개 SQL 기준을017 포함23개 이력까지 다시 검증.|
|D084|`5cb77a8`|실제 SQL→TS reader 계약2, 검증 원장과 source snapshot. 후속 산출물 커밋은 앱 코드를 바꾸지 않음.|

공개 목록·상세·비교·추천은 `creator_catalog_page`, CSV는 `my_saved_creator_catalog`, 캠페인 선택지는 id/name 전용 RPC를 사용한다. 제안 생성은 캠페인→크리에이터 순서로 잠그고 실제 역할/소유권/게시·moderation/중복을 검사한다. 이전 직접 proposals INSERT도 boolean RLS helper로 유지했다. 본인 설정과 최근 OTP로 승인된 관리자 원본 조회는 유지한다. 알 수 없는 공개 JSON 필드는 거부하고 잘못된 선택 링크는 제외한다. 미확보 지표는 null, 가상 fixture 수치는 가상으로 표시한다.

## 검증된 적용 조건

패키지: [README](../../deliverables/dev-a-read-boundary-20261120/README_KO.md), [ZIP](../../deliverables/AD-Me_DEV-A_READ_BOUNDARY_20261120_review.zip). source_head=`5cb77a894138b4b46c0a3cdbe1d332cbc51c1cad`,394 source 파일,2,725,961bytes, SHA256=`fa86f1397ad26c5561800e2938100f885127869aaa13a8b7fe02a2267a7b2418`이다. [검증 receipt](../../harness/evidence/DEV-A-READ-20261120/package-verification.json)에 Git blob/CRC/비밀 패턴/기존ZIP5개 hash 불변을 기록했다. USER에게 터미널·소스 수정·패키지 설치를 맡기지 않는다.

1. USER의 DB owner SQL Editor에서 제공된00_preflight를 실행한다. 지원 기준은 기존8/12/16/18/19개 이력이다. 현재19 기준의 정확한 버전·기존 정책 hash·anon grant도 확인한다. 이미 강화한 정책/20~23개 또는 부분 이력,100자 초과 ID,1000개 초과 공개 행은 자동 적용을 거부한다. 그 환경은 개발자가 별도 전진 수정안을 준비한다.
2. 맞는01_stage 전체를 실행한다. 이전 기준의 검증된 확장 SQL 후014~017을 하나의 트랜잭션으로 적용한다. old19 읽기를 유지해 구버전 소스 조회가 갑자기 깨지지 않는다. **이 단계는 원본 공개 읽기가 남아 있어 보안 완료가 아니다.**
3. USER가 새 source를 적용한 뒤 에이전트가 실제 URL에서 목록/기존 주소/CSV/저장/제안·지원/설정/관리자를 검증한다. 그 뒤 USER가 제공된03_activate를 실행한다. 소스 commit은 파일에 들어 있어 수동 편집하지 않는다.02_verify로23개 이력, enabled=true, anon 원본 SELECT=false를 확인한다.
4. activation은 앱·anon·authenticated·service role에 실행 권한이 없다. 최초 시각/소스 reference를 보존하고 재활성화는 같은 증거를 유지한다. false 전환/행 삭제는 거부한다. 오류 발생 시 공개 진입을 중단하고 forward fix한다. 원본 공개 권한을 다시 열거나 데이터/이력을 삭제하지 않는다.

raw source migration/CLI 적용은 기본 strict이다. 검토된 기존19 대상 atomic stage만 옛 동작을 잠시 보존한다. 이미 닫힌 DB를 다시 여는 패킷이 아니다. 기존 ZIP5개와 SQL19개는 불변이며 새 패킷은 네 migration을 추가한다. 다른 개발자의 후속 migration이 있으면 preflight를 우회하지 않는다.

## 검증과 남은 범위

[기계 판독 증빙](../../harness/evidence/DEV-A-READ-20261120/verification.json)에 명령·검증 시점·실패 수정 내역을 기록했다. Node22 lint/typecheck/unit190, 실제 DB→TS 계약2, 로컬 Auth/DB 전체 E2E32 및 최종 영향 재검증, free4/keyless10, 직접 SQL/REST54그룹, SQL rollback3, USER SQL5개 기준을 검사했다. 브라우저는 실제 Chrome desktop/mobile의 로컬 Auth·DB와 두 역할을 사용했다. worker/HOT entitlement/TEST 결제 fixture는 실제 YouTube/LLM/Toss/SMTP 검증이 아니다.

- D075: 전체 Storage/RPC/테넌트 권한 감사·교차 리뷰·USER 활성화와 실제 URL 검증이 남는다. 기존 `user-<Auth UUID>` 주소는 보존했으며 공개 ID 익명화가 아니다.
- D076: 가입·로그인 trusted IP/계정/Auth 설정, D033 대용량 서버 검색과 적정 한도 UX가 남는다. anon shared300은 IP별 제한이 아니다. 고정 시간창 경계의 burst도 남는다.
- D018/D017/D019: 정책 승인·실제 수집/정규화 writer와 read switch, 철회/삭제·보존 연결이 남는다. 새 cursor는 기존1000행 snapshot 호환용이며 D033의 완료된 필터/인덱스 검색이 아니다.
- D084: 미구현 시나리오와 외부 공급자·배포 확인이 남는다. 이번 구현으로 DONE 승격하지 않았다.

원장 변경은 DEV-A의 D018/D075/D076/D084에 한정했다. DEV-A43개는 LOCAL_VERIFIED5 / IN_PROGRESS13 / PARTIAL1 / BLOCKED_EXTERNAL2 / OPEN22 / DONE0이다.
