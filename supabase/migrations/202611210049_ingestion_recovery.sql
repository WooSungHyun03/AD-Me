-- D021: preserve legacy entry points; policy-gated bounded checkpoint recovery.
begin;
create table adme_ops.source_runtime_policies(
 version text primary key check(length(version) between 1 and 80),provider text not null check(provider='youtube'),enabled boolean not null default false,
 cache_seconds integer not null check(cache_seconds between 60 and 2592000),job_seconds integer not null check(job_seconds between 60 and 604800),
 tombstone_seconds integer not null check(tombstone_seconds between 60 and 31536000),daily_units integer not null check(daily_units between 1 and 1000),
 max_attempts integer not null check(max_attempts between 1 and 3),review_ref text not null check(length(btrim(review_ref)) between 8 and 200));
create unique index one_active_source_runtime_policy on adme_ops.source_runtime_policies(provider) where enabled;
create table adme_ops.source_tombstones(resource_hash bytea primary key,policy_version text not null references adme_ops.source_runtime_policies(version),request_ref uuid not null,expires_at timestamptz not null,created_at timestamptz not null default statement_timestamp());
alter table adme_ops.source_runtime_policies enable row level security;alter table adme_ops.source_tombstones enable row level security;
revoke all on adme_ops.source_runtime_policies,adme_ops.source_tombstones from public,anon,authenticated,service_role;
alter table adme_ops.jobs add column checkpoint jsonb not null default '{}' check(jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=16000),
 add column heartbeat_at timestamptz,add column source_policy text references adme_ops.source_runtime_policies(version),
 add column max_attempts integer not null default 3 check(max_attempts between 1 and 3),
 add column coalesced_into uuid references adme_ops.jobs(id) on delete set null;
alter table adme_ops.channels add column source_policy text references adme_ops.source_runtime_policies(version),add column expires_at timestamptz;
create function adme_ops.resource_hash(p_channel text) returns bytea language sql immutable set search_path='' as $$select sha256(convert_to('youtube:'||p_channel,'UTF8'));$$;
create function adme_ops.source_deleted(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.source_tombstones where resource_hash=adme_ops.resource_hash(p_channel) and expires_at>statement_timestamp());$$;
create function adme_ops.youtube_daily_limit() returns integer language sql stable security definer set search_path='' as $$select coalesce((select daily_units from adme_ops.source_runtime_policies where provider='youtube' and enabled),0);$$;
create function adme_ops.channel_fresh(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.channels c join adme_ops.source_runtime_policies p on p.version=c.source_policy and p.enabled where c.channel_id=p_channel and c.expires_at>statement_timestamp() and c.fetched_at<=statement_timestamp() and not adme_ops.source_deleted(c.channel_id));$$;
create function adme_ops.cache_source_guard() returns trigger language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;v jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.channel_id,0));
 if adme_ops.source_deleted(new.channel_id) then raise insufficient_privilege using message='source deleted';end if;
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled for share;
 if not found then raise insufficient_privilege using message='source policy pending';end if;
 if length(new.title) not between 1 and 100 or not adme_creator.safe_public_text(new.title) or jsonb_typeof(new.videos)<>'array' or jsonb_array_length(new.videos)>5 then raise check_violation;end if;
 for v in select value from jsonb_array_elements(new.videos) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('id','title','publishedAt')) or jsonb_typeof(v->'id') is distinct from 'string' or v->>'id' !~ '^[A-Za-z0-9_-]{11}$' or jsonb_typeof(v->'title') is distinct from 'string' or length(v->>'title') not between 1 and 300 or not adme_creator.safe_public_text(v->>'title') or jsonb_typeof(v->'publishedAt') is distinct from 'string' or v->>'publishedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise check_violation;end if;
 perform (v->>'publishedAt')::timestamptz;
 end loop;
 new.source_policy:=p.version;new.fetched_at:=statement_timestamp();new.expires_at:=statement_timestamp()+make_interval(secs=>p.cache_seconds);return new;
end;$$;
create trigger cache_source_boundary before insert or update of title,subscriber_count,videos,fetched_at on adme_ops.channels for each row execute function adme_ops.cache_source_guard();
create function adme_ops.identity_tombstone_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.provider='youtube' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.external_id,0));if adme_ops.source_deleted(new.external_id) and not(tg_op='UPDATE' and old.provider=new.provider and old.external_id=new.external_id and not new.owner_consent and new.publication_status='private') then raise insufficient_privilege using message='source deleted';end if;end if;return new;
end;$$;
create trigger identity_source_tombstone before insert or update on adme_creator.identities for each row execute function adme_ops.identity_tombstone_guard();
-- Keep the original function OIDs so cached public SQL gateways cannot retain a
-- bypass to the old implementation. Only ungranted internal copies are created.
do $$declare n text;body text;begin foreach n in array array['ops_worker_claim','ops_worker_finish'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if body is null then raise exception 'STOP: reviewed worker functions needed';end if;
 if n='ops_worker_claim' then
 if position('then 1000 else 30 end' in body)=0 then raise exception 'STOP: reviewed daily budget needed';end if;
 body:=replace(body,'then 1000 else 30 end','then adme_ops.youtube_daily_limit() else 30 end');end if;
 execute replace(body,'FUNCTION adme_ops.'||n||'(','FUNCTION adme_ops.'||n||'_before49(');
 end loop;end;$$;
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p adme_ops.source_runtime_policies;result jsonb;j adme_ops.jobs;begin
 perform adme_ops.verify_worker(p_token);perform pg_advisory_xact_lock(hashtext('adme-source-claim-v1'));
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled;
 if not found then
 update adme_ops.jobs set available_at=statement_timestamp()+interval '30 minutes',error_code='SOURCE_POLICY_PENDING' where kind like 'youtube_%' and status='queued' and available_at<=now();
 else
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,finished_at=now(),error_code='SOURCE_JOB_EXPIRED' where kind like 'youtube_%' and status in('queued','running') and(created_at+make_interval(secs=>p.job_seconds)<=now() or attempts>=max_attempts and(status='queued' or lease_until<=now()));
 update adme_ops.jobs a set status=b.status,finished_at=b.finished_at,error_code=b.error_code,coalesced_into=null from adme_ops.jobs b where a.coalesced_into=b.id and a.status='queued' and b.status in('done','failed');
 update adme_ops.jobs set status='done',finished_at=now(),error_code='CACHE_HIT' where kind='youtube_channel' and status='queued' and adme_ops.channel_fresh(input);
 update adme_ops.jobs a set coalesced_into=b.id,available_at=greatest(b.available_at,coalesce(b.lease_until,now()+interval '6 minutes')),error_code='COALESCED_PENDING' from adme_ops.jobs b where a.kind='youtube_channel' and a.status='queued' and b.kind=a.kind and b.input=a.input and b.id<>a.id and b.coalesced_into is null and(b.status='running' or b.status='queued' and(b.created_at,b.id)<(a.created_at,a.id));
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='SOURCE_DELETED',finished_at=now() where kind in('youtube_channel','youtube_claim') and status in('queued','running') and adme_ops.source_deleted(case when kind='youtube_claim' then split_part(input,':',2) else input end);
 end if;
 result:=adme_ops.ops_worker_claim_before49(p_token);if result is null then return null;end if;
 select * into j from adme_ops.jobs where id=(result->>'id')::uuid;
 if j.kind like 'youtube_%' then
 update adme_ops.jobs set source_policy=p.version,max_attempts=p.max_attempts,heartbeat_at=now(),checkpoint=case when checkpoint ? 'completed' then jsonb_set(checkpoint,'{completed}',coalesce((select jsonb_agg(v) from jsonb_array_elements(checkpoint->'completed') v where adme_ops.channel_fresh(v#>>'{}')),'[]'::jsonb)) else checkpoint end where id=j.id returning * into j;
 result:=result||jsonb_build_object('checkpoint',j.checkpoint,'policyVersion',p.version,'cacheTtlSeconds',p.cache_seconds);
 if j.kind='youtube_daily' then result:=result||jsonb_build_object('refresh',(select coalesce(jsonb_agg(channel_id),'[]'::jsonb) from(select channel_id from adme_ops.channels where not adme_ops.channel_fresh(channel_id) order by fetched_at,channel_id limit 20)c));end if;
 end if;return result;
end;$$;
create or replace function adme_ops.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed integer) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;accepted boolean;channel text;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then update adme_ops.jobs set status='failed',error_code='SOURCE_POLICY_CHANGED',lease=null,lease_until=null,finished_at=now() where id=j.id;return false;end if;
 if j.kind='youtube_channel' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||j.input,0));if adme_ops.source_deleted(j.input) then return false;end if;end if;
 end if;
 if j.kind='youtube_channel' and p_error is null and p_result='[]'::jsonb and j.checkpoint->'completed' ? j.input and adme_ops.channel_fresh(j.input) then
 update adme_ops.jobs set status='done',lease=null,lease_until=null,finished_at=now(),error_code=null,elapsed_ms=p_elapsed where id=p_id;accepted:=true;
 else accepted:=adme_ops.ops_worker_finish_before49(p_token,p_id,p_lease,p_result,p_error,p_elapsed);end if;
 if accepted then update adme_ops.jobs a set status=b.status,available_at=b.available_at,finished_at=b.finished_at,error_code=case when b.status='done' then 'COALESCED' else b.error_code end,coalesced_into=case when b.status in('done','failed') then null else a.coalesced_into end from adme_ops.jobs b where a.coalesced_into=b.id and b.id=p_id and a.status='queued';end if;
 return accepted;
end;$$;
create function adme_ops.worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;begin perform adme_ops.verify_worker(p_token);
 select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled;if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then return false;end if;end if;
 update adme_ops.jobs set heartbeat_at=now(),lease_until=least(now()+interval '6 minutes',case when p.version is null then now()+interval '6 minutes' else j.created_at+make_interval(secs=>p.job_seconds) end) where id=p_id;return true;
end;$$;
create function adme_ops.worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;completed jsonb;accepted boolean;p adme_ops.source_runtime_policies;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;
 if not found or j.kind not in('youtube_channel','youtube_daily') then raise insufficient_privilege;end if;
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or not adme_ops.job_enabled(j.kind) or j.created_at+make_interval(secs=>p.job_seconds)<=now() then raise insufficient_privilege;end if;
 if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>25 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_candidates)) or exists(select 1 from jsonb_array_elements(p_candidates) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^UC[A-Za-z0-9_-]{22}$') then raise invalid_parameter_value;end if;
 if j.kind='youtube_channel' and p_candidates is distinct from jsonb_build_array(j.input) then raise invalid_parameter_value;end if;
 if j.checkpoint ? 'candidates' and j.checkpoint->'candidates' is distinct from p_candidates then raise invalid_parameter_value;end if;
 completed:=coalesce(j.checkpoint->'completed','[]'::jsonb);
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value from jsonb_array_elements(p_candidates) where adme_ops.channel_fresh(value#>>'{}')) x;
 if p_result is not null and p_result<>'[]'::jsonb then
 if jsonb_typeof(p_result)<>'array' or jsonb_array_length(p_result)>25 or exists(select 1 from jsonb_array_elements(p_result) v where not p_candidates ? (v->>'id')) then raise invalid_parameter_value;end if;
 -- Existing validated finish stores this bounded batch atomically; restore the
 -- lease inside the same transaction before anything can observe completion.
 accepted:=adme_ops.ops_worker_finish(p_token,p_id,p_lease,p_result,null,0);if not accepted then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value->'id' from jsonb_array_elements(p_result)) x;
 update adme_ops.jobs set status='running',lease=p_lease,lease_until=j.lease_until,finished_at=null,error_code=null,output=null where id=j.id;
 end if;
 update adme_ops.jobs set checkpoint=jsonb_build_object('version',1,'candidates',p_candidates,'completed',completed),heartbeat_at=now() where id=j.id returning checkpoint into completed;
 return completed;
end;$$;
create function adme_ops.forget_channel(p_channel text,p_request uuid,p_policy text) returns void language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;begin
 if p_channel is null or p_channel !~ '^UC[A-Za-z0-9_-]{22}$' or p_request is null then raise invalid_parameter_value;end if;
 select * into p from adme_ops.source_runtime_policies where version=p_policy;if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||p_channel,0));
 insert into adme_ops.source_tombstones(resource_hash,policy_version,request_ref,expires_at) values(adme_ops.resource_hash(p_channel),p.version,p_request,statement_timestamp()+make_interval(secs=>p.tombstone_seconds)) on conflict(resource_hash) do update set expires_at=greatest(adme_ops.source_tombstones.expires_at,excluded.expires_at),request_ref=excluded.request_ref,policy_version=excluded.policy_version;
 delete from adme_ops.channels where channel_id=p_channel;
 update adme_ops.channel_claims set verified_at=null,consent_at=null where channel_id=p_channel;
 update adme_creator.identities set owner_consent=false,publication_status='private' where provider='youtube' and external_id=p_channel;
 update adme_ops.jobs set status='failed',error_code='SOURCE_DELETED',lease=null,lease_until=null,finished_at=now() where status in('queued','running') and(kind='youtube_channel' and input=p_channel or kind='youtube_claim' and split_part(input,':',2)=p_channel or checkpoint->'candidates' ? p_channel);
end;$$;
-- TTL is evaluated against the exact policy used by the last fetch, never a
-- newly approved policy retroactively applied to old cache entries.
do $$declare n text;body text;needle text:='ch.fetched_at>now()-interval ''30 days''';begin foreach n in array array['ops_own_channels','ops_public_channels'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed channel read needed';end if;
 execute replace(body,needle,'adme_ops.channel_fresh(ch.channel_id)');end loop;end;$$;
create function public.ops_worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language sql volatile security invoker set search_path='' as $$select adme_ops.worker_heartbeat($1,$2,$3);$$;
create function public.ops_worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_ops.worker_checkpoint($1,$2,$3,$4,$5);$$;
create function public.ingestion_forget_channel(p_channel text,p_request uuid,p_policy text) returns void language sql volatile security invoker set search_path='' as $$select adme_ops.forget_channel($1,$2,$3);$$;
revoke all on function adme_ops.resource_hash(text),adme_ops.source_deleted(text),adme_ops.youtube_daily_limit(),adme_ops.channel_fresh(text),adme_ops.cache_source_guard(),adme_ops.identity_tombstone_guard(),adme_ops.ops_worker_claim_before49(text),adme_ops.ops_worker_finish_before49(text,uuid,uuid,jsonb,text,integer),adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb),adme_ops.forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function adme_ops.forget_channel(text,uuid,text) to service_role;
revoke all on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb),public.ingestion_forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function public.ingestion_forget_channel(text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
