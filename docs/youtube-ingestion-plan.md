# YouTube 발굴과 갱신

공식 Data API v3의 search.list, channels.list, playlistItems.list, videos.list를 사용한다. 채널 ID를 고유 키로 삼고 채널명 변경 시 기존 레코드를 갱신한다. daily 작업은 키워드당 한 페이지 최대 5개 신규 후보와 오래된 채널 최대 20개를 검사한다. 채널과 영상 조회를 묶고, 채널마다 최신 공개 영상 5개를 대상으로 한다. 비공개 구독자 수는 값 없음으로 유지한다.

Supabase Cron은 5분마다 서울 시간을 확인하고 04:00부터 그날의 작업을 한 번만 등록한다. 기본 수집 설정은 꺼짐이며 슈퍼 관리자가 활성화할 수 있다. 워커가 중단돼도 작업이 DB에 남는다. 한도 도달 시 12시간 후 재시도하고 일반 실패는 최대 3회 시도한다. 채널 수동 작업은 하루 최대 20개다. 조회 수치는 API 반영 시점의 값이다.

수집 후보는 관리자 데이터로 유지한다. 검토 승인만으로 크리에이터 가입·협업 가능·채널 소유권을 표시하지 않는다. 원본 데이터는 30일 넘게 표시하지 않고 Cron에서 삭제한다. 크리에이터가 채널 설명에 일회성 인증 문자열을 게시하면 워커가 공식 API로 확인한다. 공개 검색은 소유자 확인, 별도 공개 동의, 공개 AD Me 프로필, 관리자 승인, 최신 자료가 모두 있을 때만 표시한다. 동의 철회 시 즉시 숨겨진다. 현재 외부 실제 채널 소유자가 인증을 마친 공개 사례는 0건이다. YouTube API 자료를 태그·광고 추정·적합도 산출에 사용하려면 해당 사용의 공식 승인을 먼저 확인한다. [YouTube 개발자 정책](https://developers.google.com/youtube/terms/developer-policies) · [할당량](https://developers.google.com/youtube/data/guides/quota_and_compliance_audits)
