# D064 — 콘텐츠·계정 사고 runbook

상태 LOCAL_VERIFIED. 운영자/지원 연락 경로, MFA·위임 역할 차이·소유자 재공개로 우회 못하는 실제 D059 잠금과 D057 검토 경로를 현재 코드에 맞췄다. 사칭/개인정보/명예훼손 우려/침해/계정 탈취 다섯 가상 사건을 접수→제한→근거→통지 판단→복구/후속 단계로 검토하고 기술 처리 기록을 남겼다.

[runbook](../../../docs/operations/incident-response.md), [가상 처리 기록](../../../docs/operations/incident-tabletop-20261121.md). 실제 로컬 보안·동의·삭제 재유입·근거 검토·복구/MFA 검사에 연결했다. 개발자 단독 기술 모의훈련이며 실제 사건/외부 통지·USER 콘솔·사람 운영자 참여가 아니다. U001 최종 보존/권리/통지 정책과 실제 담당자 review는 여전히 외부 gate다. 오래된 JWT 즉시 차단·파일 전체 파기를 이 문서로 보장하지 않는다.

공통 결과/소스: [verification](../DEV-A-P0-NEXT-20261121/verification.json), [commits](../DEV-A-P0-NEXT-20261121/commits.json).
