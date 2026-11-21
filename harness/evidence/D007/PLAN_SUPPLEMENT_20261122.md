# D007 배포물 고지 보완

기준8d9232c/기존 codex/dev-a-p0-continue, main65063c8. 외부/DEV-B 선행 완료 기록은 없다. USER의 선행 대기 제외 원칙을 유지하고 선행 없는 D007 exact lock 검토만 진행한다. 외부 문의·계정/키/배포·정책 승인 없음.

의도: 기존 license inventory/공개 원문·과거 proof를 수정하지 않고, 고정 SRI npm tarball의 README Licensing/versions.json 및 inBundle carrier의 실제 package.json·고지를 별도로 추출/분류한다. metadata root가 package/가 아닌 배포물도 이름·버전을 확인한다. SPDX 선언/README 요약/실제 permission text/확인 불가를 구분한다. 런타임 누락 항목을 무조건 해결 처리하지 않는다. 추출기는 tar 경로/링크/크기·SRI·번들 package/version·허용 registry를 검사하고 코드를 실행/설치하지 않는다.

src/app/licenses/page.tsx는 새 보완 원문 링크만 추가, 별도 public/legal/third-party-supplement-20261122.txt와 신규 docs/licenses/20261122-supplement/{manifest,inventory,summary}를 생성한다. 데이터/마이그레이션/정책/lock 변경 없음. 출처 primary npm 배포물과 package metadata를 사용하고 임의 copyright/허가를 작성하지 않는다. Linux 실제 build trace와 HTTP hash·desktop/mobile 접근성/기존 고지 byte 불변·unit/harness/lint/typecheck/build를 검증한다. whole D007은 권리/실제 최종 배포/미확인 고지 gate가 남으면 BLOCKED_EXTERNAL 유지한다.
