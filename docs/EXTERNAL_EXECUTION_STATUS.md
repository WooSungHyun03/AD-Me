# 외부 작업 20개 실제 실행 결과

확인 시각: 2026-11-19T15:05:44+09:00 · 전체 완료 아님 · 실제 서비스 베타 출시: **NO-GO**

기술 외부 작업 직접 수행 권한은 최신 사용자 요청으로 변경되었다. 본인 인증·법적 수락·유료 결정·참여자 동의는 임의 대행/완료 처리하지 않는다. 운영자 연락처 변경을 기존 시연 사이트에 배포했으며 새로운 실제 데이터 서비스 출시가 아니다.

|ID|작업|상태|실제 수행·검증|남은 조건|
|---|---|---|---|---|
|U001|서비스 운영 범위·정책·운영자 확정|PARTIAL_VERIFIED|운영자 우성현·지원 이메일을 사용자 확인 후 개인정보 안내에 실제 배포.|보존기간·위탁/국외이전 고지·정책 확정·실제 권리 요청 처리 절차 검증 필요.|
|U002|GitHub 조직·저장소·앱 권한 설정|PARTIAL_VERIFIED|GitHub 관리자 접근 확인. main에 checks CI·리뷰1·대화 해결·강제 푸시/삭제 금지 적용.|Vercel GitHub 앱 저장소 접근 승인 실패. 개발자 초대 대상·계정 2FA 확인 미완료. 관리자 bypass는 유지.|
|U003|Supabase 환경·계정·리전·한도 설정|PARTIAL_VERIFIED|AD Me ref ivtdfioypmzknlhinstg·서울·ACTIVE_HEALTHY 확인. public 13테이블 RLS 활성·비공개 portfolios bucket 확인.|개발/TEST/실서비스 환경 분리·계정 MFA·무료 한도/복구 요구 확인 미완료.|
|U004|Supabase 외부 환경·DB 변경 적용|PARTIAL_VERIFIED|원격 migrations adme_core/operations/json_contracts 및 payment-confirm ACTIVE 확인. 불필요한 재적용 안 함.|새 실제 데이터·삭제·무료모드 기능의 DB 변경은 개발 선행 티켓 미구현. 새 schema 적용 완료 아님.|
|U005|Vercel 프로젝트·Git 연결·배포 실행|PARTIAL_VERIFIED|Vercel 실제 preset Next.js·Node22·npm ci/build로 변경. 프리뷰와 연락처 유지보수 production 배포 READY·공개 URL 확인.|Git 연결 승인 미완료. 현재 Hobby의 실서비스 용도 적합성 판단과 무료 실제 베타 출시 검증 필요.|
|U006|환경변수·시크릿 등록과 교체|PARTIAL_VERIFIED|Vercel Supabase URL/ANON 환경명 확인. Supabase Edge secret 목록에서 TOSS_SECRET_KEY 부재 확인. 키 값은 노출하지 않음.|Toss/YouTube/SMTP 등 공급자 키가 확보되지 않음. 예정 변수는 코드 구현 전 임의 등록하지 않음.|
|U007|SMTP 계정·키·발신 도메인 설정|BLOCKED_PROVIDER_ACCESS|기존 인증 메일 발송 제한 확인 이력. 로그인 브라우저 DOM/스크린샷 제어 오류 재현.|SMTP 공급자·발신자/도메인·자격증명 필요. 이메일 확인을 끄거나 가짜 SMTP를 등록하지 않음.|
|U008|Auth 외부 콘솔 설정|PARTIAL_VERIFIED|Auth site_url localhost→https://ad-me-topaz.vercel.app 수정. 동일 origin 루트/대시보드 redirect 등록. diff update=0 재확인, 나머지 원격 설정 보존.|신규 callback/recovery 코드·메일 템플릿·관리자 AAL2 적용·MFA 실제 등록 검증 미완료.|
|U009|YouTube 프로젝트·API 키 발급/등록|BLOCKED_PROVIDER_ACCESS|Google API 키/수집 연결이 준비된 것으로 확인되지 않음.|Google Cloud 프로젝트/권한·YouTube API 키 제한 설정 및 D019 실제 어댑터 필요.|
|U010|YouTube 이용 정책·파생 지표 승인|BLOCKED_USER_DECISION|YouTube 원본/파생 지표 정책 검토 자료는 준비됨.|정책 개정 수락·필요 심사는 사용자 본인의 법적/계정 동의가 필요. 미확인을 승인으로 표시하지 않음.|
|U011|웹 수집 대상의 허용 근거 확보|BLOCKED_SOURCE_PERMISSION|현재 승인된 웹 수집 대상/허가 문서가 없음.|정확한 domain/path/field·처리 근거·권리 허가 필요. 무허가 크롤링 미실행.|
|U012|Instagram 앱·OAuth·심사·키|BLOCKED_IMPLEMENTATION_AND_ACCESS|Instagram은 P2 조건부 범위로 유지.|D022 OAuth·삭제/철회·정책 URL 및 Meta 앱 접근/심사 필요. 사업 요건을 충족할 수 있는지 별도 확인.|
|U013|TikTok 앱·OAuth·심사·키|BLOCKED_IMPLEMENTATION_AND_ACCESS|TikTok은 P2 조건부 범위로 유지.|D023 OAuth·시연·심사 자료 및 TikTok 계정/승인 필요. Research API 우회 미실행.|
|U014|실제 크리에이터 시범 참여·운영 동의|BLOCKED_PARTICIPATION|현재 공개 크리에이터 48명은 DEMO. 실제 참여자가 확보되었다고 표시하지 않음.|실제 참가자·프로필 소유/자료 권리·협업 수신 동의 및 claim 기능 필요. 무단 연락 미발송.|
|U015|Toss TEST 계정·호환 키·등록|BLOCKED_PROVIDER_ACCESS|기존 TEST 승인 function ACTIVE 및 서버 권한 회귀 통과. paid 주문 0개, 실제 Toss TEST 거래 없음.|Toss TEST 상점 키 접근/등록·제품 호환 확인·본인 인증 필요. 브라우저 제어 오류로 키 조회 경로 차단.|
|U016|선택적 LLM 계정·키·비용 상한|OPTIONAL_NOT_ENABLED|기존 deterministic AI 초안·추천은 키 없이 동작; 공개 E2E로 기본 흐름 확인. 외부 LLM 전송 없음.|선택적 LLM 활성화는 공급자/비용/처리 조건 결정 및 D048 어댑터 구현 후 진행.|
|U017|도메인·DNS·TLS·소유권|VERIFIED_EXISTING|기존 무료 HTTPS alias https://ad-me-topaz.vercel.app 사용 유지. 실제 HTTPS 요청·브라우저 표시 확인.|새 유료 도메인 구매 안 함. 발신 도메인 필요 여부는 SMTP 공급자 결정 시 별도 확인.|
|U018|관측·알림·백업 외부 계정 설정|BLOCKED_RECOVERY_AND_ALERT_SETUP|Supabase backups=null·PITR=false 확인. 현재 서비스 정상/권한 검사·배포 로그 확인.|정기 알림 수신 경로·백업 보관처/실행·격리 복원 증빙 없음. 정상 응답을 복구 완료로 간주하지 않음.|
|U019|실제 테스트 참여·브라우저 승인|PARTIAL_VERIFIED|기존 공개 사이트 desktop/mobile 실제 E2E 6/6 및 직접 DB 권한/부정이용 회귀 PASS. 새 연락처 production 실제 브라우저 확인.|외부 메일 신규 가입·SNS OAuth·Toss TEST 본인 인증은 미수행. 기존 테스트는 DEMO 기반임.|
|U020|공개 베타 출시·사고 연락·운영 책임|NO_GO|출시 판단은 NO-GO. 기존 대학 시연 서비스 유지보수 배포와 신규 실제 서비스 출시를 구분.|실제 데이터·삭제/동의·외부 가입·무료모드 격리·백업/복원·호스팅 적합성 등 P0/외부 게이트 미충족.|

## 실제 변경 증거

- GitHub: main branch protection 실제 PUT 후 GET 검증. checks strict + review1 + conversation resolution, force/deletion false. 단독 운영자의 복구를 위해 admin bypass는 유지했으며 이를 강제 보호로 과장하지 않는다.
- Vercel: framework null→nextjs, Node26→22, npm ci/build 반영. 프로젝트 GET으로 재확인. 기존 authenticated CLI 사용; 연결 앱 404는 해결되었다고 하지 않는다.
- Supabase Auth: 최소 auth config diff 검토 후 site URL 및 exact redirect 두 항목만 push. email confirmation/MFA 등 미선언 원격 설정 보존. push 후 declared update=0 확인.
- 운영자/지원 이메일: 실제 사용자 제공 명칭·연락처를 privacy 화면에 반영. 인증된 프리뷰 요청 및 공개 production HTTP/브라우저 확인.

- Production deployment: `dpl_FqrtgkPAXTM7EXs1eRNCHKCjieEf` READY, https://ad-me-topaz.vercel.app . 연락처 유지보수 배포.
- lint/typecheck/Vitest12/build 및 기존 공개 E2E6/6, 직접 Supabase 권한 검사 PASS. 실제 신규 이메일 가입/SNS/Toss provider 테스트 통과를 뜻하지 않는다.

## 직접 해결할 수 없는 정확한 접근 조건

1. GitHub Vercel 앱에 AD-Me 저장소 접근 승인. https://github.com/apps/vercel/installations/new
2. SMTP 공급자·발신자·필요 도메인/자격증명, Google Cloud YouTube 권한, Toss TEST 상점 접근. 키 값은 채팅으로 보내지 않는다. 현재 Chrome DOM·스크린샷 API가 timeoutMs 오류로 실패하여 로그인된 콘솔 조작도 불가하다.
3. YouTube 정책 수락/심사·참가자 소유/동의·필요 시 호스팅 플랜 판단은 사용자의 실제 계정/책임에 따른 결정이 필요하다.
4. callback/수집/OAuth/삭제/backup 등 개발 선행 항목을 구현한 뒤 실제 외부 검증해야 한다. 미구현 경로를 등록한 것으로 완료 처리하지 않는다.

민감값 없는 상세 증거: `harness/evidence/external-20261119/`. 브라우저 캡처: `output/playwright/privacy-operator-20261119.png` (공개 연락처만 포함).
