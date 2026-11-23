# D054 결과물 버전·수정 요청·승인 — 2026-11-20H

DEV-A / 기존 브랜치 `codex/dev-a-p0-continue` / 시작 `0abc1ee`. 상태는 LOCAL_VERIFIED, DONE 아님. 계획과 steward 변경 의도는 PLAN_20261120.md, 수용 기준별 증거는 verification.json과 네 개 DB receipt에 있다.

링크 저장과 검토 제출을 분리했다. 제출 설명·링크·실제 작성자·시각을 버전별 snapshot에 보존하고, 제출자의 광고 표시 확인 및 브랜드 검토 의견·승인 근거·표시 확인·실제 actor/시각을 불변 기록으로 남긴다. 현재 active submission과 room revision을 잠금 하에 확인한다. 수정 요청된 버전은 새 제출본 없이 재제출/승인할 수 없다. 다른 탭의 구버전 승인은409이며 새 버전의 체크박스도 초기화한다. 같은 key/내용의 응답 유실 재시도는 기존 결과를 돌려주며, 다른 내용 재사용은 충돌한다.

025는 새 private schema의5개 RLS table과 participant RPC를 추가한다. private table/DTO helper/owner activation의 client 권한을 차단하고, 직접 REST·구형 status RPC도 strict 또는 managed room에서 versioned review를 우회하지 못한다. 기존 ID/본문/링크/상태/광고 이력은 유지한다. 과거 완료에 확인·승인자를 발명하지 않으며 legacy로 표시한다. 저장된 URL/설명은 불변이지만 외부 URL의 실제 바이트 불변은 보장하지 않는다. Storage 파일 검증은 별도 범위다.

Node22 lint/typecheck/unit218/28파일·production build·Harness5·backlog validation PASS. 실제 격리 PostgreSQL/PostgREST 신규10그룹+기존 rate8/conversation8 PASS. 실제 local Auth/TLS Chrome desktop1440×900/mobile390×844에서 신규2+두 역할 golden2+일반 메시지2 PASS. locator를 실제 상태 badge로 강화한 뒤 신규2건 재통과. 기존30→31 USER stage SQL을 별도 DB에서 실행해 비어 있지 않은 원본 hash, staged 구형 앱, managed 방 선행 보호, owner-only 일방향 activation과 unknown/custom/reapply 거부를 검증했다.

발견·수정: 회귀 검사8개가 통과한 뒤 fixture 계정 삭제가 새 감사 FK로 실패했다. exact local DB와 해당 fixture room에 한정해 감사 기록도 정리하고8개 재통과했다. 제품 권한/불변 guard는 완화하지 않았으며 fixture 정리의 trigger 복원은 같은 트랜잭션이다. SQL025는 실제 적용 이후 수정하지 않았다. 테스트 삭제/skip 없음.

가상 사용자·결과물·표시 진술만 사용했다. 실제 광고 표시/법률/외부 URL 콘텐츠·플랫폼/Toss 성공 검증이 아니다. golden flow의 TEST 결제 backend503은 예상 거부이며 공급자 통과가 아니다. D029 공개 광고 이력으로 자동 전환하지 않는다.

USER의 기존30 정확성 검토·SQL 적용·새 source 배포·실제 URL 두 역할 검증·활성화와 D049 steward 교차 리뷰가 남는다. stage만으로 보안 완료가 아니다. 다른 담당/USER 상태와 backlog 배분은 수정하지 않는다. 변경 경로/API/적용·복구·D056 인계는 docs/handoff/DEV-A_DELIVERABLES_20261120.md에 있다.
