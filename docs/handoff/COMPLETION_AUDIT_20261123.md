# AD Me 티켓 완료 감사

2026-11-23 KST 기준. 검사 기준 원격 main은 `1f1d7c1`이며 디자인 적용 전 운영 배포는 `dpl_9NTXZgGLpeqkvjy5BcXJmrz1TYaZ`다.
아래 표는 88개 개발 티켓과 20개 사용자 작업의 원장 상태를 전수 대조한 것이다. 각 행의 링크는 확인할 증빙의 위치를 가리킨다. 표의 파일 존재 및 로컬 검증 표기는 운영 승인이나 서비스 완료의 근거로 사용하지 않는다.

## 운영에서 직접 확인한 차이

- 운영 DB 원장 40개, 최신 main 마이그레이션 104개. 운영에 빠진 신규 64개에는 권한·동의·수집 기능이 포함된다. 운영에 creator_home_summary 및 account_access RPC가 없다. 따라서 최신 main을 그대로 승격하면 기존 기능의 동작을 보장할 수 없다.
- 독립 디자인 HTML은 팀의 화면 설계다. 앱의 실제 검색, YouTube 상세, 광고 공고, 워크스페이스에 디자인을 연결하는 작업이 별도로 필요했다.
- 앱 알림 이메일 실발송, 실제 Toss TEST 주문 취소, YouTube 파생 통계·콘텐츠 태그 사용 승인에 대한 운영 완료 증거는 확인되지 않았다. 앱 알림과 가입·복구 메일은 서로 다른 경로다.

## 개발 티켓 88개

외부 조건 대기 3건, 진행 중 12건, 로컬 검증 28건, 원장 미완료 39건, 부분 검증 6건

| 티켓 | 담당 | 우선순위 | 기록 상태 | 증빙 위치 |
|---|---|---|---|---|
| D001 무료 실서비스·TEST 시연 모드 분리 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D001) |
| D002 운영 정책·요금·기능 설명 일치 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D002/README.md) |
| D003 환경 설정 스키마·누락 진단 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D003/README.md) |
| D004 서버 API 오류·검증 계약 통일 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D004/README.md) |
| D005 데모와 실제 데이터 저장·조회 분리 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D005) |
| D006 핵심 활성화·제품 이벤트 정의 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D006) |
| D007 라이선스·의존성·출처 목록 | DEV-A | P0 | BLOCKED_EXTERNAL | [기록](../../harness/evidence/D007/README.md) |
| D008 기능 플래그·단계별 공개 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D008/README.md) |
| D009 외부 사용자 이메일 가입 완주 | DEV-A | P0 | BLOCKED_EXTERNAL | [기록](../../docs/AUTH_PROVIDER_EXECUTION.md) |
| D010 비밀번호 재설정·이메일 변경 | DEV-B | P0 | PARTIAL_VERIFIED | [기록](../../docs/AUTH_PROVIDER_EXECUTION.md) |
| D011 브랜드·크리에이터 온보딩 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D011) |
| D012 브랜드 프로필·담당자 정보 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D012/README.md) |
| D013 세션 만료·재인증·로그아웃 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D013) |
| D014 계정 탈퇴·개인정보 삭제 실행 | DEV-A | P0 | IN_PROGRESS | [기록](../../harness/evidence/D014/VERIFY_NEXT_20261121.md) |
| D015 계정 설정·관심 분야·알림 동의 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D015) |
| D016 관리자 MFA·초대 기반 권한 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D016/README.md) |
| D017 플랫폼별 수집 허용 목록·데이터 계약 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D017) |
| D018 실제 인플루언서 통합 스키마 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D018/README.md) |
| D019 YouTube 공식 API 수집 어댑터 | DEV-B | P0 | PARTIAL_VERIFIED | [기록](../../docs/implementation-progress.md) |
| D020 허용된 공개 웹 크롤러 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D020/INDEPENDENT_20261122.md) |
| D021 수집 작업 큐·갱신·삭제·쿼터 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../docs/implementation-progress.md) |
| D022 Instagram 공식 연결 어댑터 | DEV-A | P2 | IN_PROGRESS | [기록](../../harness/evidence/D022/INDEPENDENT_20261122.md) |
| D023 TikTok 공식 연결 어댑터 | DEV-B | P2 | OPEN | [작업 증빙](../../harness/evidence/D023) |
| D024 실제 데이터 파일럿 품질 게이트 | DEV-B | P0 | PARTIAL_VERIFIED | [기록](../../docs/implementation-progress.md) |
| D025 미청구 프로필과 본인 프로필 청구 | DEV-B | P0 | PARTIAL_VERIFIED | [기록](../../docs/implementation-progress.md) |
| D026 크리에이터 프로필 편집 확장 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D026) |
| D027 안전한 이미지·포트폴리오 업로드 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D027) |
| D028 SNS 링크·공식 임베드·공유 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D028/README.md) |
| D029 실제 광고 이력 제출·출처 검증 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D029/PLAN_20261120.md) |
| D030 광고 이력 타임라인·경력 필터 | DEV-A | P1 | LOCAL_VERIFIED | [기록](../../harness/evidence/D030/VERIFY_READY_20261122.md) |
| D031 실제 성과 그래프·지표 정의 | DEV-A | P1 | LOCAL_VERIFIED | [기록](../../harness/evidence/D031/VERIFY_READY_20261122.md) |
| D032 유사 프로필·신고·정정 진입 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D032) |
| D033 서버 검색·페이지네이션·인덱스 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D033) |
| D034 다중 필터·URL 상태·빈 결과 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D034/README.md) |
| D035 지표 가용성 기반 필터 | DEV-A | P1 | LOCAL_VERIFIED | [기록](../../harness/evidence/D035/VERIFY_READY_20261122.md) |
| D036 후보 그룹·캠페인별 shortlist | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D036) |
| D037 저장 검색·신규 후보 알림 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D037/INDEPENDENT_20261122.md) |
| D038 CSV 가져오기·내보내기 보강 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D038) |
| D039 자연어 검색→확인 가능한 필터 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D039/INDEPENDENT_20261122.md) |
| D040 개인 CRM 메모·후보 비교 리포트 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D040) |
| D041 캠페인 기간·예산·산출물 계약 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D041/README.md) |
| D042 캠페인 복제·brief·첨부 버전 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D042/INDEPENDENT_20261122.md) |
| D043 캠페인 상태·모집 탐색·지원자 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D043) |
| D044 추천 하드 조건·결측·점수 계약 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D044) |
| D045 추천 이유·출처·스냅샷·재계산 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D045/PLAN_20261120.md) |
| D046 추천 피드백·평가 데이터셋 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D046) |
| D047 추천 실험·가중치·임베딩 | DEV-A | P2 | IN_PROGRESS | [기록](../../harness/evidence/D047/INDEPENDENT_20261122.md) |
| D048 콘셉트·제안문·요약 AI 어댑터 | DEV-B | P1 | PARTIAL_VERIFIED | [기록](../../docs/implementation-progress.md) |
| D049 제안·지원·상태 머신 회귀 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D049) |
| D050 협업 조건 변경·합의 이력 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D050/INDEPENDENT_20261122.md) |
| D051 메시지 페이지·첨부·스팸 방지 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D051/README.md) |
| D052 미읽음·인앱 알림·실시간 갱신 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D052) |
| D053 이메일 알림 outbox·수신 설정 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D053) |
| D054 결과물 버전·수정 요청·승인 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D054/PLAN_20261120.md) |
| D055 일정·마일스톤·지연 알림 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D055/INDEPENDENT_20261122.md) |
| D056 양측 대시보드·성과 내보내기 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D056) |
| D057 근거 기반 이슈·검토 워크플로 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D057/PLAN_20261120.md) |
| D058 신고·정정·삭제·이의신청 큐 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D058) |
| D059 정지·비공개 운영 잠금 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D059/README.md) |
| D060 운영 통합 검색·감사·지원 | DEV-A | P1 | LOCAL_VERIFIED | [기록](../../harness/evidence/D060/VERIFY_READY_20261122.md) |
| D061 안전성 체크리스트·선정 승인 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D061) |
| D062 사용자 차단·사칭·악용 대응 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D062) |
| D063 통계·도움말·문의 운영 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D063) |
| D064 콘텐츠·계정 운영 runbook | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D064/README.md) |
| D065 무료·TEST 요금제 분리 정비 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D065/README.md) |
| D066 Toss SDK v2 실제 TEST 완주 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D066) |
| D067 주문 승인·복구·중복·금액 방어 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D067/INDEPENDENT_20261122.md) |
| D068 TEST 취소·취소 후 권한 회수 | DEV-B | P2 | OPEN | [작업 증빙](../../harness/evidence/D068) |
| D069 TEST 이용권 만료·usage·크레딧 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D069) |
| D070 HOT 독립 슬롯·광고 고지 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D070) |
| D071 무료 Agency 팀·초대·테넌트 | DEV-A | P1 | IN_PROGRESS | [기록](../../harness/evidence/D071/INDEPENDENT_20261122.md) |
| D072 수수료 가정 계산·결제 이력 | DEV-B | P2 | OPEN | [작업 증빙](../../harness/evidence/D072) |
| D073 개인정보·이용약관·동의 버전 | DEV-A | P0 | BLOCKED_EXTERNAL | [기록](../../harness/evidence/D073/VERIFY_NEXT_20261121.md) |
| D074 개인정보 열람·수정·반출 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D074) |
| D075 RLS·RPC·Storage 전수 권한 감사 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D075/README.md) |
| D076 속도 제한·봇·리소스 남용 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D076/README.md) |
| D077 웹 보안·외부 URL·파일 경계 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D077) |
| D078 비밀값·로그·키 교체 대응 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D078) |
| D079 데이터 보존·삭제·복구 정책 실행 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D079) |
| D080 접근성·청소년·민감 데이터 경계 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D080/VERIFY_NEXT_20261121.md) |
| D081 실데이터 메인·로고·신뢰 표시 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D081/README.md) |
| D082 전 화면 반응형·접근성·상태 | DEV-A | P0 | LOCAL_VERIFIED | [기록](../../harness/evidence/D082/VERIFY_NEXT_20261121.md) |
| D083 SEO·공유·인덱싱 공개 경계 | DEV-B | P1 | OPEN | [작업 증빙](../../harness/evidence/D083) |
| D084 회귀 테스트·실제 수집 계약 테스트 | DEV-A | P0 | IN_PROGRESS | [기록](../../harness/evidence/D084/README.md) |
| D085 CI·배포 산출물·마이그레이션 안전 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D085) |
| D086 관측·오류 추적·상태·비용 알림 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D086) |
| D087 백업·복원·성능·용량 | DEV-B | P0 | PARTIAL_VERIFIED | [기록](../../docs/AUTH_PROVIDER_EXECUTION.md) |
| D088 사용자 배포 후 출시 승인 검증 | DEV-B | P0 | OPEN | [작업 증빙](../../harness/evidence/D088) |

## 사용자 작업 20개

| 티켓 | 기록 상태 | 남은 조건 |
|---|---|---|
| U001 | PARTIAL_VERIFIED | 보존기간·위탁/국외이전 고지·정책 확정·실제 권리 요청 처리 절차 검증 필요. |
| U002 | PARTIAL_VERIFIED | Vercel GitHub 앱 저장소 접근 승인 실패. 개발자 초대 대상·계정 2FA 확인 미완료. 관리자 bypass는 유지. |
| U003 | PARTIAL_VERIFIED | 개발/TEST/실서비스 환경 분리·계정 MFA·무료 한도/복구 요구 확인 미완료. |
| U004 | PARTIAL_VERIFIED | 새 실제 데이터·삭제·무료모드 기능의 DB 변경은 개발 선행 티켓 미구현. 새 schema 적용 완료 아님. |
| U005 | PARTIAL_VERIFIED | Git 연결 승인 미완료. 현재 Hobby의 실서비스 용도 적합성 판단과 무료 실제 베타 출시 검증 필요. |
| U006 | PARTIAL_VERIFIED | Resend SMTP/Toss TEST/YouTube 서버 키 등록 검증. 환경 분리·회전·재배포 계약 및 기타 조건부 공급자는 미완료. |
| U007 | VERIFIED_AUTH_SMTP | 인증/복구 발송·실수신 연결 검증. DMARC p=none의 강화 및 운영 발송량 관측은 계속 관리 필요. |
| U008 | PARTIAL_VERIFIED | Site URL·exact callback·한국어 해시 템플릿 및 사용자 비밀번호 복구/재로그인 확인 완료. 관리자 MFA·세션 보안 미완료. |
| U009 | PARTIAL_VERIFIED | YouTube API 호출·서버 Secret 등록 검증. 콘솔 restriction·쿼터 증거와 D019 수집 어댑터·정책·seed 범위 미완료. |
| U010 | BLOCKED_USER_DECISION | 정책 개정 수락·필요 심사는 사용자 본인의 법적/계정 동의가 필요. 미확인을 승인으로 표시하지 않음. |
| U011 | BLOCKED_SOURCE_PERMISSION | 정확한 domain/path/field·처리 근거·권리 허가 필요. 무허가 크롤링 미실행. |
| U012 | BLOCKED_IMPLEMENTATION_AND_ACCESS | D022 OAuth·삭제/철회·정책 URL 및 Meta 앱 접근/심사 필요. 사업 요건을 충족할 수 있는지 별도 확인. |
| U013 | BLOCKED_IMPLEMENTATION_AND_ACCESS | D023 OAuth·시연·심사 자료 및 TikTok 계정/승인 필요. Research API 우회 미실행. |
| U014 | BLOCKED_PARTICIPATION | 실제 참가자·프로필 소유/자료 권리·협업 수신 동의 및 claim 기능 필요. 무단 연락 미발송. |
| U015 | PARTIAL_VERIFIED | 동일 TEST 키 종류·실제 provider DONE·30일 이용권·DB 중복 부여 방어 확인. 무료 베타/TEST 환경 분리·실패/취소 전체 시나리오는 미완료. |
| U016 | OPTIONAL_NOT_ENABLED | 선택적 LLM 활성화는 공급자/비용/처리 조건 결정 및 D048 어댑터 구현 후 진행. |
| U017 | VERIFIED_CUSTOM_DOMAIN | Custom web domain complete; independent SMTP/provider issues remain. |
| U018 | PARTIAL_VERIFIED | 공개/Auth/Storage 덤프·네트워크 격리 복원·RLS13/FK22/고아0 확인. 원자적 snapshot·정기 외부 암호화 보관·알림·파일 복구 미완료. |
| U019 | PARTIAL_VERIFIED | 실제 도메인 E2E10/10·외부 이메일 인증·비밀번호 복구 후 재로그인·사용자 Toss TEST 승인 완료. SNS OAuth·Toss 실패/취소 및 실데이터 흐름 미완료. |
| U020 | NO_GO | 실제 데이터·삭제/동의·외부 가입·무료모드 격리·백업/복원·호스팅 적합성 등 P0/외부 게이트 미충족. |
