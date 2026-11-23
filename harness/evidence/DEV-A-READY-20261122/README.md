# 선행 없는 DEV-A P1 네 티켓

기존80e8d1e/codex/dev-a-p0-continue에서 D030/D031/D035/D060을 구현했다. [제품 source·티켓별 커밋](commits.json), [검증 명령·수량·범위](verification.json), [보안 최종138그룹](security-batch.json), [초기 실패](security-batch-initial.json), [권한 metadata](permission-inventory.json), [실제60→67 적용/롤백](packet-upgrade.json), [소스/이력/패킷 hash](packet-integrity.json). [필요 선행15개](../../../docs/handoff/DEV-A_PREREQUISITES_20261122.md) · [USER 패킷](../../../deliverables/dev-a-ready-20261122/README.md) · [API/정책/권한 계약](../../../docs/operations/discovery-support-contract.md).

LOCAL_VERIFIED는28개, 외부3/진행2/OPEN10/DONE0. 새 네 티켓의 실제 외부 자료/승인·USER 적용/대상 URL/교차 리뷰는 남긴다. P0/D014 영구 파기/D079·미확정 정책·공급자/SMTP/권리·다른 담당은 변경하지 않았다.

SQL061/063 광고 최신 승인·검색/총건수/개인 경쟁사;062/066/067 시계열 원본/파생·시간/기간/표본·null/0·YouTube 제한/별도 history defaultOFF;064/066 DB 참여율 필터/가용성 meta;065 최소 업무검색/요청ID·사유·지원감사. 개인 경쟁사·시계열·운영 raw/private 자료·원문 공개 범위를 넓히지 않는다. 기존 전문 검토/수집 감사는 보존하며 새 지원감사로 합쳤다고 하지 않는다. 고객 데이터/기존 정책snapshot·고지·lock·과거 SQL/전달물은 불변이다.

최종 unit257/41, 실제 DB계약7/5, 보안23파일138그룹, lint/typecheck/production build, Python9/harness5/backlog PASS. 브라우저 whole68은62pass/6fail(변경된 운영경로·select label 기대), 영향8은6pass/2fail(추가axe의 광고notice 대비). 경로/selector를 현재 업무계약으로 바꾸고 대비를 ink token으로 고쳤다. 새4 재통과, 마지막067 history permission/window 후새4 재통과. 68개 고유 시나리오의 전체 실행과 영향 재검증이며 단일68green 실행이 아니다. final free6/keyless10도 PASS. 생성된 인증 화면/trace는 공개 증거에 커밋하지 않고 실제 local Auth/TOTP·합성 권한 JWT·가상 source/policy/관측을 구분했다. 최종 mobile discovery/desktop admin 캡처를 직접 확인했다.

수정 이력: 광고 기간 겹침 테스트의 기대값을 실제 겹치는2건으로 고쳤다. actor canary가 cursor 입력 echo를 찾아 적용061은 불변으로 두고063에서 public ref를 사용했다.065 문법오류는 미적용 트랜잭션 전체 rollback 후 수정/최초 적용했다. metadata 미래/기간 조건은066, 기존 현재값 승인이 시계열 승인으로 넓어지지 않도록067을 추가했다. packet DB에는 DEMOseed가 없어 초기 SELECT fixture0이었고 literal 가상 자료로 수정했다. 기존 리뷰 보안 검사는 새 private competitors 때문에 RLS table수5→6을 기대하도록 고쳤으며 SELECT grant 거부·기존9행동 그룹을 유지/재통과했다. 실패를 skip으로 바꾸거나 보안 조건을 완화하지 않았다.

packet66 첫 검증은 packet-upgrade-66.json에 보존했다.067 추가로 표시된 별도 packet QA만 CLI local reset/정확60으로 복원한 후 최종67 생성 SQL을 다시 적용·오류원자성/기존 비어있지 않은 자료·old60 ledger/정책OFF/중복STOP을 검증했다. root QA/원격DB/사용자 자료 reset 없음. 신규7개 실제 root 적용 ledger/source·전달 SQL hash 일치, old60/과거 tracked deliverables/notices/lock/정책 snapshot 불변 PASS.

제품 source는25e7f08d379b297a9fdfef84607eab9b7ba7f710이다. 후속 단일 산출물 커밋에는 공유 browser fixture/검증기·stale table-count 회귀/원장·문서·패킷만 포함한다. 테스트 runner의 최종 source는 산출물 커밋이며 제품 src/public/migrations/package 파일 변경은 없다. exact pushed SHA/CI·QA 두stack 중지/볼륨 보존은 ignored receipt에 기록한다. 외부 설정/키/클라우드 배포/외부 메일·연락/실제 결제·법적 승인을 수행하지 않았다.
