-- DEV-B D058: request intake (submit_report) accepts the opaque public creator reference.
-- Profile pages link to /reports/new?creator=<public reference>; the browser never holds internal
-- user-<uuid> ids, but submit_report compared the raw argument with reports.creator_id. The target is
-- now resolved through adme_creator.resolve_reference first (internal ids of collected profiles still
-- resolve to themselves). Appeals keep taking their target from the parent request.
begin;
do $$declare body text; needle text:='target text := p_creator;';
begin
 body:=pg_get_functiondef('public.submit_report(text,text,text,text,uuid)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed submit_report required'; end if;
 body:=replace(body,needle,'target text := coalesce(adme_creator.resolve_reference(p_creator), p_creator);');
 execute body;
end$$;
commit;
