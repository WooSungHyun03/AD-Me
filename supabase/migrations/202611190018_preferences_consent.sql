-- D015: service notifications vs optional marketing consent vs interests, kept apart with a change log.
-- Service email (proposal/message activity) defaults on and can be turned off; in-app notifications stay.
-- Marketing defaults off and is only ever set by an explicit user action (never pre-checked).
alter table profiles
  add column service_email boolean not null default true,
  add column marketing_email boolean not null default false,
  add column marketing_version text,
  add column marketing_at timestamptz,
  add column interests text[] not null default '{}' check (cardinality(interests) <= 5 and array_to_string(interests, '') !~ '[<>]');

-- Append-only history: who changed which purpose to what, under which notice version, when.
create table public.consent_log(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  purpose text not null check (purpose in ('service_email','marketing_email','interests')),
  value jsonb not null,
  version text,
  created_at timestamptz not null default now()
);
create index on consent_log(user_id, id desc);
alter table consent_log enable row level security;
create policy consent_log_read on consent_log for select using (user_id = auth.uid() or is_admin());
revoke insert, update, delete on consent_log from anon, authenticated;

-- Emails waiting to be sent (a sender worker picks status='queued'; SMTP is configured separately).
create table public.email_outbox(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  purpose text not null check (purpose in ('service','marketing')),
  source_key text not null,
  status text not null default 'queued' check (status in ('queued','sent','cancelled')),
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index on email_outbox(status, id);
alter table email_outbox enable row level security; -- no policies: server only
revoke all on email_outbox from anon, authenticated;

-- Notice versions live here (mirrored in src/lib/consent.ts). Changing the wording means a new version.
create function public.marketing_notice_version() returns text language sql immutable set search_path=public as $$ select 'marketing-2026-11' $$;

-- The only write path. Version and time are set by the server, never by the client.
create function public.set_preferences(p_service boolean, p_marketing boolean, p_interests text[]) returns void
language plpgsql security definer set search_path=public as $$
declare p profiles%rowtype;
begin
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_service is distinct from p.service_email then
    update profiles set service_email = p_service where id = p.id;
    insert into consent_log(user_id, purpose, value) values (p.id, 'service_email', to_jsonb(p_service));
    if not p_service then update email_outbox set status = 'cancelled' where user_id = p.id and purpose = 'service' and status = 'queued'; end if;
  end if;
  if p_marketing is distinct from p.marketing_email then
    update profiles set marketing_email = p_marketing, marketing_version = case when p_marketing then marketing_notice_version() end,
      marketing_at = now() where id = p.id;
    insert into consent_log(user_id, purpose, value, version) values (p.id, 'marketing_email', to_jsonb(p_marketing), marketing_notice_version());
    -- Withdrawal also applies to mail already waiting to be sent.
    if not p_marketing then update email_outbox set status = 'cancelled' where user_id = p.id and purpose = 'marketing' and status = 'queued'; end if;
  end if;
  if coalesce(p_interests, '{}') is distinct from p.interests then
    update profiles set interests = coalesce(p_interests, '{}') where id = p.id;
    insert into consent_log(user_id, purpose, value) values (p.id, 'interests', to_jsonb(coalesce(p_interests, '{}')));
  end if;
end $$;
revoke all on function public.set_preferences(boolean, boolean, text[]) from public, anon;
grant execute on function public.set_preferences(boolean, boolean, text[]) to authenticated;

-- Service email for each in-app notification, only while the recipient keeps service email on.
create function public.enqueue_service_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into email_outbox(user_id, purpose, source_key)
  select new.user_id, 'service', 'notification:' || new.id from profiles where id = new.user_id and service_email
  on conflict do nothing;
  return null;
end $$;
revoke all on function public.enqueue_service_email() from public, anon, authenticated;
create trigger adme_service_email after insert on notifications for each row execute function enqueue_service_email();

-- Marketing send: the audience is exactly the users with marketing consent now (optionally by interest).
create function public.enqueue_marketing(p_key text, p_interest text default null) returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  insert into email_outbox(user_id, purpose, source_key)
  select id, 'marketing', 'marketing:' || p_key from profiles
  where marketing_email and (p_interest is null or p_interest = any(interests))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.enqueue_marketing(text, text) from public, anon, authenticated;
grant execute on function public.enqueue_marketing(text, text) to service_role;
