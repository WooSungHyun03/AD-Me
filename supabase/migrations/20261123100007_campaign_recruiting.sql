-- D043: recruiting deadline, capacity, status transitions and selection races enforced in the DB.
-- All time checks use the DB clock (now()), never a client-supplied time.
alter table campaigns
  add column recruit_until timestamptz,
  add column capacity int check (capacity between 1 and 100);

-- Selected = accepted or further along. SECURITY DEFINER: callers cannot see other users' proposals under RLS.
create function public.campaign_selected(p_campaign uuid) returns int language sql stable security definer set search_path=public as $$
  select count(*)::int from proposals where campaign_id = p_campaign and status in ('accepted','submitted','revision_requested','completed')
$$;
create function public.campaign_accepting(p_campaign uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from campaigns c where c.id = p_campaign and c.status = 'published'
    and (c.recruit_until is null or c.recruit_until > now())
    and (c.capacity is null or campaign_selected(c.id) < c.capacity))
$$;
revoke all on function public.campaign_selected(uuid), public.campaign_accepting(uuid) from public, anon;
grant execute on function public.campaign_selected(uuid), public.campaign_accepting(uuid) to authenticated;

create function public.guard_campaign_status() returns trigger language plpgsql set search_path=public as $$
declare selected int;
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft','published') then raise exception 'invalid_status'; end if;
  elsif new.status is distinct from old.status then
    if not ((old.status, new.status) in (('draft','published'),('draft','closed'),('published','closed'),('published','draft'),('closed','published'))) then
      raise exception 'invalid_transition';
    end if;
    -- Going private is only allowed before anyone has been engaged.
    if new.status = 'draft' and exists(select 1 from proposals where campaign_id = new.id and status <> 'rejected') then
      raise exception 'has_active_proposals';
    end if;
  end if;
  if new.status = 'published' and new.recruit_until is not null and new.recruit_until <= now()
     and (tg_op = 'INSERT' or new.recruit_until is distinct from old.recruit_until or new.status is distinct from old.status) then
    raise exception 'deadline_passed';
  end if;
  if tg_op = 'UPDATE' and new.capacity is distinct from old.capacity and new.capacity is not null then
    selected := campaign_selected(new.id);
    if new.capacity < selected then raise exception 'capacity_below_selected'; end if;
  end if;
  return new;
end $$;
create trigger adme_campaign_status_guard before insert or update on campaigns
  for each row execute function public.guard_campaign_status();

-- Applications need an open campaign; brand proposals need a non-closed, non-full campaign.
drop policy proposals_insert on proposals;
create policy proposals_insert on proposals for insert with check(status='pending' and exists(
  select 1 from campaigns ca join creators cr on cr.id=creator_id
  where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id and cr.claim_status='verified' and cr.published
    and ((kind='proposal' and brand_id=auth.uid() and my_role()='brand' and ca.status<>'closed'
          and (ca.capacity is null or campaign_selected(ca.id) < ca.capacity))
      or (kind='application' and creator_user_id=auth.uid() and my_role()='creator' and campaign_accepting(ca.id)))));

-- Same transition rules as before, plus: acceptance locks the campaign row and respects capacity.
create or replace function public.transition_proposal(p_id uuid,p_action text) returns text language plpgsql security definer set search_path=public as $$
declare p proposals; r text; cap int;
begin
  select * into p from proposals where id=p_id for update;
  if not found or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'forbidden'; end if;
  r := case when auth.uid()=p.brand_id then 'brand' else 'creator' end;
  if not ((p.status='pending' and p_action in ('accepted','rejected') and r=case when p.kind='proposal' then 'creator' else 'brand' end)
    or (p.status in ('accepted','revision_requested') and p_action='submitted' and r='creator' and exists(select 1 from messages where proposal_id=p.id and kind='deliverable'))
    or (p.status='submitted' and p_action in ('completed','revision_requested') and r='brand')) then
    raise exception 'invalid transition';
  end if;
  if p_action = 'accepted' then
    select capacity into cap from campaigns where id = p.campaign_id for update; -- serializes concurrent selections
    if cap is not null and campaign_selected(p.campaign_id) >= cap then raise exception 'capacity_full'; end if;
  end if;
  update proposals set status=p_action,updated_at=now() where id=p.id;
  insert into audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,p_action);
  return p_action;
end $$;
