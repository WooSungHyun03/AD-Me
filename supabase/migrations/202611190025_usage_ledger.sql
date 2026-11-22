-- D069: TEST entitlement usage ledger. entitlements.credits is the available balance; every change is written to
-- credit_ledger in the same transaction. Usage is reserve → finalize | release (idempotent per owner+request key).
-- Expiry is decided by the DB clock (now()); expired or revoked entitlements can never be re-activated.
-- TEST billing only: free_beta access never reads entitlements.
alter table entitlements alter column order_id drop not null;
alter table entitlements
  add column grant_reason text not null default 'purchase' check (grant_reason in ('purchase','admin_grant')),
  add column grant_note text check (grant_note is null or length(grant_note) between 5 and 300),
  add column granted_by uuid references profiles(id) on delete set null,
  add column revoked_at timestamptz,
  add column revoke_reason text check (revoke_reason is null or length(revoke_reason) between 5 and 300),
  add constraint entitlement_source check ((grant_reason = 'purchase') = (order_id is not null)
                                          and (grant_reason <> 'admin_grant' or grant_note is not null)),
  add constraint credits_nonnegative check (credits >= 0);
revoke insert, update, delete on entitlements from anon, authenticated;
revoke insert, update, delete on orders from anon, authenticated;

create function public.entitlement_guard() returns trigger language plpgsql set search_path=public as $$
begin
  if old.revoked_at is not null and new.revoked_at is null then raise exception 'entitlement_revoked'; end if;
  if new.expires_at > old.expires_at or new.starts_at <> old.starts_at then raise exception 'entitlement_period_fixed'; end if;
  if new.credits > old.credits and (old.revoked_at is not null or old.expires_at <= now()) then raise exception 'entitlement_inactive'; end if;
  return new;
end $$;
create trigger entitlement_guard before update on entitlements for each row execute function entitlement_guard();

create table public.credit_reservations(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  entitlement_id uuid not null references entitlements(id) on delete cascade,
  amount int not null check (amount between 1 and 100),
  request_key text not null check (request_key ~ '^[A-Za-z0-9:_-]{8,100}$'),
  status text not null default 'reserved' check (status in ('reserved','finalized','released')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (owner_id, request_key)
);
create table public.credit_ledger(
  id bigint generated always as identity primary key,
  entitlement_id uuid not null references entitlements(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('grant','reserve','finalize','release','revoke')),
  delta int not null,
  balance int not null check (balance >= 0),
  reservation_id uuid references credit_reservations(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index on credit_ledger(owner_id, created_at);
alter table credit_reservations enable row level security;
alter table credit_ledger enable row level security;
create policy credit_reservations_read on credit_reservations for select using (owner_id = auth.uid() or is_admin());
create policy credit_ledger_read on credit_ledger for select using (owner_id = auth.uid() or is_admin());
revoke insert, update, delete on credit_reservations, credit_ledger from anon, authenticated;

create function public.entitlement_active(e entitlements) returns boolean language sql stable set search_path=public as $$
  select e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()
$$;

-- Service only (server routes). Serialised per owner by locking that owner's entitlement rows.
create function public.credit_reserve(p_owner uuid, p_amount int, p_key text) returns uuid
language plpgsql security definer set search_path=public as $$
declare r credit_reservations; e entitlements;
begin
  perform 1 from entitlements where owner_id = p_owner for update;
  select * into r from credit_reservations where owner_id = p_owner and request_key = p_key;
  if found then
    if r.amount <> p_amount then raise exception 'request_key_reused'; end if;
    return r.id; -- same request again: no second charge
  end if;
  select * into e from entitlements x where x.owner_id = p_owner and entitlement_active(x) and x.credits >= p_amount
    order by x.expires_at limit 1;
  if not found then raise exception 'insufficient_credits'; end if;
  update entitlements set credits = credits - p_amount where id = e.id;
  insert into credit_reservations(owner_id, entitlement_id, amount, request_key)
    values (p_owner, e.id, p_amount, p_key) returning * into r;
  insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, reservation_id)
    values (e.id, p_owner, 'reserve', -p_amount, e.credits - p_amount, r.id);
  return r.id;
end $$;

create function public.credit_settle(p_reservation uuid, p_finalize boolean) returns text
language plpgsql security definer set search_path=public as $$
declare r credit_reservations; e entitlements;
begin
  select * into r from credit_reservations where id = p_reservation for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'reserved' then
    if r.status = (case when p_finalize then 'finalized' else 'released' end) then return r.status; end if; -- idempotent
    raise exception 'already_settled';
  end if;
  select * into e from entitlements where id = r.entitlement_id for update;
  if p_finalize and (r.expires_at <= now() or not entitlement_active(e)) then raise exception 'reservation_expired'; end if;
  if p_finalize then
    update credit_reservations set status = 'finalized', settled_at = now() where id = r.id;
    insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, reservation_id)
      values (e.id, r.owner_id, 'finalize', 0, e.credits, r.id);
    return 'finalized';
  end if;
  update credit_reservations set status = 'released', settled_at = now() where id = r.id;
  -- Credits return only to a still-active entitlement (never revives an expired/revoked one).
  if entitlement_active(e) then
    update entitlements set credits = credits + r.amount where id = e.id;
    insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, reservation_id)
      values (e.id, r.owner_id, 'release', r.amount, e.credits + r.amount, r.id);
  else
    insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, reservation_id, note)
      values (e.id, r.owner_id, 'release', 0, e.credits, r.id, 'entitlement inactive: not refunded');
  end if;
  return 'released';
end $$;

-- Reservations whose lease ran out are released (returns the count). Service/cron.
create function public.release_stale_reservations() returns int language plpgsql security definer set search_path=public as $$
declare x uuid; n int := 0;
begin
  for x in select id from credit_reservations where status = 'reserved' and expires_at <= now() loop
    perform credit_settle(x, false); n := n + 1;
  end loop;
  return n;
end $$;

create function public.admin_grant_entitlement(p_owner uuid, p_sku text, p_days int, p_credits int, p_note text) returns uuid
language plpgsql security definer set search_path=public as $$
declare item products; v uuid;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into item from products where sku = p_sku;
  if not found or (select role from profiles where id = p_owner) is distinct from item.role then raise exception 'invalid_grant'; end if;
  if p_days not between 1 and 90 or p_credits not between 0 and 1000 then raise exception 'invalid_grant'; end if;
  if length(trim(coalesce(p_note, ''))) < 5 then raise exception 'reason_required'; end if;
  insert into entitlements(owner_id, sku, expires_at, credits, grant_reason, grant_note, granted_by)
    values (p_owner, p_sku, now() + make_interval(days => p_days), p_credits, 'admin_grant', trim(p_note), auth.uid()) returning id into v;
  insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, actor_id, note)
    values (v, p_owner, 'grant', p_credits, p_credits, auth.uid(), trim(p_note));
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), v::text, 'entitlement:grant');
  return v;
end $$;

-- Cancel/recover: zero the balance, close open reservations without refund, cancel the TEST order.
create function public.revoke_entitlement(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare e entitlements;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason_required'; end if;
  select * into e from entitlements where id = p_id for update;
  if not found or e.revoked_at is not null then raise exception 'not_found'; end if;
  update credit_reservations set status = 'released', settled_at = now() where entitlement_id = e.id and status = 'reserved';
  update entitlements set credits = 0, revoked_at = now(), revoke_reason = trim(p_reason) where id = e.id;
  if e.order_id is not null then update orders set status = 'cancelled' where id = e.order_id; end if;
  insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, actor_id, note)
    values (e.id, e.owner_id, 'revoke', -e.credits, 0, auth.uid(), trim(p_reason));
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), e.id::text, 'entitlement:revoke');
end $$;

-- Purchases write their opening ledger row too (balance history starts at the grant).
create function public.entitlement_opening() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.grant_reason = 'purchase' then
    insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, note) values (new.id, new.owner_id, 'grant', new.credits, new.credits, 'purchase');
  end if;
  return new;
end $$;
create trigger entitlement_opening after insert on entitlements for each row execute function entitlement_opening();

create or replace function public.active_hot_creators() returns table(creator_id text, profile jsonb, expires_at timestamptz)
language sql stable security definer set search_path=public as $$
  select c.id, c.profile, max(e.expires_at) from creators c join entitlements e on e.owner_id = c.owner_id
  left join orders o on o.id = e.order_id
  where c.published and e.sku = 'creator_hot' and entitlement_active(e) and (e.order_id is null or o.status = 'paid')
  group by c.id, c.profile order by max(e.expires_at) desc limit 6
$$;

revoke all on function public.entitlement_guard(), public.entitlement_opening() from public, anon, authenticated;
revoke all on function public.credit_reserve(uuid, int, text), public.credit_settle(uuid, boolean), public.release_stale_reservations() from public, anon, authenticated;
grant execute on function public.credit_reserve(uuid, int, text), public.credit_settle(uuid, boolean), public.release_stale_reservations() to service_role;
revoke all on function public.admin_grant_entitlement(uuid, text, int, int, text), public.revoke_entitlement(uuid, text) from public, anon;
grant execute on function public.admin_grant_entitlement(uuid, text, int, int, text), public.revoke_entitlement(uuid, text) to authenticated;
