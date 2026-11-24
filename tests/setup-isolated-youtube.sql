-- Integration fixtures for the disposable CI database. Never run against hosted Supabase.
begin;
insert into adme_ops.source_runtime_policies(
  version,provider,enabled,cache_seconds,job_seconds,tombstone_seconds,daily_units,max_attempts,review_ref
) values ('ci-source-fixture','youtube',true,3600,3600,3600,1000,3,'ISOLATED QA ONLY; no provider approval');
update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton;
select adme_release.set_test_billing(true,'isolated CI TEST only');
select adme_release.set_demo_catalog(true,'isolated CI TEST only');
update adme_ops.settings set worker_hash=sha256(convert_to(repeat('0',64),'UTF8'));
with channels as (
  select channel_id, case channel_id
    when 'UCfpaSruWW3S4dibonKXENjA' then 1
    when 'UCT-_4GqC-yLY1xtTHhwY0hA' then 2
    when 'UC9kmlDcqksaOnCkC_qzGacA' then 3
    else 3 + row_number() over (order by channel_id)
  end as ordinal from adme_ops.featured_channel_ids
)
insert into adme_ops.channels(channel_id,title,subscriber_count,metadata,videos)
select c.channel_id, 'QA YouTube 채널 ' || lpad(c.ordinal::text,2,'0'), 500000/c.ordinal,
  jsonb_build_object('avatar','https://yt3.googleusercontent.com/adme-e2e/avatar',
    'banner','https://yt3.googleusercontent.com/adme-e2e/banner',
    'views',1000000,'videoCount',30,'topics',jsonb_build_array(case c.ordinal
      when 1 then 'Food' when 2 then 'Fashion' when 3 then 'Fashion' else 'Technology' end)),
  (select jsonb_agg(jsonb_build_object('id',lpad(n::text,11,'0'),'title','QA 영상 ' || n,
    'views',1000,'likes',100,'publishedAt',now()-n*interval '1 day',
    'thumbnail','https://i.ytimg.com/adme-e2e/thumbnail') order by n)
   from generate_series(1,5) n)
from channels c;
commit;
