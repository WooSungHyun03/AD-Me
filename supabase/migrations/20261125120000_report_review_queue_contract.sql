-- D075/D057: admin "검토 완료" wrote 'reviewed', which report_queue removed (it migrated reviewed→resolved).
-- Route the support-audited admin RPC through the queue transition so status, response and decider stay consistent.
begin;
create or replace function public.admin_review_report(p_id uuid,p_status text,p_reason text,p_request uuid)returns void language plpgsql security definer set search_path=''as $$
begin
 if not public.is_admin()then raise insufficient_privilege;end if;
 if p_status is null or p_status not in('reviewed','dismissed')then raise invalid_parameter_value;end if;
 perform adme_ops.support_log('report:'||p_status,p_id::text,p_request,p_reason);
 perform public.review_report(p_id,case p_status when 'reviewed' then 'resolved' else p_status end,p_reason,null);
end;$$;
-- D075: duplicate_open was check-then-insert; serialize per reporter/target/kind (no index, so existing duplicates cannot block the upgrade).
do $$declare body text;begin
 select pg_get_functiondef('public.submit_report(text,text,text,text,uuid)'::regprocedure)into body;
 if (length(body)-length(replace(body,'if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind','')))
    <>length('if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind')then
   raise exception 'STOP: submit_report duplicate check changed';
 end if;
 execute replace(body,'if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind',
   'perform pg_advisory_xact_lock(hashtextextended(''report:''||uid::text||'':''||target||'':''||p_kind,0));
    if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind');
end;$$;
notify pgrst,'reload schema';
commit;
