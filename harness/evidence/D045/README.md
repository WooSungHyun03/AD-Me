# D045 추천 이유·출처·스냅샷·재계산 — 2026-11-20I

DEV-A / baseline5044f45 / 같은 codex/dev-a-p0-continue / main65063c8. LOCAL_VERIFIED, DONE 아님. 실제 로컬 SQL/PostgREST/Auth/TLS + 가상 fixture 검증이며 실제 provider/플랫폼/성과 검증은 아니다. verification.json, recommendation-security-20261120.json, recommendation-upgrade-20261120.json과 인계 문서를 따른다.

DB가 owner 캠페인 입력과 공개 allowlist에서 저장 input/model/source versions/태그·예산·결측·근거·충족률·순위를 계산한다. HOT는 입력에 없으며 동일 입력 재계산 결과가 같다. 저장/재계산은 명시적 POST만 수행하고 GET/새로고침은 불변 기록을 읽는다. snapshot 원본은 유지하면서 현재 공개 철회/링크 동의 철회는 과거 읽기에서도 적용한다. 1000 cap을 넘으면 fail closed, 상위6·최근20이며 전체 정규화 추천/서버 검색은 후속이다.

수용 기준: 145 actual DB→TS factor/score/coverage/missing/eligibility parity, DB11그룹의 HOT 유무 동일 결과/명시적 재계산·과거 score 보존/출처 변경 stale/12회 동일 key→1행·1 quota/위조·타인·권한·immutability/공개 철회/상한/공유 read budget/기존 owner campaign delete를 검증했다. Node22 unit225/29·lint/typecheck/build·Harness5/backlog 통과. 실제 Chrome desktop1440×900/mobile390×844 신규2+golden2, 모바일 레이아웃 변경 후 신규2 재통과. 인증 trace는 off이며 로컬 캡처만 ignored output에 보관했다.

발견과 해결: private UID 부재를 검사한 첫 테스트가 기존 공개 user-UUID 식별자까지 오인했다. published creator ID 보존 계약에 따라 private owner field/actor 정보와 구분해 수정했고 실제 DTO의 canary/owner/request key/HOT 부재를 확인했다. opaque ID 전환은 D075 기존 잔여다.026 FK가 기존 캠페인 삭제를 막을 수 있어027로 실제 부모 cascade만 허용했고 직접 snapshot DELETE 거부와 타인 campaign 삭제 거부/본인 삭제 정리를 모두 통과했다.028은 expensive catalogue scan 이전의 공유 quota를 보강했다. 기존 적용026~027을 수정하지 않았다. 모바일 캡처의 점수 단위 줄바꿈은 기존 result grid의 div score 계약에 맞춰 고쳤다. 별도 QA DB analytics port 충돌54327은 ignored local config54337로 격리했다. 테스트 삭제/skip/제품 권한 완화 없음.

USER 생성 SQL31→34 실제 적용/중간 오류 전체 rollback/비어 있지 않은 기존 원본 hash·delivery activation stamp 보존/unknown·재적용 거부/RLS·retry·cascade 검증을 완료했다. 최종 source commit과 SHA256/LF/기존31 SQL·이전 전달 SQL·6 ZIP 불변은 packet-integrity-20261120.json에 별도 기록한다. D044 steward 모델/공개 목록 정규화 통합·USER 적용/실제 URL·교차 리뷰/전체 출시 검증은 남는다. 다른 담당/USER 원장은 바꾸지 않는다.
