# 남은 P0 구현·검증 배치

기존 `codex/dev-a-p0-continue`, 시작 `7b8fcdc`. main `65063c8` 기준을 유지했다. 첨부 DEV-A 지시서는 저장소 사본과 같았으며 현재 AGENTS/shared contract/backlog/세션을 적용했다. 티켓별 정확한 최종 커밋은 `commits.json`, 공통 명령/실제 결과/범위는 `verification.json`에 기록한다.

D021 큐 복구/TTL/정책별 예산/tombstone, D064 다섯 사고 runbook·기술 모의훈련, D080 민감 필드·성인 자기확인, D082 axe·키보드·반응형을 로컬 검증한다. D073의 정책 버전/동의 원장·철회는 구현됐지만 최종 정책 승인은 외부 대기다. D014는 재인증/lease/checkpoint/승인 보존계획/차단→Storage→Auth 삭제 순서의 **어댑터 계약만** 테스트했으며 실제 삭제 API/어댑터는 없다. D084는 전체 삭제·실제 공급자·실제 릴리스 게이트 때문에 계속 진행 중이다. D007/D009의 변하지 않은 외부 장애를 재시도하거나 DONE으로 바꾸지 않았다.

실제 로컬 Auth/PostgREST/Postgres/Storage와 가상 자료를 구분했다. YouTube 응답·정책 승인·TEST 값은 fixture/계약이며 실제 공급자 호출·외부 SMTP·법률 승인·배포 증거가 아니다. 047~054와 기존46 SQL은 적용 후 불변이다. 새 USER 패킷은 단일46→54 트랜잭션이다. 중간 오류/알 수 없는 이력/함수 변경 시 롤백, 7종 기존 레코드 보존, 중복 적용 거부, 구버전 가입 동의 소급 생성 방지, 단방향 strict 활성화를 검사했다.

실패와 수정: 새 실제 DTO 검사에서 legacy Auth UID 노출을 발견해050에서 opaque 참조로 수정했다. 채널별 checkpoint의 보수적 내부 예산을052로 보강하고 현재 공식 quota의 별도 search 버킷과 내부 가중치를 분리했다. 공개 철회의 기존 채널 동의 잔존은053에서 제거했다. strict 가입의 구버전 staging 경계를054로 명시했다. 새 axe가 찾은 heading-order를 수정했고 Next streaming 완료 후 검사하도록 harness를 바로잡았다. 전체 unit의 provider key 추출 실패는 projector와 full identity 검증을 분리해 수정했다(전체 identity strict 유지). 화면 검사에서 철회 후 남던 공개 체크 상태는 서버 refresh/remount와 재저장 회귀 검사로 수정했다. assertion을 삭제하거나 skip하지 않았다.

QA 환경 문제: packet DB의 오래된 migration 폴더를 그대로 reset하려다 순서 오류를 확인해 불변 기존46으로 복원했다. DB-owner의 auth session 전환/peer 접속이 제한되어 marked loopback TCP의 실제 auth DB 역할로 검사했다. 최종 생성 패킷 검증은 PASS다. 키 없는 브라우저는 bundled Chromium 미설치로 launch 실패했으며 기존 설치 Chrome을 명시해 재검증한다. 실패를 공급자 실패/성공으로 오인하지 않는다. 중간 raw 로그·계정·키·trace는 ignored output에만 둔다.

공통 전체 브라우저54개 이후 마지막 설정 refresh 변경은 영향받는 두-role 설정/동의와 keyless 회귀를 별도로 수행했다. 변하지 않은 전체 경로 결과와 최종 변경 검사를 구분해 재사용한다. axe 자동 검사와 표시/키보드 확인은 WCAG 인증·실제 스크린리더 전수 검사와 같지 않다. USER 패킷/법률·보존·공급자·대상 URL·DEV-B 검토는 별도 release gate다.

최종 경로 대조에서 D073의 기존 profile/brand 저장은 owner_consent/published를 유지하고 있음을 명시했다. 가입 필수3목적과 설정 전역 철회 외에 각 공개 저장의 부여/철회를 버전 원장과 원자적으로 연결하는 후속 개발·직접 REST 회귀가 남는다. 정책 외부 대기 상태를 유지하지만 모든 D073 로컬 구현이 끝났다는 뜻이 아니다.

최종 source `5748a86829de32204a56b0d590d7854c2d97ddfd`와 생성 SQL/실제 적용 이력의 대조는 [packet-integrity.json](packet-integrity.json)에 기록했다. 이전46 source·기존 tracked deliverables 불변, 새8 SQL/embedded source/manifest 일치, 최종 source 활성화 SQL을 marked root QA에서 실행하고 최초 stamp 재실행 불변을 확인했다. 이후 커밋은 인계·패킷/범위 보정 문서이며 제품 소스 변경이 아니다.
