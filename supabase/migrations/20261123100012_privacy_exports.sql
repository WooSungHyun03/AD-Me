-- D074: self-service personal data export. A recently re-authenticated user creates a one-time export
-- ticket (token stored only as a hash, 15-minute expiry); every create/download/refusal is logged.
-- The file itself is generated at download time from the user's own RLS-scoped data and never stored.

create table public.privacy_exports(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on privacy_exports(user_id, created_at desc);
alter table privacy_exports enable row level security;
create policy privacy_exports_read on privacy_exports for select using (user_id = auth.uid());
revoke insert, update, delete on privacy_exports from anon, authenticated;
-- Column-level read: the token hash is never readable through the API.
revoke select on privacy_exports from anon, authenticated;
grant select (id, user_id, expires_at, consumed_at, created_at) on privacy_exports to authenticated;

create table public.privacy_access_log(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade, -- the account that acted
  export_id uuid references privacy_exports(id) on delete set null,
  action text not null check (action in ('created','downloaded','expired','reused','denied')),
  created_at timestamptz not null default now()
);
create index on privacy_access_log(user_id, id desc);
alter table privacy_access_log enable row level security;
create policy privacy_access_log_read on privacy_access_log for select using (user_id = auth.uid());
revoke insert, update, delete on privacy_access_log from anon, authenticated;

create function public.create_privacy_export() returns table(id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path=public, extensions as $$
declare uid uuid := auth.uid(); t text; e privacy_exports;
begin
  if uid is null then raise exception 'forbidden'; end if;
  -- Re-authentication is enforced here too, not only in the route.
  if coalesce((select u.last_sign_in_at from auth.users u where u.id = uid), '-infinity') < now() - interval '10 minutes' then
    raise exception 'reauth_required';
  end if;
  if (select count(*) from privacy_exports x where x.user_id = uid and x.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  t := encode(gen_random_bytes(32), 'hex');
  insert into privacy_exports(user_id, token_hash, expires_at)
  values (uid, encode(digest(t, 'sha256'), 'hex'), now() + interval '15 minutes') returning * into e;
  insert into privacy_access_log(user_id, export_id, action) values (uid, e.id, 'created');
  return query select e.id, t, e.expires_at;
end $$;

-- Returns 'ok' exactly once per ticket; every outcome is logged (no exception, so the log row survives).
create function public.consume_privacy_export(p_id uuid, p_token text) returns text
language plpgsql security definer set search_path=public, extensions as $$
declare uid uuid := auth.uid(); e privacy_exports; outcome text;
begin
  if uid is null then return 'denied'; end if;
  select * into e from privacy_exports x where x.id = p_id for update;
  if not found or e.user_id <> uid or e.token_hash <> encode(digest(coalesce(p_token,''), 'sha256'), 'hex') then
    outcome := 'denied';
  elsif e.consumed_at is not null then
    outcome := 'reused';
  elsif e.expires_at <= now() then
    outcome := 'expired';
  else
    update privacy_exports set consumed_at = now() where privacy_exports.id = e.id;
    outcome := 'downloaded';
  end if;
  insert into privacy_access_log(user_id, export_id, action)
  values (uid, case when e.user_id = uid then e.id end, outcome);
  return case when outcome = 'downloaded' then 'ok' else outcome end;
end $$;
revoke all on function public.create_privacy_export(), public.consume_privacy_export(uuid, text) from public, anon;
grant execute on function public.create_privacy_export(), public.consume_privacy_export(uuid, text) to authenticated;
