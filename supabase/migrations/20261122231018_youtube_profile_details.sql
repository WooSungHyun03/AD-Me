begin;
alter table adme_ops.channels add column metadata jsonb not null default '{}'
  check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16000);

create or replace function adme_ops.ops_worker_finish(
  p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed int
) returns boolean language plpgsql security definer set search_path='' as $$
declare job adme_ops.jobs; item jsonb;
begin
  perform adme_ops.verify_worker(p_token);
  select * into job from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;
  if not found then return false; end if;
  if p_error is not null then
    update adme_ops.jobs set status=case when attempts>=3 or p_error in ('CHANNEL_UNAVAILABLE','DISCOVERY_DISABLED') then 'failed' else 'queued' end,
      available_at=now()+case when p_error='QUOTA' then interval '12 hours' else interval '1 minute' * power(3,attempts)::int end,
      lease=null,lease_until=null,error_code=left(p_error,40),elapsed_ms=p_elapsed,
      finished_at=case when attempts>=3 or p_error in ('CHANNEL_UNAVAILABLE','DISCOVERY_DISABLED') then now() end where id=p_id;
    return true;
  end if;
  if job.kind in ('youtube_channel','youtube_daily') then
    if jsonb_typeof(p_result) is distinct from 'array' or jsonb_array_length(p_result)>25 or octet_length(p_result::text)>750000 then
      raise invalid_parameter_value;
    end if;
    if job.kind='youtube_channel' and jsonb_array_length(p_result)<>1 then raise invalid_parameter_value; end if;
    for item in select value from jsonb_array_elements(p_result) loop
      if job.kind='youtube_channel' and item->>'id' is distinct from job.input then raise invalid_parameter_value; end if;
      insert into adme_ops.channels(channel_id,title,subscriber_count,videos,metadata)
      values(item->>'id',left(item->>'title',100),(item->>'subscribers')::bigint,coalesce(item->'videos','[]'),coalesce(item->'metadata','{}'))
      on conflict(channel_id) do update set title=excluded.title,subscriber_count=excluded.subscriber_count,
        videos=excluded.videos,metadata=excluded.metadata,fetched_at=now();
    end loop;
    p_result := null;
  elsif p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>16000 then
    raise invalid_parameter_value;
  end if;
  update adme_ops.jobs set status='done',output=p_result,error_code=null,
    lease=null,lease_until=null,finished_at=now(),elapsed_ms=p_elapsed where id=p_id;
  return true;
end;
$$;

create or replace function adme_ops.featured_youtube(p_query text,p_id text,p_limit int)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(channel) order by channel.subscriber_count desc nulls last,channel.channel_id),'[]')
  from (
    select ch.channel_id,ch.title,ch.subscriber_count,ch.fetched_at,owner.creator_id,
      case when p_id is not null then ch.videos else '[]'::jsonb end as videos,
      case when p_id is not null then ch.metadata else jsonb_build_object('avatar',ch.metadata->'avatar') end as metadata
    from adme_ops.channels ch
    left join lateral (
      select creator.id as creator_id
      from adme_ops.channel_claims claim
      join public.creators creator on creator.owner_id=claim.owner_id and creator.published
      where claim.channel_id=ch.channel_id and claim.verified_at is not null and claim.consent_at is not null
        and ch.review='accepted' and coalesce(creator.profile->>'is_demo','false')='false'
      order by creator.id limit 1
    ) owner on true
    where ch.review<>'rejected' and ch.fetched_at>now()-interval '30 days'
      and (owner.creator_id is not null or exists(select 1 from adme_ops.featured_channel_ids f where f.channel_id=ch.channel_id))
      and (p_id is null or ch.channel_id=p_id)
      and strpos(lower(ch.title),lower(left(coalesce(p_query,''),80)))>0
    order by ch.subscriber_count desc nulls last,ch.channel_id
    limit least(greatest(coalesce(p_limit,24),1),50)
  ) channel;
$$;

create table public.saved_youtube_channels (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  channel_id text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  primary key(owner_id,channel_id)
);
alter table public.saved_youtube_channels enable row level security;
revoke all on public.saved_youtube_channels from public,anon,authenticated;
grant select,delete,insert(channel_id) on public.saved_youtube_channels to authenticated;
create policy saved_youtube_read on public.saved_youtube_channels for select to authenticated
  using (owner_id=(select auth.uid()));
create policy saved_youtube_add on public.saved_youtube_channels for insert to authenticated
  with check (owner_id=(select auth.uid()) and public.featured_youtube('',channel_id,1)<>'[]');
create policy saved_youtube_remove on public.saved_youtube_channels for delete to authenticated
  using (owner_id=(select auth.uid()));
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb language plpgsql security definer
set search_path='' as $$
declare job adme_ops.jobs; keyword text;
begin
  perform adme_ops.verify_worker(p_token);
  update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='LEASE_EXPIRED',finished_at=now()
    where status='running' and lease_until<=now() and attempts>=3;
  select * into job from adme_ops.jobs
    where (status='queued' and available_at<=now()) or (status='running' and lease_until<=now() and attempts<3)
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update adme_ops.jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '6 minutes'
    where id=job.id returning * into job;
  select discovery_keyword into keyword from adme_ops.settings where discovery_enabled;
  return jsonb_build_object('id',job.id,'kind',job.kind,'input',job.input,'lease',job.lease,
    'keyword',keyword,'refresh',case when job.kind='youtube_daily' then
      (select coalesce(jsonb_agg(channel_id),'[]') from
        (
          select channel_id from (
            select channel_id,0 as priority,null::timestamptz as fetched_at from adme_ops.featured_channel_ids
            union all
            select ch.channel_id,1,ch.fetched_at from adme_ops.channels ch
              where ch.review<>'rejected' and not exists (
                select 1 from adme_ops.featured_channel_ids f where f.channel_id=ch.channel_id
              )
          ) candidates order by priority,fetched_at,channel_id limit 20
        ) c) end);
end;
$$;

create or replace function adme_ops.daily_tick() returns void language plpgsql set search_path='' as $$
declare
  local_now timestamp := now() at time zone 'Asia/Seoul';
begin
  delete from adme_ops.channels where fetched_at<=now()-interval '30 days';
  delete from adme_ops.jobs where created_at<=now()-interval '14 days';
  if local_now::time >= time '04:00' then
    insert into adme_ops.jobs(kind,input) values('youtube_daily',local_now::date::text) on conflict do nothing;
  end if;
end;
$$;
commit;
