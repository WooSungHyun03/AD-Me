# 남은 DEV-A P0 전체 대조·독립 구현

시작aab0be9, clean 기존 codex/dev-a-p0-continue. AGENTS/shared contract/v2/REAL_SERVICE/역사40/세션/설치 Next route 문서 확인. D007/D009/D014/D073/D084 전체를 대조한다. U001 최종 보존·위탁/국외이전·권리 절차는 미확정이라 async 사실 확인을 요청했고 기다리는 동안 독립 구현을 계속한다. 외부 콘솔/키/배포·외부 메일 발송은 USER 전담이다.

D014: 기존 순수 계약에서 실제 재인증·DB 요청/멱등 receipt·stale JWT 차단·세션 제한·private Storage 격리/기존 경로 제거·내구 lease/checkpoint까지 구현한다. 보존 미승인 시 영구 파기는 중단하고 명시적 대기 상태로 둔다. D079 담당 상태를 임의 완료/재배분하지 않는다. 적용된57 SQL 불변,058부터 예약. pre_request는 DataAPI만 보호하므로 public/Storage restrictive RLS와 이미지 경로를 별도로 차단한다. 이미 발급/캐시/다운로드된 URL·바이트의 범위를 구분한다.

D007: 기존 exact lock/notice 증거를 덮지 않고 최종 빌드·notice 산출물의 독립 가능한 누락을 보강한다. 권리 승인/누락 notice 근거는 추정으로 채우지 않는다. D009: 로컬 SMTP 증거와 현재 소스 차이를 대조하고 실제 외부 수신은 USER gate로 유지한다. D073: 확정 facts가 도착할 때만 정책 새 version/hash·적용본 준비, 가상 승인을 운영에 복사하지 않는다. D084: 위 변경의 실제 SQL/Auth/Storage/두-role·desktop/mobile 회귀를 구분해 저장한다.

공통 수정 의도: auth/context/proxy·이미지 접근·새 계정 삭제 API/settings·private schema/hooks/worker, permission inventory 및 USER 증분 패킷. 기존 DB hook과 충돌 시 STOP, 자동 대체하지 않는다. 관련 검사 후 공통 gates는 최종 batch 한 번, 티켓별 commit·기존 branch push·exact CI 확인. DONE은 전체 수용 조건 전 금지.

최종 범위: 실제 접수/격리 런타임과 native Auth·Storage 검증까지 구현했으며 영구 파기/Auth 삭제/보존·backup replay·상시 worker는 D079 계약 이후 작업이다.058을 적용한 뒤 후속 권한 수정이 섞여 원본을 ledger와 대조해 복구했고059 forward fix로 분리했다.060은 접수 시 소유 수집 lease 취소. 전체64/최종권한4, 기존20보안127그룹, DB→TS7/실제격리3, free6/keyless10, unit248/38. 신규자료 미확정 상태를 D073 승인으로 바꾸지 않았고 Linux actual build/HTTP notice는4개 runtime gap을 명시했다. 사용자57→60 패킷1개, old artifacts 불변, ZIP 중복 생성 없음.
