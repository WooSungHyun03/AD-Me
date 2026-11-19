# DEV-A P0 구현·적용 검토 패킷 — 2026-11-19 KST

기준 HEAD `4437eb1`, 로컬 브랜치 `codex/dev-a-p0-continue`. 이전 변경이 있던 루트 체크아웃을 보존하며 이어서 구현했다. `dev-a-local` 독립 체크아웃은 그대로 보존하고 루트 검사·Git 추가·배포에서 제외했다. 이번 결과는 미커밋 소스 패키지의 파일별 SHA-256으로 식별한다. push·배포·외부 콘솔 변경·외부 키 조회/발급/등록은 실행하지 않았다.

**전체 무료 실제 데이터 베타는 NO-GO다.** 아래 패킷은 DEV-B 교차 검토와 격리 QA 적용용이다. D001/D005 환경·시연 데이터 격리, D017/D018 실제 데이터 계약, 삭제/동의/수집/권한 전수 감사 등 다른 P0가 미완료다. 전체 43개 DEV-A 티켓을 완료했다고 표시하지 않았다.

|티켓|이번 구현/검증|남은 조건|
|---|---|---|
|D003/D004|정확한 잠금 패키지·Node 22에서 설정·안전 오류 계약, 실제 로컬 DB와 브라우저 회귀. SQL 입력 오류 22023→422, 미존재 P0002→404 확장|DEV-B 계약 리뷰 및 배포 환경 재검증|
|D007|잠금 506개, 정확한 설치 버전 고지 확인 393개, 고지 파일 본문 533개와 해시 보존|113개 고지/플랫폼 아티팩트, Linux 배포·Edge Deno 번들 및 브랜드 재배포 범위 확인|
|D009|로컬 Supabase Auth + Mailpit에서 신규 가입·인증 전 로그인 거부·재발송·GET 미소비·POST 인증·증표 재사용 거부|이 소스/템플릿의 실제 외부 SMTP 및 U007/U008 재검증. 로컬 수신은 외부 배달 증거가 아님|
|D012|브랜드명·업종·소개 CRUD, 공개 DTO v1, 별도 비공개 담당자, 수락한 상대 공유·철회, 원자적 저장, REST 권한 거부|D011 온보딩 리뷰, D027 권한 검증 업로드 연결. 로고는 미제공 표시이며 임의 외부 URL 저장을 거부|
|D016|만료/철회 가능한 별도 운영 승인, TOTP 등록·인증 UI, 검증된 JWT의 AAL2+최근 15분 TOTP, API/RLS/RPC 이중 검사|USER가 의도한 운영자 신원·승인 대상을 확정하고 U008에서 TOTP 설정. 외부 실제 계정 검증 전 DONE 아님|
|D059|소유자 공개 선택과 별도 운영 잠금, 사유·append-only 이력, 소유자의 재공개/삭제 재등록·직접 REST 잠금 해제 거부. 잠금 해제가 소유자 비공개를 자동 공개하지 않음|DEV-B 교차 리뷰, D016 외부 적용 후 실제 URL 검증|
|D084|로컬 QA 생성·격리 DB·두 역할·MFA·메일·브랜드/잠금 E2E 및 직접 REST 회귀 추가|전체 수집/삭제/경합/권한 행렬은 D018/D049/D075 인계 후 확장|

정확한 명령·횟수·실행 시각은 [현재 검증 원장](../../harness/evidence/DEV-A-P0-CONTINUE/verification.json)을 따른다. 이전 실행의 빌드/E2E 차단 증거는 수정하지 않았다.

## 새 스키마와 API 계약

1. `202611190004_admin_security.sql`: `administrator_grants`, `is_admin_provisioned()`, `admin_mfa_recent()`, `is_admin()` 강화. 기존 role-only 관리자를 자동 승인하지 않는다. `provision_administrator`/`revoke_administrator`는 DB 소유자만 실행하며 public/anon/authenticated/service_role의 EXECUTE를 철회한다. 승인 참조·기한·실제 DB 실행 주체를 저장한다. 최근성은 토큰 iat가 아닌 AMR의 `totp`/`mfa/totp` 시각으로 검사한다.
2. `202611190005_moderation_locks.sql`: creators/campaigns의 `moderation_status`, `moderation_events`, 공개/제안/HOT 쿼리와 DB 트리거. `moderate_entity` 4인자 RPC에 사유가 필수다. 구형 3인자 서명은 삭제하지 않고 변경을 거부하므로 앱 업그레이드 전 운영 변경 기능이 닫힌다.
3. `202611190006_brand_profiles.sql`: 공개 브랜드와 비공개 담당자를 별도 테이블로 분리, RLS, 원자적 저장 RPC.
4. `202611190007_brand_projection.sql`: 직접 인증 REST에도 공개 브랜드의 owner_id SELECT를 허용하지 않는다. 소유자 설정은 `my_brand_account()`, 허용된 상대 연락처는 `brand_contact_for(uuid)`로 읽는다.

`PATCH /api/account`의 기존 `{name}` 요청은 유지한다. 선택 `brand` 객체는 엄격한 Zod 스키마를 사용하며 owner_id/사업자 인증 배지/외부 로고 URL을 받지 않는다. `GET /api/brands/:id`는 공개 필드만, `/api/brands/:id/contact`는 허용된 담당자 DTO만 반환한다. 관리자 API는 미초대/만료/철회/AAL1/오래된 OTP에 403을 반환한다. DB/Auth 장애는 비밀값 없는 503이다.

D014/D079 삭제 구현 시 새 brand_profiles/brand_contacts/administrator_grants/moderation_events 참조와 보존 규칙을 포함해야 한다. 기존 크리에이터 JSON DTO의 private owner_id 정리는 아직 D018/D075 범위이며 이 패킷으로 전수 보안 감사가 완료되지 않는다.

## 사용자의 외부 적용 순서

사용자에게 터미널 실행·패키지 설치·소스 편집을 요청하지 않는다. 개발 담당이 소스와 SQL을 패키징한다. 배포를 유발하는 push/merge는 별도 릴리스 시점 조율 없이 실행하지 않는다.

1. DEV-B가 스키마 번호·관리자 권한 변화·브랜드 DTO·잠금 의미를 검토한다. 소스 패키지의 `MANIFEST.json`과 파일 해시를 비교한다. 개인/실서비스 DB가 아닌 검토된 QA 대상을 먼저 확정한다.
2. USER가 해당 Supabase 콘솔에서 기존 백업/복구 준비 상태를 확인하고 `user-apply/00_preflight.sql` 결과를 확인한다. 신규 대상이 이미 있거나 기준선이 다르면 중단하고 개발 담당이 차이를 정리한다.
3. USER가 준비된 `user-apply/01_apply_all.sql` 또는 개별 번호 파일을 SQL Editor에서 순서대로 적용한다. 각 파일은 source SHA-256과 실제 migration history 기록을 포함하고 트랜잭션으로 묶었다. 이미 적용한 파일을 반복 실행하지 않는다. 결과는 개발 담당이 검증한다.
4. USER가 U008에서 TOTP 등록/확인을 활성화한다. 초기 운영자 UUID·승인 참조·유효 기간은 사용자 본인이 결정한다. 패킷의 오프라인 `console-actions.html`이 입력값에서 정확한 승인/철회 SQL을 생성하므로 앱 소스나 SQL 본문을 직접 작성할 필요가 없다. HTML은 SQL 실행·계정 접속·외부 통신을 하지 않는다.
5. 현재 환경 이름은 [환경 계약](ENVIRONMENT_CONTRACT.md)을 따른다. 새 외부 키는 추가하지 않았다. 로컬 QA의 합성 TEST 클라이언트 키·TLS 파일·계정·Mailpit 설정을 외부 환경에 복사하지 않는다. 결제 확인의 로컬 503 검사는 실제 Toss 승인 증거가 아니다.
6. 개발 담당이 리뷰된 소스를 통합하고, 사용자와 조율한 시점에 사용자가 배포/승격한다. SQL 004~007 적용 전에 새 소스를 배포하면 없는 컬럼/RPC 때문에 기능이 닫힌다. 실제 URL에서 두 역할·관리자 MFA·브랜드 프라이버시·잠금·메일을 재검증한 뒤에만 외부 상태를 갱신한다.

## 실패 및 복구

- SQL 파일 하나가 실패하면 해당 트랜잭션은 롤백된다. 다음 파일을 실행하지 말고 오류의 코드·파일·migration history만 공유한다. 비밀값·메일 원문·세션·OTP를 공유하지 않는다.
- 앱 rollback은 새 보안 스키마를 삭제하는 DB rollback과 다르다. 구형 앱의 사유 없는 운영 RPC는 거부될 수 있으므로 검토된 forward fix를 우선한다. role-only 관리자 접근을 다시 여는 우회를 하지 않는다.
- 운영 승인 철회는 현재 JWT의 AAL2 여부와 무관하게 DB에서 즉시 차단한다. 권한 재부여와 법적 승인·본인 확인을 에이전트가 대신 확정하지 않는다.

## 개발자 재현

Node 22에서 `npm ci`, `npm run setup:qa:local`, `npm run test:security:local`, `npm run test:e2e:local`을 실행한다. setup 스크립트는 표식이 있는 `output/dev-a-db` 프로젝트만 초기화하며 Docker/OpenSSL 문제는 개발 담당이 해결한다. 모든 접속은 loopback이다. 운영 빌드의 HTTPS 검증은 유지하고 로컬 인증서로 TLS 프록시를 사용한다. 인증 trace는 끄고 비공개 런타임 파일은 ignored output 안에만 둔다.

[Supabase MFA/RLS 공식 계약](https://supabase.com/docs/guides/auth/auth-mfa), [검증된 JWT claims](https://supabase.com/docs/reference/javascript/auth-getclaims), [로컬 메일 템플릿](https://supabase.com/docs/guides/local-development/customizing-email-templates)을 구현 근거로 확인했다.

## 티켓별 커밋 후속 기록

구현·검증 당시의 미커밋 스냅샷은 보존했다. 이후 15개 티켓 커밋과 원본 이력 보존·검증 결과는 [커밋 기록](DEV-A_TICKET_COMMITS.md)을 따른다. 패키지 ZIP은 당시 스냅샷이며 커밋 생성이 배포 또는 DONE을 의미하지 않는다.
