# API & Server Actions contracts

- All authenticated endpoints verify owner and role on the server. Zod validate params/body. Error response `{error:{code,message,requestId}}` with Korean user messages; no raw stack traces.
- Prefer Server Actions for form submissions; route handlers only for external callback/webhook/JSON APIs.

## JSON API 오류 v1

`apiRoute`가 JSON/CSV API의 성공 및 오류 응답에 서버가 생성한 `X-Request-Id`를 붙인다. 실패 시 `error.requestId`도 같은 값이며 기존 클라이언트의 `error.message`는 유지한다. 로깅은 고정 작업명, 코드, 요청 ID만 사용한다.

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
- `dataStatus` enum: `verified` / `self_reported` / `synthetic_demo` / `unavailable`.
- `metrics` may be `null`; never silently present fake performance figures.
- Every recommendation result displays `score`, `coverage`, `breakdown`, `excluded`, `evidence[]`, and `rankingVersion`.
- Store server-provided timestamps as ISO-8601 with explicit timezone conversion in UI.
