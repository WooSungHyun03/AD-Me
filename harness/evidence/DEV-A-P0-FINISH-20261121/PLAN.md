# 진행 중 P0 전체 마무리 배치

사용자 요청: 진행 중 DEV-A P0 전체. 시작a1e8080 / 기존 codex/dev-a-p0-continue, main 신규 없음. 대상13: D002,D007,D008,D012,D018,D028,D034,D051,D065,D075,D076,D081,D084. OPEN/타인 배분은 변경하지 않는다. 완료 여부는 각 수용 기준/실제 증거로 결정하며 USER/DEV-B 선행을 완료로 가정하지 않는다.

실행 순서: D081 실제 공개 목록/DEMO·집계 정리 → D028 embed 실패 복구 → D007 exact lockfile notice 확인 → D002/D008/D065 앱·DB TEST 격리 → D034/D076 검색/한도 연결 → D012/D051 업로드 선행 대조와 독립 구현 → D018/D075 읽기/권한 감사 → D084 최종 공통 회귀. 같은 DB/build 작업은 직렬, 티켓별 commit, 공통 검증/USER 패킷은 마지막 한 번. 기존34 migrations/이전 산출물 불변, 새 번호035부터 예약. 외부 콘솔/키/배포는 USER만 수행한다.

공유 변경 의도: D001의 DB mode 격리 steward, D033 검색 API steward, D027 upload steward, D049 협업 steward에 호환 계약/실제 잔여를 문서로 인계한다. 기존 endpoint·상태·정상 워크플로우/ID를 보존하고 공개 DTO·직접 REST 우회를 함께 검증한다. 리뷰 미실시는 미실시로 남긴다. 실제 외부 공급자/Toss/법률/브랜드 재배포 승인을 fixture로 대체하지 않는다.
