# D034 다중 필터·URL 상태·빈 결과

2026-11-20 · 기존 codex/dev-a-p0-continue · 첨부 지시서 검토 후 독립 구현.

- `creator-filters.ts`: URL v1 repeated category/platform/tag, 같은 필드 OR/필드 간 AND, 예산 구간과 견적 구간의 inclusive overlap, 팔로워 범위·가용성·검색·정렬. blank와0을 분리하고 음수/소수/초과/뒤집힌 범위는 조용히 전체 결과로 바꾸지 않고 오류+빈 상태로 표시한다. 최대8 선택, query120자와 숫자 상한, stable name/ID tie-break.
- `use-catalog-filters.ts`는 URL을 단일 상태로 사용하고 이벤트에서 최신 URL을 읽는다. 선택/정렬/reset은 push, 텍스트/숫자는 replace하여 키 입력마다 이력이 쌓이지 않는다. reload/back/forward/관계없는 query/hash 보존, 정렬 포함 전체 초기화를 실제 Chrome에서 검증했다. 기존 전체 snapshot을 동기 필터링하며 history 변경에서 새 서버 검색 요청을 만들지 않는다.
- legacy 본인 등록의 followers0/metrics_source=unavailable은 실제0이 아니므로 미확보로 취급한다. 유효하게 표기된 DEMO 관측0만 숫자0이며 실제 실측값으로 주장하지 않는다. 팔로워 조건 사용 시 미확보는 제외, 정렬 시 마지막이다.
- `creator-search-request.ts`는 **미연결 D033 인계 계약**이다. 이전 AbortSignal 취소, adapter가 취소를 무시하는 늦은 성공/실패 차단, 현재 오류 전달, dispose/cancel과 입력 snapshot 테스트4. 현재 UI가 이 비동기 adapter를 사용하거나 서버 검색이 구현됐다고 보고하지 않는다.
- Node22 lint/typecheck/build, 전체 unit176/21(신규20), keyless production Chrome E2E10/10(신규 필터6/기존4) PASS. 필터조합→URL→reload→back/forward→reset, explicit0/범위 오류/rapid query, keyboard 및320/390/768/1440 overflow 확인. 테스트 selector 수정은 single select→체크박스 UI 변경에 따른 것이고 검사 삭제/skip 없음.
- 최초 keyless 실행은 별도 수동 build와 같은.next를 동시에 사용해 build lock으로 시작 실패했다. build 종료 후 순차 재실행10/10 PASS. 제품 테스트를 우회하지 않았다.
- 후속 실제 모바일 클릭에서 Next router의 transition-priority URL 반영 전 controlled checkbox가 잠깐 원래 값으로 복구돼 check 실패1건을 확인했다. `useSyncExternalStore`로 URL의 synchronous 변경/popstate를 구독하고 입력 이벤트에서 즉시 통지했다. URL 단일 상태는 유지하며 sleep/force/retry로 우회하지 않았다. 수정 후 keyless10/10 및 실제 로컬DB 공개 탐색/DTO4/4 PASS, desktop1440/mobile390 캡처를 직접 확인했다. 320/390/768/1440 overflow 및 키보드 검사도 통과했다.
- **IN_PROGRESS**: D033 server public DTO/cursor/검색 인덱스/대량 데이터/실제 비동기 연결, DEV-B 교차 리뷰·대상 적용이 남는다. UI만 만들고 DONE으로 표시하지 않는다. DB/다른 담당 원장/외부 제공자·키·배포를 변경하지 않았다.
