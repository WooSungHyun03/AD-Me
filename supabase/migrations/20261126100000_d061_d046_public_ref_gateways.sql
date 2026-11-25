-- DEV-B D061/D046: selection review and recommendation feedback on opaque public creator references.
-- Campaign pages only hold public references (the browser never sees internal user-<uuid> ids), while
-- creator_reviews and matching_feedback are keyed by the internal creator id. Without a gateway the
-- review form and the rating form could not address a candidate, so both were dropped from the page.
-- 1) set_creator_review resolves the reference before its existing ownership/approval checks.
-- 2) campaign_selection_reviews: owner-only read of the campaign's candidates (applicants + campaign
--    shortlist) with the private review state, returned under public references.
-- 3) rate_recommendation: service-only upsert used by /api/matching-feedback after it recomputed the
--    shown rank/score/version; resolves the reference. my_recommendation_feedback: rater-only read.
begin;

-- Line-ending agnostic match (the stored body keeps the CRLF/LF of the checkout that applied it).
do $$declare body text; needle text:='declare items uuid\[\]; ok uuid\[\];\s*begin';
begin
 body:=pg_get_functiondef('public.set_creator_review(uuid,text,uuid[],text,boolean)'::regprocedure);
 if body !~ needle then raise exception 'STOP: reviewed set_creator_review required'; end if;
 body:=regexp_replace(body,needle,'declare items uuid[]; ok uuid[];
begin
  p_creator := coalesce(adme_creator.resolve_reference(p_creator), p_creator);');
 execute body;
end$$;

create function public.campaign_selection_reviews(p_campaign uuid)
returns table(ref text, name text, applicant boolean, checked uuid[], memo text, approved boolean, reviewed_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.campaigns c where c.id=p_campaign and c.owner_id=auth.uid() and not c.is_demo) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return query
  -- CTE columns are prefixed so they never collide with the OUT parameter names.
  with candidates as(
    select p.creator_id as c_id, true as c_applicant from public.proposals p
      where p.campaign_id=p_campaign and p.kind='application'
    union
    select i.creator_id, false from public.saved_list_items i join public.saved_lists l on l.id=i.list_id
      where l.campaign_id=p_campaign and l.owner_id=auth.uid()
  ), merged as(
    select c.c_id, bool_or(c.c_applicant) as c_applicant from candidates c group by c.c_id
  )
  select adme_creator.public_reference(m.c_id),
         coalesce(adme_creator.catalog_dto(cr)->>'name', '비공개 프로필'),
         m.c_applicant, coalesce(r.checked,'{}'::uuid[]), coalesce(r.memo,''), coalesce(r.approved,false), r.reviewed_at
  from merged m join public.creators cr on cr.id=m.c_id
  left join public.creator_reviews r on r.campaign_id=p_campaign and r.creator_id=m.c_id
  where adme_creator.public_reference(m.c_id) is not null
  order by m.c_applicant desc, 2
  limit 100;
end $$;
revoke all on function public.campaign_selection_reviews(uuid) from public, anon;
grant execute on function public.campaign_selection_reviews(uuid) to authenticated;

create function public.rate_recommendation(p_rater uuid, p_campaign uuid, p_creator text, p_version text,
  p_rank int, p_score int, p_verdict text, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare target text := adme_creator.resolve_reference(p_creator);
begin
  if auth.role() is distinct from 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  if target is null then raise exception 'not_found' using errcode='P0002'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign and c.owner_id=p_rater and not c.is_demo) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  insert into public.matching_feedback(campaign_id,creator_id,rater_id,model_version,rank_position,score,verdict,reason,updated_at)
  values(p_campaign,target,p_rater,p_version,p_rank,p_score,p_verdict,p_reason,now())
  on conflict(campaign_id,creator_id,rater_id) do update set model_version=excluded.model_version,
    rank_position=excluded.rank_position, score=excluded.score, verdict=excluded.verdict, reason=excluded.reason, updated_at=now();
end $$;
revoke all on function public.rate_recommendation(uuid,uuid,text,text,int,int,text,text) from public, anon, authenticated;
grant execute on function public.rate_recommendation(uuid,uuid,text,text,int,int,text,text) to service_role;

create function public.my_recommendation_feedback(p_campaign uuid)
returns table(ref text, verdict text, reason text)
language sql stable security definer set search_path='' as $$
  select adme_creator.public_reference(f.creator_id), f.verdict, f.reason
  from public.matching_feedback f where f.campaign_id=p_campaign and f.rater_id=auth.uid() and auth.uid() is not null;
$$;
revoke all on function public.my_recommendation_feedback(uuid) from public, anon;
grant execute on function public.my_recommendation_feedback(uuid) to authenticated;

commit;
