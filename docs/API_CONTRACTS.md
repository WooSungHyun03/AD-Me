# API & Server Actions contracts

- All authenticated endpoints verify owner and role on the server. Zod validate params/body. Error response `{error:{code,message,requestId}}` with Korean user messages; no raw stack traces.
- Prefer Server Actions for form submissions; route handlers only for external callback/webhook/JSON APIs.

## JSON API 오류 v1

`apiRoute`가 JSON/CSV API의 성공 및 오류 응답에 서버가 생성한 `X-Request-Id`를 붙인다. 실패 시 `error.requestId`도 같은 값이며 기존 클라이언트의 `error.message`는 유지한다. 로깅은 고정 작업명, 코드, 요청 ID만 사용한다.

2026-11-20: main의 intelligence API도 동일 계약을 사용한다. 429는 `Retry-After`(정수1~86400초)를 포함한다. 신규 원자 쿼터의 DB `PT429`는 남은 고정 윈도우를 전달하며 원문 details는 클라이언트에 보내지 않는다. 구형 `54000`은 보수적60초 fallback이다. 비활성 DB 자원의 `PT404`는 404로 매핑한다. 새 API는 `fail`이 예외를 던진다는 계약을 지키며 반드시 `apiRoute`로 감싼다.

| HTTP | 코드 | 의미 |
|---|---|---|
| 400 | BAD_REQUEST | 읽을 수 없는 JSON 또는 요청 형식 오류 |
| 401 | UNAUTHENTICATED | 세션이 없거나 만료됨 |
| 403 | FORBIDDEN | 역할·소유권·요청 출처가 허용 범위를 벗어남 |
| 404 | NOT_FOUND | 접근 가능한 리소스 없음 |
| 409 | CONFLICT | 중복, 상태 전이 또는 동시 변경 충돌 |
| 422 | INVALID_INPUT | JSON 또는 파라미터가 입력 스키마를 충족하지 않음 |
| 429 | RATE_LIMITED | 호출 한도 초과 |
| 500 | INTERNAL_ERROR | 분류되지 않은 서버 오류 |
| 503 | SERVICE_UNAVAILABLE | 서비스 설정 누락 또는 외부 의존성 장애 |

| Operation | Input | Output / policy |
|---|---|---|
| `searchCreators` | query, category[], vibes[], platform[], budget?, cursor | paginated public DTO + provenance |
| `getCreatorProfile` | creatorId | published fields, ads + reviewed safety entries |
| `upsertMyCreator` | validated profile, vibes, formats | owner-authenticated updated creator |
| `createCampaign` | product/category/goal/budget/target/vibes/formats | new campaign ID owned by brand |
| `listMyCampaigns` | status/page | brand-only campaigns |
| `matchCampaign` | campaignId | pure deterministic scores persisted by owner and scorerVersion |
| `compareCreators` | campaignId, creatorIds[] (max 3) | verified comparable fields; missing markers |
| `saveCreator` | creatorId, listId | ownership-safe saved creators |
| `applyCampaign` | campaignId, creatorId, note | creator-owned application, public campaign |
| `sendProposal` | campaignId, creatorId, brief | validated brand owner proposal |
| `transitionProposal` | proposalId, action | role/status-guarded transition, audit |
| `createCheckoutOrder` | sku ONLY | generated orderId, DB amount, owned by caller |
| `confirmTestPayment` | orderId, paymentKey, amount | DB checks + Toss confirm + once-only entitlement |
| `reportContent` | creatorId, reason, relevant source | moderation queue, not public immediately |

## UI data contract

DEV-A 2026-11-19 후속 계약: 공개 브랜드 DTO v1과 비공개 연락처를 분리했다. `PATCH /api/account`는 기존 name-only 입력과 선택 brand 객체를 받는다. `GET /api/brands/:id`는 id/brandName/industry/introduction/logo(null)만 반환하며 owner_id/이메일/담당자를 포함하지 않는다. 연락처 조회는 `/api/brands/:id/contact`에서 소유자 또는 공유를 허용받은 수락한 참여자에게만 제공한다. 관리자 API는 별도 유효 승인과 최근 15분 TOTP AAL2를 요구한다. `moderate_entity`에는 사유가 필요하며 공개 선호가 아닌 별도 운영 잠금을 바꾼다. 자세한 스키마·호환 경계는 [후속 패킷](handoff/DEV-A_P0_CONTINUATION_PACKET.md)을 따른다.
- `dataStatus` enum: `verified` / `self_reported` / `synthetic_demo` / `unavailable`.
- `metrics` may be `null`; never silently present fake performance figures.
- Every recommendation result displays `score`, `coverage`, `breakdown`, `excluded`, `evidence[]`, and `rankingVersion`.
- Store server-provided timestamps as ISO-8601 with explicit timezone conversion in UI.
