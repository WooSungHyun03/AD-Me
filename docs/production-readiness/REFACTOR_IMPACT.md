# 개발자 A/B 티켓 개편 영향표

전체 개발 티켓 91개를 원장의 기존 담당·SP·상태·선행·검증 범위에 대조했다. 유지 73개, 변경 16개, 보관 2개다.

`UPDATE`는 경로 추가 또는 검증 범위 명시다. 파일 이동 전 경로는 호환 진입점으로 남았다. 기존 검증은 해당 SHA와 증거 범위 내에서 유지한다. 운영 새 배포는 D088에서 검증한다.

| ID | 판단 | 담당 및 SP (전후 동일) | 선행 | 영향 및 회귀 확인 |
| --- | --- | --- | --- | --- |
| D001 | KEEP | DEV-B / 3 | — | 기존 완료 조건 및 증빙 유지 |
| D002 | KEEP | DEV-A / 2 | D001 | 기존 완료 조건 및 증빙 유지 |
| D003 | UPDATE | DEV-A / 3 | — | 격리 DB 권한과 로그에 요청 ID만 노출되는지 재검증. Preview/Production 키의 DB 격리 확인 필요. |
| D004 | UPDATE | DEV-A / 3 | — | `src/lib/api.ts` → `src/shared/server/http.ts` |
| D005 | KEEP | DEV-B / 5 | D001 | 기존 완료 조건 및 증빙 유지 |
| D006 | KEEP | DEV-B / 3 | — | 기존 완료 조건 및 증빙 유지 |
| D007 | KEEP | DEV-A / 2 | — | 기존 완료 조건 및 증빙 유지 |
| D008 | KEEP | DEV-A / 3 | D003 | 기존 완료 조건 및 증빙 유지 |
| D009 | KEEP | DEV-A / 3 | U007, U008 | 기존 완료 조건 및 증빙 유지 |
| D010 | KEEP | DEV-B / 5 | D009 | 기존 완료 조건 및 증빙 유지 |
| D011 | KEEP | DEV-B / 3 | D009 | 기존 완료 조건 및 증빙 유지 |
| D012 | KEEP | DEV-A / 3 | D011 | 기존 완료 조건 및 증빙 유지 |
| D013 | KEEP | DEV-B / 3 | D009 | 기존 완료 조건 및 증빙 유지 |
| D014 | KEEP | DEV-A / 8 | D018, D073, D079 | 기존 완료 조건 및 증빙 유지 |
| D015 | KEEP | DEV-B / 3 | D011 | 기존 완료 조건 및 증빙 유지 |
| D016 | UPDATE | DEV-A / 5 | U008 | `src/lib/api.ts` → `src/shared/server/http.ts` |
| D017 | KEEP | DEV-B / 5 | U001 | 기존 완료 조건 및 증빙 유지 |
| D018 | KEEP | DEV-A / 5 | D017 | 기존 완료 조건 및 증빙 유지 |
| D019 | KEEP | DEV-A / 8 | D018, U009 | 기존 완료 조건 및 증빙 유지 |
| D020 | KEEP | DEV-A / 8 | D017, D018, U011 | 기존 완료 조건 및 증빙 유지 |
| D021 | KEEP | DEV-A / 8 | D018, D019 | 기존 완료 조건 및 증빙 유지 |
| D022 | ARCHIVE | DEV-A / 8 | D018, U012 | 기존 완료 조건 및 증빙 유지 |
| D023 | ARCHIVE | DEV-B / 8 | D018, U013 | 기존 완료 조건 및 증빙 유지 |
| D024 | KEEP | DEV-B / 5 | D005, D019, D021, U014 | 기존 완료 조건 및 증빙 유지 |
| D025 | KEEP | DEV-B / 8 | D018, D011, U014 | 기존 완료 조건 및 증빙 유지 |
| D026 | KEEP | DEV-B / 5 | D018 | 기존 완료 조건 및 증빙 유지 |
| D027 | KEEP | DEV-B / 5 | D075 | 기존 완료 조건 및 증빙 유지 |
| D028 | KEEP | DEV-A / 3 | D026 | 기존 완료 조건 및 증빙 유지 |
| D029 | KEEP | DEV-A / 8 | D018, D057 | 기존 완료 조건 및 증빙 유지 |
| D030 | KEEP | DEV-A / 5 | D029 | 기존 완료 조건 및 증빙 유지 |
| D031 | KEEP | DEV-A / 5 | D021, U010 | 기존 완료 조건 및 증빙 유지 |
| D032 | KEEP | DEV-B / 3 | D033, D058 | 기존 완료 조건 및 증빙 유지 |
| D033 | KEEP | DEV-A / 8 | D018, D005 | 기존 완료 조건 및 증빙 유지 |
| D034 | KEEP | DEV-A / 5 | D033 | 기존 완료 조건 및 증빙 유지 |
| D035 | KEEP | DEV-A / 3 | D031 | 기존 완료 조건 및 증빙 유지 |
| D036 | KEEP | DEV-B / 5 | D043 | 기존 완료 조건 및 증빙 유지 |
| D037 | KEEP | DEV-A / 5 | D034, D052 | 기존 완료 조건 및 증빙 유지 |
| D038 | KEEP | DEV-B / 5 | D018 | 기존 완료 조건 및 증빙 유지 |
| D039 | UPDATE | DEV-A / 5 | D034, D048 | 상품 조건은 explicit proposal 계약과 실제 공개 채널 흐름 회귀로 확인한다. |
| D040 | KEEP | DEV-B / 5 | D036 | 기존 완료 조건 및 증빙 유지 |
| D041 | KEEP | DEV-B / 5 | D012 | 기존 완료 조건 및 증빙 유지 |
| D042 | KEEP | DEV-A / 5 | D027, D041, U001, D079 | 기존 완료 조건 및 증빙 유지 |
| D043 | KEEP | DEV-B / 5 | D041 | 기존 완료 조건 및 증빙 유지 |
| D044 | KEEP | DEV-A / 8 | D018, D041 | 기존 완료 조건 및 증빙 유지 |
| D045 | KEEP | DEV-A / 5 | D044 | 기존 완료 조건 및 증빙 유지 |
| D046 | KEEP | DEV-B / 5 | D045 | 기존 완료 조건 및 증빙 유지 |
| D047 | KEEP | DEV-A / 8 | D046, U010 | 기존 완료 조건 및 증빙 유지 |
| D048 | UPDATE | DEV-A / 8 | D003, D008 | 워커 로그 계약과 로컬 추론 검증을 PR-003과 연결한다. 운영 대기열 복구는 D086에 남긴다. |
| D049 | KEEP | DEV-B / 5 | D043 | 기존 완료 조건 및 증빙 유지 |
| D050 | KEEP | DEV-B / 5 | D049 | 기존 완료 조건 및 증빙 유지 |
| D051 | KEEP | DEV-B / 5 | D049, D027, D076 | 기존 완료 조건 및 증빙 유지 |
| D052 | KEEP | DEV-B / 5 | D049 | 기존 완료 조건 및 증빙 유지 |
| D053 | KEEP | DEV-B / 5 | D052, U007 | 기존 완료 조건 및 증빙 유지 |
| D054 | KEEP | DEV-B / 5 | D049, D029 | 기존 완료 조건 및 증빙 유지 |
| D055 | KEEP | DEV-A / 5 | D041, D052 | 기존 완료 조건 및 증빙 유지 |
| D056 | KEEP | DEV-B / 5 | D049, D054 | 기존 완료 조건 및 증빙 유지 |
| D057 | KEEP | DEV-A / 8 | D073 | 기존 완료 조건 및 증빙 유지 |
| D058 | KEEP | DEV-B / 5 | D057 | 기존 완료 조건 및 증빙 유지 |
| D059 | KEEP | DEV-A / 5 | D016 | 기존 완료 조건 및 증빙 유지 |
| D060 | KEEP | DEV-B / 5 | D075, D059 | 기존 완료 조건 및 증빙 유지 |
| D061 | KEEP | DEV-B / 3 | D049 | 기존 완료 조건 및 증빙 유지 |
| D062 | KEEP | DEV-B / 5 | D059, D076 | 기존 완료 조건 및 증빙 유지 |
| D063 | KEEP | DEV-B / 3 | D006, D058 | 기존 완료 조건 및 증빙 유지 |
| D064 | KEEP | DEV-A / 3 | U001 | 기존 완료 조건 및 증빙 유지 |
| D065 | KEEP | DEV-B / 3 | D001, D002 | 기존 완료 조건 및 증빙 유지 |
| D066 | KEEP | DEV-B / 5 | D065, U015, U006 | 기존 완료 조건 및 증빙 유지 |
| D067 | UPDATE | DEV-B / 5 | D066 | `src/app/api/billing/orders/route.ts` → `src/domains/billing/orders.server.ts` |
| D068 | KEEP | DEV-B / 5 | D067 | 기존 완료 조건 및 증빙 유지 |
| D069 | KEEP | DEV-B / 5 | D067 | 기존 완료 조건 및 증빙 유지 |
| D070 | KEEP | DEV-B / 3 | D069 | 기존 완료 조건 및 증빙 유지 |
| D071 | KEEP | DEV-A / 8 | D075, D011 | 기존 완료 조건 및 증빙 유지 |
| D072 | KEEP | DEV-B / 3 | D065 | 기존 완료 조건 및 증빙 유지 |
| D073 | KEEP | DEV-A / 5 | U001 | 기존 완료 조건 및 증빙 유지 |
| D074 | KEEP | DEV-B / 5 | D073 | 기존 완료 조건 및 증빙 유지 |
| D075 | UPDATE | DEV-A / 8 | D018 | `src/lib/api.ts` → `src/shared/server/http.ts` · 브랜드 타인 접근 거부 및 관리자 AAL2 증거를 분리한다. |
| D076 | KEEP | DEV-A / 5 | D004 | 기존 완료 조건 및 증빙 유지 |
| D077 | UPDATE | DEV-B / 5 | D076 | `src/lib/api.ts` → `src/shared/server/http.ts` |
| D078 | UPDATE | DEV-B / 3 | D003 | `src/lib/api.ts` → `src/shared/server/http.ts` |
| D079 | KEEP | DEV-B / 5 | D018, D073 | 기존 완료 조건 및 증빙 유지 |
| D080 | KEEP | DEV-A / 3 | U001 | 기존 완료 조건 및 증빙 유지 |
| D081 | UPDATE | DEV-A / 5 | D024, D002 | 기존 공개 브라우저 통과는 해당 배포 SHA에서 보존한다. 밝은 테마로 바뀐 운영 배포의 재검증은 D088에서 수행한다. |
| D082 | UPDATE | DEV-A / 5 | D081 | 밝은 공통 표면·홈 모션·모바일 가격 CTA를 격리 환경에서 검증한다. |
| D083 | KEEP | DEV-B / 3 | D005, D025 | 기존 완료 조건 및 증빙 유지 |
| D084 | UPDATE | DEV-A / 8 | D049, D075 | 빈 로컬 DB의 116개 적용과 운영 업그레이드의 별도 증거를 요구한다. |
| D085 | UPDATE | DEV-B / 5 | D003, D075, D087 | 운영·프리뷰 격리, 백업·복구를 호환성 승인 전에 검증한다. |
| D086 | UPDATE | DEV-B / 5 | D078, U018 | 실모델 재시작과 내구성 큐 재처리·임대 만료를 따로 검증한다. |
| D087 | UPDATE | DEV-B / 5 | D079, U003, U018 | 운영 스키마/마이그레이션 번호 매핑·복구를 승인 전에 검증한다. |
| D088 | UPDATE | DEV-B / 5 | D024, D081, D082, D084, D085, D086, D087, U004, U005, U006, U019, PR-001 | 공개 URL의 역할별 흐름과 모바일, 새 밝은 화면 및 모션을 운영 적용 후 재확인한다. |
| PR-001 | KEEP | DEV-A / 8 | D039, D044, D048 | 기존 완료 조건 및 증빙 유지 |
| PR-002 | KEEP | DEV-A / 8 | D017, D021, D048 | 기존 완료 조건 및 증빙 유지 |
| PR-004 | KEEP | DEV-B / 8 | D067, D068, U021, U022 | 기존 완료 조건 및 증빙 유지 |
