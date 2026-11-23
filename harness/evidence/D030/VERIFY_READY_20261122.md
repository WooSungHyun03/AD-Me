# D030 광고 이력 타임라인·경력 필터

D029의 실제 검토/공개 계약에 신규061/063을 더했다. ad_history_page + /api/ad-history/search, public-ad-history/AdTimeline, 개인 브랜드 경쟁사 RPC/API를 구현했다. brand 부분 일치/category 정확 일치/기간 겹침, 최신 공개 ad_evidence만 검색·총건수·안정 keyset·조건 결합 cursor, 정정/철회/정책·moderation 반영. legacy lookup의 cursor actor ID 노출은 적용061을 바꾸지 않고063으로 opaque 보강했다. 경쟁사20개·소유권 서버 결정·직접 테이블권한 없음·타계정/익명 표식 없음.

단위3, 실제 local Postgres/PostgREST3그룹 및 desktop/mobile 공개 조회→필터→개인 경쟁사 저장→익명 비노출→철회/집계 시나리오. 공통 결과/실패 수정/최종 source: ../DEV-A-READY-20261122/{verification.json,commits.json}. 실제 가상 계정/광고 근거/정책이며 외부 광고 사실·권리 승인 아님. 첫 기간 검사는 양끝이 겹치는 두 광고를 한 개로 기대해 기간 겹침 정의에 맞게 기대값을 고쳤다. actor canary 검사는 실제 cursor 문제를 찾아063을 적용했다.

개인 계정 범위이며 팀 경쟁사 공유는 D071 선행이다. 실제 정책/광고자료 검토·USER SQL/앱 적용/실제 QA URL·교차 리뷰는 남는다. 전체 DONE 아님. 중단 시 기존 공개 정책을 임의 켜지 않고 forward fix한다.
