-- Restore the exact DEV-A68 worker budget/search protections, plus bounded primary YouTube metadata.
begin;;
CREATE OR REPLACE FUNCTION adme_ops.ops_worker_claim(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if p.version is not null then update adme_ops.jobs set available_at=to_timestamp((floor(extract(epoch from statement_timestamp())/86400)+1)*86400),error_code='SOURCE_BUDGET_INSUFFICIENT' where status='queued' and kind like 'youtube_%' and case kind when 'youtube_daily' then 175 when 'youtube_channel' then 3 else 1 end>p.daily_units;end if; result:=adme_ops.ops_worker_claim_before49(p_token);if result is null then return null;end if;
 select * into j from adme_ops.jobs where id=(result->>'id')::uuid;
 if j.kind='youtube_daily' and not(j.checkpoint ? 'candidates') then
 declare retry_seconds integer;start_at timestamptz;begin
 retry_seconds:=adme_ops.reserve_source_search(p.search_calls_24h);
 if retry_seconds>0 then
 update adme_ops.jobs set status='queued',attempts=attempts-1,lease=null,lease_until=null,available_at=statement_timestamp()+make_interval(secs=>retry_seconds),error_code='SOURCE_SEARCH_BUDGET' where id=j.id;
 -- No lease or provider request was returned. Undo only this internal weight;
 -- provider failures after a returned lease never receive a refund.
 start_at:=to_timestamp(floor(extract(epoch from statement_timestamp())/86400)*86400);
 delete from adme_ops.rate_windows where scope='provider_day' and subject='youtube' and window_start=start_at and used=175;
 update adme_ops.rate_windows set used=used-175 where scope='provider_day' and subject='youtube' and window_start=start_at and used>175;
 return null;end if;end;end if;
 if j.kind like 'youtube_%' then
 update adme_ops.jobs set source_policy=p.version,max_attempts=p.max_attempts,heartbeat_at=now(),checkpoint=case when checkpoint ? 'completed' then jsonb_set(checkpoint,'{completed}',coalesce((select jsonb_agg(v) from jsonb_array_elements(checkpoint->'completed') v where adme_ops.channel_fresh(v#>>'{}')),'[]'::jsonb)) else checkpoint end where id=j.id returning * into j;
 result:=result||jsonb_build_object('checkpoint',j.checkpoint,'policyVersion',p.version,'cacheTtlSeconds',p.cache_seconds);
 if j.kind='youtube_daily' then result:=result||jsonb_build_object('refresh',(select coalesce(jsonb_agg(channel_id),'[]')from(select channel_id from(select f.channel_id,0 priority from adme_ops.featured_channel_ids f union select c.channel_id,1 priority from adme_ops.channels c where c.review<>'rejected'and not exists(select 1 from adme_ops.featured_channel_ids f where f.channel_id=c.channel_id))q where not adme_ops.source_deleted(channel_id)and not adme_ops.channel_fresh(channel_id)order by priority,channel_id limit 20)x));end if;
 end if;return result;
end;$function$;
CREATE OR REPLACE FUNCTION adme_ops.ops_worker_finish(p_token text, p_id uuid, p_lease uuid, p_result jsonb, p_error text, p_elapsed integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if jsonb_typeof(item->'metadata')='object'and octet_length((item->'metadata')::text)<=32768 then
 update adme_ops.channels set metadata=coalesce((select jsonb_object_agg(key,value)from jsonb_each(item->'metadata')where key=any(array['avatar','banner','handle','description','createdAt','language','topics','views','videoCount'])),'{}'::jsonb)where channel_id=item->>'id';
 end if;end loop;end if;
 return accepted;
end;$function$;
CREATE OR REPLACE FUNCTION adme_ops.cache_source_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare p adme_ops.source_runtime_policies;v jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.channel_id,0));
 if adme_ops.source_deleted(new.channel_id) then raise insufficient_privilege using message='source deleted';end if;
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled for share;
 if not found then raise insufficient_privilege using message='source policy pending';end if;
 if length(new.title) not between 1 and 100 or not adme_creator.safe_public_text(new.title) or jsonb_typeof(new.videos)<>'array' or jsonb_array_length(new.videos)>5 then raise check_violation;end if;
 for v in select value from jsonb_array_elements(new.videos) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('id','title','publishedAt','views','likes','thumbnail')) or jsonb_typeof(v->'id') is distinct from 'string' or v->>'id' !~ '^[A-Za-z0-9_-]{11}$' or jsonb_typeof(v->'title') is distinct from 'string' or length(v->>'title') not between 1 and 300 or not adme_creator.safe_public_text(v->>'title') or jsonb_typeof(v->'publishedAt') is distinct from 'string' or v->>'publishedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise check_violation;end if;
 if exists(select 1 from jsonb_each(v)r where r.key in('views','likes')and jsonb_typeof(r.value)<>'null'and(jsonb_typeof(r.value)<>'number'or r.value::text!~'^[0-9]{1,18}$'))then raise check_violation;end if;
 if v?'thumbnail'and jsonb_typeof(v->'thumbnail')<>'null'and(jsonb_typeof(v->'thumbnail')<>'string'or adme_creator.public_https(v->>'thumbnail')is null)then raise check_violation;end if;
 perform (v->>'publishedAt')::timestamptz;
 end loop;
 new.source_policy:=p.version;new.fetched_at:=statement_timestamp();new.expires_at:=statement_timestamp()+make_interval(secs=>p.cache_seconds);return new;
end;$function$;
notify pgrst,'reload schema';
commit;
