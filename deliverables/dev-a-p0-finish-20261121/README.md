# USER 적용 패킷 — 진행 중 P0 로컬 구현

현재 패킷은 정확한 기존34 application migration에035~046을 원자 추가한다. `MANIFEST.json`의 source_head를 기준으로 한다. 기존 산출물은 불변이며 새 ZIP/전체 소스 복제본을 만들지 않았다. 개발자는 로컬 검증만 했으며 실제 외부 설정/SQL/키/배포를 실행하지 않았다. 사용자의 터미널·코드 수정·패키지 설치는 필요 없다.

1. USER가 Supabase 콘솔에서 현재 복구 지점을 확인하고 SQL Editor로 `00_preflight.sql`을 실행한다. 정확한34 이력/기존 함수와 다르면 STOP이다. 이력을 수정해서 통과시키지 않는다. 이전 버전8/19/23/24/25/28/31이면 기존 패킷의 해당 경로를 개발자가 실제 이력과 대조해 준비한다. 알 수 없는 이력에는 이 파일을 적용하지 않는다.
2. USER가 `01_apply_current_34.sql` 전체를 한 번 실행한다. lock5초/statement60초/단일 transaction이다. 중간 실패는 전체 rollback, 중복 실행과 임의 함수 변경은 거부한다. 기존 프로필·캠페인·협업·메시지·주문·저장 PK/FK/내용은 보존한다.
3. `02_verify.sql`은 read-only 확인이다. 이력46, TEST billing OFF, 공개 reference switch OFF, source publication policies0, private image bucket false/4MiB, 새 private table RLS 위반0행이 예상값이다. 기존 read/delivery switch는 이전 활성 상태·처음 증거를 보존한다. 공개 ID는 아직 이전 앱 호환 상태다. **이 staging 상태는 개인정보 경계 완료가 아니다.**
4. USER가 검토된 source_head를 포함하는 앱 소스의 배포 시점을 조정하고 적용한다. 무료 실제 데이터 모드: `ADME_SERVICE_MODE=free_beta`, `ADME_FEATURE_TEST_BILLING=off`, 기존 결제 실제 키 사용 금지. 업로드/서버 Auth budget은 같은 프로젝트의 승인된 `SUPABASE_SERVICE_ROLE_KEY`를 서버에만 설정한다. 값은 문서/클라이언트/로그/스크린샷에 넣지 않는다. 키가 없으면 업로드는503이며 나머지 기능은 계속 동작한다. HMAC key가 없으면 Auth는 고정 shared fallback 한도다. IP는 Vercel이 덮어쓴 단일 `x-vercel-forwarded-for`만 신뢰한다. 일반 XFF를 신뢰하지 않는다.
5. DEV-B D001/D017/D027/D033/D049/D085 검토와 실제 URL의 두 역할·반대 역할 거부·검색/저장/추천/협업/이미지/공개 철회 확인 후 USER가 `03_activate_after_source_review.sql`을 실행한다. 공개 ID가 Auth UID와 독립인 `c-UUID`로 바뀌고 기존 내부 PK/FK는 유지된다. 이전 filtered cursor는 거부되므로 검색 첫 페이지를 다시 연다. owner-only/one-way이며 최초 activation ref/time을 덮어쓰지 않는다. TEST billing이나 provider 정책을 활성화하지 않는다.

영상은 opt-in 공식 iframe+원본 링크이며 콘텐츠/썸네일 사본을 수집하지 않는다. 이미지는 PNG/JPEG/WebP만 수락해 실제 디코딩·메타데이터 제거·PNG 재인코딩 후 private Storage에 저장한다. 입력/출력4MiB, 16M pixel, 업로드 시도/예약 한도가 있다. private 첨부는 매 다운로드 시 현재 참여자/차단/검토 상태를 다시 확인하는 인증 스트림이며 장기 signed URL을 공개하지 않는다. 차단 후 이력 메타데이터는 유지되지만 다운로드는 거부한다. 로고는 현재 공개 브랜드의 현재 파일만 익명 표시하며 철회 후404다. 참조 해제는 즉시 바이트 삭제가 아니며 계정 삭제·보존/수거는 D014/D079 후속이다.

Vercel 표준 요청/응답 한도 아래로 앱을4MiB로 제한했다. 유료/대용량 opt-in 설정은 하지 않았다. [공식 Functions 한도](https://vercel.com/docs/functions/limitations), [공식 요청 헤더](https://vercel.com/docs/headers/request-headers). 실제 대상 플랫폼/Storage/CORS/메일/Auth 기본 rate 설정은 USER 확인이 필요하다. 직접 GoTrue 호출은 앱의 budget을 경유하지 않으므로 공급자 자체 한도도 별도다.

장애 시 새 기능 노출을 중지하고 소스/DB의 실제 상태를 개발자가 읽어 additive forward fix를 준비한다. 적용된 SQL 수정, schema DROP, 이력 삭제, 공개 ID switch 역전, TEST gate 임의 개방은 하지 않는다. 이미지 경로는 클라이언트가 선택하거나 덮어쓸 수 없다. 계정/정책/배포/권리 승인을 로컬 fixture 통과로 대체하지 않는다.
