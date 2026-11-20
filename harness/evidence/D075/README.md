# D075 공개 원본 읽기 경계 보수

2026-11-20E · source665fcae 이후, 기존 codex/dev-a-p0-continue.

- 014는 원본 creators SELECT를 본인/승인된 MFA admin으로 제한하고 public RPC/HOT/saved에 DB allowlist를 적용한다. owner_id/owner_consent/이메일/OAuth/unknown JSON이 공개 DTO·embedded join에서 나오지 않는다. 공개 페이지는 RPC를 사용하고 invalid optional link만 안전하게 제외하며 private key가 추가된 응답은 strict validator가 거부한다.
- 의존 경로를 함께 변경했다: 공개 목록/상세/비교/추천, 캠페인 후보 id/name, API제안 원자 RPC, favorites CSV, workspace의 불필요한 raw join 제거. 원본 ID/FK/JSON/기존 주소/POST 입력과201{id} 응답/409중복/403권한/422불가 계약을 유지한다. 직접 proposals INSERT도 실제 owner와 actor를 확인하는 private boolean RLS helper로 호환된다. 상태 전이는 바꾸지 않았다.
- [직접 검사8그룹](creator-read-security-20261120.json): anon/타인 raw 거부, 본인/최근OTP admin 허용, safe RPC의 legacyID/null/0, cursor, own saved/foreign embed, 선택지, 동시 제안 중복/위조, HOT, moderation. HOT paid entitlement는 격리 DB 권한 fixture이며 실제 Toss/제공자 검증이 아니다.
- [메타데이터 inventory](permission-inventory-20261120.json): 테이블28/RLS28, 함수81, 정책35. private 테이블 client SELECT0, 공개 definer+anon 함수는 기존 자기 권한 bool/role2개다. 이 목록의 존재만으로 함수/Storage/테넌트의 모든 보안 기준을 검증한 것은 아니다.
- 구버전 SQL 적용 순서도 별도016으로 보수한다. 최종 USER 패킷은014~016을 함께 적용하고 old19 legacy 읽기를 보존하는 stage 후, 새 source 확인 뒤 owner SQL로 한 번만 활성화한다. raw migration 기본값은 strict이고, 이미 강화된 정책/부분 이력은 staging하지 않는다. 현재 패킷이 나오기 전014만 따로 외부 적용하지 않는다.
- **IN_PROGRESS**: USER 대상 적용/실제 URL·교차 리뷰, 전체 Storage/RPC/테넌트 권한 감사와 opaque 공개ID 이관이 남는다. legacy user-AuthUUID 주소를 유지하며 익명화했다고 주장하지 않는다. staging 중 raw 노출이 남으므로 보안 완료로 보고하지 않는다. 전체 검증과 적용 증거는 후속 공통 증빙에 기록한다.
