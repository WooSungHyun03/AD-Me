# 근거 검토·광고 이력 적용 — 2026-11-20G

USER가 외부 콘솔·배포를 수행한다. 개발자는 source/마이그레이션/검증을 완성했다. 터미널·소스 편집·패키지 설치를 요구하지 않는다. 기존 ZIP6개와 이전24개 SQL은 보존한다. source commit/hash는 MANIFEST.json에 기록한다.

1. 개발자가 실제 대상의 migration 이력을 읽어23개 또는24개 기준을 확인한다. 해당00_preflight를 DB owner SQL Editor에서 실행한다. 다른 이력/부분 적용/이미 새 schema가 있으면 중단한다.19개 이하라면 이전 read boundary/메시지 확장 인계를 먼저 확인하며 preflight를 우회하지 않는다.
2. 맞는01_apply_previous_23 또는01_apply_current_24 전체를 SQL Editor에서 실행한다.23은 검증된 기존 메시지 확장을 먼저 적용한다.019~024 여섯 migration은 한 transaction/lock5초/statement60초 제한으로 적용한다. 실패한 transaction은 롤백되며23 기준의 이전 메시지 확장은 별도 transaction으로 남을 수 있다. 반복하지 말고 개발자가 실제 이력을 확인한다.
3.02_verify에서30개 이력, private5테이블 RLS5/no-client SELECT, public invoker/volatile RPC, 이슈·광고 정책 모두OFF를 확인한다. 기존 report/message/profile 데이터와 read boundary/grant는 바뀌지 않는다.
4. USER가 source를 적용한 뒤 개발자가 실제 URL의 제출/정정/답변/검토/공개 OFF, 기존 가입·캠페인·제안/메시지·관리자 흐름을 재검증한다. 실제 source_head 이후 산출물 커밋은 앱 코드를 바꾸지 않는다.
5. 공개 정책은 이슈(enabled/version/approval_ref)와 광고(ad_enabled/ad_version/ad_approval_ref)가 독립적이다. 실제 U001/D073 승인 version/근거를 받은 뒤 개발자가 실행 가능한 별도 SQL을 준비한다. 이번 패킷에 더미 정책 활성화 SQL은 없다. 정책 승인·활성화 없이 공개 기능 완료로 보고하지 않는다.

기존 접수 신고는 기존 관리자 화면, 새 제출/당사자 입장/광고 이력은 근거 검토함에서 확인한다. legacy reports POST payload/ok:true와 기존 DB 정상 INSERT·ID는 유지한다. 공개는 승인된 현재 version·강한 근거·출처·정책·프로필 게시/moderation 조건을 모두 확인한다. 원본 주장/내부 메모/UID/비공개 입장은 공개하지 않는다. 실제 브랜드 로고·콘텐츠를 복제/수집하지 않았다. fixture 통과는 실제 광고·플랫폼·법률 검증이 아니다.

복구는 forward fix이며 데이터/이력 삭제·MFA 우회·원본 공개 권한 재개방을 하지 않는다. 문의/이상 상태는 개발자가 재현·수정한다. 장기 history pagination/대규모 검색·Storage/철회·보존·실제 정규화/정책·출시 전체 게이트는 남아 있다.

해시 검증은 SQL_CANONICAL.json의 UTF-8/LF 기준과 최초 전달 Git commit의 실제 SQL blob을 함께 사용한다. Windows/Linux 줄바꿈 차이는 허용하며 SQL 내용 변경은 거부한다. MANIFEST.json의 raw hash/size는 최초 생성 시점의 증거로 그대로 보존했다. 전달 SQL 원문을 다시 수정하지 않았다.
