# D054 결과물 버전 USER 적용 패킷

정확한 기존30개 migration 기준에025 하나를 추가한다. 새 키/설정 등록은 없다. SQL/manifest의 hash는 UTF-8 LF 기준이며 Windows CRLF checkout은 LF로 정규화해 검증한다. source_head가 실제 커밋인 MANIFEST.json을 사용한다. agent가 외부 콘솔/배포를 수행한 패킷이 아니다.

1. USER가 복구 지점을 확인하고 기존 SQL Editor에서 `00_preflight_current_30.sql` 실행: 결과가 오류면 다음 파일을 실행하지 않는다. unknown/custom/hardened/이미 적용/부분 적용은 개발자 재검토 대상이다.
2. `01_stage_current_30.sql` 전체 실행: 원자 적용, 기존 ID/메시지/협업 상태 보존, 과거 확인/승인자 발명 없음. 무제한 대기 대신 lock5초/statement60초 후 실패한다. 실패하면 트랜잭션 전체 rollback이다.
3. `02_verify.sql`: 이력31개, private5개 RLS=true/clientSELECT=false, public gateways invoker/volatile, 전역 enabled=false를 확인한다. stage는 구형 앱 호환 단계로서 보안 완료가 아니다. 새 버전을 채택한 managed 방은 stage에서도 version 없는 status 변경을 거부한다.
4. USER가 manifest source_head를 포함하는 새 source 배포 후 실제 URL에서 두 역할 제출·수정·재제출·오래된 승인409·최신 승인·타인 거부를 확인한다. [인계 문서](../../docs/handoff/DEV-A_DELIVERABLES_20261120.md)의 D049 교차 리뷰도 필요하다.
5. 조건을 확인한 뒤 `03_activate.sql` 전체 실행,02로 enabled=true 및 최초 release_ref/activated_at 보존을 확인한다. activation은 DB owner만 가능하고 일방향이다. 실행만으로 실제 URL 검증을 대체하지 않는다.

기존30에 해당하지 않으면 임의 migration 이력 편집/함수 삭제로 통과시키지 않는다. 개발자가 읽기 전용 확인 후 맞는 추가 패킷을 준비한다. stage 이후 이미 managed인 방과 전역 활성화 이후에는 구형 앱만으로 복귀할 수 없으며 source 전진 수정이 필요하다. 확정 이력 삭제/경계 재개방은 복구 방법이 아니다. 일반 메시지·기존 수락/거절은 유지한다. CLI raw025는 기본 strict이므로 stage와 중복 적용하지 않는다.

URL/설명 snapshot과 실제 검토 actor/time을 보존한다. 외부 URL의 파일 바이트 불변이나 광고의 법적 적합성 검증은 포함하지 않는다. 기존 완료에 누락된 표시 확인/검토 근거는 legacy로 표시하며 가짜 기록을 보충하지 않는다. 전체 릴리스와 실제 공급자 성공은 미확인이다.
