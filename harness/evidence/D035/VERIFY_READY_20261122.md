# D035 지표 가용성 기반 필터

D031 이후064/066과 기존 필터/API meta/UI를 확장했다. minEngagement 빈값/정수0~100, 원자적인 DB 검색/총건수/페이지에 조건을 적용한다. 현재 공개·claim·동의·정책의 fresh 비 YouTube 참여율만 허용하며 최신null/표본2미만/산식·기간 누락/미래 자료를 제외한다. 실제0%는 min0에 통과하고 미확보·placeholder0/DEMO fixture를 참여율로 전용하지 않는다. 제공가능 프로필수/공급원·정책/최소표본/산식 meta, 비활성 사유·조건해제 UI, 연령/성별 미수집·인자 거부. 기존 follower/catalog 계약과 old client 빈조건 호환 유지.

실제 local DB4그룹(D031 공유): policyOFF/old filter 호환, 원본0/null·YouTube derived 양쪽 surface 거부, min0/1·unknown demographics·미래 formula canary 비노출, 최신null·기간미래·표본/TTL/철회. desktop/mobile 실제 검색에서 자료 존재 시 활성/min0한개/min1없음/정책OFF 비활성·조건해제 확인. 단위 허용 없는 keyless fixture min0 거부. 최종 source/명령: ../DEV-A-READY-20261122/{verification.json,commits.json}.

모두 가상 관측/승인 policy fixture와 실제 로컬 DB이며 실제 공급자·정책 승인 아님. 새 derived_allowed 기본false, 승인 SQL 없음. 실제 자료/정책/USER 적용·URL·교차 검토 전 DONE 아님. 기존060까지 불변,066으로 적용064의 metadata 관측시각 방어를 추가했다.
