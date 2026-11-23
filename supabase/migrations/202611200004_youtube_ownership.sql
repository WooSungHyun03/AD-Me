begin;
alter table adme_ops.jobs drop constraint jobs_kind_check,
  add constraint jobs_kind_check check (kind in ('youtube_channel','youtube_daily','marketing_draft','youtube_claim'));
create table adme_ops.channel_claims (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  challenge text not null default replace(gen_random_uuid()::text,'-',''),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  consent_at timestamptz,
  unique(owner_id,channel_id)
);
create unique index adme_one_verified_owner on adme_ops.channel_claims(channel_id) where verified_at is not null;
alter table adme_ops.channel_claims enable row level security;

create function public.ops_own_channels() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'channel_id',c.channel_id,'challenge',case when c.verified_at is null then c.challenge end,
    'verified',c.verified_at is not null,'consent',c.consent_at is not null,'review',ch.review,
    'job', (select j.status from adme_ops.jobs j where j.kind='youtube_claim' and j.owner_id=c.owner_id
      and split_part(j.input,':',1)=c.id::text order by j.created_at desc limit 1)
  ) order by c.created_at desc),'[]') from adme_ops.channel_claims c
  left join adme_ops.channels ch on ch.channel_id=c.channel_id and ch.fetched_at>now()-interval '30 days'
  where c.owner_id=auth.uid();
$$;

create function public.ops_channel_owner(p_action text,p_channel text) returns void
language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); claim adme_ops.channel_claims;
begin
  if v_owner is null or not exists(select 1 from public.profiles where id=v_owner and role='creator') then
    raise insufficient_privilege;
  end if;
  if p_channel is null or p_channel !~ '^UC[A-Za-z0-9_-]{22}$' then raise invalid_parameter_value; end if;
  perform pg_catalog.pg_advisory_xact_lock(71207);
  if p_action='create' then
    if (select count(*) from adme_ops.channel_claims where owner_id=v_owner)>=5 then raise program_limit_exceeded; end if;
    insert into adme_ops.channel_claims(channel_id,owner_id) values(p_channel,v_owner) on conflict(owner_id,channel_id) do nothing;
    return;
  end if;
  select * into claim from adme_ops.channel_claims where owner_id=v_owner and channel_id=p_channel for update;
  if not found then raise no_data_found; end if;
  case p_action
    when 'check' then
      if claim.verified_at is not null then return; end if;
      if exists(select 1 from adme_ops.jobs where owner_id=v_owner and kind='youtube_claim'
        and status in ('queued','running') and split_part(input,':',1)=claim.id::text) then return; end if;
      if (select count(*) from adme_ops.jobs where kind='youtube_claim' and created_at>now()-interval '1 day')>=30
        or (select count(*) from adme_ops.jobs where kind='youtube_claim' and owner_id=v_owner and created_at>now()-interval '1 hour')>=3
        then raise program_limit_exceeded; end if;
      insert into adme_ops.jobs(kind,owner_id,input)
      values('youtube_claim',v_owner,claim.id::text||':'||p_channel||':'||claim.challenge);
    when 'publish' then
      if claim.verified_at is null then raise insufficient_privilege; end if;
      update adme_ops.channel_claims set consent_at=now() where id=claim.id;
    when 'hide' then
      update adme_ops.channel_claims set consent_at=null where id=claim.id;
    when 'unlink' then
      delete from adme_ops.jobs where owner_id=v_owner and kind='youtube_claim'
        and split_part(input,':',1)=claim.id::text;
      delete from adme_ops.channel_claims where id=claim.id;
    else raise invalid_parameter_value;
  end case;
end;
$$;

create function adme_ops.capture_ownership() returns trigger language plpgsql set search_path='' as $$
begin
  if new.kind='youtube_claim' and new.status='done' then
    if new.output->'verified' = 'true'::jsonb then
      perform pg_catalog.pg_advisory_xact_lock(71208);
      update adme_ops.channel_claims c set verified_at=now()
      where c.id=split_part(new.input,':',1)::uuid and c.owner_id=new.owner_id
        and c.challenge=split_part(new.input,':',3) and c.verified_at is null
        and not exists(select 1 from adme_ops.channel_claims other where other.channel_id=c.channel_id
          and other.id<>c.id and other.verified_at is not null);
    end if;
    new.output=null;
    new.input=split_part(new.input,':',1);
  end if;
  return new;
end;
$$;
create trigger adme_channel_ownership before update of status on adme_ops.jobs
for each row execute function adme_ops.capture_ownership();

create function public.ops_public_channels(p_query text default '') returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(r)), '[]') from (
    select ch.channel_id, ch.title, ch.subscriber_count, ch.fetched_at, creator.id as creator_id
    from adme_ops.channels ch
    join adme_ops.channel_claims c using(channel_id)
    join public.creators creator on creator.owner_id=c.owner_id and creator.published
      and coalesce(creator.profile->>'is_demo','false')='false'
    where ch.review='accepted' and ch.fetched_at>now()-interval '30 days'
      and c.verified_at is not null and c.consent_at is not null
      and strpos(lower(ch.title), lower(left(coalesce(p_query,''),80)))>0
    order by ch.title,ch.channel_id limit 50
  ) r;
$$;
revoke all on function public.ops_own_channels(),public.ops_channel_owner(text,text),
  public.ops_public_channels(text) from public,anon,authenticated;
grant execute on function public.ops_own_channels(),public.ops_channel_owner(text,text) to authenticated;
grant execute on function public.ops_public_channels(text) to anon,authenticated;
commit;
