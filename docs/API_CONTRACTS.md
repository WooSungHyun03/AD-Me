# API & Server Actions contracts

- All authenticated endpoints verify owner and role on the server. Zod validate params/body. Error response `{error:{code,message,requestId}}` with Korean user messages; no raw stack traces.
- Prefer Server Actions for form submissions; route handlers only for external callback/webhook/JSON APIs.

## JSON API 오류 v1

`apiRoute`가 JSON/CSV API의 성공 및 오류 응답에 서버가 생성한 `X-Request-Id`를 붙인다. 실패 시 `error.requestId`도 같은 값이며 기존 클라이언트의 `error.message`는 유지한다. 로깅은 고정 작업명, 코드, 요청 ID만 사용한다.

2026-11-20: main의 intelligence API도 동일 계약을 사용한다. 429는 `Retry-After`(정수1~86400초)를 포함한다. 신규 원자 쿼터의 DB `PT429`는 남은 고정 윈도우를 전달하며 원문 details는 클라이언트에 보내지 않는다. 구형 `54000`은 보수적60초 fallback이다. 비활성 DB 자원의 `PT404`는 404로 매핑한다. 새 API는 `fail`이 예외를 던진다는 계약을 지키며 반드시 `apiRoute`로 감싼다.

2026-11-20B: `ops_draft_get` 자체가 사용자별120회/분을 원자적으로 소비한다. public invoker wrapper는 volatile이며 직접 REST GET으로 조회를 우회할 수 없다. 앱은 별도 quota RPC 없이 getter를 한 번 호출한다. 오래된 앱용 `ops_request_quota('draft_poll')`는 별도 카운터로 유지한다.

## 캠페인 terms v2 — D041

- POST `/api/campaigns`의 브리프와 PATCH의 `brief`에 선택적 `terms`를 추가한다. API/저장은 `version:2`, `recruitment/production/posting: {start,end}`의 정규 UTC 분 단위 문자열(`YYYY-MM-DDTHH:mm:00.000Z`)이다. 폼은 KST를 입력받아 한 번만 변환한다. 각 기간은 start<end, 시작 순서는 모집≤제작≤게시이며 단계가 겹칠 수 있다. 날짜가 공개 상태를 자동 변경하지 않는다.
- `compensation`은 `{mode:'unknown'}` 또는 `{mode:'declared',cash?:{minimumKrw,maximumKrw},product?:{description,quantity}}`. declared는 cash/product 하나 이상, 금액은 정수0~1억 원·최소≤최대, 제품 수량1~1000. 미정을0원으로 바꾸지 않는다. 기존 `budget_krw`는 필수 총 예산으로 유지하며 이 단가와 별도다.
- `deliverables`는1~20개, `{format,quantity:1~100,usageRights,exclusivity:string|null}`. 문자열 길이와 비어 있지 않은 사용권을 검증한다. 중첩 구조의 미지원 필드를 거부한다. 실제 계약 체결·권리 검증·결제 승인을 뜻하지 않는다.
- v1 요청·행에는 terms가 없어도 되며 과거 날짜/보상을 생성하지 않는다. v2를 저장한 뒤 terms가 누락된 오래된 업데이트는422로 거부하여 정보 손실을 막는다. DB CHECK/trigger도 직접 REST에 동일 경계를 적용한다. 기존 RLS·moderation·제안 이력은 유지한다.
- 후속 D042/D043/D044/D050/D055는 이 버전을 소비하고 총 예산/단가·미정·모집 상태를 혼동하지 않아야 한다. 실제 협업 합의 버전·추천 스냅샷은 해당 티켓의 별도 구현이다.

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

## D034 client filter URL v1

`/creators` uses repeated `category`/`platform`/`tag` values (OR within a field; AND across fields), `q`, `minPrice`/`maxPrice`, `minFollowers`/`maxFollowers`, `available=1`, `sort=name|price|followers`. Zero is explicit, blank is unrestricted. Price ranges overlap inclusively with creator quote ranges. Numeric invalid/reversed ranges show an error with no results, never silently become unrestricted. Text is bounded120, choices8/field, price0..100000000 and followers0..10000000000. Reset removes all owned keys including sort and preserves unrelated query/hash. Sorts use name/ID ties and missing followers sort last.

This is the current snapshot UI contract, **not** a paginated server search endpoint. D033 must review the contract and connect a validated public DTO/cursor API. `createLatestCreatorSearch` supplies an independently tested cancellation/stale response boundary for that future connection; the current UI filters synchronously. Legacy owner-registration placeholders are unavailable, not real zero observations; synthetic DEMO counts remain labeled. No population-wide search/performance or actual provider verification is claimed.

## D018 private storage snapshot v1 (2026-11-20C)

`my_creator_identity_snapshot()` takes no arguments and returns null when the authenticated caller has no legacy creator, or a private version1 snapshot with creatorId UUID, legacyCreatorId, unchanged legacyProfile, identities and identitiesTruncated. Each identity includes the existing identity contract plus sourceType/policyVersion/collectedAt/metrics/metricsTruncated. It returns at most50 identities and200 latest observations per identity; truncation is explicit. The public wrapper is SECURITY INVOKER; a private implementation selects only auth.uid()'s legacy creator, including after role/ownership changes. Anonymous execution and direct normalized table access are revoked. This is an owner-only DB RPC, not the public CreatorPublicDTO or a search API.

`creator-storage.ts` is a server-only storage validator/legacy adapter. Legacy JSON and normalized observations remain separate; missing real metrics never inherit synthetic legacy followers. No policy is approved, provider writer connected, main YouTube directory migrated or public read source switched by migration013. D017/D019 review is required before those steps; source policy_version is provenance, not proof of approval. Details: [D018 handoff](handoff/DEV-A_SCHEMA_20261120.md).

## D018 transitional public app catalog DTO (2026-11-20D)

`projectPublicCreator` projects legacy JSON through a validated allowlist. `publicCreators` no longer selects the owner column or spreads raw JSON into client props. It omits owner_id/owner_consent/contact/OAuth/internal/unknown fields; source/SNS/portfolio links require explicit consent and safe HTTPS normalization. Unavailable real metrics are null, and only labeled fictional source counts remain numeric. Malformed or unpublished rows are omitted. Matching accepts only required public fields; fixture recommendations retain their scores.

This is an app boundary repair. **Direct REST access to published legacy creators and user-<Auth UUID> public IDs still require a coordinated read/opaque-ID migration under D018/D033/D075.** No DB grant/RLS/schema change, approved provider policy or actual normalized ingestion read switch is implied. D033 must connect its reviewed public pagination/search contract rather than assume the current snapshot API meets that ticket.
