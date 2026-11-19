# API & Server Actions contracts

- All authenticated endpoints verify owner and role on the server. Zod validate params/body. Error response `{error:{code,message,requestId}}` with Korean user messages; no raw stack traces.
- Prefer Server Actions for form submissions; route handlers only for external callback/webhook/JSON APIs.

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
