# D057 근거 검토 흐름 — 2026-11-20G

019/020에서 비공개 제출·정정 version·당사자 답변·검토·감사와 공개 allowlist를 구현했다. 공개는 기본OFF 정책, 승인된 현재 version, 명시적 공개 판정, 대상 공개/moderation 조건을 모두 충족해야 한다. 원본 주장·내부 메모·비공개 입장·actor IDs는 공개 DTO에서 제외한다. 미확인 주장은 공개하거나 위험 점수/검색 제외로 연결하지 않는다.

직접 DB/REST9그룹 PASS: concurrent retry8→1case/1quota, 정정 경합과 stale review, 당사자 답변의 version 증가, anon/foreign/stale MFA/self review/정책OFF 거부, private/public 경계·정책/중재/철회·불변 history/audit·실제 cursor/한도. 실제 local PostgreSQL과 가상 사용자/근거만 사용했으며 테스트 정책은 fixture로 켠 뒤 복구했다. SQL owner fixture 정리는 격리 DB에서만 transaction lock 아래 history DELETE guard를 잠시 해제하고 해당 fixture만 지운 뒤 복구한다. 제품/RLS 부정 검사를 우회하지 않는다.

source API/폼/내 검토함·당사자 입장/최근OTP 운영 검토함·프로필 공개 자료를 연결했다. 기존 reports 행/legacy 검토 기능과 데이터·ID는 보존한다. 기존 POST payload/ok:true를 유지하고 evidenceKind 기본claim/clientKey를 추가했다.

IN_PROGRESS: 실제 U001/D073 정책 승인·USER 적용/실제 URL·교차 리뷰가 남는다. 현재 private history는 보존하지만 장기 대량 history의 별도 페이지 API는 후속 보강이다. D029 후속 변경을 묶어 최종 브라우저/공통 검증과 한 적용 SQL 증빙을 남긴다. 로컬 통과를 실제 정책/법적 검증으로 보고하지 않는다.
