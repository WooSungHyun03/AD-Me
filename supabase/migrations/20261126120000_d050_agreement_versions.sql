-- DEV-B D050: versioned collaboration terms (budget · deliverables · schedule) per proposal.
-- A party proposes terms; they count as agreed only after the other party accepts. A one-sided proposal
-- never replaces the last agreed terms. Offers, acceptances and the event log are append-only and readable
-- only by the two parties; all writes go through the RPCs below, which serialize on the proposal row,
-- check an expected version (optimistic concurrency), are idempotent by client key, and refuse closed,
-- blocked or restricted collaborations. This records the parties' agreement only — it is not an electronic
-- signature or a settlement guarantee.
begin;

create table public.agreement_offers(
  id uuid primary key,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  terms jsonb not null check (
    jsonb_typeof(terms)='object' and octet_length(terms::text) <= 4000
    and (terms - array['budgetKrw','deliverables','schedule','note']) = '{}'::jsonb
    and (terms->'budgetKrw' is null or jsonb_typeof(terms->'budgetKrw') in ('number','null'))
    and jsonb_typeof(terms->'deliverables')='string' and jsonb_typeof(terms->'schedule')='string'),
  accepted_by uuid[] not null check (cardinality(accepted_by) between 1 and 2),
  replaces uuid references public.agreement_offers(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
create index agreement_offers_proposal on public.agreement_offers(proposal_id, created_at);
create table public.agreement_events(
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  offer_id uuid not null references public.agreement_offers(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('proposed','accepted')),
  version int not null check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  unique(proposal_id, version)
);
alter table public.agreement_offers enable row level security;
alter table public.agreement_events enable row level security;
create policy agreement_offers_parties on public.agreement_offers for select using (
  exists(select 1 from public.proposals p where p.id=proposal_id and auth.uid() in (p.brand_id, p.creator_user_id)));
create policy agreement_events_parties on public.agreement_events for select using (
  exists(select 1 from public.proposals p where p.id=proposal_id and auth.uid() in (p.brand_id, p.creator_user_id)));
revoke insert, update, delete on public.agreement_offers, public.agreement_events from anon, authenticated;

create function adme_ops.agreement_snapshot(p_proposal uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'proposalId', p_proposal,
    'version', coalesce((select max(e.version) from public.agreement_events e where e.proposal_id=p_proposal),0),
    'writable', (select p.status in ('pending','accepted','submitted','revision_requested') from public.proposals p where p.id=p_proposal),
    'offers', coalesce((select jsonb_agg(jsonb_build_object(
        'id',o.id,'mine',o.author_id=auth.uid(),'terms',o.terms,'accepted',cardinality(o.accepted_by)=2,
        'acceptedByMe',auth.uid()=any(o.accepted_by),'replaces',o.replaces,'createdAt',o.created_at,'confirmedAt',o.confirmed_at)
        order by o.created_at, o.id) from public.agreement_offers o where o.proposal_id=p_proposal),'[]'::jsonb));
$$;
revoke all on function adme_ops.agreement_snapshot(uuid) from public, anon, authenticated, service_role;

-- Locks the proposal, checks the caller is a party of an open, contactable collaboration and the version.
create function adme_ops.agreement_guard(p_proposal uuid, p_expected int) returns public.proposals
language plpgsql security definer set search_path='' as $$
declare p public.proposals; other uuid; current_version int;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal for update;
  if not found or auth.uid() not in (p.brand_id, p.creator_user_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p.status not in ('pending','accepted','submitted','revision_requested') then raise exception 'agreement_locked' using errcode='55000'; end if;
  other := case when auth.uid()=p.brand_id then p.creator_user_id else p.brand_id end;
  if public.contact_denied(auth.uid(), other) is not null then raise exception 'agreement_locked' using errcode='55000'; end if;
  current_version := coalesce((select max(version) from public.agreement_events where proposal_id=p_proposal),0);
  if p_expected is distinct from current_version then raise exception 'stale_version' using errcode='40001'; end if;
  return p;
end $$;
revoke all on function adme_ops.agreement_guard(uuid,int) from public, anon, authenticated, service_role;

create function public.agreement_state(p_proposal uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.proposals p where p.id=p_proposal and auth.uid() in (p.brand_id,p.creator_user_id)) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  return adme_ops.agreement_snapshot(p_proposal);
end $$;

create function public.agreement_propose(p_proposal uuid, p_offer uuid, p_expected int, p_terms jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior public.agreement_offers; confirmed uuid; v int;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform adme_ops.require_quota('agreement_write', auth.uid()::text, 30, 3600);
  select * into prior from public.agreement_offers where id=p_offer;
  if found then -- idempotent retry with the same key and payload
    if prior.proposal_id=p_proposal and prior.author_id=auth.uid() and prior.terms=p_terms then
      return public.agreement_state(p_proposal);
    end if;
    raise exception 'key_reused' using errcode='23505';
  end if;
  perform adme_ops.agreement_guard(p_proposal, p_expected);
  if (select count(*) from public.agreement_offers where proposal_id=p_proposal) >= 50 then
    raise exception 'agreement_limit' using errcode='54000';
  end if;
  select id into confirmed from public.agreement_offers where proposal_id=p_proposal and cardinality(accepted_by)=2
    order by confirmed_at desc, id desc limit 1;
  insert into public.agreement_offers(id,proposal_id,author_id,terms,accepted_by,replaces)
    values(p_offer,p_proposal,auth.uid(),p_terms,array[auth.uid()],confirmed);
  v := p_expected + 1;
  insert into public.agreement_events(proposal_id,offer_id,actor_id,kind,version) values(p_proposal,p_offer,auth.uid(),'proposed',v);
  return adme_ops.agreement_snapshot(p_proposal);
end $$;

create function public.agreement_accept(p_proposal uuid, p_offer uuid, p_expected int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare latest public.agreement_offers;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode='42501'; end if;
  perform adme_ops.require_quota('agreement_write', auth.uid()::text, 30, 3600);
  if exists(select 1 from public.agreement_offers o where o.id=p_offer and o.proposal_id=p_proposal
            and cardinality(o.accepted_by)=2 and auth.uid()=any(o.accepted_by)) then
    return public.agreement_state(p_proposal); -- idempotent retry of an acceptance that already landed
  end if;
  perform adme_ops.agreement_guard(p_proposal, p_expected);
  select * into latest from public.agreement_offers where proposal_id=p_proposal order by created_at desc, id desc limit 1;
  if latest.id is distinct from p_offer or cardinality(latest.accepted_by)<>1 or auth.uid()=any(latest.accepted_by) then
    raise exception 'not_pending' using errcode='55000';
  end if;
  update public.agreement_offers set accepted_by=accepted_by||auth.uid(), confirmed_at=statement_timestamp() where id=p_offer;
  insert into public.agreement_events(proposal_id,offer_id,actor_id,kind,version) values(p_proposal,p_offer,auth.uid(),'accepted',p_expected+1);
  return adme_ops.agreement_snapshot(p_proposal);
end $$;

revoke all on function public.agreement_state(uuid), public.agreement_propose(uuid,uuid,int,jsonb),
  public.agreement_accept(uuid,uuid,int) from public, anon;
grant execute on function public.agreement_state(uuid), public.agreement_propose(uuid,uuid,int,jsonb),
  public.agreement_accept(uuid,uuid,int) to authenticated;
commit;
