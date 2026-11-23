-- D029: owner-submitted advertising evidence uses the same immutable review workflow.
begin;
alter table adme_review.policy add column ad_enabled boolean not null default false;
alter table adme_review.policy add column ad_version text;
alter table adme_review.policy add column ad_approval_ref text;
alter table adme_review.policy add constraint review_ad_policy_required check(not ad_enabled or
  (ad_version is not null and length(ad_version) between 1 and 80 and ad_approval_ref is not null and adme_creator.public_https(ad_approval_ref) is not null));
alter table adme_review.cases drop constraint cases_kind_check;
alter table adme_review.cases add constraint cases_kind_check check(kind in ('issue','ad'));
alter table adme_review.decisions drop constraint decisions_classification_check;
alter table adme_review.decisions add constraint decisions_classification_check check(classification in ('unverified_claim','confirmed_fact','official_correction','ad_evidence'));
alter table adme_review.cases add column evidence_url text;
create unique index review_ad_source_unique on adme_review.cases(creator_id,evidence_url) where kind='ad';
create function adme_review.validate_ad(p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare field text; started date; ended date;
begin
 if auth.uid() is null or public.my_role() is distinct from 'creator' or not exists(select 1 from public.creators where id=p_creator and owner_id=auth.uid()) then
   raise exception 'owner submission required' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload-array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl','ownershipConfirmed']<>'{}'::jsonb
   or p_payload->'ownershipConfirmed' is distinct from 'true'::jsonb then raise invalid_parameter_value; end if;
 foreach field in array array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl'] loop
   if jsonb_typeof(p_payload->field) is distinct from 'string' then raise invalid_parameter_value; end if;
 end loop;
 if length(btrim(p_payload->>'brandLabel')) not between 2 and 100
   or length(btrim(p_payload->>'category')) not between 2 and 50 or length(btrim(p_payload->>'format')) not between 2 and 50
   or (p_payload->>'startedOn') !~ '^\d{4}-\d{2}-\d{2}$' or (p_payload->>'endedOn') !~ '^\d{4}-\d{2}-\d{2}$'
   or p_payload->>'interest' not in ('paid','gifted','affiliate','unpaid','unknown')
   or p_payload->>'disclosure' not in ('visible','missing','unclear')
   or p_payload->>'evidenceKind' not in ('self_declaration','paid_partnership_label','official_confirmation','brand_mention')
   or length(p_payload->>'sourceUrl')>1000 or adme_creator.public_https(p_payload->>'sourceUrl') is null then raise invalid_parameter_value; end if;
 begin started:=(p_payload->>'startedOn')::date; ended:=(p_payload->>'endedOn')::date;
 exception when invalid_datetime_format or datetime_field_overflow then raise invalid_parameter_value; end;
 if started>ended or ended>(statement_timestamp() at time zone 'Asia/Seoul')::date then raise invalid_parameter_value; end if;
 return jsonb_build_object('brandLabel',btrim(p_payload->>'brandLabel'),'category',btrim(p_payload->>'category'),'format',btrim(p_payload->>'format'),
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl','ownershipConfirmed',true);
end;
$$;
create function adme_review.ad_source_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update adme_review.cases set evidence_url=new.payload->>'sourceUrl' where id=new.case_id and kind='ad';
 return new;
end;
$$;
create trigger review_ad_source after insert on adme_review.revisions for each row execute function adme_review.ad_source_guard();
revoke all on function adme_review.validate_ad(text,jsonb),adme_review.ad_source_guard() from public,anon,authenticated,service_role;
create or replace function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind')
 when p_kind='ad' then jsonb_build_object('brandLabel',p_payload->'brandLabel','category',p_payload->'category','format',p_payload->'format',
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl') else '{}'::jsonb end;
$$;
create or replace function adme_review.validate_submission(p_kind text,p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.creators; reason text; source text; evidence text;
begin
  select * into c from public.creators where id=p_creator and ((published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin());
  if c.id is null then raise exception 'submission unavailable' using errcode='42501'; end if;
  if p_kind='ad' then return adme_review.validate_ad(p_creator,p_payload); end if;
  if p_kind is distinct from 'issue' or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-array['reason','sourceUrl','evidenceKind']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  reason:=btrim(p_payload->>'reason'); source:=p_payload->>'sourceUrl'; evidence:=p_payload->>'evidenceKind';
  if jsonb_typeof(p_payload->'reason') is distinct from 'string' or reason is null or length(reason) not between 10 and 2000
    or jsonb_typeof(p_payload->'sourceUrl') is distinct from 'string' or length(source)>1000 or adme_creator.public_https(source) is null
    or evidence is null or evidence not in ('claim','source','official_statement','correction') then raise invalid_parameter_value; end if;
  return jsonb_build_object('reason',reason,'sourceUrl',source,'evidenceKind',evidence);
end;
$$;
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
  if p_publish and c.kind='ad' and (p_classification<>'ad_evidence' or not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb)) then
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
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version and s.publish_consent order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and (case when c.kind='ad' then p.ad_enabled else p.enabled end)
      and d.policy_version=(case when c.kind='ad' then p.ad_version else p.version end)
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
notify pgrst,'reload schema';
commit;
