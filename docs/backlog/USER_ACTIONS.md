# AD Me 사용자 전용 작업 — 상세 실행 안내

사용자 전용 외부 작업 20개를 각 파일로 구체화했다. 개발자가 코드·SQL·테스트·설정 안내를 완성한 뒤 사용자는 필요한 외부 콘솔 작업과 인증만 수행한다. 사용자에게 터미널·패키지 설치·직접 코드 수정을 요구하지 않는다. 현재 상태는 미완료/확인 대기이며 계정 설정을 실행한 것으로 표시하지 않는다.

## 준비 순서

1. 범위/계정/환경: U001 → U002/U003 → U007 준비.
2. YouTube 수집: U009/U010, 파일럿 U014. 허용 웹 수집은 U011 선택, Meta/TikTok은 U012/U013 P2 선택.
3. 코드가 준비된 뒤: U004 DB/함수 적용 → U006 환경값 등록 → U008 Auth URL/템플릿 → U005 검증용 배포. 실제 적용 선후는 D085 릴리스 packet으로 확정한다.
4. 운영 준비: U018 알림/백업, 필요 시 U017 도메인. 도메인 변경 시 U006/U008/메일/공급자 callback을 다시 대조한다.
5. U019 사용자 인증·테스트 → D088 개발자의 실제 URL 검증 → U020 최종 출시 판단.
6. Toss TEST U015와 LLM U016은 선택적이다. 무료 베타 전체를 막지 않으며 활성화된 범위에만 실제 검증을 요구한다.

## 중요한 구현/외부 조건

- 현재 인증 콜백·재설정·YouTube 어댑터·SNS OAuth가 완성되지 않았으므로 설정만으로 기능 구현을 대신할 수 없다. 각 작업의 “개발자 준비물”이 제공되기 전에는 해당 설정을 추측으로 적용하지 않는다.
- 무료 서비스라도 Vercel Hobby의 개인 비상업 용도 조건을 충족한다고 자동 판단할 수 없다. U005에서 용도 적합성을 확인하고 불확실하면 지원 문의/다른 적합한 선택을 검토한다.
- 원본 키·DB 비밀번호·OAuth 토큰·메일 인증 링크는 문서·채팅·GitHub에 넣지 않는다. 이름/환경/시각/검증 결과만 기록한다.

|ID|우선순위|상세 절차|
|---|---|---|
|U001|P0|[서비스 운영 범위·정책·운영자 확정](../user-tickets/U001.md)|
|U002|P0|[GitHub 조직·저장소·앱 권한 설정](../user-tickets/U002.md)|
|U003|P0|[Supabase 환경·계정·리전·한도 설정](../user-tickets/U003.md)|
|U004|P0|[Supabase 외부 환경·DB 변경 적용](../user-tickets/U004.md)|
|U005|P0|[Vercel 프로젝트·Git 연결·배포 실행](../user-tickets/U005.md)|
|U006|P0|[환경변수·시크릿 등록과 교체](../user-tickets/U006.md)|
|U007|P0|[SMTP 계정·키·발신 도메인 설정](../user-tickets/U007.md)|
|U008|P0|[Auth 외부 콘솔 설정](../user-tickets/U008.md)|
|U009|P0|[YouTube 프로젝트·API 키 발급/등록](../user-tickets/U009.md)|
|U010|P0|[YouTube 이용 정책·파생 지표 승인](../user-tickets/U010.md)|
|U011|P1|[웹 수집 대상의 허용 근거 확보](../user-tickets/U011.md)|
|U012|P2|[Instagram 앱·OAuth·심사·키](../user-tickets/U012.md)|
|U013|P2|[TikTok 앱·OAuth·심사·키](../user-tickets/U013.md)|
|U014|P0|[실제 크리에이터 시범 참여·운영 동의](../user-tickets/U014.md)|
|U015|P1|[Toss TEST 계정·호환 키·등록](../user-tickets/U015.md)|
|U016|P1|[선택적 LLM 계정·키·비용 상한](../user-tickets/U016.md)|
|U017|P1|[도메인·DNS·TLS·소유권](../user-tickets/U017.md)|
|U018|P0|[관측·알림·백업 외부 계정 설정](../user-tickets/U018.md)|
|U019|P0|[실제 테스트 참여·브라우저 승인](../user-tickets/U019.md)|
|U020|P0|[공개 베타 출시·사고 연락·운영 책임](../user-tickets/U020.md)|

설정명·저장 위치: [환경 계약](../handoff/ENVIRONMENT_CONTRACT.md). 코드/테스트/릴리스 준비: [공유 실행 계약](../handoff/SHARED_EXECUTION_CONTRACT.md).
