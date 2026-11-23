-- D006: activation funnel events (signup → explore → shortlist → proposal → accept), privacy-minimal.
-- Contract (mirrors src/lib/analytics.ts): event name, occurred_at, pseudonymous subject, role, unique dedupe key.
-- Never stored: user id, email, message/brief text, search terms, creator ids of other people.
create table public.analytics_secret(id boolean primary key default true check (id), salt bytea not null default extensions.gen_random_bytes(32));
alter table analytics_secret enable row level security; -- no policies: only definer functions read the salt
revoke all on analytics_secret from anon, authenticated;
insert into analytics_secret default values;

create table public.product_events(
  id bigint generated always as identity primary key,
  event text not null check (event in ('signup','explore','shortlist','proposal','accept')),
  subject text not null check (subject ~ '^p:[0-9a-f]{32}$'),
  role text check (role in ('brand','creator','admin')),
  occurred_at timestamptz not null default now(),
  dedupe_key text not null unique
);
create index on product_events(occurred_at);
alter table product_events enable row level security;
create policy product_events_admin_read on product_events for select using (is_admin());
revoke insert, update, delete on product_events from anon, authenticated;

-- Opt-out (settings). Default on: pseudonymous counts only; opting out stops new events and erases past ones.
alter table profiles add column analytics_opt_out boolean not null default false;
grant update(analytics_opt_out) on profiles to authenticated;

create function public.analytics_subject(u uuid) returns text language sql stable security definer set search_path=public, extensions as $$
  select 'p:' || left(encode(hmac(convert_to(u::text, 'UTF8'), (select salt from analytics_secret), 'sha256'), 'hex'), 32)
$$;
revoke all on function public.analytics_subject(uuid) from public, anon, authenticated;

-- Single writer. A resend with the same key is counted once (unique dedupe_key, on conflict do nothing).
create function public.record_event(p_event text, p_user uuid, p_key text) returns void
language plpgsql security definer set search_path=public as $$
declare r text; opted boolean; s text;
begin
  select role, analytics_opt_out into r, opted from profiles where id = p_user;
  if not found or opted then return; end if;
  s := analytics_subject(p_user);
  insert into product_events(event, subject, role, dedupe_key)
  values (p_event, s, r, p_event || ':' || s || ':' || p_key) on conflict (dedupe_key) do nothing;
end $$;
revoke all on function public.record_event(text, uuid, text) from public, anon, authenticated;

create function public.track_events() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_table_name = 'profiles' then
    perform record_event('signup', new.id, 'once');
  elsif tg_table_name = 'saved_list_items' then
    perform record_event('shortlist', new.owner_id, analytics_subject(new.owner_id) || md5(new.creator_id));
  elsif tg_op = 'INSERT' then -- proposals: the initiator acts
    perform record_event('proposal', case when new.kind = 'proposal' then new.brand_id else new.creator_user_id end, new.id::text);
  elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform record_event('accept', case when new.kind = 'proposal' then new.creator_user_id else new.brand_id end, new.id::text);
  end if;
  return null;
end $$;
revoke all on function public.track_events() from public, anon, authenticated;
create trigger adme_event_signup after insert on profiles for each row execute function track_events();
create trigger adme_event_shortlist after insert on saved_list_items for each row execute function track_events();
create trigger adme_event_proposal after insert or update of status on proposals for each row execute function track_events();

-- Explore: at most one per user per day (KST); the search terms are never passed.
create function public.track_explore() returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then perform record_event('explore', auth.uid(), to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD')); end if;
end $$;
revoke all on function public.track_explore() from public, anon;
grant execute on function public.track_explore() to authenticated;

-- Opting out erases the user's past events; deleting the account does too.
create function public.erase_events() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op = 'DELETE' then delete from product_events where subject = analytics_subject(old.id); return old; end if;
  if new.analytics_opt_out and not old.analytics_opt_out then delete from product_events where subject = analytics_subject(new.id); end if;
  return new;
end $$;
revoke all on function public.erase_events() from public, anon, authenticated;
create trigger adme_event_erase before delete or update of analytics_opt_out on profiles for each row execute function erase_events();

-- Admin aggregate: distinct subjects per step in the window, no row-level data leaves.
create function public.product_funnel(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not (is_admin() or auth.role() = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_object_agg(e, coalesce(n, 0)) from unnest(array['signup','explore','shortlist','proposal','accept']) e
    left join (select event, count(distinct subject) n from product_events
               where occurred_at >= now() - make_interval(days => least(greatest(p_days, 1), 400)) group by event) x on x.event = e);
end $$;
revoke all on function public.product_funnel(int) from public, anon;
grant execute on function public.product_funnel(int) to authenticated, service_role;

-- Retention: events kept 400 days (13 months, year-over-year comparison).
create or replace function public.run_retention(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c jsonb := '{}'; n int;
begin
  begin
    delete from privacy_exports where expires_at < p_now - interval '1 day';
    get diagnostics n = row_count; c := c || jsonb_build_object('privacy_exports', n);
    delete from privacy_access_log where created_at < p_now - interval '1 year';
    get diagnostics n = row_count; c := c || jsonb_build_object('privacy_access_log', n);
    delete from notifications where created_at < p_now - interval '180 days';
    get diagnostics n = row_count; c := c || jsonb_build_object('notifications', n);
    delete from audit_log where created_at < p_now - interval '1 year';
    get diagnostics n = row_count; c := c || jsonb_build_object('audit_log', n);
    -- Closed deals: messages removed and brief replaced 3 years after the last change.
    delete from messages m using proposals p where m.proposal_id = p.id
      and p.status in ('rejected','cancelled','completed') and p.updated_at < p_now - interval '3 years';
    get diagnostics n = row_count; c := c || jsonb_build_object('messages', n);
    update proposals set brief = '[보존기간 경과로 삭제됨]'
      where status in ('rejected','cancelled','completed') and updated_at < p_now - interval '3 years'
        and brief <> '[보존기간 경과로 삭제됨]';
    get diagnostics n = row_count; c := c || jsonb_build_object('proposal_briefs', n);
    -- Closed reports: free text removed after 3 years; the ticket, kind and decision dates stay.
    update reports set reason = '[보존기간 경과로 삭제됨]', response = case when response is null then null else '[보존기간 경과로 삭제됨]' end
      where status in ('resolved','dismissed') and decided_at < p_now - interval '3 years'
        and reason <> '[보존기간 경과로 삭제됨]';
    get diagnostics n = row_count; c := c || jsonb_build_object('report_texts', n);
    delete from contact_restrictions where coalesce(lifted_at, ends_at) < p_now - interval '1 year';
    get diagnostics n = row_count; c := c || jsonb_build_object('contact_restrictions', n);
    delete from product_events where occurred_at < p_now - interval '400 days';
    get diagnostics n = row_count; c := c || jsonb_build_object('product_events', n);
    delete from retention_runs where started_at < p_now - interval '1 year';
    insert into retention_runs(status, counts, finished_at) values ('ok', c, now());
  exception when others then
    -- The partial work above is rolled back; the failure itself is kept so the next run (retry) is visible.
    insert into retention_runs(status, error, finished_at) values ('failed', left(sqlerrm, 200), now());
    return jsonb_build_object('error', left(sqlerrm, 200));
  end;
  return c;
end $$;
