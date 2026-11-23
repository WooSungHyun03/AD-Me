# Database Design (Postgres + Supabase)

Use UUID PK, `created_at`, `updated_at` (unless join table). Postgres enums or CHECK constraints for statuses. Add FK indexes, unique constraints, owner policies, and SQL migrations. Prefer money `amount_krw INTEGER` (not float); no payment amount taken from browser. The below is **schema contract**, agent implements executable migration SQL.

| Table | Main fields | Permissions |
|---|---|---|
| `profiles` | id(auth uid), role, display_name, avatar_url | own, admin |
| `brands` | id, owner_id, name, category, description, logo_path | public name, own write |
| `creators` | id, owner_id nullable, stage, name, bio, city_nullable, categories, price_min, price_max, availability, is_demo, consent_status | public published read, owner/admin write |
| `social_accounts` | id, creator_id, platform, handle, url, followers_nullable, metrics_date, source_kind, is_demo | owner/admin write; published read |
| `vibe_tags` | id, slug, label, family, display_order | public read, admin write |
| `creator_vibes` | creator_id, tag_id, selected_by, evidence_url nullable | owner/admin write, published read |
| `portfolio_items` | creator_id, title, media_path/url, media_rights, format, is_demo | owner/admin write, published read |
| `ad_collaborations` | creator_id, brand_label, campaign_category, published_at, source_url, verification_status, is_demo | owner/admin write, published read |
| `safety_reviews` | creator_id, title, issue_status, source_url, verified_at, subject_response_url, moderator_id, is_demo, public_visible | admin write, reviewed/public read |
| `content_reports` | reporter_id, subject_type/id, reason, status, reviewer_id | own create, admin read/write |
| `campaigns` | brand_id, owner_id, title, product, category, target, goal, budget_krw, start/end, status, is_demo | owner write, public when published |
| `campaign_vibes` | campaign_id, tag_id | campaign owner |
| `applications` | campaign_id, creator_id, note, status | creator submit, brand reviews, RLS |
| `saved_lists` / `saved_list_items` | owner_id, name, campaign_id, is_default / list_id, creator_id | owner (캠페인 후보는 본인 캠페인만) |
| `match_runs` | campaign_id, scorer_version, weights_jsonb, created_by | campaign owner |
| `match_results` | run_id, creator_id, score, coverage, breakdown_jsonb, excluded | campaign owner |
| `proposals` | brand_id, creator_user_id, creator_id, campaign_id, kind, status(pending/accepted/rejected/cancelled/submitted/revision_requested/completed), brief | both parties read; status only via `transition_proposal` |
| `proposal_events` | proposal_id, actor_id, recipient_id, from_status, to_status | participants read; written only by definer functions in the same transaction as the status change (D052 inbox source) |
| `notifications` / `notification_cursors` | user_id, proposal_id, kind, status, source_key(unique) / user_id, last_read_id, read_at | recipient-only read (still a participant); written only by triggers / `mark_notifications_read` (monotonic); unread via `notification_unread()`; both in `supabase_realtime` |
| `reports` / `report_events` / `suppressed_sources` | ticket_no, kind(report/correction/deletion/appeal), parent_id, identity_verified, due_at, interim_hidden, response, decided_by/at / report_id, to_status / match_key (sha256 `h:` hash only, D079) | requester-only read (no public path); written only by `submit_report`/`review_report`; suppression admin-only, blocks ownerless creator insert/republish |
| `deletion_tombstones` / `retention_runs` | subject_kind(collected_profile/owner_profile/upload), subject_id, key_hashes(`h:` only), requested_at / status ok\|failed, counts, error | admin read only; written by deletion triggers and server-only `reapply_tombstones` / `run_retention` (service_role); no link to the requesting report |
| `privacy_exports` / `privacy_access_log` | user_id, token_hash(sha256, API에서 읽기 불가), expires_at(15분), consumed_at / user_id, export_id, action(created/downloaded/expired/reused/denied) | owner-only read; written only by `create_privacy_export`(최근 10분 내 로그인·24h 5건)·`consume_privacy_export`(1회) |
| `uploads` + bucket `private-uploads` | id, owner_id, path(`<owner>/<id>.<ext>` 검사), mime, size_bytes(≤5MB), original_name, purpose, rights_confirmed(필수), status(ready/deleted) | owner reads live rows; rows/objects written only by server key after magic-byte check; storage select = owner + live row; no browser insert/update/delete (old `portfolios` insert/delete policies dropped); `delete_upload` RPC |
| `user_blocks` / `contact_restrictions` | blocker_id, blocked_id / user_id, reason, report_id, starts_at, ends_at(≤30일), created_by, lifted_at/by, appeal, appealed_at | blocker-only read (blocked person never sees it) / owner+admin read; writes only via `block_counterparty`·`unblock_user`·`restrict_contact`(admin, 1~30일)·`lift_restriction`·`appeal_restriction`; single helper `contact_denied` (internal) used by `guard_contact` trigger on proposals/messages, `transition_proposal` accept, `notify_proposal_event`; reports kind `impersonation` |
| `proposal_messages` | proposal_id, author_id, body, visibility, created_at | participants, private internal notes excluded |
| `deliverables` | proposal_id, creator_id, url, status, feedback | both parties/role restrictions |
| `notifications` | user_id, type, entity_id, read_at | recipient only |
| `products` | sku, name, amount_krw, entitlement_kind, duration_days, credits, active | public read, admin write |
| `orders` | id, owner_id, sku, amount_krw, order_status, toss_order_id UNIQUE, created_at | owner read; trusted server write |
| `payments` | order_id UNIQUE, payment_key UNIQUE, confirmed_amount_krw, provider_status, approved_at, payload_sanitized | owner read; trusted server write |
| `entitlements` | owner_id, kind, expires_at, credits_remaining, source_order_id UNIQUE | owner read; trusted server write |
| `promotions` | creator_id, source_order_id, start_at, end_at, label, is_active | owner read, server-controlled write |
| `audit_events` | actor_id, action, target_type/id, changes_redacted, occurred_at | admin read, server write |

## Hard constraints
- RLS enabled on **all private tables**, including join tables. Never rely on hiding UI alone.
- `creator.owner_id` nullable for moderator-created public catalog entries; only moderator may claim/transfer after verification.
- `campaigns.brand_id` must belong to authenticated brand user; `proposals.brand_id` must match campaign owner and `creator_id` real.
- State-machine transitions must be in trusted server code/SQL: DRAFT -> SENT -> ACCEPTED/DECLINED -> IN_PROGRESS -> DELIVERED -> COMPLETED; CANCELLED from allowed earlier states.
- No forged `role=admin` from user-editable metadata. Admin roles assigned out-of-band or verified allowlist in a locked database table.
- Expose only public `creator` DTO; no raw private email/payment secrets/subject reports.
- Use unique order transaction id for idempotent provider confirmation; no duplicated entitlement grant.
- Store only sanitized payment response (never card data); server logging redacts keys/PII.
