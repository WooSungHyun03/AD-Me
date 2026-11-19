# Security, Data Reliability & License/Usage Boundaries

1. **Non-commercial/public repo ≠ ignore licenses.** Respect MIT/Apache notices, GPL/AGPL distribution/source obligations, prohibitions on private services/API redistribution, image licensing. Prefer permissive licenses (MIT/Apache/BSD) and record package license/SBOM where possible.
2. Images of real creators: only creator-owned/uploads, explicitly licensed images, API-permitted thumbnails and properly permitted embeds. Do not copy copyrighted profile photos or platform images wholesale without rights.
3. Real person risk/controversy: only reliable corroborated sources, neutral summary, date, state, subject response, human review, rectification/removal mechanism; no automatic 'bad person' risk scores, no rumors.
4. Metrics: source URL/type, collection timestamp, disclaimer, possible stale data; no fabricated likes/audience/ROI/fake follower stats.
5. Platform integrations: implement adapters behind permissions; YouTube official Data API within quota/caching rules. Meta Instagram Business Discovery and TikTok One require eligibility/permissions; default to user-submitted data. No anti-bot bypass or prohibited mass scraping.
6. Auth & RBAC: Supabase RLS per private table, trusted session validation on server, no role from editable metadata, no service key client exposure, secure storage policies.
7. Privacy: users may edit/delete own profile; collect minimal personal information and do not expose contact email without permission. Add admin report/appeal workflow.
8. Upload security: size/MIME validation, path scope per user, avoid SVG injection/file execution, signed/private URLs as needed.
9. Payments: test only; immutable prices from DB, server confirm, unique IDs/idempotency, no entitlement before confirm, never reveal secret key, no 'live'.
10. Development: no API keys in git commits or CI logs, `.gitignore` env, npm audit review, CSRF-safe authenticated server actions, rate-limit sensitive endpoints as available.
11. AI: redact PII, limit token/call count/cost, validate structured outputs with Zod, show AI-generated drafts, fallback when API fails, defend against prompt injection in external snippets.

Sources:
- https://developers.google.com/youtube/terms/developer-policies-guide
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/v21.0/
- https://business-api.tiktok.com/portal/docs/tiktok-one-api/v1.3
- https://supabase.com/docs/guides/database/postgres/row-level-security
