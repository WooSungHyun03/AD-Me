-- Restore source-policy/lease/checkpoint/quota/tombstone guards while retaining bounded YouTube metadata and featured refresh.
begin;
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
 if j.kind='youtube_daily' then result:=result||jsonb_build_object('refresh',(select coalesce(jsonb_agg(channel_id),'[]')from(select channel_id from(select f.channel_id,0 priority from adme_ops.featured_channel_ids f union select c.channel_id,1 priority from adme_ops.channels c where c.review<>'rejected'and not exists(select 1 from adme_ops.featured_channel_ids f where f.channel_id=c.channel_id))q where not adme_ops.source_deleted(channel_id)and not adme_ops.channel_fresh(channel_id)order by priority,channel_id limit 20)x));end if;
 end if;return result;
end;$$;
create or replace function adme_ops.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed integer) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;accepted boolean;channel text;item jsonb;
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
 if accepted and p_error is null and jsonb_typeof(p_result)='array' then
 for item in select value from jsonb_array_elements(p_result)loop
  if jsonb_typeof(item->'metadata')='object' then
   update adme_ops.channels set metadata=coalesce((select jsonb_object_agg(key,value)from jsonb_each(item->'metadata')where key=any(array['avatar','banner','handle','description','createdAt','language','topics','views','videoCount'])),'{}'::jsonb)where channel_id=item->>'id';
  end if;
 end loop;
 end if;
 return accepted;
end;$$;
notify pgrst,'reload schema';
commit;
