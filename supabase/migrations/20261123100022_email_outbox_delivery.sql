-- D053: app notification email delivery state. Separate from Supabase Auth emails (signup/reset), which go
-- through the Auth SMTP setting and never touch this table. Nothing here sends mail: a server worker claims
-- rows, calls the configured sender, and reports the result.
alter table email_outbox
  add column channel text not null default 'email' check (channel in ('email')),
  add column template text not null default 'notification',
  add column template_version text not null default 'v1',
  add column attempts int not null default 0 check (attempts >= 0),
  add column next_attempt_at timestamptz not null default now(),
  add column locked_until timestamptz,
  add column last_error text check (length(last_error) <= 200),
  add column sent_at timestamptz;
alter table email_outbox drop constraint email_outbox_status_check;
alter table email_outbox add constraint email_outbox_status_check
  check (status in ('queued','sending','sent','failed','dead','cancelled'));
-- Idempotency key = event + recipient + channel (replaces user+source, same rows; channel defaults to email).
alter table email_outbox add constraint email_outbox_event_recipient_channel unique (source_key, user_id, channel);
alter table email_outbox drop constraint email_outbox_user_id_source_key_key;
create index email_outbox_due on email_outbox(next_attempt_at) where status in ('queued','failed','sending');

create or replace function public.enqueue_service_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into email_outbox(user_id, purpose, source_key, template, template_version)
  select new.user_id, 'service', 'notification:' || new.id, 'notification_' || new.kind, 'v1'
  from profiles where id = new.user_id and service_email
  on conflict do nothing;
  return null;
end $$;
create or replace function public.enqueue_marketing(p_key text, p_interest text default null) returns int
language plpgsql security definer set search_path=public as $$
declare n int;
begin
  insert into email_outbox(user_id, purpose, source_key, template, template_version)
  select id, 'marketing', 'marketing:' || p_key, 'marketing', 'v1' from profiles
  where marketing_email and (p_interest is null or p_interest = any(interests))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Stateless one-click unsubscribe token: "<user id>.<purpose>.<hmac>". The secret never leaves the DB.
create table public.email_secret(id boolean primary key default true check (id), key bytea not null default extensions.gen_random_bytes(32));
alter table email_secret enable row level security; -- no policies
revoke all on email_secret from anon, authenticated;
insert into email_secret default values;
create function public.unsubscribe_token(p_user uuid, p_purpose text) returns text
language sql stable security definer set search_path=public, extensions as $$
  select p_user::text || '.' || p_purpose || '.' ||
    left(encode(hmac(convert_to(p_user::text || ':' || p_purpose, 'UTF8'), (select key from email_secret), 'sha256'), 'hex'), 40)
$$;
revoke all on function public.unsubscribe_token(uuid, text) from public, anon, authenticated;
grant execute on function public.unsubscribe_token(uuid, text) to service_role;
-- Anyone holding a valid token may turn that one purpose off (no login: RFC 8058 one-click). Returns the purpose.
create function public.unsubscribe_email(p_token text) returns text
language plpgsql security definer set search_path=public, extensions as $$
declare u uuid; pur text;
begin
  if p_token !~ '^[0-9a-f-]{36}\.(service|marketing)\.[0-9a-f]{40}$' then raise exception 'invalid_token' using errcode = '22023'; end if;
  u := split_part(p_token, '.', 1)::uuid; pur := split_part(p_token, '.', 2);
  if unsubscribe_token(u, pur) <> p_token then raise exception 'invalid_token' using errcode = '22023'; end if;
  if pur = 'marketing' then
    update profiles set marketing_email = false, marketing_version = null, marketing_at = now() where id = u and marketing_email;
  else
    update profiles set service_email = false where id = u and service_email;
  end if;
  if found then insert into consent_log(user_id, purpose, value, version) values (u, pur || '_email', to_jsonb(false), 'unsubscribe-link'); end if;
  update email_outbox set status = 'cancelled' where user_id = u and purpose = pur and status in ('queued','failed');
  return pur;
end $$;
revoke all on function public.unsubscribe_email(text) from public;
grant execute on function public.unsubscribe_email(text) to anon, authenticated, service_role;

-- Worker: claim due rows (skip-locked, so parallel workers never get the same row), re-checking consent at
-- send time; a 'sending' row whose lease expired (crashed worker) is claimable again.
create function public.claim_emails(p_limit int default 20) returns table(
  id bigint, purpose text, template text, template_version text, source_key text, email text, attempts int, unsubscribe text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  update email_outbox o set status = 'cancelled'
    from profiles p
   where p.id = o.user_id and o.status in ('queued','failed','sending') and o.next_attempt_at <= now()
     and ((o.purpose = 'service' and not p.service_email) or (o.purpose = 'marketing' and not p.marketing_email));
  return query
  with due as (
    select o.id from email_outbox o
     where (o.status in ('queued','failed') and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.locked_until < now())
     order by o.next_attempt_at, o.id limit least(greatest(p_limit, 1), 100)
     for update skip locked)
  update email_outbox o set status = 'sending', attempts = o.attempts + 1, locked_until = now() + interval '5 minutes'
    from due, auth.users u
   where o.id = due.id and u.id = o.user_id
  returning o.id, o.purpose, o.template, o.template_version, o.source_key, u.email::text, o.attempts,
            unsubscribe_token(o.user_id, o.purpose);
end $$;
-- Backoff 2^attempts minutes; after 5 attempts the row is dead-lettered (kept for inspection, not retried).
create function public.finish_email(p_id bigint, p_ok boolean, p_error text default null) returns text
language plpgsql security definer set search_path=public as $$
declare s text;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  update email_outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'dead' else 'failed' end,
    sent_at = case when p_ok then now() end,
    last_error = case when p_ok then null else left(coalesce(p_error, 'error'), 200) end,
    next_attempt_at = case when p_ok then next_attempt_at else now() + make_interval(mins => power(2, attempts)::int) end,
    locked_until = null
  where id = p_id and status = 'sending' returning status into s;
  return s;
end $$;
create function public.email_outbox_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from email_outbox group by status) s);
end $$;
revoke all on function public.claim_emails(int) from public, anon, authenticated;
revoke all on function public.finish_email(bigint, boolean, text) from public, anon, authenticated;
revoke all on function public.email_outbox_stats() from public, anon;
grant execute on function public.claim_emails(int) to service_role;
grant execute on function public.finish_email(bigint, boolean, text) to service_role;
grant execute on function public.email_outbox_stats() to authenticated, service_role;
