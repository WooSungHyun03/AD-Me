# D080 — 성인 범위·민감 데이터 경계

상태 LOCAL_VERIFIED. 만19세 이상 자기확인과 실제 연령/신원 검증의 차이를 안내한다. 주민번호/생년월일/신분증·얼굴 인식 API를 추가하지 않았다. full identity/metric/profile 허용 입력을 고정하고 건강/정치/종교/얼굴 등 민감 지표와 분명한 주민번호·전화·이메일 공개 패턴을 NFKC 정규화 후 TS/SQL 양쪽에서 거부한다. 업무용 비공개 담당자 이메일 목적은 보존한다. 048/051은 기존 오염 공개 DTO를 숨기며 자동 삭제하지 않고 공개 브랜드 오염 시 preflight 중단한다.

단위검사와 실제 SQL/REST 동의·민감 경계 및 브랜드/creator 공개 DTO·권한 검사가 통과했다. full identity는 strict이고 provider key 추출 projector는 기존 계약을 유지한다. 이 규칙은 모든 자유문장의 개인정보를 탐지하는 완전한 DLP가 아니다. 권리 요청·운영 검토와 U001 최종 정책/실제 수집 승인·DEV-B review는 남는다. 자기확인을 신원 확인으로 보고하지 않는다.

공통 결과/소스: [verification](../DEV-A-P0-NEXT-20261121/verification.json), [commits](../DEV-A-P0-NEXT-20261121/commits.json).
