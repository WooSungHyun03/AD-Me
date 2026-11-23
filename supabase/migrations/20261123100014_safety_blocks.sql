-- D062: blocks, temporary contact restrictions, spam/multi-account rate limits and impersonation review.
-- One helper, contact_denied(sender, recipient), decides contact everywhere: new proposals/applications,
-- messages, acceptance and notifications. Reports never sanction automatically; only an admin restricts,
-- always with an end date, and the restricted user can appeal.

create table public.user_blocks(
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on user_blocks(blocked_id);
alter table user_blocks enable row level security;
-- The blocked person is never told (no read path for them).
create policy user_blocks_read on user_blocks for select using (blocker_id = auth.uid());
revoke insert, update, delete on user_blocks from anon, authenticated;

create table public.contact_restrictions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (length(reason) between 5 and 500),
  report_id uuid references reports(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null, -- always temporary: no permanent sanction without a human re-deciding
  created_by uuid not null references profiles(id),
  lifted_at timestamptz,
  lifted_by uuid references profiles(id),
  appeal text check (appeal is null or length(appeal) between 10 and 2000),
  appealed_at timestamptz,
  check (ends_at > starts_at and ends_at <= starts_at + interval '30 days')
);
create index on contact_restrictions(user_id, ends_at desc);
alter table contact_restrictions enable row level security;
create policy contact_restrictions_read on contact_restrictions for select using (user_id = auth.uid() or is_admin());
revoke insert, update, delete on contact_restrictions from anon, authenticated;

create function public.contact_restricted(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from contact_restrictions r where r.user_id = p_user and r.lifted_at is null
                and now() between r.starts_at and r.ends_at)
$$;

-- The single permission helper. Returns null when contact is allowed, otherwise the reason code.
create function public.contact_denied(p_sender uuid, p_recipient uuid) returns text
language sql stable security definer set search_path=public as $$
  select case
    when exists(select 1 from user_blocks b where (b.blocker_id = p_sender and b.blocked_id = p_recipient)
                                               or (b.blocker_id = p_recipient and b.blocked_id = p_sender)) then 'blocked'
    when contact_restricted(p_sender) then 'contact_restricted'
  end
$$;
-- Internal only (definer callers): arbitrary-pair lookups are not exposed to users.
revoke all on function public.contact_restricted(uuid), public.contact_denied(uuid, uuid) from public, anon, authenticated;

-- Definer part of the guard: block/restriction via the helper, then rate limits (counts span other users' rows).
-- Sender is always the caller, so nobody can probe relations between other people.
create function public.contact_check(p_table text, p_recipient uuid) returns void
language plpgsql security definer set search_path=public as $$
declare p_sender uuid := auth.uid(); reason text := contact_denied(p_sender, p_recipient);
begin
  if reason is not null then raise exception '%', reason; end if;
  if p_table = 'proposals' then
    -- Sender: 20 new requests/24h. Creator as recipient: 10 unsolicited brand proposals/hour from anyone
    -- (multi-account spam). Applications to a brand's open campaign are expected in bulk and are bounded by the
    -- campaign's own recruiting rules (deadline/capacity) plus the applicant's sender limit.
    if (select count(*) from proposals x where (case when x.kind = 'proposal' then x.brand_id else x.creator_user_id end) = p_sender
          and x.created_at > now() - interval '24 hours') >= 20
       or (select count(*) from proposals x where x.kind = 'proposal' and x.creator_user_id = p_recipient
          and x.created_at > now() - interval '1 hour') >= 10 then
      raise exception 'rate_limited';
    end if;
  else
    -- Sender: 30 messages/10 min. Recipient: 60 messages/10 min across all senders.
    if (select count(*) from messages m where m.sender_id = p_sender and m.created_at > now() - interval '10 minutes') >= 30
       or (select count(*) from messages m join proposals q on q.id = m.proposal_id
           where m.sender_id <> p_recipient and p_recipient in (q.brand_id, q.creator_user_id)
             and m.created_at > now() - interval '10 minutes') >= 60 then
      raise exception 'rate_limited';
    end if;
  end if;
end $$;
revoke all on function public.contact_check(text, uuid) from public, anon;
grant execute on function public.contact_check(text, uuid) to authenticated;

-- Invoker trigger so current_user tells browser requests (authenticated/anon) from definer/seed paths.
create function public.guard_contact() returns trigger language plpgsql set search_path=public as $$
declare sender uuid := auth.uid(); recipient uuid; p proposals;
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if tg_table_name = 'proposals' then
    recipient := case when new.kind = 'proposal' then new.creator_user_id else new.brand_id end;
  else
    select * into p from proposals where id = new.proposal_id; -- RLS: only a participant can see it
    if not found then return new; end if; -- the insert policy refuses non-participants
    recipient := case when sender = p.brand_id then p.creator_user_id else p.brand_id end;
  end if;
  perform contact_check(tg_table_name, recipient);
  return new;
end $$;
revoke all on function public.guard_contact() from public, anon, authenticated;
create trigger adme_guard_contact before insert on proposals for each row execute function public.guard_contact();
create trigger adme_guard_contact before insert on messages for each row execute function public.guard_contact();

-- Acceptance also goes through the helper (a block after the request stops the collaboration from starting).
create or replace function public.transition_proposal(p_id uuid, p_action text) returns text
language plpgsql security definer set search_path=public as $$
declare p proposals; r text; starter text; cap int; reason text;
begin
  select * into p from proposals where id = p_id for update;
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
    reason := contact_denied(auth.uid(), case when r = 'brand' then p.creator_user_id else p.brand_id end);
    if reason is not null then raise exception '%', reason; end if;
    if not exists(select 1 from creators c where c.id = p.creator_id and c.published and c.claim_status = 'verified'
                  and c.owner_id = p.creator_user_id) then
      raise exception 'creator_unavailable';
    end if;
    select capacity into cap from campaigns where id = p.campaign_id for update;
    if cap is not null and campaign_selected(p.campaign_id) >= cap then raise exception 'capacity_full'; end if;
  end if;
  update proposals set status = p_action, updated_at = now() where id = p.id;
  insert into proposal_events(proposal_id, actor_id, recipient_id, from_status, to_status)
  values (p.id, auth.uid(), case when r = 'brand' then p.creator_user_id else p.brand_id end, p.status, p_action);
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p.id::text, p_action);
  return p_action;
end $$;

-- Notifications: nothing reaches a user from someone either of them blocked.
create or replace function public.notify_proposal_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.actor_id is not null and exists(select 1 from user_blocks b
      where (b.blocker_id = new.recipient_id and b.blocked_id = new.actor_id)
         or (b.blocker_id = new.actor_id and b.blocked_id = new.recipient_id)) then
    return new;
  end if;
  insert into notifications(user_id, proposal_id, kind, status, source_key)
  values (new.recipient_id, new.proposal_id, 'status', new.to_status, 'event:' || new.id)
  on conflict (source_key) do nothing;
  return new;
end $$;

-- Block / unblock. Blocking is done from a shared proposal so user ids are never enumerable;
-- an open request between the two is closed (cancelled if mine, rejected if theirs).
create function public.block_counterparty(p_proposal uuid) returns text
language plpgsql security definer set search_path=public as $$
declare p proposals; other uuid; r text; starter text;
begin
  select * into p from proposals where id = p_proposal for update;
  if not found or auth.uid() is null or auth.uid() not in (p.brand_id, p.creator_user_id) then raise exception 'forbidden'; end if;
  other := case when auth.uid() = p.brand_id then p.creator_user_id else p.brand_id end;
  insert into user_blocks(blocker_id, blocked_id) values (auth.uid(), other) on conflict do nothing;
  for p in select * from proposals x where x.status = 'pending'
      and ((x.brand_id = auth.uid() and x.creator_user_id = other) or (x.brand_id = other and x.creator_user_id = auth.uid())) for update loop
    r := case when auth.uid() = p.brand_id then 'brand' else 'creator' end;
    starter := case when p.kind = 'proposal' then 'brand' else 'creator' end;
    update proposals set status = case when r = starter then 'cancelled' else 'rejected' end, updated_at = now() where id = p.id;
    insert into proposal_events(proposal_id, actor_id, recipient_id, from_status, to_status)
    values (p.id, auth.uid(), other, 'pending', case when r = starter then 'cancelled' else 'rejected' end);
  end loop;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), other::text, 'block');
  return 'blocked';
end $$;
create function public.unblock_user(p_user uuid) returns text
language plpgsql security definer set search_path=public as $$
begin
  delete from user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
  if not found then raise exception 'not_found'; end if;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p_user::text, 'unblock');
  return 'unblocked';
end $$;
-- Names of people I blocked (only my own list), for the settings page.
create function public.my_blocks() returns table(blocked_id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select b.blocked_id, pr.name, b.created_at from user_blocks b join profiles pr on pr.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc
$$;

-- Admin: temporary restriction (1..30 days) tied to a report; lift; restricted user appeals once per restriction.
create function public.restrict_contact(p_report uuid, p_days int, p_reason text) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid; rid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_days not between 1 and 30 then raise exception 'invalid_days'; end if;
  select c.owner_id into target from reports r join creators c on c.id = r.creator_id where r.id = p_report;
  if target is null then raise exception 'no_account'; end if; -- collected profiles have no account to restrict
  if target = auth.uid() then raise exception 'forbidden'; end if;
  insert into contact_restrictions(user_id, reason, report_id, ends_at, created_by)
  values (target, trim(p_reason), p_report, now() + make_interval(days => p_days), auth.uid()) returning id into rid;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), rid::text, 'restrict:' || p_days || 'd');
  return rid;
end $$;
create function public.lift_restriction(p_id uuid) returns text
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update contact_restrictions set lifted_at = now(), lifted_by = auth.uid() where id = p_id and lifted_at is null;
  if not found then raise exception 'not_found'; end if;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p_id::text, 'restrict:lift');
  return 'lifted';
end $$;
create function public.appeal_restriction(p_id uuid, p_text text) returns text
language plpgsql security definer set search_path=public as $$
begin
  if length(trim(coalesce(p_text,''))) not between 10 and 2000 then raise exception 'invalid_reason'; end if;
  update contact_restrictions set appeal = trim(p_text), appealed_at = now()
  where id = p_id and user_id = auth.uid() and appeal is null and lifted_at is null and ends_at > now();
  if not found then raise exception 'appeal_closed'; end if;
  return 'appealed';
end $$;
revoke all on function public.block_counterparty(uuid), public.unblock_user(uuid), public.my_blocks(),
  public.restrict_contact(uuid,int,text), public.lift_restriction(uuid), public.appeal_restriction(uuid,text) from public, anon;
grant execute on function public.block_counterparty(uuid), public.unblock_user(uuid), public.my_blocks(),
  public.restrict_contact(uuid,int,text), public.lift_restriction(uuid), public.appeal_restriction(uuid,text) to authenticated;

-- Impersonation is its own report kind: always manual review (and appealable through D058).
alter table reports drop constraint reports_kind_check;
alter table reports add constraint reports_kind_check check (kind in ('report','correction','deletion','appeal','impersonation'));
create or replace function public.submit_report(p_kind text, p_creator text, p_reason text, p_source_url text default null,
  p_parent uuid default null) returns table(id uuid, ticket_no text, due_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); target text := p_creator; par reports; owner uuid; r reports;
begin
  if uid is null then raise exception 'forbidden'; end if;
  if p_kind not in ('report','correction','deletion','appeal','impersonation') then raise exception 'invalid_kind'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'invalid_reason'; end if;
  if (select count(*) from reports x where x.reporter_id = uid and x.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  if p_kind = 'appeal' then
    select * into par from reports x where x.id = p_parent;
    if not found or par.reporter_id <> uid or par.kind = 'appeal' then raise exception 'forbidden'; end if;
    if par.status not in ('resolved','dismissed') or par.decided_at < now() - interval '30 days' then raise exception 'appeal_closed'; end if;
    if exists(select 1 from reports x where x.parent_id = par.id and x.kind = 'appeal') then raise exception 'duplicate_open'; end if;
    target := par.creator_id;
  else
    if p_parent is not null then raise exception 'invalid_kind'; end if;
    if p_kind in ('report','correction','impersonation') and coalesce(p_source_url,'') not like 'https://%' then raise exception 'invalid_source'; end if;
    if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind
              and x.status in ('pending','in_review')) then
      raise exception 'duplicate_open';
    end if;
  end if;
  select c.owner_id into owner from creators c where c.id = target;
  if not found then raise exception 'not_found'; end if;
  insert into reports(reporter_id, creator_id, reason, source_url, kind, parent_id, identity_verified, ticket_no, due_at)
  values (uid, target, trim(p_reason), nullif(p_source_url,''), p_kind, case when p_kind = 'appeal' then par.id end,
          owner is not null and owner = uid,
          'ADR-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('report_ticket_seq')::text, 5, '0'),
          now() + case when p_kind = 'deletion' then interval '10 days' else interval '7 days' end)
  returning * into r;
  insert into report_events(report_id, to_status) values (r.id, 'pending');
  return query select r.id, r.ticket_no, r.due_at;
end $$;
