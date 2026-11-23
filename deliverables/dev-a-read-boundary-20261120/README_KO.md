# DEV-A 공개 읽기 경계·호환 적용 — 2026-11-20E

USER가 외부 콘솔·배포를 수행한다. 개발자가 소스/SQL/테스트를 준비했으며 터미널·코드 편집·설치를 요구하지 않는다. 기존 ZIP5개와 SQL19개는 보존했다. 새014~017 네 migration을 추가한다.

1. 에이전트가 현재 이력/정책을 읽어 기준을 확인한다. 현재19이면 current_19, 기존8/12/16/18이면 각각 main_8/integrated_12/previous_16/terms_18의00_preflight를 SQL Editor에서 실행한다.20/21/22/이미23/사용자가 따로 강화한 정책은 자동 staging하지 않고 중단한다. 권한을 재개방하지 않도록 원래 정책 hash/anon grant도 검사한다.
2. 맞는01_stage 파일 전체를 SQL Editor에서 실행한다.014~017은 하나의 트랜잭션과 잠금 제한으로 적용되며 enabled=false 상태에서 기존19의 읽기 권한을 유지한다. 따라서 이 단계의 구버전 페이지를 갑자기 막지 않는다. 이 상태는 아직 원본 공개 읽기가 유지되므로 보안 완료가 아니다. 부분 실패 시 반복/수정하지 말고 에이전트가 상태를 읽어 복구안을 준비한다.
3. 새 source를 검토하고 USER가 적용한다. 에이전트가 실제 URL의 공개 목록/기존 프로필 주소/즐겨찾기/CSV/제안/지원/관리자·본인 설정을 검증한 후03_activate.sql을 SQL Editor에서 실행한다. 실제 소스 commit reference가 파일에 들어 있으므로 소스 편집이 필요 없다.23개 이력과 enabled=true/원본 anon SELECT=false를02_verify로 재확인한다.
4. 활성화는 owner SQL 전용이며 앱·서비스 role·관리자 JWT에는 권한이 없다. 한 번 켜면 false/삭제/activation 증거 변경을 거부한다. 문제가 생기면 공개 진입을 중단하고 forward fix하며 raw JSON 공개 권한을 다시 열거나 MFA/기존 데이터/이력을 삭제하지 않는다.

원본 테이블은 본인/승인 MFA 관리자만 읽고 공개 RPC/HOT/saved는 allowlist를 반환한다. 제안은 기존 API 입력/ID/201응답을 유지하는 원자 RPC이며 기존 직접 INSERT의 역할/실제 소유자 RLS도 유지한다. 원본 ID/FK/JSON/기존 링크를 변경하지 않았다. user-AuthUUID 공개 주소의 opaque-ID 이관, D033 실제 server search, 정책/수집·전체 권한/Storage/테넌트 검토는 여전히 미완료다.

직접 source migration/CLI 적용은 기본 strict이다. 이 패킷의 검증된 옛19 대상 atomic stage만 기존 읽기를 잠시 유지한다. 이미 strict인 DB의 경계를 끄는 패킷이 아니다. source_head 이후 전달 커밋은 산출물/메타데이터다. 실제 provider/결제/배포 검증을 fixture 통과로 주장하지 않는다.
