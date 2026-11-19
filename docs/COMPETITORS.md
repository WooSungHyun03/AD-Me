# 경쟁사 기능 벤치마크 — 2026-11-19 공개 자료 기준

> 아래는 경쟁사 공식 소개에 기반한 공개 기능 사례다. 업체의 코드, 상표, 데이터베이스 또는 UI를 무단 복제하라는 지시가 아니다. AD Me가 사용 경험 및 기능 패턴을 자체 구현한다.

| 회사 | 공식 확인 기능 | AD Me 대응 | 구현 난이도 |
|---|---|---|---|
| Featuring / 피처링 | 고급 필터/리스트업 자동화/유사 그룹/CSV 업로드·엑셀 출력/DM·이메일/캠페인 관리/성과 리포트 | creator filters, shortlist, CSV, outreach, metrics | 중·상 |
| REVU / 레뷰 | 캠페인 생성·지원자 모집·선정·운영·정산·결과 추적 | 캠페인 공고, 참여 지원, 상태 머신, 결과물 | 중 |
| Modash | AI 자연어 탐색/오디언스 분석/유사 인플루언서/브랜드 협업 연혁/리스트/관계 관리 | 추천·설명·광고 이력·유사 후보 | 중·상 |
| HypeAuditor | 참여율/오디언스 특성/진위성/브랜드 안전성/성과 분석 | 데이터가 제공된 경우 출처 표시 분석 | 상 |
| CreatorIQ SafeIQ | 멀티모달 콘텐츠 컨텍스트 위험 검토, 검토 증거 제공 | 출처 기반 검토 기록/분쟁·정정 요청 | 상 |
| GRIN | 인플루언서 CRM, 자동 outreach, gift/affiliate, creator lifecycle | 상태 보드/AI 초안/결과물 등록 | 중 |
| Aspire | 크리에이터가 캠페인에 직접 지원, 브랜드 측 선발/협업 | 양면 마켓플레이스 | 중 |
| Collabstr | 마켓플레이스/채팅·결과물/결제·에스크로 | 제안·수락·결과물·Toss 테스트 | 중~상 |

## 공식 링크 (추가 확인 가능)
- 피처링: https://featuring.co/pricing ; https://featuring.co/product-campaign-management
- 레뷰: https://biz.revu.net/ ; https://biz.revu.net/direct
- Modash: https://help.modash.io/en/articles/13714522-what-is-modash-and-how-does-it-work ; https://www.modash.io/features/influencer-vetting
- HypeAuditor: https://help.hypeauditor.com/en/articles/2221686-what-is-hypeauditor-and-what-can-it-do
- CreatorIQ: https://www.creatoriq.com/brand-safety
- GRIN: https://grin.ai/ ; https://grin.co/
- Aspire: https://www.aspire.io/features/creator-marketplace
- Collabstr: https://collabstr.com/ ; https://help.collabstr.com/en/article/what-is-collabstr-1bz1tdk/

## 차별화 전략
1. **분위기/브랜드 이미지 적합성**을 구분된 태그(청아함·맑음·고급스러움·발랄함 등), 콘텐츠 종류, 타깃 적합도에 결합한다.
2. 크리에이터를 추천하기 전 **광고 이력·경쟁사 협업·출처 기반 이슈**를 통합 검토한다.
3. 추천 근거를 분해 가능한 점수로 보이고 **유료 노출과 유기적 추천**을 완전히 분리한다.
4. 단순 리스트업이 아니라 브랜드와 크리에이터 **양면 제안 및 수락·운영**까지 흐름 연결.
5. 작은 크리에이터도 가입하여 콘텐츠 포트폴리오를 등록하고 노출될 기회를 갖는다.

## 경쟁사에서 가져오지 않을 것
- 경쟁사의 비공개 DB, 소스 코드, UI 자산, 상표, 유료 크리에이터 데이터 무단 복제
- fake followers와 같은 수치를 독자 추정하면서 검증된 통계처럼 표시하는 것
- 공식 API 권한이 없는 SNS 대량 크롤링을 서비스 필수 의존성으로 삼는 것
- 자동 명예훼손성 스코어링 또는 실제 사람의 미확인 논란을 증폭하는 것
