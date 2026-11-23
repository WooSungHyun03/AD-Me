# Policy, tradeoffs, and unresolved provider gates (2026-11-22)

## Verified constraints (consult current official documentation again before live access)
1. YouTube's new additional derived metrics/data storage policy allows specific average/ratio/AI tagging/brand suitability use cases **subject to accepting an amendment and satisfying applicable review/permission**. Until verified, no public use of YouTube API-derived computed averages, tags or custom scores. Source: https://developers.google.com/youtube/terms/derived-metrics-policy
2. Standard YouTube API non-authorized metadata is normally refreshed/deleted within 30 days; channel counts may be rounded/hidden and video visibility changes. Source: https://developers.google.com/youtube/terms/developer-policies/
3. Official current default quota: `search.list` separate bucket 100 calls per day (1 quota unit each), all-other endpoints default quota total 10,000/day. Confirm in Google Cloud Console; source: https://developers.google.com/youtube/data/determine_quota_cost
4. `playlistItems.list` for channel uploads, not repeatedly `search.list` for daily new uploads. Source: https://developers.google.com/youtube/data/reference/rest/v3/search/list
5. Toss real recurring billing requires separate billing setup/conditions; a 30-day one-time test purchase is not automatic recurring. Source: https://docs.tosspayments.com/guides/v2/billing
6. Vercel Hobby plan is restricted to non-commercial/personal use. Public test-only school demo may qualify, but if genuine commercial payments or operations begin, reassess. Source: https://vercel.com/docs/plans/hobby and https://vercel.com/legal/terms
7. YouTube API policy has conditions on selling ads/promotions on screens containing YouTube API Data: the screen must include sufficiently independent, non-YouTube value, and other terms continue to apply. Sponsor slots must be clearly labelled and the product must include its own substantial campaign/creator matching or verified-profile value. Source: https://developers.google.com/youtube/terms/developer-policies/
8. Supabase Cron supports scheduled jobs; do not run unbounded GPU AI within Vercel request. Source: https://supabase.com/docs/guides/cron

## Product decisions
- Paid relevance injection rejected: paid promotion placed in clearly labelled sponsored band. User's goal is paid upper exposure, not dishonest AI results.
- Auto-discovered channel ≠ member. To prevent fake partnerships and contact misuse, only verified creators can apply/buy sponsor and publish own contact.
- Business contact default hidden. Public sources do not automatically grant reuse of an email for marketing.
- Paid job posting + paid creator application is included even though it creates marketplace friction. Admin may grant free credits, feature flag and user tests; do not remove user-requested fee.
- AI semantic search UX remains available even before derived-policy acceptance using creator-authorized first-party data and verified manual tags; API-derived analytics filters clearly disabled until accepted.
- No auto-generated serious allegations or unreviewed reputational risk scores. Admin can manage factual citations/corrections.
- Pricing table is **hypothetical product configuration**, not market-validated revenue model.
- No automated Git force push. Push main when permitted/verified, else report exact restriction.

## Provider readiness report format
| Provider | Connected? | Credentials configured safely? | Live sandbox test evidence? | External approval? | Status |
|---|---|---|---|---|---|
| YouTube | | | | derived policy acceptance | PENDING |
| Google OAuth | | | | verification/scopes as applicable | PENDING |
| Toss TEST | | | | TEST merchant | PENDING |
| Supabase | | | | project ownership | PENDING |
| Vercel | | | | plan fit | PENDING |
| Local LLM | | | | hardware and runtime | PENDING |

## Explicitly forbidden representations
Do not call calculated average views an official YouTube metric; do not present a channel discovered by API as "joined AD Me"; do not invent brand contact or guarantee advertising results; do not mark real payments/production deployment if only mocks passed.
