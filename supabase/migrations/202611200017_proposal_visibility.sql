-- Preserve the former RLS-hidden campaign behavior inside the compatibility RPC.
begin;
create or replace function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or p_kind is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Same visibility as the previous caller's SELECT under campaigns_read RLS.
  -- A foreign private campaign and a missing campaign return the same failure.
  select * into ca from public.campaigns where id=p_campaign
    and (owner_id=auth.uid() or status='published') for share;
  if ca.id is null then raise exception 'collaboration unavailable' using errcode='23514'; end if;
  select * into cr from public.creators where id=p_creator for share;
  if cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
