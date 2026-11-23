-- D058: report / correction / deletion / appeal queue with ticket numbers, deadlines, interim action,
-- requester-only status, a processing log, and suppression that blocks re-collection after deletion.

create sequence public.report_ticket_seq;
alter table reports
  add column ticket_no text,
  add column kind text not null default 'report' check (kind in ('report','correction','deletion','appeal')),
  add column parent_id uuid references reports(id),
  add column identity_verified boolean not null default false, -- requester is the profile owner (checked by DB)
  add column due_at timestamptz,
  add column interim_hidden boolean not null default false,
  add column response text check (response is null or length(response) between 5 and 2000),
  add column decided_by uuid references profiles(id),
  add column decided_at timestamptz;
alter table reports alter column source_url drop not null;
alter table reports drop constraint reports_status_check;
update reports set status = 'resolved' where status = 'reviewed';
alter table reports add constraint reports_status_check check (status in ('pending','in_review','resolved','dismissed'));
alter table reports drop constraint reports_source_url_check;
alter table reports add constraint reports_source_url_check
  check ((source_url is null and kind in ('deletion','appeal')) or source_url like 'https://%');
update reports set ticket_no = 'ADR-' || to_char(created_at at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('report_ticket_seq')::text, 5, '0'),
  due_at = created_at + interval '7 days' where ticket_no is null;
alter table reports alter column ticket_no set not null, alter column due_at set not null;
alter table reports add constraint reports_ticket_unique unique (ticket_no);
create unique index reports_one_appeal on reports(parent_id) where kind = 'appeal';
create index on reports(reporter_id, created_at desc);
create index on reports(status, due_at);

-- Requests are written only through submit_report (rate limit, ticket, verification); reads stay requester/admin only.
drop policy reports_insert on reports;
revoke insert, update, delete on reports from anon, authenticated;

-- Status log visible to the requester (no actor; admin identity lives in admin-only audit_log).
create table public.report_events(
  id bigint generated always as identity primary key,
  report_id uuid not null references reports(id) on delete cascade,
  to_status text not null,
  interim_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on report_events(report_id, id);
alter table report_events enable row level security;
create policy report_events_read on report_events for select using (
  exists(select 1 from reports r where r.id = report_id and (r.reporter_id = auth.uid() or is_admin())));
revoke insert, update, delete on report_events from anon, authenticated;

-- Keys of deleted collected profiles; any collector insert/republish matching a key is refused.
create table public.suppressed_sources(
  match_key text primary key, -- 'id:<creator id>' | 'url:<lowercased url>' | 'handle:<lowercased handle>'
  report_id uuid references reports(id),
  created_at timestamptz not null default now()
);
alter table suppressed_sources enable row level security;
create policy suppressed_read on suppressed_sources for select using (is_admin());
revoke insert, update, delete on suppressed_sources from anon, authenticated;

create function public.creator_match_keys(p_id text, p jsonb) returns text[] language sql immutable set search_path=public as $$
  select array_remove(array[
    'id:' || p_id,
    case when coalesce(p->>'social_url','') <> '' then 'url:' || lower(rtrim(p->>'social_url','/')) end,
    case when coalesce(p->>'handle','') not in ('','self_reported') then 'handle:' || lower(p->>'handle') end
  ], null)
$$;
create function public.guard_suppressed_creator() returns trigger language plpgsql set search_path=public as $$
begin
  -- Owner self-registration is the subject's own choice; only collected (ownerless) rows are blocked.
  if new.owner_id is null and (tg_op = 'INSERT' or (new.published and not old.published))
     and exists(select 1 from suppressed_sources s where s.match_key = any(creator_match_keys(new.id, new.profile))) then
    raise exception 'suppressed_source';
  end if;
  return new;
end $$;
create trigger adme_creator_suppressed before insert or update on creators
  for each row execute function public.guard_suppressed_creator();

create function public.submit_report(p_kind text, p_creator text, p_reason text, p_source_url text default null,
  p_parent uuid default null) returns table(id uuid, ticket_no text, due_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); target text := p_creator; par reports; owner uuid; r reports;
begin
  if uid is null then raise exception 'forbidden'; end if;
  if p_kind not in ('report','correction','deletion','appeal') then raise exception 'invalid_kind'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'invalid_reason'; end if;
  -- Abuse limits: 5 requests per 24h per account, one open request per account+profile+kind.
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
    if p_kind in ('report','correction') and coalesce(p_source_url,'') not like 'https://%' then raise exception 'invalid_source'; end if;
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
          -- Deletion follows the 10-day personal-data request window; others 7 days.
          now() + case when p_kind = 'deletion' then interval '10 days' else interval '7 days' end)
  returning * into r;
  insert into report_events(report_id, to_status) values (r.id, 'pending');
  return query select r.id, r.ticket_no, r.due_at;
end $$;
revoke all on function public.submit_report(text,text,text,text,uuid) from public, anon;
grant execute on function public.submit_report(text,text,text,text,uuid) to authenticated;

drop function public.review_report(uuid, text);
create function public.review_report(p_id uuid, p_status text, p_response text default null, p_hide boolean default null)
returns text language plpgsql security definer set search_path=public as $$
declare r reports; par reports; c creators;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from reports where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not ((r.status = 'pending' and p_status in ('in_review','resolved','dismissed'))
       or (r.status = 'in_review' and p_status in ('resolved','dismissed'))) then
    raise exception 'invalid_transition';
  end if;
  if p_status in ('resolved','dismissed') and length(trim(coalesce(p_response,''))) < 5 then raise exception 'response_required'; end if;
  if r.kind = 'appeal' then
    select * into par from reports where id = r.parent_id;
    if par.decided_by = auth.uid() then raise exception 'same_reviewer'; end if; -- appeals go to a different admin
  end if;
  select * into c from creators where id = r.creator_id for update;
  -- Interim action: hide the profile while under review (no public trace of the report).
  if p_hide is not null and p_hide <> r.interim_hidden then
    update creators set published = not p_hide, moderation_locked = p_hide where id = c.id;
    r.interim_hidden := p_hide;
  end if;
  if p_status = 'resolved' and (r.kind = 'deletion' or (r.kind = 'appeal' and par.kind = 'deletion')) then
    if c.owner_id is null then
      -- Collected/demo profile: remember its keys, then scrub content so nothing re-publishes it.
      insert into suppressed_sources(match_key, report_id)
      select k, r.id from unnest(creator_match_keys(c.id, c.profile)) k on conflict do nothing;
      update creators set published = false, moderation_locked = true,
        profile = jsonb_build_object('name','삭제된 프로필','bio','','handle','','categories','[]'::jsonb,'vibes','[]'::jsonb,
          'formats','[]'::jsonb,'platforms','[]'::jsonb,'price_min_krw',null,'price_max_krw',null,'followers',0,
          'is_available',null,'is_demo',coalesce((c.profile->>'is_demo')::boolean,false))
      where id = c.id;
    else
      update creators set published = false, moderation_locked = true where id = c.id;
    end if;
  end if;
  update reports set status = p_status, interim_hidden = r.interim_hidden,
    response = case when p_status in ('resolved','dismissed') then trim(p_response) else response end,
    decided_by = case when p_status in ('resolved','dismissed') then auth.uid() else decided_by end,
    decided_at = case when p_status in ('resolved','dismissed') then now() else decided_at end
  where id = r.id;
  insert into report_events(report_id, to_status, interim_hidden) values (r.id, p_status, r.interim_hidden);
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), r.id::text, 'report:' || p_status ||
    case when p_hide is true then ':hide' when p_hide is false then ':unhide' else '' end);
  return p_status;
end $$;
revoke all on function public.review_report(uuid,text,text,boolean) from public, anon;
grant execute on function public.review_report(uuid,text,text,boolean) to authenticated;
