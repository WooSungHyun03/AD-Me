# DEV-A 준비된 P1 적용 패킷 — 60 → 67

대상 D030/D031/D035/D060. 신규61~67은 과거60개 SQL 및 기존 전달물을 수정하지 않는 증분이다. [manifest](MANIFEST.json)에 정확한 티켓 source SHA와 LF SHA256을 기록한다. [선행사항 목록](../../docs/handoff/DEV-A_PREREQUISITES_20261122.md) · [검증 증거](../../harness/evidence/DEV-A-READY-20261122/README.md).

1. USER가 대상 Supabase SQL Editor에서 `00_preflight.sql`을 실행한다. 정확한60 이력·기존 함수·삭제 접근 hook을 검사한다. STOP이면 이력/함수/권한을 임의 삭제·수정하지 말고 개발자가 대상에 맞는 패킷을 준비한다.
2. 통과한 대상에 `01_apply_current_60.sql` 전체를 한 번 실행한다.61~67과 이력이 한 트랜잭션이다. 중간 오류/시간 초과는 전체 롤백하며 기존 비어 있지 않은 프로필·광고 이력·원본 관측값을 보존한다.
3. `02_verify.sql` 결과: 이력67, 기존 삭제 intake OFF 유지, competitors/support_audit RLS=true와 direct_select=false, private_probe=false, 감사 UPDATE/DELETE trigger 활성 상태를 확인한다. 기존 공급원·파생 지표를 승인하지 않으며 새 derived_allowed/history_allowed 기본false다. 현재값 공개 승인이 시계열 공개 승인으로 확대되지 않는다. history_allowed/history_window_seconds/history_permission_ref는 실제 공급원별 허용 이력/기간/권리 근거를 USER가 확정한 뒤 개발자가 별도 검토 패킷으로 준비한다. 이번 패킷에는 활성화 SQL이 없다.
4. USER가 배포 시점을 조율해 MANIFEST의 source 및 후속 산출물 커밋을 포함한 새 앱을 적용한다. 기존 reason 없는 신고 검토 RPC는 거부되므로 SQL과 새 클라이언트를 한 릴리스로 조율한다. 개발자가 대상 QA URL에서 두 역할·운영 OTP·조회/권한·정정·철회 회귀를 검증한다. 배포 수행·완료를 이 패킷이 대신하지 않는다.

변화: 공개 승인된 현재 광고 버전만 검색/집계하고 개인 브랜드 경쟁사 표식은 타 계정에 제공하지 않는다. 과거 관측의 0/null/공백을 보존하고 출처·기간·산식·표본을 표시한다. YouTube 파생 지표는 비활성이다. 비 YouTube 참여율은 승인 정책/공개·claim·동의/갱신 기한/명시적 산식·기간/표본2개 이상을 모두 만족할 때만 필터 후보이며, 복수 연결 자료 중 하나가 최솟값을 충족해야 한다. 인구통계는 수집·제공하지 않는다.

운영 검색은 최근 OTP와 현재 업무 역할을 DB에서 재확인한다. super 전체/support 회원·신고/content 프로필·수집/campaign 캠페인/finance TEST 주문이다. 서버20개 페이지, 직접RPC 최대50, 검색 분당60 한도이며 raw profile/brief/job input/output, 이메일·인증정보·결제키를 내보내지 않는다. 각 조회와 새 신고·운영 잠금은 사유/actor/action/target/requestId를 append-only 보관한다. 기존 전문 검토/수집 콘솔의 별도 감사 원장은 이 화면의 검색 감사와 구분한다. 신규 권한 변경/대량 반출 기능은 없다. 자기 역할 변경은 기존 DB guard가 계속 거부한다.

새 private 경쟁사/지원 감사·파생 산식/표본/기간 메타데이터 처리 목적과 미확정 보존은 policy-processing-register에 기록한다. 운영 최종 정책/위탁/리전/백업 예외를 승인하거나 기간을 임의 확정하지 않는다. 삭제 intake나 공급원 정책을 켜는 SQL, 비밀값, 키 발급/등록/외부 메일·실제 결제는 없다. 가상 로컬 fixture를 운영에 복사하지 않는다.

복구는 원장/감사 기록 삭제·trigger/RLS 해제·migration 이력 삭제가 아닌 개발자의 forward fix와 USER의 검토된 앱 릴리스로 진행한다. USER에게 터미널·코드 편집·설치를 요구하지 않는다.
