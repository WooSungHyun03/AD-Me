# D031 출처가 기록된 관측 그래프

062 metric_history/creator_metric_history와 metrics.ts·MetricHistory를 상세 페이지에 연결했다. 관측/수집 KST·기간·원본/파생·출처·산식/표본·null/0·갱신 지연·표본 부족·명시적 잘림을 구분한다. 원본 합산/평균이나 인구통계를 추정하지 않는다. 역사적 수치를 TTL로0으로 덮지 않고 null·긴 미수집 구간을 선으로 잇지 않는다. 최근30일, RPC1~90일/identity10·관측200 제한. 표/캡션과 함께 접근 가능한 값·출처를 제공한다. YouTube derived는 현재값/시계열 모두 비활성. 다른 파생 값도 정책/산식/표본/기간 필수이며066이 관측 이후 기간을 거부한다.

단위 시계열/스키마/기간 검증, 실제 local normalized DB·현재값/시계열 허가/현재 공개 프로필·철회/정책·미래 자료·원본0/null, desktop/mobile 관측 표·공백 그래프·출처·overflow 검증. D035와 공유하는 실제 DB4그룹 및 공통 최종 검증은 ../DEV-A-READY-20261122/{metric-security.json,verification.json,commits.json}. 입력은 가상 관측·정책이며 플랫폼 실제 성과 검증/승인이 아니다.

기존 원본 관측값은 수정하지 않고 nullable metadata를 추가했다. 최종067은 시계열 공개를 별도 defaultOFF 승인/history_permission_ref/window로 분리했다. 현재값 승인이 시계열 공개로 확대되지 않고 요청 기간과 실제 승인 window 중 짧은 기간만 읽는다. 승인 전 빈상태·1시간 window에서 오래된 관측 제외·가상 승인4시간 window에서 원본0/null 보존을 검사했다. 실제 D017/D019 승인/정규화 writer·실제 공급자 자료·USER 적용/대상URL/교차 검토는 별도. 이 UI의 로컬 검증을 실제 플랫폼 성과 확보나 전체 DONE으로 보고하지 않는다.
