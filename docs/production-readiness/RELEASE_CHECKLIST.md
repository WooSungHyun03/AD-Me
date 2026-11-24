# 출시 릴리스 체크리스트

- [ ] 무료 베타·격리 TEST 시연·유료 정식 운영의 URL·DB·비밀 설정·책임자를 구분한다. 승인 없이는 운영에서 실제 청구를 활성화하지 않는다.
- [ ] main SHA, 호환 운영 SHA, 비교 DB, 적용 원장, Vercel 배포 ID, 이전 복구 지점을 묶는다.
- [ ] SQL 105개와 원격 41행을 번호뿐 아니라 본문과 권한·호출 계약으로 검증한다. 적용된 파일은 불변이다. 복제 DB restore 검증을 통과한다.
- [ ] 정확한 lockfile로 lint·타입·단위·빌드·비밀/의존성 검사 및 빈 DB와 운영 복제본 마이그레이션을 실행한다.
- [ ] 익명·브랜드·크리에이터·admin·제3자 RLS/RPC/Storage, 권한·MFA·세션 만료, CSRF, 가입·복구·삭제를 검사한다.
- [ ] 상품→추천→공고→지원→수락→메시지·결과물까지 정상·실패·경합을 실제 QA 동선에서 검증한다.
- [ ] 공식 데이터의 TTL·삭제·quota·Cron·AI 장애와 fallback을 검사한다. 운영에 가짜 실적이나 비승인 태그가 없는지 확인한다.
- [ ] TEST의 주문 금액·소유권·멱등·승인/실패/취소·HOT 회수를 전용 환경에서 확인한다.
- [ ] 360~1920과 keyboard·axe·빈/실패·복구·성능, canonical·robots·공유 렌더를 검수한다.
- [ ] 운영 권한·동의·고지·알림·도메인·메일·비용 한도와 사고 대응 책임을 확인한다.
- [ ] 승인된 작업자가 복제본 검증 후 운영 expand/backfill/read switch 순서로 적용한다. Vercel 후보 URL과 운영 승격 뒤 핵심 smoke를 실행한다.
- [ ] 중대한 장애가 있으면 승격을 중단한다. 앱 롤백과 DB 계약/복원은 각각 독립적으로 검증한다.
- [ ] 유료 운영의 경우 U021·U022·PR-004 승인, 운영 원장·대사·취소/환불·영수증 및 고객 고지를 추가 확인한다.

[외부 실행](EXTERNAL_ACTIONS.md) · [출시 판정](GO_NO_GO.md) · [기존 릴리스 계약](../handoff/RELEASE_MANIFEST.md)

## 2026-11-24 개편 릴리스

[운영 기준선](RELEASE_BASELINE.md)과 [실행 기록](OPERATOR_EXECUTION_20261124.md)을 적용한다. 로컬 0→116 증거는 운영 복원·업그레이드 증거와 독립적이다. 운영 DB와 격리된 프리뷰 확인 후에도 U004·U005·U020 승인이 필요하다.

## main 자동 배포 설정

GitHub `main`을 Vercel의 Production branch로 사용한다. `main`에 푸시하면 Vercel이 운영 빌드를 시작한다. 빌드 명령은 전체 `supabase/migrations` SQL 파일의 이름과 내용에서 산출한 지문을 Production 환경의 `ADME_PRODUCTION_SCHEMA_SHA256`과 비교한다. 값이 없거나 다르면 빌드가 멈추고 기존 도메인 배포가 계속 응답한다. Preview와 로컬 빌드는 이 운영 설정 없이 실행된다.

새 SQL을 적용할 때에는 운영 백업·복구 증빙, 운영 스키마로부터의 업그레이드 검사, 각 RPC 및 권한 대조를 완료한다. 검증을 마친 커밋의 체크아웃에서 `node scripts/production-schema.mjs --fingerprint`로 지문을 구해 Vercel Production 환경에 등록한다. 같은 커밋을 재배포하면 환경변수가 적용된다. SQL 파일에 변화가 없는 후속 앱 변경은 기존 지문으로 배포할 수 있다. 이 값은 비밀키나 DB 접속 정보가 아니다. 기존 배포를 롤백해야 할 경우에도 Vercel 배포와 DB 마이그레이션의 호환성을 확인한다.

연결 전 확인은 Vercel 프로젝트의 Git 설정에서 `WooSungHyun03/AD-Me`와 Production branch `main`이 함께 표시되는지 확인한다. 2026-11-24 Vercel API에서 기존 프로젝트의 Git 연결이 비어 있었고 연결 요청은 GitHub App 설치·접근 승인을 요구했다. GitHub 소유자가 저장소 액세스를 승인한 다음 기존 `ad-me` 프로젝트에서 연결을 재시도한다.
