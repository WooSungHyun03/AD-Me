# 데이터 공급원 정책 (D017)

실행 정책: `src/lib/ingestion/policy.ts`. 이 표와 코드가 다르면 코드 기준으로 수집이 차단된다. 수집기는 fetch **전에** `assertSourceAllowed()`를 호출하고, 저장 전 `pickAllowed()`로 허용 필드만 남긴다.

| 공급원 | 상태 | 목적 | 근거 | 허용 필드 | 약관 | 보존 | 갱신 | 재배포 | 검토자 |
|---|---|---|---|---|---|---|---|---|---|
| owner_self_registration | approved | 본인 협업 프로필 공개 | 본인 입력·공개 동의 | 이름·소개·분야·분위기·형식·플랫폼·견적·가용성·SNS/포트폴리오 URL | /privacy | 365일 또는 삭제 요청 시 | 본인 수정 | 공개 프로필 | AD Me 운영 |
| youtube_data_api | **pending** | 허용 seed 채널 공개 프로필·통계 | YouTube API Services 약관 (U001 검토 필요) | 채널 ID·제목·설명·customUrl·개설일·국가·구독자수(숨김 여부)·영상수·조회수, 영상 ID·제목·게시일·조회/좋아요/댓글수 | [API Services ToS](https://developers.google.com/youtube/terms/api-services-terms-of-service) · [Developer Policies](https://developers.google.com/youtube/terms/developer-policies) | 30일 | 30일 | 공개 프로필(출처 표기) | 미지정 |
| tiktok_display_api | **pending** (P2) | 동의 본인 계정 연결 | OAuth 동의 (U013) | open_id·표시 이름·아바타·팔로워·영상 ID/제목/조회수 | [Developer ToS](https://www.tiktok.com/legal/page/global/tik-tok-developer-terms-of-service/en) | 30일 | 30일 | 공개 프로필 | 미지정 |
| demo_fixture | approved | TEST 시연 | 자체 생성 가상 데이터 | 전체 | fixtures/ | — | — | 없음(시연 환경만) | AD Me 운영 |

## 승인 절차 (U001 — 사용자)
1. 공급원 약관 페이지에서 현재 버전/개정일을 확인해 `terms_version`에 기록 (추측 금지).
2. 검토자 이름을 `reviewer`에 기록, `status: "approved"`, 재검토 기한 `review_expires_at` 설정.
3. 공급원 승인 전에는 수집 코드가 실행 즉시 `SourceNotAllowedError`로 중단된다.

## 금지
- 플랫폼 웹 스크래핑, 비공개 지표 추정치 저장, TikTok Research API의 상업 탐색 사용.

TikTok 연동 설계(OAuth·토큰·철회·삭제 콜백): [tiktok-display-api.md](tiktok-display-api.md) (D023).
- 허용 목록 밖 필드(이메일·전화 등 PII) 저장.

> 약관 세부(보존 30일 등)는 검토자가 원문으로 재확인해야 한다. 이 표의 값은 보수적 초기값이다.
