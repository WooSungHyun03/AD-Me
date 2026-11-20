-- D076: atomic shared quotas. All subjects/limits are chosen on the server/DB.
begin;
-- New provider/model work is opt-in at the DB boundary as well as the app.
create table adme_ops.resource_controls (
  singleton boolean primary key default true check(singleton),
  ingestion_enabled boolean not null default false,
  llm_enabled boolean not null default false
);
insert into adme_ops.resource_controls default values;
alter table adme_ops.resource_controls enable row level security;
revoke all on adme_ops.resource_controls from public,anon,authenticated,service_role;
create function adme_ops.job_enabled(p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select case when p_kind='marketing_draft' then llm_enabled
    when p_kind in ('youtube_channel','youtube_daily','youtube_claim') then ingestion_enabled else false end
    from adme_ops.resource_controls where singleton),false);
$$;
revoke all on function adme_ops.job_enabled(text) from public,anon,authenticated,service_role;
update adme_ops.settings set discovery_enabled=false where singleton=true;
create function adme_ops.guard_discovery_enable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.discovery_enabled and not adme_ops.job_enabled('youtube_daily') then
    raise sqlstate 'PT404' using message='feature disabled';
  end if;
  return new;
end;
$$;
create function adme_ops.pause_discovery() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.ingestion_enabled then update adme_ops.settings set discovery_enabled=false where singleton=true; end if;
  return new;
end;
$$;
revoke all on function adme_ops.guard_discovery_enable(),adme_ops.pause_discovery() from public,anon,authenticated;
create trigger ops_discovery_gate before update on adme_ops.settings for each row execute function adme_ops.guard_discovery_enable();
create trigger ops_resource_pause after update on adme_ops.resource_controls for each row execute function adme_ops.pause_discovery();
create table adme_ops.rate_windows (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  used integer not null check(used>0),
  primary key(scope,subject,window_start)
);
alter table adme_ops.rate_windows enable row level security;
revoke all on adme_ops.rate_windows from public,anon,authenticated,service_role;
create index ops_rate_expiry on adme_ops.rate_windows(window_start);

create function adme_ops.take_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns int language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; accepted int;
begin
  if p_scope is null or length(p_scope) not between 1 and 80
     or p_subject is null or length(p_subject) not between 1 and 100
     or p_limit is null or p_limit not between 1 and 100000
     or p_window is null or p_window not between 1 and 86400
     or p_cost is null or p_cost not between 1 and p_limit then raise invalid_parameter_value; end if;
  start_at := to_timestamp(floor(extract(epoch from statement_timestamp())/p_window)*p_window);
  insert into adme_ops.rate_windows(scope,subject,window_start,used)
    values(p_scope,p_subject,start_at,p_cost)
    on conflict(scope,subject,window_start) do update set used=adme_ops.rate_windows.used+excluded.used
      where adme_ops.rate_windows.used+excluded.used<=p_limit
    returning used into accepted;
  if accepted is not null then return 0; end if;
  return greatest(1,ceil(extract(epoch from start_at+make_interval(secs=>p_window)-statement_timestamp()))::int);
end;
$$;
create function adme_ops.require_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns void language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  retry := adme_ops.take_quota(p_scope,p_subject,p_limit,p_window,p_cost);
  if retry>0 then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','PT429','message','request limit reached',
        'details',jsonb_build_object('retryAfter',retry)::text)::text,
      detail=jsonb_build_object('status',429,'headers',jsonb_build_object('Retry-After',retry::text))::text;
  end if;
end;
$$;
revoke all on function adme_ops.take_quota(text,text,int,int,int),adme_ops.require_quota(text,text,int,int,int)
  from public,anon,authenticated,service_role;

-- Deliberately no caller-controlled subject, limit or window.
create function adme_ops.ops_request_quota(p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_action='draft_poll' then
    retry:=adme_ops.take_quota('draft_poll',auth.uid()::text,120,60);
  else raise invalid_parameter_value; end if;
  return jsonb_build_object('allowed',retry=0,'retryAfter',retry);
end;
$$;
create function public.ops_request_quota(p_action text) returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_request_quota($1); $$;
revoke all on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) from public,anon,authenticated;
grant execute on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) to authenticated;

create function adme_ops.limit_private_writes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Only developer/owner maintenance can omit a JWT; browser/service requests cannot.
  if auth.uid() is null and session_user in ('postgres','supabase_admin') then return new; end if;
  if auth.uid() is null then raise insufficient_privilege; end if;
  if tg_table_name='messages' then
    if new.sender_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('message_minute',auth.uid()::text,20,60);
    perform adme_ops.require_quota('message_day',auth.uid()::text,200,86400);
  elsif tg_table_name='reports' then
    if new.reporter_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('report_hour',auth.uid()::text,5,3600);
    perform adme_ops.require_quota('report_day',auth.uid()::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_private_writes() from public,anon,authenticated;
create trigger message_rate_limit before insert on public.messages for each row execute function adme_ops.limit_private_writes();
create trigger report_rate_limit before insert on public.reports for each row execute function adme_ops.limit_private_writes();

create function adme_ops.limit_job_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not adme_ops.job_enabled(new.kind) then raise sqlstate 'PT404' using message='feature disabled'; end if;
  if new.kind='marketing_draft' then
    perform adme_ops.require_quota('draft_day',new.owner_id::text,10,86400);
  elsif new.kind='youtube_claim' then
    perform adme_ops.require_quota('claim_day',new.owner_id::text,5,86400);
  elsif new.kind='youtube_channel' then
    perform adme_ops.require_quota('manual_channel_day',new.owner_id::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_job_enqueue() from public,anon,authenticated;
create trigger ops_job_rate_limit before insert on adme_ops.jobs for each row execute function adme_ops.limit_job_enqueue();

-- Reserve a conservative provider/model budget BEFORE returning a lease.
-- A retry consumes another reservation; provider errors never refund a reservation.
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job adme_ops.jobs; keyword text; retry int; cost int; provider text;
begin
  perform adme_ops.verify_worker(p_token);
  delete from adme_ops.rate_windows where window_start<now()-interval '2 days';
  update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='LEASE_EXPIRED',finished_at=now()
    where status='running' and lease_until<=now() and attempts>=3;
  for iteration in 1..10 loop
    select * into job from adme_ops.jobs
      where adme_ops.job_enabled(kind) and ((status='queued' and available_at<=now() and attempts<3)
        or (status='running' and lease_until<=now() and attempts<3))
      order by created_at,id for update skip locked limit 1;
    if not found then return null; end if;
    provider:=case when job.kind='marketing_draft' then 'local_llm' else 'youtube' end;
    -- Daily: 100 search + 1 channels + <=25 playlists + <=3 videos = <=129 units.
    cost:=case job.kind when 'youtube_daily' then 130 when 'youtube_channel' then 3 else 1 end;
    retry:=adme_ops.take_quota('provider_day',provider,case when provider='youtube' then 1000 else 30 end,86400,cost);
    if retry>0 then
      update adme_ops.jobs set status='queued',available_at=now()+make_interval(secs=>retry),
        lease=null,lease_until=null,error_code='LOCAL_BUDGET' where id=job.id;
      continue;
    end if;
    update adme_ops.jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '6 minutes'
      where id=job.id returning * into job;
    select discovery_keyword into keyword from adme_ops.settings where discovery_enabled;
    return jsonb_build_object('id',job.id,'kind',job.kind,'input',job.input,'lease',job.lease,
      'keyword',keyword,'refresh',case when job.kind='youtube_daily' and keyword is not null then
        (select coalesce(jsonb_agg(channel_id),'[]') from
          (select channel_id from adme_ops.channels order by fetched_at,channel_id limit 20) c) end);
  end loop;
  return null;
end;
$$;
select cron.schedule('adme-rate-cleanup','15 20 * * *',
  'delete from adme_ops.rate_windows where window_start < now() - interval ''2 days''');
commit;
