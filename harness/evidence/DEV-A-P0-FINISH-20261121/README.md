# 진행 중 P0 마무리 배치 — 2026-11-21

DEV-A, 시작 a1e8080, 기존 `codex/dev-a-p0-continue`. 대상13개는 PLAN.md에 고정했다. 원본 backlog/타인 담당/기존34 migration은 변경하지 않는다. 최종 source와 티켓별 커밋은 `commits.json`, 실행 결과는 `verification.json`에 기록한다. 티켓별 `VERIFY_20261121.md`는 이전 증거에 추가한다.

실제 로컬 PostgreSQL/PostgREST/Auth/Storage와 가상 QA 계정을 사용했다. 합성 JWT 권한 검사, 로컬 메일 수신함, 가상 정책/이미지, DB-only TEST 승인, 차단한 YouTube 네트워크 검사는 외부 공급자 성공 증거가 아니다. 인증 trace/계정/키/원본 응답은 ignored output에만 둔다. 1440×900과390×844 Chrome, 검색 키보드320/390/768/1440 검증을 구분한다.

검증 명령은 Node22로 lint/typecheck/test/build, `npm run test:e2e:local`, 영향 시나리오 재검사, free-local/keyless, Vitest storage config, 17개 local security driver, Python harness/secret/handoff 검증이다. SQL 권한 메타데이터47 tables/189 functions/2 private buckets는 D075 inventory에 보존한다. 새 SQL035~046은 적용 후 수정하지 않았고 기존 이력/PK/FK/가격/점수는 보존한다. `packet-upgrade.json`은 실제34→46/원자 rollback/기존 비어 있지 않은 데이터 불변/ID switch 증거다.

첫 브라우저 회귀의6실패 원인: 한 번에48개를 가정한 테스트를24개+다음 페이지 계약으로 수정; 이미지 상태 안내가 추가되어 모호해진 message status를 해당 메시지 폼으로 한정; Next 공식 설치 문서의 streamed not-found HTTP200 계약에 맞춰 철회 시 not-found 화면·콘텐츠/원본/iframe 부재를 함께 검사. 두 번째 대화 테스트는 `filter(has:)`의 잘못된 상위 상대 범위를 고쳤다. 기능 거부/중복/XSS 단언은 유지했다. Keyless 첫 실행은 미설치 Chromium을 선택한 환경 오류이며, 설치된 Chrome을 명시했다. 이후 키보드 검사는 hydration 전 native details가 초기화되는 경합을 발견해 필터의 inert/aria-busy 준비 상태를 구현했다. 영향 검사만 재실행하며 skip/임의 sleep/제품 한도 완화는 하지 않는다.

LOCAL_VERIFIED는 이 소스의 로컬 기준이며 DONE이 아니다. D007은 최종 Linux/Edge 산출물의 고지·71개 exact archive 고지 본문 부재 및 제공 자산 재배포 범위 검토가 남는다. D084는 계정 삭제/보존 등 아직 구현되지 않은 전체 서비스 흐름과 실제 공급자/대상 URL 검증이 남는다. D017 정책 승인/D019 실제 writer/D026 claim/USER 외부 적용과 DEV-B 교차 검토를 완료로 가정하지 않는다.
