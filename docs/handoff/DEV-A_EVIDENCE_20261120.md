# DEV-A 근거 검토·광고 이력 인계 — 2026-11-20G

기준0a20b21, 기존 codex/dev-a-p0-continue에서 D057/D029를 구현했다. 기존24개 migration과 데이터·ID·프로필·메시지·기존 접수 신고를 보존했다. 새 source는 근거 검토함으로 제출하며 이전 접수 기록은 기존 관리자 화면에서 계속 확인한다. 외부 설정/키/배포/실제 광고·공급자 검증은 수행하지 않았다.

## 티켓별 변경

|티켓|커밋|구현|
|---|---|---|
|D057|14dc12d|019/020 private 제출/정정·답변 version·검토/감사, 최근 OTP 승인 admin, 공개 allowlist·기본OFF 정책, 사용자·관리자 검토함·프로필 표시|
|D057|0a65d7c|022 반복 철회는 quota/audit를 추가하지 않는 no-op, 최초 변경에만 DB quota|
|D057|8ad223b|024 최신 답변의 공개 동의를 확인해 과거 공개 입장이 최신 비공개 답변 대신 다시 노출되지 않게 보수|
|D029|fed59dd|021/023 본인 광고 이력·출처·기간·형식·경제적 이해관계·표시/권한 확인, source URL 중복/정정 guard, 별도 광고 정책·강한 근거 판정·폼/검토함/공개 이력|
|D084|ee83210 및 후속 산출물 커밋|수용 기준별 증빙, 최종 공통 검사,23/24→30 실제 생성 SQL 검증과 소스 hash manifest|

미확인 주장·본인 진술·단순 브랜드 언급을 확인 광고나 위험 점수로 바꾸지 않는다. 정정/당사자 답변은 새 version을 만들고 공개를 내린 뒤 재검토한다. 다른 제출본을 승인한 과거 요청은 충돌로 거부한다. 신고자/owner/최근 OTP 승인 관리자만 private 자료를 읽으며 공개 응답에는 원본 주장·내부 메모·actor IDs·비공개 입장·제출 권한 체크가 없다. DEMO 여부·제출자·검토자·시각은 DB에서 정한다. 원본 이력은 불변이며 별도 감사 기록을 남긴다.

## 검증

[최종 기계 판독 결과](../../harness/evidence/DEV-A-EVIDENCE-20261120/verification.json)에 정확한 명령·시점·실패 수정 내역을 보존한다.

- Node22 lint/typecheck/unit210/27파일 PASS. 신규 D057 API/계약7+D0296이다.
- 실제 local PostgreSQL/PostgREST D0579그룹+D0298그룹 PASS. 중복·정정 경합·MFA·소유자 위조·검토 전후 공개·정책/중재·불변/감사·최신 답변 동의·quota/cursor를 확인했다. 마지막 D057은30개, D029는29개 이력에서 검사했다.
- 실제 Chrome desktop/mobile의 새 근거 검토2+새 광고 이력2+기존 두 역할 golden2 PASS, production build PASS. 최초 광고 browser2건의 exact label locator는 option 텍스트와 구분되는 동일한 정확한 accessible combobox role로 고쳐 영향2건을 재검증했다. 이후023/024는 강한 근거/최신 답변 동의의 DB·parser 부정 검사이며 승인된 UI 동작은 유지한다. 최종 CI에서 현재 소스 build를 다시 확인한다.
- 생성 SQL을 별도 local DB의23개/24개 기준에서30개까지 실제 실행했다. 비어 있지 않은 기존 메시지·신고·프로필 hash, 구버전 authenticated INSERT, 기존 read boundary/grant를 보존했다. 정책2개 기본OFF, private5테이블 전체RLS/no-client-select, unknown/repeat 거부, 원본 SQL LF hash를 검증했다.
- 가상 사용자·근거·광고·TEST 주문만 사용했다. 정책을 테스트 중 명시적 fixture로 켠 뒤 복구했다. 실제 공급자/콘텐츠/법률 검토/결제 성공으로 보고하지 않는다. 인증 trace/계정/키는 전달하지 않는다.

## USER 적용

[적용 패킷](../../deliverables/dev-a-evidence-20261120/README_KO.md)의 정확한 기준 preflight와 SQL을 사용한다.23개이면 기존 메시지 확장을 포함한 previous_23,24개이면 current_24다. USER가 DB owner SQL Editor에서 적용한 다음 새 source를 배포한다. 에이전트는 실제 URL을 받은 뒤 권한·공개 전후·정정·답변·관리자/기존 흐름을 재검증한다. 터미널·소스 수정·설치를 사용자에게 요구하지 않는다.

이슈 공개와 광고 공개는 각각 기본OFF다. 활성화에 필요한 실제 정책 version/승인 근거는 U001/D073 담당자가 확정한다. 확정된 값을 받은 뒤 개발자가 그대로 실행 가능한 별도 SQL을 준비한다. 더미 정책 값을 실행하도록 전달하지 않는다. 기존 read boundary 활성화는 이전 인계 절차를 따르며 이번 SQL이 다시 열거나 끄지 않는다. 실패 시 반복/이력 삭제/권한 재개방 대신 실제 DB 이력을 읽고 forward fix한다.

## 남은 범위

D057/D029는 문서 수용 기준을 로컬에서 검증한 LOCAL_VERIFIED이며 DONE은 아니다. USER 실제 정책 승인/적용, 실제 출처 자료의 운영 검토, 실제 URL과 DEV-B 교차 리뷰가 남는다. 장기 private history의 추가 페이지 API와 대규모 읽기 성능, D030의 전체 검색/대량 timeline pagination, D018/D026 실제 정규화·플랫폼 소유 확인, D073 동의 버전·D014/D079 보존/삭제 연결은 별도 미완료다. 현재 timeline은 프로필당 공개 자료 최대50개를 보여주며 전체 광고 이력을 보장하지 않는다. 문서 범위의 local workflow 검증을 이 후속 작업까지 완료한 것으로 확대하지 않는다.

패킷 source_head는 `ee832100b7b9f831a1107d4921ac8fb4028e0f52`이다. 원본6개 Git blob/SQL5파일 hash와 기존24개 migration·ZIP6개 불변을 [산출물 검증](../../harness/evidence/DEV-A-EVIDENCE-20261120/package-verification.json)에 기록했다. source_head 이후 산출물 커밋은 앱 코드를 바꾸지 않는다.
