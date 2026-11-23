-- Requests stop already queued/leased user-owned collection; global approved jobs remain separate.
begin;
do $$declare body text;needle text:='update adme_ops.channel_claims set consent_at=null where owner_id=p_actor;';begin
 body:=pg_get_functiondef('public.deletion_accept(uuid,uuid,text,timestamptz)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed deletion accept function required';end if;
 execute replace(body,needle,needle||' update adme_ops.jobs set status=''failed'',lease=null,lease_until=null,finished_at=clock_timestamp(),error_code=''ACCOUNT_DELETION'',output=null where owner_id=p_actor and status in(''queued'',''running'');');
end;$$;
notify pgrst,'reload schema';
commit;
