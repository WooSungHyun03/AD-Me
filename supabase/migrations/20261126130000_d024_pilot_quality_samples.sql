-- DEV-B D024: read-only facts for the real-data pilot quality gate.
-- One row per stored YouTube channel with only what the gate needs: an opaque sample reference
-- (first 6 bytes of the existing source resource hash), a title hash for duplicate detection,
-- field presence, freshness timestamps, the runtime source policy and whether a verified,
-- consenting owner claim exists. Raw channel ids, titles and owner ids are never returned, so the
-- report can be written to evidence without dumping source data. Service role only: the operator
-- runs it from the CLI; no browser role can call it.
begin;
create function public.pilot_quality_samples()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', statement_timestamp(),
    'samples', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', encode(substr(adme_ops.resource_hash(c.channel_id), 1, 6), 'hex'),
        'validId', c.channel_id ~ '^UC[A-Za-z0-9_-]{22}$',
        'titleHash', case when nullif(btrim(c.title), '') is null then null
                          else encode(extensions.digest(lower(btrim(c.title)), 'sha256'), 'hex') end,
        'subscriberCount', c.subscriber_count,
        'videoCount', coalesce(jsonb_array_length(case when jsonb_typeof(c.videos) = 'array' then c.videos end), 0),
        'hasViews', c.metadata ? 'views',
        'fetchedAt', c.fetched_at,
        'expiresAt', c.expires_at,
        'policy', c.source_policy,
        'policyEnabled', coalesce(p.enabled, false),
        'policyIsolated', p.review_ref is null or p.review_ref ilike 'ISOLATED%',
        'ownerVerified', exists(select 1 from adme_ops.channel_claims k
                                where k.channel_id = c.channel_id and k.verified_at is not null and k.consent_at is not null),
        'tombstoned', adme_ops.source_deleted(c.channel_id)
      ) order by adme_ops.resource_hash(c.channel_id))
      from adme_ops.channels c
      left join adme_ops.source_runtime_policies p on p.version = c.source_policy
    ), '[]'::jsonb),
    'activeTombstones', (select count(*) from adme_ops.source_tombstones t where t.expires_at > statement_timestamp())
  )
$$;
revoke all on function public.pilot_quality_samples() from public, anon, authenticated;
grant execute on function public.pilot_quality_samples() to service_role;
commit;
