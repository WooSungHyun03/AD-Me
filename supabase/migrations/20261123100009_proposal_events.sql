-- D049: proposal state machine — cancel by the initiator, history + notification event written
-- atomically with every state change, and gating of hidden/unverified creators at acceptance.

alter table proposals drop constraint proposals_status_check;
alter table proposals add constraint proposals_status_check
  check (status in ('pending','accepted','rejected','cancelled','submitted','revision_requested','completed'));

-- One row per state change. recipient_id = the other participant (the notification target, D052 reads this).
create table public.proposal_events(
  id bigint generated always as identity primary key,
  proposal_id uuid not null references proposals(id) on delete cascade,
  actor_id uuid references profiles(id),
  recipient_id uuid not null references profiles(id),
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);
create index on proposal_events(proposal_id, id);
create index on proposal_events(recipient_id, id desc);
alter table proposal_events enable row level security;
create policy proposal_events_read on proposal_events for select using (
  exists(select 1 from proposals p where p.id = proposal_id and auth.uid() in (p.brand_id, p.creator_user_id))
  or is_admin());
-- No insert/update/delete policies: rows are written only by the definer functions below.
revoke insert, update, delete on proposal_events from anon, authenticated;

-- Backfill: existing proposals get one event for their current state (from_status unknown).
insert into proposal_events(proposal_id, actor_id, recipient_id, from_status, to_status, created_at)
select id, null, case when kind = 'proposal' then creator_user_id else brand_id end, null, status, updated_at
from proposals;

create function public.log_proposal_created() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into proposal_events(proposal_id, actor_id, recipient_id, from_status, to_status)
  values (new.id, auth.uid(), case when new.kind = 'proposal' then new.creator_user_id else new.brand_id end, null, new.status);
  return new;
end $$;
revoke all on function public.log_proposal_created() from public, anon, authenticated;
create trigger adme_proposal_created after insert on proposals
  for each row execute function public.log_proposal_created();

create or replace function public.transition_proposal(p_id uuid, p_action text) returns text
language plpgsql security definer set search_path=public as $$
declare p proposals; r text; starter text; cap int;
begin
  select * into p from proposals where id = p_id for update; -- serializes concurrent actions on one proposal
  if not found or auth.uid() is null or auth.uid() not in (p.brand_id, p.creator_user_id) then raise exception 'forbidden'; end if;
  r := case when auth.uid() = p.brand_id then 'brand' else 'creator' end;
  starter := case when p.kind = 'proposal' then 'brand' else 'creator' end;
  if not ((p.status = 'pending' and p_action in ('accepted','rejected') and r <> starter)
    or (p.status = 'pending' and p_action = 'cancelled' and r = starter)
    or (p.status in ('accepted','revision_requested') and p_action = 'submitted' and r = 'creator'
        and exists(select 1 from messages where proposal_id = p.id and kind = 'deliverable'))
    or (p.status = 'submitted' and p_action in ('completed','revision_requested') and r = 'brand')) then
    raise exception 'invalid transition';
  end if;
  if p_action = 'accepted' then
    -- A creator hidden by moderation or no longer verified cannot enter a collaboration.
    if not exists(select 1 from creators c where c.id = p.creator_id and c.published and c.claim_status = 'verified'
                  and c.owner_id = p.creator_user_id) then
      raise exception 'creator_unavailable';
    end if;
    select capacity into cap from campaigns where id = p.campaign_id for update; -- serializes concurrent selections
    if cap is not null and campaign_selected(p.campaign_id) >= cap then raise exception 'capacity_full'; end if;
  end if;
  update proposals set status = p_action, updated_at = now() where id = p.id;
  insert into proposal_events(proposal_id, actor_id, recipient_id, from_status, to_status)
  values (p.id, auth.uid(), case when r = 'brand' then p.creator_user_id else p.brand_id end, p.status, p_action);
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p.id::text, p_action);
  return p_action;
end $$;

-- Cancelled proposals are closed like rejected ones: no messages, and they don't block making a campaign private.
drop policy messages_insert on messages;
create policy messages_insert on messages for insert with check(sender_id = auth.uid() and exists(
  select 1 from proposals p where p.id = proposal_id and auth.uid() in (p.brand_id, p.creator_user_id)
    and p.status not in ('rejected','cancelled')
    -- messages.kind must be qualified: inside this subquery a bare `kind` resolves to proposals.kind,
    -- which silently blocked every plain message (bug since 0001).
    and (messages.kind = 'message' or (p.creator_user_id = auth.uid() and p.status in ('accepted','revision_requested')))));

create or replace function public.guard_campaign_status() returns trigger language plpgsql set search_path=public as $$
declare selected int;
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('draft','published') then raise exception 'invalid_status'; end if;
  elsif new.status is distinct from old.status then
    if not ((old.status, new.status) in (('draft','published'),('draft','closed'),('published','closed'),('published','draft'),('closed','published'))) then
      raise exception 'invalid_transition';
    end if;
    if new.status = 'draft' and exists(select 1 from proposals where campaign_id = new.id and status not in ('rejected','cancelled')) then
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
