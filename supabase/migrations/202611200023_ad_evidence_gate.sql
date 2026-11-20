-- D029: weak evidence is never classified as confirmed advertising, even privately.
begin;
create or replace function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid; active_enabled boolean; active_version text;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction','ad_evidence')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  if (c.kind='issue' and p_classification='ad_evidence') or (c.kind='ad' and p_classification not in ('unverified_claim','ad_evidence')) then raise invalid_parameter_value; end if;
  if c.kind='ad' and ((p_publish and p_classification<>'ad_evidence') or (p_classification='ad_evidence' and not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb))) then
    raise exception 'advertising evidence required' using errcode='23514'; end if;
  select * into policy from adme_review.policy where singleton for share;
  active_enabled:=case when c.kind='ad' then policy.ad_enabled else policy.enabled end;
  active_version:=case when c.kind='ad' then policy.ad_version else policy.version end;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or active_enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,active_version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
notify pgrst,'reload schema';
commit;
