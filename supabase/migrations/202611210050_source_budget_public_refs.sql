-- Forward fix after49: low configured budgets defer work rather than passing an
-- invalid cost to the shared limiter; public YouTube links use the same opaque IDs.
begin;
do $$declare body text;needle text:='result:=adme_ops.ops_worker_claim_before49(p_token);';begin
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed49 claim needed';end if;
 execute replace(body,needle,'if p.version is not null then update adme_ops.jobs set available_at=to_timestamp((floor(extract(epoch from statement_timestamp())/86400)+1)*86400),error_code=''SOURCE_BUDGET_INSUFFICIENT'' where status=''queued'' and kind like ''youtube_%'' and case kind when ''youtube_daily'' then 130 when ''youtube_channel'' then 3 else 1 end>p.daily_units;end if; '||needle);
 body:=pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure);
 if position('creator.id as creator_id' in body)=0 then raise exception 'STOP: reviewed public channel DTO needed';end if;
 execute replace(body,'creator.id as creator_id','adme_creator.public_reference(creator.id) as creator_id');
end;$$;
notify pgrst,'reload schema';
commit;
