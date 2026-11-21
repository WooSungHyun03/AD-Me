# 광고 이력·지표·운영 검색 계약 — 2026-11-22

D030 `/api/ad-history/search`: creatorId,brand(부분 문자열),category(정확 일치),from/to(겹치는 기간),cursor. `ad_history_page`는 현재 revision/decision·ad_evidence·허용 근거·공개 정책·catalog 권한을 확인해 items/total/nextCursor를 한 snapshot에서 반환한다. 정정·철회·정책 버전 변경은 다음 조회의 목록과 집계에 함께 적용된다. keyset은 startedOn DESC/id DESC, cursor는 검색 조건에 묶이고 legacy lookup에도 공개 참조를 사용한다. 필터/새 조회를 바꾼 뒤 예전 응답으로 덮어쓰지 않는다. 검색 공개 DTO에는 내부 검토 근거/제출 동의·actor 필드를 넣지 않는다.

`my_ad_competitors`, `/api/ad-history/competitors` POST는 현재 브랜드 계정의 최대20개 이름만 읽고 교체한다. arbitrary owner parameter/직접 테이블 권한은 없다. 대소문자 무시 정확 이름 일치이며 기업 실체 식별/경쟁 관계의 객관적 판정이 아니다. 공개 평판·다른 브랜드·팀 공유와 분리하고 응답 private/no-store다. 팀 범위는 D071 선행 후 계약한다.

D031 `creator_metric_history`: 공개 catalog/owner 동의·claimed identity·publication policy·metric unit allowlist·현재 moderation/관측·수집 시각을 검사한다. 최근30일 UI, 직접RPC1~90일, identity최대10/각최신200관측(잘림 명시). 미래 관측/비공개 필드/미승인 파생 자료를 제외한다. 역사적 값은 당시 관측이며 TTL 경과를 과거 수치의 0으로 덮지 않는다. 현재 표시는 TTL 경과를 알리고 null은 미확인이다. 그래프는 null 및 TTL보다 긴 관측 공백을 선으로 잇지 않고 값·수집/관측 KST·원본 출처 표를 함께 제공한다. 합산·평균·인구통계를 추정하지 않는다.

파생 값은 승인된 비 YouTube 정책의 derived_allowed, 직접 기록된 formula_text/sample_size/period_start/end가 필요하며 기간 끝은 관측 이후일 수 없다. 기존 metadata 없는 derived 값은 공개하지 않는다. 승인/평가 사실을 개발자가 추정해 입력하지 않는다. YouTube derived는 이 릴리스에서 허용하지 않는다.

D035 `creator_filter_page` 기존 v1에 backward-compatible minEngagement 기본빈값과 선택적 metrics metadata를 더했다. API URLminEngagement는 정수0~100, 필드 미지정/빈값과 측정0을 구분한다. 최신·신선·공개·정책 허용·표본2개 이상 비 YouTube 참여율만 비교하며 오래된 성공값으로 최신null을 대체하지 않는다. min0도 미확보 자료를 통과시키지 않는다. 데이터 없는 필터는 사유와 함께 비활성이고 URL의 기존 조건은 해제 가능하다. 연령·성별은 미수집/미제공이며 검색 인자로 받지 않는다. metadata는 제공 가능 profile수/단위/표본 하한/정책/공급원/산식20개 상한을 포함한다. 상세기간·원문출처는 프로필에서 확인한다. 원본 팔로워 임시0/DEMO를 실제 지표로 바꾸지 않는다.

D060 `/api/admin/search` POST: 최근 검증된 native Auth claims·MFA 및 DB의 만료 가능한 ops role을 재확인한다. kind/query/cursor/reason 외 필드와 대량반출/권한변경 요청은 거부한다. 기본20/직접RPC최대50·분당60·created_at DESC/id DESC·kind/query에 묶인 커서. 본문/PII/raw jobs/payment keys를 선택하지 않는 SQL DTO allowlist와 strict Zod로 이중 검사한다. empty/error/OTP 재확인·다음 페이지를 제공한다.

검색과 현재 신고 검토/잠금 조치는 새 support_audit에 사유/actor/action/target/requestId를 원자적으로 기록한다. API의 생성 requestId가 검색·신고 응답 헤더와 DB에 동일하게 전달된다. 잠금 API는 새 wrapper로 전달하며 legacy direct lock은 DB가 UUID를 생성한다. 기존 전문 검토·수집 작업의 감사는 기존 도메인 원장을 보존하며 새 검색 감사에 합쳤다고 주장하지 않는다. 기존 reason 없는 review_report는 업그레이드를 요구한다. support_audit는 private RLS/default-deny·UPDATE/DELETE trigger 거부다. DB 소유자는 forward migration 권한이 있으므로 DB 소유자에 대한 암호학적 위변조 방지라고 하지 않는다.

067은 history_allowed 기본false/history_window_seconds(1시간~30일)/history_permission_ref를 추가한다. 현재값 공개 승인은 과거 이력 공개 승인이 아니다. 실제 허용 이력·보존/공개 기간·근거를 확인한 새 정책별 승인 전에는 시계열 자료를 반환하지 않는다. UI 요청30일과 승인된 공급원 window 중 짧은 기간만 읽는다. 위 fixture만 명시적으로 가상 승인을 설정한다. 원본 지표 read/참여율의 현재값 허가를 바꾸지 않는다.

새 개인 경쟁사·감사 보존 및 공급원 승인·실제 지표·최종 환경 적용/교차 리뷰는 별도 선행/출시 게이트다. 실제 가상 계정의 로컬 Postgres/Auth/Storage 검증과 실제 공급자·정책 승인·배포 검증을 구분한다.
