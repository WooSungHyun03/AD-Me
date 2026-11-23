-- D059 bridge: upstream directory must honor the independent moderation lock.
begin;
create or replace function adme_ops.ops_public_channels(p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform adme_ops.require_quota('youtube_search',coalesce(auth.uid()::text,'anonymous-shared'),
    case when auth.uid() is null then 300 else 60 end,60);
  return (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from (
    select ch.channel_id,ch.title,ch.subscriber_count,ch.fetched_at,creator.id as creator_id
    from adme_ops.channels ch join adme_ops.channel_claims c using(channel_id)
    join public.creators creator on creator.owner_id=c.owner_id and creator.published
      and creator.moderation_status='allowed' and coalesce(creator.profile->>'is_demo','false')='false'
    where ch.review='accepted' and ch.fetched_at>now()-interval '30 days'
      and c.verified_at is not null and c.consent_at is not null
      and strpos(lower(ch.title),lower(left(coalesce(p_query,''),80)))>0
    order by ch.title,ch.channel_id limit 50
  ) r);
end;
$$;
create or replace function public.ops_public_channels(p_query text default '') returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_public_channels($1); $$;
commit;
