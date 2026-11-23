# 남은 P0: D073 공개 저장 원자 통합 → D084 회귀

시작0a2be26, clean 기존 codex/dev-a-p0-continue. AGENTS/shared contract/v2 backlog/REAL_SERVICE/역사40/세션/설치 Next route 문서 확인. D007/D009 변하지 않은 외부 gate, D014 실제 파기는 DEV-B D079 및 U001 미승인 보존 계약을 유지한다. 이번 독립 구현은 D073의 남은 profile/brand 공개 저장→동의 원장 연결이다. D084는 해당 actual local DB/REST/브라우저 회귀를 추가한다. 외부 콘솔/키/배포 없음.

공유 변경 의도: creator/profile/account API·forms·consent history 및 새055 예약. 원장에 global/creator/brand 범위를 구분하고, request key+payload hash를 actor에 묶어 lost ACK replay가 오래된 공개 상태를 재적용하지 않도록 한다. 공개 저장+동의 event+결과 receipt는 같은 DB transaction. 기존 direct REST/legacy brand RPC의 공개 우회는 strict boundary에서 거부하고 직접 비공개/삭제는 승인 만료 후에도 허용·철회 기록한다. 기존54 적용 SQL/이전 artifacts 불변. raw055 strict 기본, 새 USER54→55 패킷만 source 교체 전 staged compatibility를 유지하며 단방향 활성화는 USER 몫이다. staging을 동의 완료라 하지 않는다.

개별 수용: wrong/stale policy·role/owner·extra fields·key 재사용 payload 충돌·실패 rollback·동시 요청1event·global 철회와 replay 시 재공개 방지·legacy bypass 거부/직접 privacy restriction 허용. 실제 marked loopback QA를 재사용하고 해당 SQL/REST·unit/API·desktop/mobile 검증 후 공통 lint/typecheck/unit/build 및 필요한 기존 regression을 한 번 실행한다. 실제 정책 승인/공급자/실제 삭제는 완료로 올리지 않는다.

최종:055 applied 불변, 실제 brand trigger record 필드 참조 오류를056, global old-receipt 재적용을057 forward fix로 해결했다. v2 API는 현재 철회인지 구분하고 오래된 결과이면 UI가 실제 페이지를 다시 읽는다. USER 패킷은54→57 하나. 전체58(055/056) 뒤 최종057/v2 영향10·fresh document/streaming 준비 캡처4, free6/keyless10으로 영향 범위를 다시 검사했다. 서로 다른 새 key의 순서는 서버 처리 순서이며 클릭 시각 CAS가 아니다. D073 정책 승인 대기·D084 실제 삭제/공급자/릴리스 gate 유지, 타인/미변경 blocker는 재시도하지 않았다.
