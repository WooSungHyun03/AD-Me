begin;
create schema if not exists adme_ops;
revoke all on schema adme_ops from public, anon, authenticated;
create table adme_ops.staff (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('super','content','campaign','finance','support'))
);
create table adme_ops.settings (
  singleton boolean primary key default true check (singleton),
  worker_hash bytea,
  discovery_enabled boolean not null default false,
  discovery_keyword text not null default '뷰티 리뷰'
    check (char_length(discovery_keyword) between 2 and 80)
);
insert into adme_ops.settings default values;

create table adme_ops.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('youtube_channel','youtube_daily','marketing_draft')),
  owner_id uuid references public.profiles(id) on delete cascade,
  input text not null check (char_length(input) between 1 and 1600),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease uuid,
  output jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  elapsed_ms int
);
create unique index adme_daily_once on adme_ops.jobs(input) where kind='youtube_daily';
create index adme_job_lookup on adme_ops.jobs(status, available_at, created_at);
create table adme_ops.channels (
  channel_id text primary key check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  title text not null,
  subscriber_count bigint check (subscriber_count >= 0),
  videos jsonb not null default '[]' check (jsonb_typeof(videos)='array'),
  review text not null default 'pending' check (review in ('pending','accepted','rejected')),
  fetched_at timestamptz not null default now()
);
create index adme_channels_freshness on adme_ops.channels(fetched_at);
alter table adme_ops.staff enable row level security;
alter table adme_ops.settings enable row level security;
alter table adme_ops.jobs enable row level security;
alter table adme_ops.channels enable row level security;

create function adme_ops.staff_role() returns text language sql stable
set search_path='' as $$
  select coalesce(
    (select 'super' from public.profiles where id=auth.uid() and role='admin'),
    (select role from adme_ops.staff where user_id=auth.uid())
  );
$$;
create function public.ops_current_role() returns text language sql stable security definer
set search_path='' as $$ select adme_ops.staff_role(); $$;

create function public.ops_dashboard() returns jsonb language plpgsql stable security definer
set search_path='' as $$
declare r text := adme_ops.staff_role();
begin
  if r is null then raise insufficient_privilege; end if;
  return jsonb_build_object(
    'role',r,
    'members',case when r in ('super','support') then
      (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from
        (select id,name,role,created_at from public.profiles order by created_at desc limit 50) m) end,
    'campaigns',case when r in ('super','campaign') then
      (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from
        (select id,brief->>'title' title,status from public.campaigns order by created_at desc limit 50) c) end,
    'orders',case when r in ('super','finance') then
      (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from
        (select sku,amount,status,created_at from public.orders order by created_at desc limit 50) o) end,
    'channels',case when r in ('super','content') then
      (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from
        (select * from adme_ops.channels where fetched_at > now()-interval '30 days' order by fetched_at desc limit 50) c) end,
    'jobs',case when r in ('super','content') then
      (select coalesce(jsonb_agg(to_jsonb(j)), '[]') from
        (select id, kind,status,attempts,error_code,created_at,finished_at,elapsed_ms
         from adme_ops.jobs order by created_at desc limit 50) j) end,
    'keyword',case when r in ('super','content') then (select discovery_keyword from adme_ops.settings) end,
    'discoveryEnabled',case when r in ('super','content') then (select discovery_enabled from adme_ops.settings) end
  );
end;
$$;

create function public.ops_admin_command(p_action text, p_value text, p_extra text default '')
returns void language plpgsql security definer set search_path='' as $$
declare r text := adme_ops.staff_role();
begin
  if r is null then raise insufficient_privilege; end if;
  case p_action
    when 'channel' then
      if r not in ('super','content') then raise insufficient_privilege; end if;
      if p_value is null or p_value !~ '^UC[A-Za-z0-9_-]{22}$' then raise invalid_parameter_value; end if;
      perform pg_catalog.pg_advisory_xact_lock(71200);
      if (select count(*) from adme_ops.jobs where kind='youtube_channel'
          and created_at>now()-interval '1 day') >= 20 then raise program_limit_exceeded; end if;
      insert into adme_ops.jobs(kind,owner_id,input)
      select 'youtube_channel',auth.uid(),p_value
      where not exists(select 1 from adme_ops.jobs where kind='youtube_channel'
        and input=p_value and status in ('queued','running'));
    when 'review' then
      if r not in ('super','content') then raise insufficient_privilege; end if;
      if p_extra not in ('accepted','rejected','pending') then raise invalid_parameter_value; end if;
      update adme_ops.channels set review=p_extra where channel_id=p_value and fetched_at>now()-interval '30 days';
      if not found then raise no_data_found; end if;
    when 'discovery' then
      if r <> 'super' then raise insufficient_privilege; end if;
      if p_extra not in ('true','false') or char_length(p_value) not between 2 and 80 then raise invalid_parameter_value; end if;
      update adme_ops.settings set discovery_enabled=p_extra::boolean,discovery_keyword=p_value;
    when 'staff' then
      if r <> 'super' then raise insufficient_privilege; end if;
      if p_extra not in ('super','content','campaign','finance','support','remove') then raise invalid_parameter_value; end if;
      if p_extra='remove' then
        delete from adme_ops.staff where user_id=p_value::uuid;
      else
        insert into adme_ops.staff(user_id,role) values(p_value::uuid,p_extra)
        on conflict(user_id) do update set role=excluded.role;
      end if;
    else raise invalid_parameter_value;
  end case;
  insert into public.audit_log(actor_id,entity_id,action)
  values(auth.uid(),left(p_value,100),'ops:'||p_action||':'||left(p_extra,40));
end;
$$;

create function public.ops_draft_create(p_input text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_owner uuid := auth.uid(); v_id uuid;
begin
  if v_owner is null or not exists(select 1 from public.profiles where id=v_owner and role='brand') then
    raise insufficient_privilege;
  end if;
  if char_length(btrim(p_input)) not between 10 and 1600 then raise invalid_parameter_value; end if;
  perform pg_catalog.pg_advisory_xact_lock(71201);
  if (select count(*) from adme_ops.jobs where kind='marketing_draft' and status in ('queued','running'))>=30 or
     (select count(*) from adme_ops.jobs where owner_id=v_owner and kind='marketing_draft' and created_at>now()-interval '1 hour')>=3
  then raise program_limit_exceeded; end if;
  insert into adme_ops.jobs(kind,owner_id,input) values('marketing_draft',v_owner,btrim(p_input)) returning id into v_id;
  return v_id;
end;
$$;
create function public.ops_draft_get(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('status',status,'output',output,'error',error_code)
  from adme_ops.jobs where id=p_id and kind='marketing_draft' and owner_id=auth.uid();
$$;

create function adme_ops.daily_tick() returns void language plpgsql set search_path='' as $$
declare
  local_now timestamp := now() at time zone 'Asia/Seoul';
begin
  delete from adme_ops.channels where fetched_at<=now()-interval '30 days';
  delete from adme_ops.jobs where created_at<=now()-interval '14 days';
  if local_now::time >= time '04:00' and exists(
    select 1 from adme_ops.settings where discovery_enabled
  ) then
    insert into adme_ops.jobs(kind,input) values('youtube_daily',local_now::date::text) on conflict do nothing;
  end if;
end;
$$;

create function adme_ops.verify_worker(p_token text) returns void language plpgsql stable set search_path='' as $$
begin
  if p_token is null or char_length(p_token)<>64 or not exists(
    select 1 from adme_ops.settings where worker_hash=sha256(convert_to(p_token,'UTF8'))
  ) then raise insufficient_privilege; end if;
end;
$$;
create function public.ops_worker_claim(p_token text) returns jsonb language plpgsql security definer
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
    'keyword',keyword,'refresh',case when job.kind='youtube_daily' and keyword is not null then
      (select coalesce(jsonb_agg(channel_id),'[]') from
        (select channel_id from adme_ops.channels order by fetched_at limit 20) c) end);
end;
$$;

create function public.ops_worker_finish(
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
    if jsonb_typeof(p_result) is distinct from 'array' or jsonb_array_length(p_result)>25 or octet_length(p_result::text)>180000 then
      raise invalid_parameter_value;
    end if;
    if job.kind='youtube_channel' and jsonb_array_length(p_result)<>1 then raise invalid_parameter_value; end if;
    for item in select value from jsonb_array_elements(p_result) loop
      if job.kind='youtube_channel' and item->>'id' is distinct from job.input then raise invalid_parameter_value; end if;
      insert into adme_ops.channels(channel_id,title,subscriber_count,videos)
      values(item->>'id',left(item->>'title',100),(item->>'subscribers')::bigint,coalesce(item->'videos','[]'))
      on conflict(channel_id) do update set title=excluded.title,subscriber_count=excluded.subscriber_count,
        videos=excluded.videos,fetched_at=now();
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
revoke all on function public.ops_current_role(), public.ops_dashboard(),
  public.ops_admin_command(text,text,text),public.ops_draft_create(text),public.ops_draft_get(uuid),
  public.ops_worker_claim(text),public.ops_worker_finish(text,uuid,uuid,jsonb,text,int)
  from public,anon,authenticated;
grant execute on function public.ops_current_role(),public.ops_dashboard(),public.ops_admin_command(text,text,text),
  public.ops_draft_create(text),public.ops_draft_get(uuid) to authenticated;
grant execute on function public.ops_worker_claim(text),public.ops_worker_finish(text,uuid,uuid,jsonb,text,int) to anon;
commit;
