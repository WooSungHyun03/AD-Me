# AD Me 운영자 독립 실행 문서

너는 AD Me 운영자다. Local AI 실행 환경, 배포 사이트와 운영 DB, 공급자/API 키, 웹디자인 시안·승인, 외부 운영 결정을 맡는다. 각 티켓의 선행 상태를 먼저 확인한다. 확정한 결정과 실제 성공 증거를 원장에 기록한다.

전체 24건 · ACTIVE 미완료 16건. 기존 U 번호는 유지한다. 사업 관련 기존 BUSINESS 항목은 운영자 문서에서 함께 관리하고 해당 책임자·전문기관·공급자가 실제 승인을 한다.

## 시작 프롬프트

> 최신 main과 [공유 계약](SHARED_CONTRACT.md)을 확인한다. 아래 분야에서 착수 가능한 티켓을 골라 운영 기준과 확인할 항목을 먼저 적는다. 브라우저 승인·동의·키 등록은 해당 계정에서 처리한다. 에이전트가 실행할 수 있는 터미널·리포트 작업은 승인된 범위에서 맡긴다. 변경 뒤 실제 호스트 또는 URL과 영향받는 기능을 확인한다. 공급자 키와 고객 자료는 채팅·문서·Git에 넣지 않는다.

## 분야별 실행·인수 기준

| 분야 | 운영자가 할 일 | 개발자 인수물 및 확인 |
|---|---|---|
| Local AI · PR-003 | 호스트·GPU·Ollama·모델 버전, loopback, 실행 서비스 상태, 실패·복구 확인 | A의 D048 실행 파일과 B의 D086 큐·경보 계약을 인수한다. 합성 입력을 사용한 승인된 격리 시험의 버전·latency·실패·복구 결과를 남긴다. |
| 배포 사이트 · U004/U005/U017 | 운영 DB 적용·Vercel 승격·도메인·롤백 | B의 D085/D087 변경·복원 패킷과 A의 D075 권한 증거를 확인한다. 스키마 기준과 배포 SHA 대조 후 운영 URL·권한·핵심 흐름을 확인한다. |
| API 키 · U006/U007/U009/U015 | 키 발급·환경별 비공개 등록·제한·회전 및 공급자 콘솔 승인 | A의 D003 설정명과 필요한 스코프를 인수한다. 키 대신 환경·범위·검증 결과를 공유하고 무료/TEST/라이브 구분을 확인한다. |
| 웹디자인 · O001 | 브랜드 톤과 페이지 우선순위, 시안 제작·선택, 프리뷰 승인 | 기준서와 시안을 B에게 넘긴다. B가 공통 UI에 적용하면 A가 탐색·추천 표시를, 운영자가 desktop/mobile 실화면을 확인한다. |
| 서비스·사업 | 출시 범위, 개인정보·콘텐츠 권리, 실결제 여부와 공식 계약 승인 | [외부 조치](EXTERNAL_ACTIONS.md)와 [출시 판정](GO_NO_GO.md)의 증거로 확인한다. 현재 사업자 미등록 방침에 따라 라이브 판매는 gated다. |

운영 적용은 [릴리스 체크리스트](RELEASE_CHECKLIST.md)를 따른다. 이전 마이그레이션 패킷은 현재 운영 스키마와 검증 기준을 대조한 뒤 적용한다. 로컬 모델 변경은 공유 GPU와 기존 워커 상태를 확인한 뒤 진행한다.

## 완료 보고 형식

ID · 상태 · 실행 환경/URL · 계정 승인자 · 기준 SHA/모델 버전 · 실행 및 성공/실패 · 변경된 설정명(값 제외) · 증빙 · 롤백·다음 담당. ALL_TICKETS.json을 수정하고 python3 harness/production_readiness.py로 세 실행 문서를 다시 생성한다.


# Local AI 호스트·모델 운영

## PR-003 · Local AI 호스트·모델 가동 및 장애 복구 승인

OPERATOR · P1 · S1 주요 부족 · AI · IN_PROGRESS · 외부 SP · ACTIVE

- **현재 문제** — 호스트에서 Qwen과 임베딩 모델이 실제 동작했으나 운영 p95·시간 제한·부하·재시작 복구가 입증되지 않았다.
- **재현·관찰** — Ollama loopback에서 짧은 한국어 JSON·임베딩과 동시 2건을 재측정한다. 운영 출력과 별도로 격리 환경의 재기동·서킷 차단을 확인한다.
- **화면** — /admin/intelligence · /api/health
- **관련 코드** — scripts/intelligence_worker.py · docs/operations · src/components/youtube-ops-summary.tsx
- **DB·RPC** — adme_ops.jobs lease, model version, failure code, retry cap
- **기대 동작** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **구현** — 기존 Ollama·모델·systemd 서비스의 버전, 보호된 로컬 연결, 실행 주체와 가용 자원을 점검한다. D048의 실행 파일과 D086의 큐·경보 계약을 인수한다. 승인된 격리 런타임에서 실제 모델로 재시작·타임아웃·복구를 검증하고 모델 버전과 p50/p95·실패 건수를 보관한다. 앱 코드 수정 사항은 각 담당에게 재현과 함께 인계한다.
- **변경 파일** — docs/operations/local-model-recovery.md · 운영 서비스 설정 및 비공개 상태 기록
- **신규 파일** — 격리 모델 결과와 승인된 운영 활성화 기록
- **선행 티켓** — D048 · D086
- **영향** — /admin/intelligence · /api/health
- **보안** — 호스트 포트 공개 금지, 고객 입력 대신 합성 자료로 부하 측정, 권한·결제 로직에 LLM 사용 금지.
- **검증** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **완료 조건** — 30건 이상에서 p50/p95·실패율 보고, 대기상태가 복구·한도 초과에 수렴, 재실행 중복 없음, 일반 조회·채팅·ORDERS 영향 없음.
- **차단 요인** — 공유 GPU와 기존 워커의 실행 상태를 확인한다. 재시작 시험은 격리 환경에서만 하고 운영 활성화는 안전 한도·관측·릴리스 승인 후에 한다.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/PR-003/ (신규 검증 기록 위치) · harness/evidence/PR-003/TRANSPORT_20261123.md · harness/evidence/DEV-A-REMAINING-20261123/README.md · harness/evidence/DEV-A-REMAINING-20261123/REMAINING_GATES.md · docs/production-readiness/OPERATOR_EXECUTION_20261124.md
- **검증 범위** — 기존 격리 CPU 모델과 복구 시험 증빙을 인수한다. 운영 호스트 장애 복구와 최종 활성화는 별도로 확인한다.
- **이전 담당 기록** — DEV-A

## U016 · 선택적 LLM 계정·키·비용 상한

OPERATOR · P1 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · GATED

- **현재 문제** — Local AI가 실행되며 외부 LLM은 현재 출시 필수가 아니다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 키·처리 조건·국외이전 해당 여부·예산 한도를 직접 설정한다. 미설정 시 fallback으로 운영한다.
- **구현** — 외부 공급자를 추가하기로 한 경우에만 비용 상한·처리 조건·보존/이전을 검토한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 외부 공급자를 추가하기로 한 경우에만 비용 상한·처리 조건·보존/이전을 검토한다.
- **차단 요인** — Local AI가 실행되며 외부 LLM은 현재 출시 필수가 아니다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — OPTIONAL_NOT_ENABLED

# 배포 사이트·DB·도메인

## U002 · GitHub 조직·저장소·앱 권한 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — main 푸시가 가능하지만 Git 연동 배포는 비활성이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 저장소 권한·보호 규칙·Vercel GitHub 앱 연결 및 외부 워크플로 승인을 수행한다.
- **구현** — GitHub 접근과 Vercel 앱 권한을 소유자가 검토한다. 자동 배포를 즉시 켜지 말고 D085에 승인·공개 순서·권한 증빙을 전달한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — GitHub 접근과 Vercel 앱 권한을 소유자가 검토한다. 자동 배포를 즉시 켜지 말고 D085에 승인·공개 순서·권한 증빙을 전달한다.
- **차단 요인** — main 푸시가 가능하지만 Git 연동 배포는 비활성이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U003 · Supabase 환경·계정·리전·한도 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 운영 원장과 저장소 차이, 격리 및 복원 보관 범위가 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발/실서비스 환경·소유권·무료 한도·보존/백업 가능 범위를 확인한다. 기존 프로젝트의 준비 상태도 기록한다.
- **구현** — 운영·스테이징·TEST 프로젝트 식별 관계, 리전·한도·보존·복원 가능한 백업을 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 운영·스테이징·TEST 프로젝트 식별 관계, 리전·한도·보존·복원 가능한 백업을 확인한다.
- **차단 요인** — 운영 원장과 저장소 차이, 격리 및 복원 보관 범위가 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U004 · Supabase 외부 환경·DB 변경 적용

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 현재 호환 릴리스만 동작한다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발자가 제공한 검토된 마이그레이션·RLS·Storage·Edge Function 변경을 외부 서비스에 적용한다. 적용 로그만 공유한다.
- **구현** — D085/D087의 복제본 검증과 롤백 증거를 검토한 뒤 승인된 순서로 SQL·Storage·함수를 적용한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D085 · D087
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D085/D087의 복제본 검증과 롤백 증거를 검토한 뒤 승인된 순서로 SQL·Storage·함수를 적용한다.
- **차단 요인** — 현재 호환 릴리스만 동작한다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U005 · Vercel 프로젝트·Git 연결·배포 실행

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 현재 도메인은 운영 호환 Vercel 배포를 사용한다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 배포 사이트의 프로젝트 설정·프로덕션/프리뷰·Git 연결·배포/재배포·승격/롤백을 직접 수행한다.
- **구현** — D085 승인된 소스의 preview/production 분리, 빌드·도메인·롤백 이력을 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — U004
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D085 승인된 소스의 preview/production 분리, 빌드·도메인·롤백 이력을 확인한다.
- **차단 요인** — 현재 도메인은 운영 호환 Vercel 배포를 사용한다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U008 · Auth 외부 콘솔 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 운영 MFA 전용 경로와 재발송 화면 미지원. 기존 callback 결과는 역사 증거다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 사이트 URL·허용 콜백·메일 템플릿·세션/MFA/비밀번호 보호 설정을 환경별로 적용한다.
- **구현** — host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — host별 Auth 허용 URL, 가입/복구 템플릿, 세션 정책, MFA 정책을 설정하고 콜백 성공·거부 로그를 확인한다.
- **차단 요인** — 운영 MFA 전용 경로와 재발송 화면 미지원. 기존 callback 결과는 역사 증거다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U018 · 관측·알림·백업 외부 계정 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 복구 이력은 있으나 최신 SQL+Auth+Storage의 외부 보관과 연락 경보는 확인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 무료 플랜 한도·수신 채널·외부 토큰·백업 위치·접근 권한을 설정한다. 유료 전환은 별도 판단한다.
- **구현** — 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 권한 있는 저장 위치, 암호화·보유 및 복원 훈련 계정, 연락 경보를 지정한다.
- **차단 요인** — 과거 복구 이력은 있으나 최신 SQL+Auth+Storage의 외부 보관과 연락 경보는 확인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U017 · 도메인·DNS·TLS·소유권

OPERATOR · P1 · S1 조건부 · OPERATIONS · VERIFIED · 외부 SP · ACTIVE

- **현재 문제** — 공개 도메인 TLS 및 www→apex 이동을 확인했다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 필요 시 도메인 소유권·DNS·서비스 주소를 설정한다. 도메인 구매는 선택 사항이며 무료 URL로 시작할 수 있다.
- **구현** — ownership/DNS 기록을 유지한다. HTTPS 200, www 308, canonical 및 만료/연장 소유자를 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — ownership/DNS 기록을 유지한다. HTTPS 200, www 308, canonical 및 만료/연장 소유자를 확인한다.
- **차단 요인** — 공개 도메인 TLS 및 www→apex 이동을 확인했다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md · docs/production-readiness/OPERATOR_EXECUTION_20261124.md
- **검증 범위** — 운영 DNS/TLS, www→apex 308, 홈 canonical
- **이전 담당 기록** — USER
- **이전 기록** — VERIFIED_CUSTOM_DOMAIN

# API 키·공급자 승인

## U006 · 환경변수·시크릿 등록과 교체

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 등록된 키의 실제 값은 승인 문서나 코드에 필요하지 않다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 개발자 제공 변수명 목록에 따라 Supabase/Vercel/CI에 키를 직접 등록한다. 값은 채팅·티켓에 올리지 않는다.
- **구현** — 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D003
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 검토된 변수명·환경별 scope·회전 소유자만 기록한다. TEST 전용 등록 후 redacted 체크 결과를 공유한다.
- **차단 요인** — 등록된 키의 실제 값은 승인 문서나 코드에 필요하지 않다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U007 · SMTP 계정·키·발신 도메인 설정

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 가입·복구 실제 수신 이력이 있으나 새 가입·운영 발송 경보 재검증이 필요하다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 메일 공급자 가입·키 발급/등록·발신자 인증·SPF/DKIM/DMARC·Supabase SMTP 연결을 직접 수행한다.
- **구현** — 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 기존 설정의 DNS SPF/DKIM/DMARC, 발신자, 실제 수신 케이스를 확인한다. 앱 알림은 D053 별도 검증이다.
- **차단 요인** — 과거 가입·복구 실제 수신 이력이 있으나 새 가입·운영 발송 경보 재검증이 필요하다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — VERIFIED_AUTH_SMTP

## U009 · YouTube 프로젝트·API 키 발급/등록

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 공식 YouTube 원본 수집은 동작한다. 키 제한과 쿼터 소유자의 증빙이 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — Google 프로젝트·API 활성화·키 제한·무료 쿼터 확인·서버 키 등록을 수행한다.
- **구현** — YouTube Data API 전용 제한, 무료 quota, 키 회전 주체 및 호출 결과를 값 없이 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — YouTube Data API 전용 제한, 무료 quota, 키 회전 주체 및 호출 결과를 값 없이 확인한다.
- **차단 요인** — 공식 YouTube 원본 수집은 동작한다. 키 제한과 쿼터 소유자의 증빙이 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U015 · Toss TEST 계정·호환 키·등록

OPERATOR · P1 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 과거 TEST 승인 이력이 있다. 이번 릴리스 실패·취소·복구 완주에는 별도 격리 환경의 확인이 필요하다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 사용 가능한 TEST 상점/문서 체험 키 범위와 SDK v2 호환성을 확인하고 클라이언트·서버 TEST 키를 직접 등록한다. 라이브 키는 제외한다.
- **구현** — 같은 TEST 상점의 SDK v2 세트와 isolated 환경 등록을 확인한다. 키는 비공개 설정에만 넣는다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 같은 TEST 상점의 SDK v2 세트와 isolated 환경 등록을 확인한다. 키는 비공개 설정에만 넣는다.
- **차단 요인** — 과거 TEST 승인 이력이 있다. 이번 릴리스 실패·취소·복구 완주에는 별도 격리 환경의 확인이 필요하다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U010 · YouTube 이용 정책·파생 지표 승인

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 파생 지표·콘텐츠 태그 용도의 명시적 승인 증거가 없다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 유스케이스·보관/갱신·파생 지표 요건을 확인하고 필요한 정책 개정 수락·심사·쿼터 신청을 수행한다.
- **구현** — 프로젝트의 허용 목적, API 필드, 보존, 승인·심사 필요 여부를 검토해 처리 근거와 적용 범위를 명시한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 프로젝트의 허용 목적, API 필드, 보존, 승인·심사 필요 여부를 검토해 처리 근거와 적용 범위를 명시한다.
- **차단 요인** — 파생 지표·콘텐츠 태그 용도의 명시적 승인 증거가 없다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_USER_DECISION

## U011 · 웹 수집 대상의 허용 근거 확보

OPERATOR · P1 · S1 조건부 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 공식 API 외 소재의 사용권·허용 범위가 확인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 대상 도메인 약관·라이선스·필요한 허가와 개인 정보 처리 근거를 확인하고 허용 목록을 승인한다.
- **구현** — domain/path/필드/출처/권리/철회·삭제를 문서로 승인한다. 미승인 소스는 비활성이다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — domain/path/필드/출처/권리/철회·삭제를 문서로 승인한다. 미승인 소스는 비활성이다.
- **차단 요인** — 공식 API 외 소재의 사용권·허용 범위가 확인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_SOURCE_PERMISSION

# 웹디자인 시안·화면 승인

## O001 · 웹디자인 시안·브랜드 기준 및 반영 승인

OPERATOR · P1 · S1 시각·사용성 검수 · UI · IN_PROGRESS · 외부 SP · ACTIVE

- **현재 문제** — 기존 시각 감사와 화면 개선을 바탕으로 운영자가 변경할 디자인의 범위·우선순위·승인 기준을 명시해야 한다.
- **재현·관찰** — 홈·탐색·채널 상세·공고·대시보드·요금제를 열어 현행 화면과 시안의 차이를 비교하고, 모바일 390px과 데스크톱 1440px에서 CTA·상태·가독성을 점검한다.
- **화면** — / · /creators · /creators/youtube/[id] · /jobs · /dashboard · /pricing
- **관련 코드** — docs/DESIGN_SYSTEM.md · docs/design/visual-audit.md · src/app/marketplace-theme.css
- **DB·RPC** — 화면 설계와 시각 검수는 DB 변경 없음. 공개 프로필과 결측 표시는 기존 데이터 계약을 사용한다.
- **기대 동작** — 웹디자인 시안과 공통 원칙이 승인되고, 구현 담당자와 배포 전에 확인할 판정 기준이 명시된다.
- **구현** — 운영자가 페이지별 우선순위와 시안(링크 또는 이미지)을 확정한다. 로고·타이포·색상·여백·CTA·모바일 및 로딩/빈/오류 상태를 인계서에 명시한다. B가 공통 레이아웃·토큰·UI를 반영하고 A가 탐색·추천·콘텐츠 근거를 검토한다. 운영자는 프리뷰 실화면을 확인하고 채택 또는 수정 요청의 근거를 남긴다.
- **변경 파일** — docs/design/visual-audit.md · 승인한 웹디자인 시안과 운영 인계 기록
- **신규 파일** — harness/evidence/O001/ 디자인 결정과 공개 가능한 브라우저 비교 증거
- **선행 티켓** — D081
- **영향** — 공통 내비게이션, 브랜드 탐색, 광고 공고, 업무 화면, 요금제
- **보안** — 시안·캡처에 개인 QA 데이터와 비밀 설정을 넣지 않는다. TEST 고지, 스폰서 표식, 출처 문구, 권한 실패 안내를 확인한다.
- **검증** — 390px과 1440px에서 공개/로그인 상태, 주요 CTA와 로딩/빈/오류 화면을 비교한다. 키보드 포커스와 명암비의 개발자 회귀 결과를 인수한다.
- **완료 조건** — 시안과 적용 범위가 확인되고 담당 개발자·프리뷰 URL·캡처·승인 결과가 하나의 기록으로 연결된다.
- **차단 요인** — 밝은 UI 및 모션의 로컬 검증과 별도로 운영 디자인 확인 및 운영 릴리스 승인이 필요하다.
- **증빙** — docs/design/visual-audit.md · harness/evidence/VISUAL-REDESIGN-20261123/verification.json · docs/production-readiness/OPERATOR_EXECUTION_20261124.md

# 서비스 운영·사업 승인

## U001 · 서비스 운영 범위·정책·운영자 확정

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 공개 운영 책임과 개인정보 처리 문서 승인이 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 무료 성인 베타·수집 목적·권리 행사 연락처·처리 기한·정책 문구를 확정한다. 필요하면 전문 검토를 받는다.
- **구현** — 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 기존 공개 운영자 연락처의 수신, 권리 행사 절차, 보유기간·처리위탁·성인 범위를 결정하고 승인본에 날짜를 남긴다.
- **차단 요인** — 공개 운영 책임과 개인정보 처리 문서 승인이 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U014 · 실제 크리에이터 시범 참여·운영 동의

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 실제로 등록·인증한 참가자의 동의와 두 역할 협업 QA가 남았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 파일럿 참여자·권리 증명·협업 수신 동의·소유권 분쟁 연락 창구를 확보한다. 무단 제안 메일 대량 발송은 하지 않는다.
- **구현** — 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 한 명 이상의 승인된 창작자와 브랜드 QA를 확보하여 채널 소유권·연락·삭제 조건을 동의 범위에서 확인한다.
- **차단 요인** — 실제로 등록·인증한 참가자의 동의와 두 역할 협업 QA가 남았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_PARTICIPATION

## U019 · 실제 테스트 참여·브라우저 승인

OPERATOR · P0 · S0 출시 조건 · OPERATIONS · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 기존 사용자 인증·TEST 이력과 현재 합격 기준은 별개다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — OAuth·이메일 링크·2FA·TEST 결제 인증 등 사용자만 가능한 화면을 수행하고 테스트 결과를 확인한다.
- **구현** — 필요할 때 실제 가입, 잠금/MFA, 운영자 QR 확인 및 격리 TEST 승인·취소를 수행하고 결과만 공유한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — U015
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 필요할 때 실제 가입, 잠금/MFA, 운영자 QR 확인 및 격리 TEST 승인·취소를 수행하고 결과만 공유한다.
- **차단 요인** — 기존 사용자 인증·TEST 이력과 현재 합격 기준은 별개다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — PARTIAL_VERIFIED

## U020 · 공개 베타 출시·사고 연락·운영 책임

OPERATOR · P0 · S0 출시 조건 · COMPLIANCE · BLOCKED · 외부 SP · ACTIVE

- **현재 문제** — 정식 출시 전 책임과 사고 대응 범위가 승인되지 않았다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — 정책/실제 데이터/보안/복구 증빙을 확인한 뒤 사용자 본인이 출시를 결정하고 지속 운영 담당·지원 시간을 정한다.
- **구현** — D088의 기술 증거를 검토하고 무료 베타와 유료 운영 각각의 책임자, 지원·장애 기준, GO/NO-GO를 기록한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — D088 · U001 · U014
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — D088의 기술 증거를 검토하고 무료 베타와 유료 운영 각각의 책임자, 지원·장애 기준, GO/NO-GO를 기록한다.
- **차단 요인** — 정식 출시 전 책임과 사고 대응 범위가 승인되지 않았다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — NO_GO

## U021 · 유료 판매 사업 주체와 상품·환불 정책 승인

OPERATOR · P0 · S0 출시 차단 · COMPLIANCE · BLOCKED · 외부 SP · GATED

- **현재 문제** — 현재 사업자등록 계획이 없고 별도 라이브 유료 판매 요건을 승인한 자료가 없다.
- **재현·관찰** — 운영자가 현재 무료 베타 범위를 확인하고 정식 판매 추진 여부를 기록한다.
- **화면** — 운영 의사결정 문서
- **관련 코드** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **DB·RPC** — 정식 판매 주체와 보존 책임 체계
- **기대 동작** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **구현** — 정식 판매를 추진할 때만 자격·등록·운영자 공개 정보와 고지·환불 기준을 전문가 및 공급자와 확인한다.
- **변경 파일** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — U001
- **영향** — 운영 의사결정 문서
- **보안** — 민감한 서류는 공개 저장소에 보관하지 않는다.
- **검증** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **완료 조건** — 주체·책임·고지 승인 결과를 남겼거나 미추진 상태를 명시한다.
- **차단 요인** — 사업자등록 미추진 방침. 무료 베타와 별도.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/U021/ (신규 검증 기록 위치)
- **이전 담당 기록** — BUSINESS

## U022 · Toss 라이브 상점 계약 및 환경 승인

OPERATOR · P0 · S0 출시 차단 · BILLING · BLOCKED · 외부 SP · GATED

- **현재 문제** — 정식 운영 상점·라이브 계약·운영 키 증빙이 없다.
- **재현·관찰** — Toss 개발자센터/운영 관리자에서 승인된 상점·결제수단·환경 분리 증빙을 검토한다.
- **화면** — Toss 상점관리자 · 운영 환경 설정
- **관련 코드** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **DB·RPC** — 운영 상점 식별자와 정산 책임을 환경별로 분리
- **기대 동작** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **구현** — U021 후 계약과 카드사 심사를 확인하고 승인된 운영자만 키를 비공개 환경에 등록한다. 이번 감사에서는 키 발급이나 환경 활성화를 수행하지 않는다.
- **변경 파일** — docs/production-readiness/EXTERNAL_ACTIONS.md
- **신규 파일** — 테스트와 evidence 계약 우선. 신규 스키마는 CLI 생성 및 통합 순번 승인
- **선행 티켓** — U021
- **영향** — Toss 상점관리자 · 운영 환경 설정
- **보안** — 키 자체·카드 데이터·정산 자료를 저장소에 올리지 않는다.
- **검증** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **완료 조건** — 승인된 계약·환경/merchant 검증·철회 또는 롤백 증빙이 운영자에게 확보된다.
- **차단 요인** — 유료 판매 승인 이전에는 진행하지 않는다.
- **증빙** — docs/production-readiness/MASTER_AUDIT.md · harness/evidence/U022/ (신규 검증 기록 위치)
- **이전 담당 기록** — BUSINESS

## U012 · Instagram 앱·OAuth·심사·키

OPERATOR · P2 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ARCHIVED

- **현재 문제** — Meta는 출시 범위 밖이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — Meta 앱·계정 유형·승인 scope·개인정보 URL·철회 콜백·심사·키 발급/등록을 직접 진행한다.
- **구현** — 계정 발급·OAuth 작업을 수행할 필요가 없다. 역사적 기록만 보관한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 업무 범위 밖으로 유지하며 신규 연동하지 않는다.
- **차단 요인** — Meta는 출시 범위 밖이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_IMPLEMENTATION_AND_ACCESS

## U013 · TikTok 앱·OAuth·심사·키

OPERATOR · P2 · S1 조건부 · OPERATIONS · BLOCKED · 외부 SP · ARCHIVED

- **현재 문제** — TikTok은 출시 범위 밖이다.
- **재현·관찰** — 외부 계정/운영자가 해당 서비스 콘솔의 설정과 최근 검증된 동작을 대조한다.
- **화면** — 해당 공급자 콘솔 · docs/production-readiness/EXTERNAL_ACTIONS.md
- **관련 코드** — docs/handoff/ENVIRONMENT_CONTRACT.md
- **DB·RPC** — 해당 운영·격리 환경의 승인·기록 범위만 확인
- **기대 동작** — TikTok 앱·Display API scope·심사·콜백·키 발급/등록을 직접 진행한다.
- **구현** — 계정 발급·OAuth 작업을 수행할 필요가 없다. 역사적 기록만 보관한다.
- **변경 파일** — 운영 인계서 및 증빙 기록
- **신규 파일** — 비밀값을 제외한 승인·운영 확인 기록
- **선행 티켓** — 없음
- **영향** — 계정·운영·정책 설정의 대응 기능
- **보안** — 비밀값, 이메일 원문, 복구 링크, 인증 토큰을 공유 저장소에 보관하지 않는다.
- **검증** — 완료 확인자가 날짜·환경·설정명·해당 검증 결과를 기록한다.
- **완료 조건** — 업무 범위 밖으로 유지하며 신규 연동하지 않는다.
- **차단 요인** — TikTok은 출시 범위 밖이다.
- **증빙** — docs/handoff/COMPLETION_AUDIT_20261123.md · docs/production-readiness/EXTERNAL_ACTIONS.md
- **이전 담당 기록** — USER
- **이전 기록** — BLOCKED_IMPLEMENTATION_AND_ACCESS
