# D019 — YouTube 공식 API 수집 어댑터 (2026-11-19, local)

상태: 어댑터·계약 테스트 완료 / **실제 채널 검증 BLOCKED** — U009/U010(API 키 발급·등록), U001(정책 승인) 필요. 현재 정책 `pending`이라 실행 시 fetch 전에 차단됨(의도된 동작).

## 구현
- `src/lib/ingestion/youtube.ts` [신규]: 채널 ID seed(`UC` + 22자)만 입력. 엔드포인트는 channels/playlistItems/videos(각 1 unit)만, search.list(100 unit) 미사용. 50개 배치, 중복 seed 제거, 10초 timeout.
- 숨긴 구독자 수 → `subscriber_count: null` + `hidden_subscriber_count: true`. 좋아요/댓글 비공개 → null (0이나 추정값 금지).
- 오류 구분: quota / rate / auth / bad_request / upstream. 존재하지 않거나 삭제된 채널은 API가 구분하지 않으므로 `not_found`.
- 출처 필드: `source_type`, `source_url`, `fetched_at`. 정책 허용 필드 외 제거(`pickAllowed`).
- 키: 서버 전용 `YOUTUBE_API_KEY`(.env.example 추가). 클라이언트 import 경로 없음.

## 검증
- `tests/ingestion/youtube.test.ts` 4건 + 합성 fixture(`tests/ingestion/fixtures/youtube.json`, 실제 채널 아님): pending 차단(fetch 0회), 키·ID 검증, 필드 매핑/숨김/not_found/엔드포인트 제한, 오류 5종 구분.
- vitest 38/38, lint, typecheck, build PASS.
- 미실행: 실제 API 호출(키 없음). DB 저장 계층은 DEV-A D018/D021 소관 — 이 모듈은 결과만 반환.
