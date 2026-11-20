-- D057: the latest private position must not resurrect an older public statement.
begin;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select case when s.publish_consent then jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) else null end from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version order by s.created_at desc,s.id desc limit 1)) dto
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
