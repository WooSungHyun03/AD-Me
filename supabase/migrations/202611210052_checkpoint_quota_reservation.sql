-- Internal conservative weight175 retains the old100 search buffer plus <=75
-- ordinary calls. It is NOT current provider billing/quota accounting: current
-- Google docs put search in a separate bucket. Enforce that bucket separately
-- with a rolling24h cap, which is stricter than Pacific-midnight reset.
begin;
alter table adme_ops.source_runtime_policies add column search_calls_24h integer not null default 5 check(search_calls_24h between 1 and 100);
create function adme_ops.reserve_source_search(p_limit integer) returns integer language plpgsql security definer set search_path='' as $$declare amount bigint;oldest timestamptz;begin
 if p_limit is null or p_limit not between 1 and 100 then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtext('adme-youtube-search-rolling24h'));
 select coalesce(sum(used),0),min(window_start) into amount,oldest from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube' and window_start>statement_timestamp()-interval '24 hours';
 if amount>=p_limit then return greatest(1,ceil(extract(epoch from oldest+interval '24 hours'-statement_timestamp()))::integer);end if;
 insert into adme_ops.rate_windows(scope,subject,window_start,used)values('source_search_24h','youtube',statement_timestamp(),1) on conflict(scope,subject,window_start)do update set used=adme_ops.rate_windows.used+1;return 0;
end;$$;
revoke all on function adme_ops.reserve_source_search(integer) from public,anon,authenticated,service_role;
do $$declare n text;body text;needle text:='when ''youtube_daily'' then 130';begin
 foreach n in array array['ops_worker_claim_before49','ops_worker_claim'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed source budget needed';end if;
 execute replace(body,needle,'when ''youtube_daily'' then 175');end loop;
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 needle:='if j.kind like ''youtube_%'' then';
 if position(needle in body)=0 then raise exception 'STOP: reviewed source lease needed';end if;
 execute replace(body,needle,'if j.kind=''youtube_daily'' and not(j.checkpoint ? ''candidates'') then
 declare retry_seconds integer;start_at timestamptz;begin
 retry_seconds:=adme_ops.reserve_source_search(p.search_calls_24h);
 if retry_seconds>0 then
 update adme_ops.jobs set status=''queued'',attempts=attempts-1,lease=null,lease_until=null,available_at=statement_timestamp()+make_interval(secs=>retry_seconds),error_code=''SOURCE_SEARCH_BUDGET'' where id=j.id;
 -- No lease or provider request was returned. Undo only this internal weight;
 -- provider failures after a returned lease never receive a refund.
 start_at:=to_timestamp(floor(extract(epoch from statement_timestamp())/86400)*86400);
 delete from adme_ops.rate_windows where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used=175;
 update adme_ops.rate_windows set used=used-175 where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used>175;
 return null;end if;end;end if;
 '||needle);
end;$$;
notify pgrst,'reload schema';
commit;
