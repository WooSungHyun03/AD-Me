-- D057: never expose original allegations; a changed response invalidates open reviews.
begin;
alter table adme_review.policy add constraint review_policy_approval_required check(not enabled or
  (version is not null and length(version) between 1 and 80 and approval_ref is not null and adme_creator.public_https(approval_ref) is not null));
create function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind') else '{}'::jsonb end;
$$;
revoke all on function adme_review.public_payload(text,jsonb) from public,anon,authenticated,service_role;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or p_kind is distinct from 'issue' then raise invalid_parameter_value; end if;
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
      and d.classification<>'unverified_claim' and p.enabled and d.policy_version=p.version
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
create or replace function adme_review.respond(p_id uuid,p_expected int,p_body text,p_source text,p_public boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; result uuid;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or not exists(select 1 from public.creators where id=c.creator_id and owner_id=auth.uid()) then
    raise exception 'response not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  if p_body is null or length(btrim(p_body)) not between 10 and 2000 or p_public is null
    or (p_source is not null and (length(p_source)>1000 or adme_creator.public_https(p_source) is null)) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_response',auth.uid()::text,10,3600);
  if c.status='withdrawn' then raise exception 'review conflict' using errcode='40001'; end if;
  insert into adme_review.revisions(case_id,version,payload,actor_id)
    select c.id,c.version+1,payload,auth.uid() from adme_review.revisions where case_id=c.id and version=c.version;
  insert into adme_review.responses(case_id,version,actor_id,body,source_url,publish_consent)
    values(c.id,c.version+1,auth.uid(),btrim(p_body),p_source,p_public) returning id into result;
  update adme_review.cases set version=c.version+1,status='pending',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:response:'||(c.version+1));
  return result;
end;
$$;
notify pgrst,'reload schema';
commit;
