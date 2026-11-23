# D060 업무별 운영 검색·감사

065 private support_audit와 strict DTO/page/cursor 기반 admin_support_search·새API/UI를 구현했다. /admin은 bulk profiles/reports/orders/raw profile·brief/audit select를 없애고 OTP 후 사유를 입력해20개씩 조회한다. super/support/content/campaign/finance 업무 범위, query 조건에 묶인 keyset·직접RPC50상한/분당60, 빈상태·에러·OTP 재확인·정상 페이지 전환. 일반 계정/만료OTP/타업무·export/role 요청은 거부한다. 원문·이메일/credentials/payment keys는 SQL/strict schema 양쪽에서 선택하지 않는다.

검색/현재 신고 검토·잠금은 actor/action/target/reason/requestId를 append-only 기록한다. API wrapper의 requestId를 핸들러 두번째 인자로 전달(기존1인자 핸들러 호환), 새 검색·신고·잠금 RPC에서 HTTP와 DB ID를 연결한다. legacy direct lock도 DB UUID 감사에 남고 reason없는 review_report는 거부한다. 이전 전문 검토/수집 원장은 보존하며 새 원장에 통합했다고 하지 않는다. UPDATE/DELETE trigger + 모든 앱 역할 direct SELECT/변경 거부. 소유자 migration 권한에 대한 암호학적 위변조 보장은 아니다. 임의 권한변경/대량반출 기능을 추가하지 않는다.

단위 API scope/owner injection/reason/strict DTO/요청ID, 실제 로컬 DB4그룹(최근MFA/role, 최소 DTO/커서, 사유/신고원자성, 원장불변/직접권한), native Auth TOTP desktop/mobile 운영자/위임자·조회/페이지·HTTP ID→DB audit·잠금/owner 재공개 거부를 확인한다. 공통 최종 결과/실패/정정/코드 SHA: ../DEV-A-READY-20261122/{verification.json,commits.json}. 합성 권한 JWT와 native MFA UI 검증을 구분한다.

초기065 문법오류(default20)는 transaction 실패로 적용되지 않았으며 수정 후 최초 적용했다. SQL immutable 이후 변경 없음. 기존 테스트의 상세없는 대량 화면/위임자 자동 intelligence 경로·select label 선택자는 새 UI 계약에 맞게 변경하고 같은 거부/보존 검증을 재실행한다. 실제 지원/사용자 PII를 쓰지 않았고 USER 환경·보존정책/적용·실제URL·교차 리뷰 전 DONE 아님.
