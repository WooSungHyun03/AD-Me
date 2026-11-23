# 준비된 DEV-A P1 묶음

기준80e8d1e, 기존 codex/dev-a-p0-continue, origin/main65063c8. USER: 선행 필요한 티켓 제외, 나머지 P0/P1/P2 구현 및 선행사항 전달. 기존 LOCAL_VERIFIED는 로컬 선행 구현 근거로만 사용하며 최종 배포/교차 리뷰 완료로 간주하지 않는다. P0 미확정 정책/삭제·공급자/권리는 반복 작업하지 않는다.

순서 D030 → D031 → D035 → D060. D029/D021/D075/D059의 로컬 코드 계약을 사용한다. D035는 이번 D031 뒤에 진행한다. 수정 의도: 새 ad-history/metrics/admin-search 모듈·API·UI·테스트, public-ad-history/normalized-public/catalog/admin 화면. 신규 SQL061 광고 조회/개인 브랜드 경쟁사,062 공개 시계열,063 legacy lookup cursor opaque 참조 보강,064 지표 필터,065 운영 검색/감사 예약. 기존060까지 적용 SQL 불변. DEV-B catalog/schemas/types 계약은 변경하지 않고 추가 모듈/RPC로 확장한다. 소유자 없는 공개 자료/미승인 파생 지표를 추정하지 않는다.

각 티켓 영향 unit·실제 local SQL/REST 권한·정정/철회·동시성·민감값 검사, 마지막 공유 lint/typecheck/unit/build/desktop-mobile E2E 및 한 USER60→최종 패킷. 가상 계정/정책/자료와 실제 로컬 인프라를 구분하며 실제 공급자/SMTP/결제/배포 검증을 주장하지 않는다. 티켓별 commit, 한 산출물 commit, 기존 브랜치 push/CI, QA 볼륨 보존. 외부 콘솔·키·배포·대외 연락 없음.

첨부 DEV-A 문서를 확인했다. 첨부 폴더의 SHARED_EXECUTION_CONTRACT.md는 존재하지 않아 저장소 docs/handoff/SHARED_EXECUTION_CONTRACT.md의 전체 계약을 적용했다. 과거 tasks40/세션·v2 원장을 확인했고 원본 티켓 배분/다른 담당 상태는 변경하지 않는다.

후속 예약066은 파생 기간/미래 metadata 검증,067은 시계열 별도 승인/history window다. 기존 적용 SQL은 forward migration으로만 보강했다. D004 steward의 apiRoute는 생성 requestId를 handler의 두번째 인자로 넘기며 기존1인자 호출 호환을 유지한다. 새 지원 검색/신고/잠금 RPC가 같은 HTTP receipt ID를 사용한다. catalog.ts/schemas.ts/타 담당 API 시그니처는 수정하지 않았다. source history 기본OFF이며 실제 공급원 승인은 외부 gate다.
