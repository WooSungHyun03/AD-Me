# D012 — 브랜드와 담당자 분리

DEV-A · 2026-11-19 KST · root HEAD 4437eb1 / codex/dev-a-p0-continue (미커밋)

구현 전 계획은 DEV-A-P0-CONTINUE/PLAN.md에 기록했다. SQL 006/007, brand-profile.ts, account PATCH, 공개/연락처 GET, 설정 폼을 구현했다. 공개 DTO v1은 owner_id/담당자를 제외하며 직접 REST 컬럼 권한도 제한했다. 담당자는 별도 테이블/RLS로 저장하고 수락한 참여자에게만 선택적으로 공유하며 철회 후 조회를 거부한다. 이름·브랜드·담당자 저장은 원자적이다. 사업자번호·인증 배지를 요구하지 않는다.

단위 계약, 격리 REST 공개/타인 수정 거부/잘못된 담당자 rollback/참여자 공유·철회, desktop/mobile E2E를 실행했다. [공통 결과](../DEV-A-P0-CONTINUE/verification.json), [REST 결과](../DEV-A-P0-CONTINUE/local-brand-security.json). 모든 자료는 가상 로컬 fixture다.

**IN_PROGRESS**: D011 리뷰와 D027 업로드 연결이 남았다. 로고는 준비 중으로 표시하며 임의 URL을 수락하지 않는다. 새 테이블 삭제/보존 계약은 D014/D079에 인계한다. 외부 적용·새 배포 없음.
