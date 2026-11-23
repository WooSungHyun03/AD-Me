# D051 메시지 기능 인계 — 2026-11-20F

기준9a45fc0 / 기존 codex/dev-a-p0-continue / main65063c8. D049의 협업 상태 전이와 기존 메시지·프로필 ID/본문은 보존했다. 외부 설정·키·배포·실제 사용자 메시지는 건드리지 않았다.

## 구현

- 방을 펼칠 때 해당 방의 최근20개만 읽고 시간+UUID tie-break cursor로 과거 기록을 더 읽는다. 최대50개, 방에 묶인 cursor, 응답 no-store, UTC 저장/KST 표시. 대시보드의 전체 메시지 조회를 제거했다. 다른 방/anon은 DB에서 거부하며 공개 invoker RPC는 volatile이다.
- 전송에 sender+room+clientKey 고유키와 방 row lock을 사용한다. 동일 내용의 재시도는 같은 메시지 ID를 반환하고 quota를 다시 차감하지 않는다. 같은 키로 내용을 바꾸면409다. 구버전 payload는 서버에서 새 key를 만들어 지원하나, 키를 유지하지 않는 구버전 클라이언트에는 네트워크 재시도 중복 방지를 보장하지 않는다.
- 새 폼은 처리 중 재전송을 막고 결과 불명/네트워크 실패에도 같은 payload의 key를 유지한다. 성공 시 key를 교체한다. actual server commit 후 응답만 끊긴 상황을 브라우저에서 재현해 재시도2회→저장1개를 검증했다.
- 차단은 방 참여자가 본인 설정만 바꾼다. 한 사람이라도 차단하면 양측의 새 메시지를 RPC·직접 INSERT 모두 거부한다. 기존 대화는 참여자에게 유지한다. 이미 성공한 동일 key의 재시도는 새 쓰기 없이 이전 ID를 확인한다.
- 신고는 다른 참여자의 실제 메시지에만 가능하며 사유10~2000자, 사용자/메시지당 중복1개, 시간당5·일10개다. private RLS 테이블은 anon/authenticated/service role이 직접 읽거나 쓰지 못한다. 신고 사유는 대화 상대에게 반환하지 않는다. 운영자 검토 UI 연결은 후속 D060/D057 범위다.
- 기존20/min·200/day 전송 한도를 유지하고 읽기120/account/min, 차단30/account/min을 DB에서 강제한다. 신규 INSERT의 위조 sender·방·거절 상태·moderation 및 credential 없는 HTTPS 링크를 검사한다. 본문은 React 텍스트로 표시하고 과거의 안전하지 않은 URL도 화면에서 제외한다.

## 적용 순서

USER는 [검토된 SQL](../../deliverables/dev-a-messages-20261120.sql)을 DB owner SQL Editor에서 적용한 다음 새 source를 배포한다. 터미널/코드 편집/패키지 설치가 필요 없다. 에이전트는 해당 작업을 대행하지 않았다.

SQL은 **앞선 읽기 경계 패킷까지 정확한23개 migration 이력**을 확인하고24번째018을 한 트랜잭션으로 적용한다. 다른 이력·이미 존재하는 새 스키마/컬럼·중복 적용이면 멈춘다. lock5초/statement60초 제한이 있다. 원본 데이터 변경 없이 nullable key와 인덱스/새 private schema/호환 RPC·INSERT guard를 추가한다. 이미 적용한 source migration을 다시 수정하지 않는다.

구버전의 정상 message INSERT는 계속 작동한다. 새 클라이언트가 차단한 방, 위조 sender, 제한된 프로필/캠페인, 잘못된 링크의 신규 전송은 차단하는 것이 의도된 동작이다. 기존 read_boundary의 strict/staged 상태는 이 SQL이 바꾸지 않는다. 앞선 공개 읽기 활성화 절차도 그대로 남는다. 실패 시 트랜잭션 롤백 후 에이전트가 실제 이력을 읽어 전진 수정안을 만든다. 데이터를 지우거나 기존 보안 정책을 다시 열지 않는다.

적용 후 확인: 이력24개, messages.idempotency_key 존재, adme_messaging 테이블2개/RLS2개, conversation_* public 함수4개 모두 invoker+volatile. 실제 URL에서 두 참여자의 조회·전송/결과물·읽음·협업 전이·차단/신고와 외부 방 거부를 에이전트가 재검증한다.

## 증거와 남은 범위

[검증 결과](../../harness/evidence/D051/verification-20261120.json): Node22 lint/typecheck/unit197/25파일, 신규 API 계약7, 실제 DB/REST8그룹·기존 rate8그룹, desktop/mobile Chrome 신규 대화2+기존 두 역할 golden2, production build PASS. 별도 격리 DB에서 생성 SQL23→24를 실제 실행해 기존 메시지 hash·구버전 INSERT·공개 read 상태 보존, 알 수 없는 이력/중복 적용 거부를 확인했다. 화면 캡처도 두 viewport에서 확인했다. 가상 사용자·본문만 사용했으며 실제 공급자/외부 발송 검증이 아니다.

D051은 **IN_PROGRESS**다. D027의 MIME/크기/소유권/삭제·방별 재인가를 갖춘 Storage 첨부가 없으며 현재 HTTPS 결과물 링크는 파일 첨부가 아니다. signed URL 수명과 다른 방 첨부 재사용 거부는 그 계약을 받은 뒤 연결한다. D049 교차 리뷰와 실제 URL 검증도 남는다. 참여자 read RLS를 유지한 기존 raw REST SELECT 자체를 새 검색 RPC로 대체하거나 완전한 봇 방지를 했다고 주장하지 않는다.
