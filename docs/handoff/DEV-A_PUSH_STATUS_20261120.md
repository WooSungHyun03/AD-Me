# DEV-A 남은 티켓·티켓별 커밋·푸시 체크포인트

> 2026-11-20D: 첨부43개 지시서 대조 후 D034 필터/URL·D018 공개 앱 DTO 보수와 회귀를 추가했다. 현재 OPEN23/진행12/부분1/외부2/LOCAL5/DONE0이며 [최신 검토 보고서](DEV-A_DOCUMENT_AUDIT_20261120.md)를 따른다. 직접 REST·legacy-ID·서버 검색 연결은 출시 차단으로 유지한다.

> 2026-11-20C 계속: 기존 `codex/dev-a-p0-continue`에 전체 이력을 보존하고 D018 private DB/RLS·UUID 백필·호환 adapter(4fd47a9), D084 SQL→TS/전체 회귀(554c681)를 추가했다. 상태 수량은 동일하고 D018의 DB 미구현 설명은 [최신 인계](DEV-A_SCHEMA_20261120.md)로 대체한다. 아래는 이전 push 시점의 상세 내역이다.

작성 2026-11-20T03:35:25.323089+00:00 · 코드 기준 `036c83d9c6` · 작업 브랜치 `codex/dev-a-p0-20261120` · main `65063c8`. 이 문서 자체의 커밋은 기준 코드 다음에 추가된다.

사용자 요청은 남은 범위 설명과 현재 작업 브랜치 push다. main 병합·외부 콘솔 설정·Vercel/Supabase 배포 명령은 실행 범위에 포함하지 않는다. 저장소 CI는 push 시 검증만 실행한다. 호스팅의 별도 자동화 결과는 배포 성공으로 추정하지 않는다.

## 현재 수량

|구분|개수|해석|
|---|---:|---|
|전체 DEV-A|43|P0 29 · P1 12 · P2 2, 원래 배분219SP|
|LOCAL_VERIFIED|5|로컬 기술 검증 통과. 대상 환경 적용·리뷰·실제 URL 검증 필요|
|부분 구현·외부 대기|14|IN_PROGRESS11 + BLOCKED_EXTERNAL2 + PARTIAL_VERIFIED1|
|OPEN|24|P0 10 · P1 12 · P2 2. 아직 착수 증빙이 없는 범위|
|DONE|0|커밋·mock·fixture 통과를 출시 완료로 표시하지 않음|

구현 또는 실제 검증이 더 필요한 것은38개이며, 로컬 검증5개도 최종 출시 게이트가 남아 있다. 초기219SP는 남은 공수의 재산정값이 아니다. 이번 DEV-A 코드/문서 커밋이 있는 티켓은18개이고, D021은 main에서 이어받은 부분 구현 상태다.

## 로컬 검증5개 — 구현 후 최종 게이트

|ID|티켓|남은 게이트|
|---|---|---|
|D003|환경 설정 스키마·누락 진단|정확한 잠금 의존성·Node 22·설정 계약·빌드·로컬 E2E 검증. DEV-B 리뷰 및 대상 환경 적용 검증 전 DONE 아님.|
|D004|서버 API 오류·검증 계약 통일|main 신규 API도 오류 v1·검증·안전한 DB 매핑으로 통합. 실제 대상 URL/DEV-B 교차 리뷰 전 DONE 아님.|
|D016|관리자 MFA·초대 기반 권한|main 운영 역할까지 승인 만료·철회·최근OTP 강제. 실제 로컬 Auth 및 직접REST 검증. U008 외부 승인·MFA·DEV-B 리뷰 대기.|
|D041|캠페인 기간·예산·산출물 계약|기간/제공 유형/수량/사용권/독점 조건의 폼·API·DB·공개조회/수정 및 무료모드 검증. 실제 적용/DEV-B 후속 계약 리뷰 전 DONE 아님.|
|D059|정지·비공개 운영 잠금|main YouTube 공개 디렉터리도 독립 moderation lock 준수. 공개 DTO/동시검색·로컬 Auth/DB 검증. 외부 적용·교차 리뷰 대기.|

## 부분 구현·외부 대기14개

|ID|티켓·상태|아직 해야 할 일|
|---|---|---|
|D002|운영 정책·요금·기능 설명 일치 · IN_PROGRESS|D001의 DB·모드 격리와 TEST 카탈로그의 실제 화면/주문 대조가 남음.|
|D007|라이선스·의존성·출처 목록 · IN_PROGRESS|잠금 506개/고지 확인 393개/원문 533개 확보. 113개와 Linux·Edge 실제 배포 아티팩트 및 브랜드 재배포 범위 미확인.|
|D008|기능 플래그·단계별 공개 · IN_PROGRESS|앱/DB 큐·lease 기본OFF 및 계약검증. 실제 환경·수집 정책·worker 활성화와 TEST DB 격리는 USER/D001 인계 필요.|
|D009|외부 사용자 이메일 가입 완주 · BLOCKED_EXTERNAL|로컬 Auth/Mailpit 가입·재발송·증표 재사용 거부 통과. 이번 소스/템플릿의 실제 외부 SMTP·U007/U008 재검증 필요.|
|D012|브랜드 프로필·담당자 정보 · IN_PROGRESS|브랜드/담당자 분리·공개 DTO·REST·UI 검증. D011 리뷰와 D027 로고 업로드 연결 미완료; 외부 적용 안 함.|
|D018|실제 인플루언서 통합 스키마 · IN_PROGRESS|공급자 ID/nullable 지표의 TypeScript 계약만 있음. D017 정책 계약과 DB 테이블·RLS·중복/핸들 변경·이전 데이터 호환·backfill/read switch 구현 필요.|
|D021|수집 작업 큐·갱신·삭제·쿼터 · PARTIAL_VERIFIED|main에 작업 lease/retry/cron/정리, DEV-A에 공급원 예산이 있음. 정규 스키마(D018)/공식 수집(D019) 연결, 체크포인트·장기 장애 재개·삭제 tombstone/재수집 차단과 운영 검증이 남음.|
|D028|SNS 링크·공식 임베드·공유 · IN_PROGRESS|D026 소유 확인, 브라우저 임베드 실패 복구 및 실제 공급원 검증 필요.|
|D051|메시지 페이지·첨부·스팸 방지 · IN_PROGRESS|브랜드 일반 메시지 RLS 모호성만 보수. 페이지네이션·첨부·스팸 UX 및 D049 통합 미완료.|
|D064|콘텐츠·계정 운영 runbook · BLOCKED_EXTERNAL|U001 확정 및 운영 담당 지정, 운영 모의훈련 필요.|
|D065|무료·TEST 요금제 분리 정비 · IN_PROGRESS|D001 격리 인계와 실제 TEST 주문·승인 재검증이 필요.|
|D076|속도 제한·봇·리소스 남용 · IN_PROGRESS|직접 draft_get RPC 쿼터 우회 해결; 실제 getter120/min와 앱1회 호출 검증. 가입/로그인 신뢰IP·계정/Auth 설정 및 기존 카탈로그 제한 미완료.|
|D081|실데이터 메인·로고·신뢰 표시 · IN_PROGRESS|캠페인 추천의 가상 프로필 DEMO 누락 보수·시각검증. 실제 메인 집계/출처 신뢰 재설계 및 D024/D002 후속 인계 남음.|
|D084|회귀 테스트·실제 수집 계약 테스트 · IN_PROGRESS|Node22 단위150, 로컬E2E30+무료DB4+keyless4, 직접REST35/SQL3 및 세 적용기준 패킷 검증. 실제 공급자/미구현 전체 워크플로는 미완료.|

## 미착수24개 — 요구 기능과 선행 인계

|ID|단계·티켓|구현해야 할 내용|선행|
|---|---|---|---|
|D014|P0 · 계정 탈퇴·개인정보 삭제 실행|프로필 숨김과 계정 삭제를 구분하고 Auth·Storage·파생 데이터·보존 예외·재수집 차단을 처리한다.|D018(DEV-A), D073(DEV-A), D079(DEV-B)|
|D020|P1 · 허용된 공개 웹 크롤러|허용 목록 도메인에서 약관·권리·robots 검토 후 최소 업무 정보를 수집한다. 로그인·CAPTCHA 우회는 하지 않는다.|D017(DEV-B), D018(DEV-A), U011(USER)|
|D022|P2 · Instagram 공식 연결 어댑터|승인된 API 기능과 계정 종류만 지원하고 OAuth 토큰 암호화·갱신·철회를 구현한다.|D018(DEV-A), U012(USER)|
|D029|P0 · 실제 광고 이력 제출·출처 검증|브랜드·기간·형식·경제적 이해관계 표시·증거 URL·제출자·검토 상태를 저장한다. 단순 브랜드 언급을 광고로 확정하지 않는다.|D018(DEV-A), D057(DEV-A)|
|D030|P1 · 광고 이력 타임라인·경력 필터|실제 검증 이력 기반 브랜드·카테고리·기간 필터와 브랜드별 경쟁사 표식을 제공한다.|D029(DEV-A)|
|D031|P1 · 실제 성과 그래프·지표 정의|확인 가능한 시계열과 집계 산식·기간·출처를 표시하고 타깃 인구통계는 미제공 상태로 남긴다.|D021(DEV-A)|
|D034|P0 · 다중 필터·URL 상태·빈 결과|플랫폼·분야·태그·가격·가용성·팔로워 필터를 조합하고 URL 복원·초기화·0과 결측을 구분한다.|D033(DEV-B)|
|D035|P1 · 지표 가용성 기반 필터|참여율·연령·성별 필터는 적법하게 확보된 데이터가 있는 공급원만 제공한다.|D031(DEV-A)|
|D037|P1 · 저장 검색·신규 후보 알림|검색 조건 버전을 저장하고 동의한 사용자에게 신규 후보 요약을 제공한다.|D034(DEV-A), D052(DEV-B)|
|D039|P1 · 자연어 검색→확인 가능한 필터|파서 기본값과 선택적 LLM을 제공하고 변환 조건을 사용자가 확인·수정한다.|D034(DEV-A), D048(DEV-B)|
|D042|P1 · 캠페인 복제·brief·첨부 버전|복제 시 참여자·메시지 등 개인정보를 복사하지 않고 brief 파일 버전을 관리한다.|D027(DEV-B), D041(DEV-A)|
|D045|P0 · 추천 이유·출처·스냅샷·재계산|점수 버전·입력·태그·예산 적합·미확인 항목을 저장하고 광고 슬롯과 순위를 분리한다.|D044(DEV-B)|
|D047|P2 · 추천 실험·가중치·임베딩|기준 모델과 실험 모델을 분리하고 허용된 콘텐츠로만 임베딩하며 YouTube 파생 지표 정책 적용 여부를 검토한다.|D046(DEV-B), U010(USER)|
|D050|P1 · 협업 조건 변경·합의 이력|예산·산출물·일정 수정안을 버전으로 남기고 양측 확인 전 확정으로 표시하지 않는다.|D049(DEV-B)|
|D054|P0 · 결과물 버전·수정 요청·승인|링크 제출을 버전·검토 의견·승인 근거·광고 표시 체크로 확장한다.|D049(DEV-B), D029(DEV-A)|
|D055|P1 · 일정·마일스톤·지연 알림|캠페인·협업별 마감·타임존·캘린더·리마인더를 제공한다.|D041(DEV-A), D052(DEV-B)|
|D057|P0 · 근거 기반 이슈·검토 워크플로|출처·확인/미확인·당사자 입장·담당자·검토일을 관리하고 무근거 의혹을 위험 점수화하지 않는다.|D073(DEV-A)|
|D060|P1 · 운영 통합 검색·감사·지원|회원·캠페인·수집 작업·신고·TEST 주문을 제한된 관리자 DTO로 찾고 변경 사유를 남긴다.|D075(DEV-A), D059(DEV-A)|
|D067|P1 · 주문 승인·복구·중복·금액 방어|기존 서버 금액·소유권·원자적 권한 부여를 회귀하고 승인 중단 복구·위조 콜백을 검증한다.|D066(DEV-B)|
|D071|P1 · 무료 Agency 팀·초대·테넌트|팀 관리자/구성원·초대 만료·탈퇴·브랜드 전환·팀 자료 범위를 구현하고 유료 청구는 제외한다.|D075(DEV-A), D011(DEV-B)|
|D073|P0 · 개인정보·이용약관·동의 버전|수집 출처·목적·법적 근거 검토·보존·처리위탁·국외이전 해당 여부·권리 행사·운영자 연락처를 정책과 구현에 맞춘다.|U001(USER)|
|D075|P0 · RLS·RPC·Storage 전수 권한 감사|직접 DB API·SECURITY DEFINER·검색 경로·공개 DTO·테넌트 경계를 검사하고 최소권한을 적용한다.|D018(DEV-A)|
|D080|P0 · 접근성·청소년·민감 데이터 경계|초기 성인 서비스 범위·정책을 확정하고 주민번호·민감 추정·얼굴 인식·사적 연락처 수집을 배제한다.|U001(USER)|
|D082|P0 · 전 화면 반응형·접근성·상태|키보드·포커스·스크린리더·대비·폼 오류·로딩·빈 상태·복구 UX를 전 흐름에 적용한다.|D081(DEV-A)|

선행이 미완료여도 독립 schema/adapter/권한 계약·로컬 테스트는 진행한다. 키가 없다는 이유로 모든 개발을 중단하지 않는다. USER는 정책/계정/외부 설정/키/배포를 맡고, 개발자는 코드·마이그레이션·테스트·적용 자료를 준비한다.

## 다음 P0 실행 순서

1. D076: 가입/로그인 신뢰 IP·계정 제한 및 기존 카탈로그 경계. 직접 draft getter 우회는011에서 이미 해결했다.
2. D018: D017(DEV-B) 공급원 계약을 확인하고 정규 DB/RLS/이전 JSON adapter를 구현해 수집·삭제·검색·추천 선행을 풀기.
3. D073/D080: U001 정책 결정이 필요한 부분은 초안/미승인으로 표시하고 동의 버전·민감 필드 경계 코드를 독립 구현.
4. D075 및 D014: 기존 DB 권한 행렬 감사와 삭제 범위 설계부터 진행하고 D018/D079 이후 실제 삭제/재수집 차단 연결.
5. D051/D057/D029/D054: 협업·첨부·정정/이슈 선행 인계에 맞춰 저장/상태 전이/부정 테스트를 구현.
6. D034/D045/D081/D082: DEV-B 검색/추천/public DTO 연결 후 필터·추천 증거·실제 메인·전체 접근성/반응형 회귀 완성.

## 작업한18개 티켓의 실제 커밋

아래는 Git 이력의 티켓 태그로 대조한 구현·문서·검증 커밋이다. 별도 공통 main 통합은 `69935f1`, source/SQL 패킷·검증 원장 commit은 별도 보존했다. 커밋이 있어도 표의 상태 이상으로 완료를 주장하지 않는다.

|ID|티켓|커밋|현재 상태|
|---|---|---|---|
|D002|운영 정책·요금·기능 설명 일치|[bfd1866](https://github.com/WooSungHyun03/AD-Me/commit/bfd1866ece5489e6a272f709bdc4c45267a6f72d)|IN_PROGRESS|
|D003|환경 설정 스키마·누락 진단|[68c8777](https://github.com/WooSungHyun03/AD-Me/commit/68c8777c9a8f0a5ca75d2fe671368fc3783b04be), [036c83d](https://github.com/WooSungHyun03/AD-Me/commit/036c83d9c65bec1843bb47f2959fe7d0360d6b96)|LOCAL_VERIFIED|
|D004|서버 API 오류·검증 계약 통일|[3a8a183](https://github.com/WooSungHyun03/AD-Me/commit/3a8a183e01a53b1867a914ad35a275cd0d9c4a25)|LOCAL_VERIFIED|
|D007|라이선스·의존성·출처 목록|[7196d26](https://github.com/WooSungHyun03/AD-Me/commit/7196d26b2926477b34ebe6907311a1fe527e9377)|IN_PROGRESS|
|D008|기능 플래그·단계별 공개|[88469e6](https://github.com/WooSungHyun03/AD-Me/commit/88469e6731f8776936e944548cc574f0d45bcd55), [0aa6dd3](https://github.com/WooSungHyun03/AD-Me/commit/0aa6dd3fff0f53cee4c74871328ba4fe3142b2ac)|IN_PROGRESS|
|D009|외부 사용자 이메일 가입 완주|[5a6dac2](https://github.com/WooSungHyun03/AD-Me/commit/5a6dac25aea5d13f0fe0fd734e6a89f9e4603b82)|BLOCKED_EXTERNAL|
|D012|브랜드 프로필·담당자 정보|[bb35fb5](https://github.com/WooSungHyun03/AD-Me/commit/bb35fb57d536d597b1f3a748f9462a79ff188987)|IN_PROGRESS|
|D016|관리자 MFA·초대 기반 권한|[d7077fe](https://github.com/WooSungHyun03/AD-Me/commit/d7077fe228df65b8b876539418e3622530440f0b), [7466c65](https://github.com/WooSungHyun03/AD-Me/commit/7466c65af6afd65e948a951887c57b9c95a4c053)|LOCAL_VERIFIED|
|D018|실제 인플루언서 통합 스키마|[4dbab18](https://github.com/WooSungHyun03/AD-Me/commit/4dbab188e3e1edf32456cafe11c1369939010a39)|IN_PROGRESS|
|D028|SNS 링크·공식 임베드·공유|[2882507](https://github.com/WooSungHyun03/AD-Me/commit/2882507e823471361b44480fb49eef86212d76e0)|IN_PROGRESS|
|D041|캠페인 기간·예산·산출물 계약|[c817d64](https://github.com/WooSungHyun03/AD-Me/commit/c817d644bbadab94b6769373c550f24290a935ef), [1054bce](https://github.com/WooSungHyun03/AD-Me/commit/1054bce25950e315571bb1a3ff71fb9941d6dfd6)|LOCAL_VERIFIED|
|D051|메시지 페이지·첨부·스팸 방지|[93ce710](https://github.com/WooSungHyun03/AD-Me/commit/93ce710d7614e9a95424888fd94c7bb608a1b7e3)|IN_PROGRESS|
|D059|정지·비공개 운영 잠금|[e4fca4b](https://github.com/WooSungHyun03/AD-Me/commit/e4fca4bc75d75e7bed7feddf65b13097a1d65960), [6e36d58](https://github.com/WooSungHyun03/AD-Me/commit/6e36d5877cf3d6dad4b5247d27ff7343ac64d661)|LOCAL_VERIFIED|
|D064|콘텐츠·계정 운영 runbook|[b6d4838](https://github.com/WooSungHyun03/AD-Me/commit/b6d48389f9bc10ba8ae544ed8325d3ca247d6d35)|BLOCKED_EXTERNAL|
|D065|무료·TEST 요금제 분리 정비|[48e674d](https://github.com/WooSungHyun03/AD-Me/commit/48e674da6faa81fa9ace33f1a4f23ea0b9f40d08)|IN_PROGRESS|
|D076|속도 제한·봇·리소스 남용|[48e8451](https://github.com/WooSungHyun03/AD-Me/commit/48e845179ef0766145907db6793997e930c59024), [a4d9991](https://github.com/WooSungHyun03/AD-Me/commit/a4d9991d3b20d3addfc48bff81fc093ab22ef585)|IN_PROGRESS|
|D081|실데이터 메인·로고·신뢰 표시|[35602e9](https://github.com/WooSungHyun03/AD-Me/commit/35602e903341f3fb2ed464c310d12f1c950e120f)|IN_PROGRESS|
|D084|회귀 테스트·실제 수집 계약 테스트|[5c9afd0](https://github.com/WooSungHyun03/AD-Me/commit/5c9afd0b65848c6eddb5fbc8af0a5db54adc54f2), [fee00fd](https://github.com/WooSungHyun03/AD-Me/commit/fee00fd1daf701a1a1a759dc8aefef43743539d1), [436171c](https://github.com/WooSungHyun03/AD-Me/commit/436171c5258e9debb5a3b81ed1ed4f47cd5220b9)|IN_PROGRESS|

## 검증과 보존

직전 앱 검증은 Node22 unit150/18, 로컬 Auth/DB E2E30, 무료 베타/no-Toss-key4, keyless4, 직접 REST35그룹, SQL3 및 세 기준 적용 패킷 PASS다. [실행 결과와 초기 실패 수정](../../harness/evidence/DEV-A-CONTINUE-20261120B/verification.json). 실제 provider/외부 SMTP/Toss/호스팅 성공을 대신하지 않는다.

이번 push 전 사전 검사는 secret scan·backlog·handoff 구조 검증이다. 기존 handoff validator의 Windows 기본 인코딩과 worker consumer 복합 경로 표기를 D003에서 수정했다. 소비 source path와 DB guard를 분리했으며 검사 규칙/수용 기준을 완화하지 않았다. 앱 동작·키·클라우드 설정은 변경하지 않았다.

이전 ZIP3개는 당시 source_head의 고정 스냅샷이며 소급 재작성하지 않았다. 최신 메타데이터 수정과 이 보고서는 작업 브랜치에서 확인한다. [티켓별 역사 기록](DEV-A_TICKET_COMMITS.md) · [런타임 원장](../../harness/handoff/runtime-status.json) · [최신 기능 인계](DEV-A_CONTINUATION_20261120B.md).

푸시 대상: [AD-Me의 작업 브랜치](https://github.com/WooSungHyun03/AD-Me/tree/codex/dev-a-p0-20261120). 원격 ref와 실제 SHA 일치 여부는 git push 후 별도로 확인한다.
