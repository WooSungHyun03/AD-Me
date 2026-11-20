# D029 광고 이력 제출·출처 검토 — 2026-11-20G

021/023에서 본인 프로필에 대한 브랜드·기간·형식·분야·경제적 이해관계·표시 확인·근거 종류/URL·제출 권한 확인을 D057 private revision에 저장한다. actor/is_demo/reviewer/date는 DB가 정한다. URL 중복은 대상 creator 기준 unique이며 정정도 원자 검사한다. 같은 key 재시도는 동일 case ID다.

단순 브랜드 언급·본인 진술·이해관계 미확인은 공개 여부와 무관하게 확인 광고(ad_evidence)로 분류하지 못한다. 광고 공개 정책은 기존 이슈 정책과 별도로 기본OFF다. 최근 OTP 승인 관리자/현재 version/명시적 근거 검토/광고 정책·프로필 게시/moderation을 모두 확인한다. 공개 DTO는 권한 확인 체크·actor IDs·내부 메모를 제외한다. 기존 fictional ads/DB 이력/로고는 보존하고 외부 콘텐츠·로고를 복제하거나 수집하지 않는다.

실제 local PostgreSQL/PostgREST8그룹 PASS: 위조 소유자·날짜·권한·unknown field, concurrent same key8→1, URL 중복/정정 롤백, brand mention/self declaration/unknown interest의 비공개·공개 확정 거부, 정책 분리·version invalidation·공개 allowlist·정정/철회·불변 history와 기존 가상 광고 데이터 hash 보존. 가상 사용자/광고/출처만 사용했으며 실제 광고/플랫폼 공급자 검증이 아니다.

신규 schema/API 단위6 + 기존7 = 전체 unit210/27파일, lint/typecheck PASS. 실제 Chrome desktop/mobile에서 제출→검토→공개→정정→구버전 승인 거부→새 version 재검토2건 PASS. 최초 실패는 label 전체 텍스트에 select options가 포함되는 테스트 locator 문제였고, 동일한 정확한 accessible name의 combobox role을 사용해 수정했다. 제품 판정이나 보안 조건을 완화하지 않았다.

최종 묶음의 SQL23/24→30 및 D057 consent 회귀/공통 증거는 후속 D084 인계에 기록한다. USER 정책 승인/적용·실제 URL·교차 리뷰는 남는다. D030 전체 검색/대량 timeline pagination, D018 실제 정규화 수집/플랫폼 소유 확인, 실제 출처 내용의 운영 검토는 별도이며 이번 fixture 통과로 완료를 주장하지 않는다.

## 최종 local 수용 기준 검증
실제 DB8(29개 이력)·API/schema6·전체210 unit·desktop/mobile2 및 실제 생성 SQL23/24→30 검증. 수용 기준 LOCAL_VERIFIED이며 실제 정책/USER 적용/출처 내용·플랫폼/URL·교차 리뷰는 외부/후속으로 남는다. DONE 아님. 종합 증거 DEV-A-EVIDENCE-20261120/verification.json.
