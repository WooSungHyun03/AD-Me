# 독립 레드팀 검토 프롬프트 (1~2일마다 수행)

AD Me 개발 코드에 대해 실제 실행 기반으로 RED TEAM 리뷰를 하라. 코드와 docs/QA.md를 읽고 문제를 찾아라. 다음 네 갈래로 검토하라:

1. SECURITY: RLS/IDOR, 다른 사용자 정보 접근, 위조 admin, storage upload, payment tampering/replay, secret leakage.
2. PRODUCT: 캠페인 생성~추천~제안~수락~결제까지 단절된 부분, missing/error state, fake data used as factual.
3. MATCHING: 가중치 총합, 결측치 처리, 랭킹 독립성, 데이터 출처, 근거없는 AI 설명.
4. DESIGN: 사용자 제공 로고의 대비, 모바일, 키보드, 스크롤, 카드 반복, B2B 신뢰감.

문제를 `MUST/SHOULD/OPTIONAL`, 재현 단계, 파일:행 또는 화면 경로, 수정 방법, 검증 테스트로 구체화한다. MUST 문제를 수정하고 검증하기 전 출시/완료로 보고하지 마라. 리뷰만 하지 말고 실제 테스트를 작성하거나 실행해서 확인하라.
