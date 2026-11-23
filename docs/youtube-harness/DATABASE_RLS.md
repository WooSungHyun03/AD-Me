# AD Me — Database, migrations, invariants and authorization

## Strategy
Keep existing migrations/history, evolve with additive migrations. Supabase PostgreSQL/Auth/Storage/Realtime; use server validation with Zod + RLS. `id uuid`, `created_at timestamptz`, `updated_at timestamptz`, indexes and unique constraints. Prefer normalized tables, avoid duplicating membership and channel records. DB is authority for billing and access; no localStorage authority.

## Tables/columns: target conceptual schema (map to existing names)
| Table | Key fields/invariants |
|---|---|
| `accounts` | id=auth.uid, role `brand/creator` immutable from self, disabled_at, verify flags |
| `brand_profiles` | account_id FK unique, brand_name, industry, contact_private, verified_at |
| `youtube_channels` | youtube_channel_id UNIQUE, title, handle, description, thumbnail_url, uploads_playlist_id, subscriber_count_nullable, subscriber_hidden, youtube_updated_at, source_type, claim_state, sync_policy_status |
| `youtube_video_cache` | youtube_video_id UNIQUE, youtube_channel_id FK, title, description, published_at, url, duration, view_count_nullable, live_broadcast_type_nullable, raw_api_updated_at, stale_after, removed_at |
| `creator_profiles` | account_id unique, claimed_youtube_channel_id unique nullable, preferred_categories, preferred_formats, cooperation_status, suggested_budget, owner_verified_at |
| `creator_claim_requests` | account_id, youtube_channel_id, oauth_google_subject/private token reference, verified_at, revoked_at, status; unique active claims |
| `creator_contact_methods` | creator_id, channel=email/phone/platform_chat, encrypted_value, verified_at, consent_at, visibility enum; default hidden |
| `creator_portfolio` | creator_id, source_url, description, is_owner_submitted, permissions_verified |
| `creator_tags` | channel_id/profile_id, tag_id, source=`owner/ai/editor`, confidence, model_version, status=`proposed/approved/rejected`, source_evidence, reviewed_at |
| `channel_metric_snapshots` | youtube_channel_id, source, raw stats JSON, sampled_at, consent_scope, policy_status, expires_at, UNIQUE(channel_id,sampled_at); retain per policy |
| `derived_metric_cache` | channel_id, metric_type, window, value, sample_size, sample_cutoff, disclosure, approval_status, computed_at, expires_at; never publish until policy permits |
| `youtube_discovery_rules` | keywords, enabled, category, locale, priority, max_results, updated_by |
| `youtube_sync_jobs` | dedupe_key UNIQUE, job_kind, resource_id, status, lease_until, attempts, next_run_at, worker_id, error_class, last_error, started_at, ended_at |
| `youtube_sync_logs` | job_id, quota_bucket, endpoint, call_count, results_count, source_timestamp, outcome |
| `ai_jobs` | kind, channel_id/campaign_id, params_hash, provider, model_version, status, lease_until, error, output_json; dedupe job hash |
| `ai_analysis` | job_id unique, channel_id, source_evidence, tag_proposals, confidence, user_visible=false until approved, analyzed_at |
| `brands_campaigns` | brand_id, title, description, product, budget, dates, formats, targeting, filter_json, status |
| `search_sessions` | brand_id, campaign_id, params_hash, state, paid_entitlement_txn_id, model_version, result_json, error, UNIQUE(brand_id,campaign_id,params_hash) where allowed |
| `search_results` | session_id, channel_id, organic_rank, components_json, evidence_json, policy_basis, created_at |
| `saved_candidates` | brand_id, channel_id, campaign_id, note, UNIQUE(...) |
| `sponsor_placements` | creator_id, channel_id, entitlement_id, start_at, expires_at, status, placement_group, display_label='스폰서'; only owned verified channels can sponsor |
| `jobs` | brand_id, campaign_id, title, description, category, budget, deliverables, apply_deadline, status, publishing_txn_id, published_at |
| `applications` | job_id, creator_id, proposed_quote, pitch, status, charge_txn_id, submitted_at, UNIQUE(job_id,creator_id) |
| `conversations` | id, brand_id, creator_id, job_id nullable, campaign_id nullable, agreed_to_contact, last_message_at, state |
| `conversation_members` | conversation_id, account_id, role, UNIQUE(conversation_id,account_id) |
| `messages` | conversation_id, sender_id, body, sent_at, edited_at, deleted_at; server validates participants |
| `message_reports` | reporter_id, message_id, category, status, reviewed_by, reviewed_at |
| `product_prices` | product_code, amount_krw, version, status, effective_from/to, allow_admin_update |
| `orders` | account_id, product_price_id, external_order_id UNIQUE, amount_krw, state, toss_payment_key UNIQUE nullable, gateway_confirmed_at |
| `entitlement_grants` | order_id UNIQUE, account_id, entitlement_type, remaining, starts_at, expires_at, state |
| `entitlement_ledger` | account_id, entitlement_type, delta, resource_kind, resource_id, idempotency_key UNIQUE, source_order_id, created_at; immutable append-only |
| `billing_events` | order_id, payment_provider_event_key UNIQUE, response_summary, received_at; never store payment card details |
| `refund_requests` | order_id, requester_id, reason, status, approved_by, audit_reference |
| `admin_roles` | account_id, privilege, approved_by, granted_at, revoked_at |
| `admin_audit_logs` | actor_id, target_kind/id, operation, old_value_redacted, new_value_redacted, reason, timestamp, request_id |
| `feature_flags` | key unique, enabled, reason, changed_by, updated_at; youtube-derived metrics gate false by default |

## Critical RLS/permission matrix
- Public read: approved directory channels, allowed public profile fields, published jobs. NEVER allow public contact/claim OAuth tokens/private notes/payment/messages.
- Creator read/write: own creator_profile, own contact, own claim, own applications, conversations where member. Cannot mutate `youtube_channels` raw API fields or claim own channel just by guessing channel ID.
- Brand read/write: owned brand/campaign/search/order records, own jobs and applicants to their jobs, conversations where member. Cannot read another brand's search results, order history or private contact.
- Admin: granted privileges stored in server-controlled trusted metadata/database table, **never user-editable metadata**. Separate capabilities for admin financial ops and moderation. All mutations audited.
- Public schema tables RLS ENABLED with tight `USING`/`WITH CHECK`; service_role only backend and batch workers. `SECURITY DEFINER` if indispensable isolated to unexposed schema and restricted `EXECUTE`.
- Realtime membership enforced via DB RLS; Storage bucket policies for creator portfolio and attachments, bounded file size, mime type and access controls.

## Atomic mutations & race conditions
- Use a single serializable transaction or locked row + stored procedure for ledger debit and resource publish/submit. Never `GET remaining` then `UPDATE remaining` in two separate requests.
- Idempotency keys: `search:<brandId>:<campaignId>:<params_hash>`, `post:<brandId>:<jobId>:v1`, `apply:<jobId>:<creatorId>`, `payment:<externalOrderId>:grant`, `yt-sync:<channelId>:<date>`. Normalize hash inputs consistently.
- `INSERT ON CONFLICT ...` + transaction ensures retry is no-op, not charge again; unique constraints are the final guard.
- Payment successUrl query params **not trusted**. Read order from DB and confirm with Toss server using secret. Validate currency, amount, ownership and product version, then grant.
- Expiration and refund revoke/adjust entitlements according to explicit policies, log all adjustments and never change gateway-approved facts arbitrarily.
- Job lease processing: `FOR UPDATE SKIP LOCKED` or documented safe queue service, bounded lease, retry/backoff, dead-letter; one job idempotency key.

## Security acceptance tests
- A brand cannot read B brand's campaigns/search results/applications/messages.
- An unverified creator cannot edit a claimed channel's stats or buy paid promotion for someone else's channel.
- No actor can change their own `role` or `admin_roles` via API; no unclaimed contact visibility.
- Payment replay, app double click, second browser, concurrent requests result in one resource/one debit.
- With missing YouTube derived approval, `derived_metric_cache` is never returned by public APIs or filter endpoints.
- After delete/revoke, public contact disappears and sync credentials revoked; YouTube deletion request handling operational.
