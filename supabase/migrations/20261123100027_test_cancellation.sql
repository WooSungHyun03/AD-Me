-- D068: TEST payment cancellation. Server-only state machine; the provider call lives in the payment-confirm Edge
-- Function (it alone holds the Toss TEST secret). Clients never send a paymentKey: the stored key of an order the
-- caller owns is used, so knowing someone else's paymentKey grants nothing.
-- Policy (TEST): full cancellation only; refused once any credit was finalized (used) or while a reservation is
-- in flight. A successful cancel marks the order cancelled and revokes its entitlement immediately (HOT slot gone).
create table public.payment_cancellations(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  owner_id uuid not null references profiles(id),
  idempotency_key uuid not null unique,
  reason text not null check (length(reason) between 2 and 200),
  status text not null default 'requested' check (status in ('requested','done','failed')),
  provider_status text,
  error_code text check (length(error_code) <= 80),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
-- At most one live (requested/done) cancellation per order; failed attempts may be retried with a new key.
create unique index payment_cancellations_live on payment_cancellations(order_id) where status in ('requested','done');
create index on payment_cancellations(owner_id);
alter table payment_cancellations enable row level security;
create policy cancellations_read on payment_cancellations for select using (owner_id = auth.uid() or is_admin());
revoke insert, update, delete on payment_cancellations from anon, authenticated;

-- Returns the cancellation row to act on plus the stored payment key (service role only).
create function public.begin_test_cancel(p_order uuid, p_owner uuid, p_reason text, p_key uuid)
returns table(cancellation_id uuid, status text, payment_key text)
language plpgsql security definer set search_path=public as $$
declare o orders; c payment_cancellations; e entitlements;
begin
  select * into c from payment_cancellations pc where pc.idempotency_key = p_key;
  if found then
    if c.order_id <> p_order or c.owner_id <> p_owner then raise exception 'idempotency_conflict'; end if;
    return query select c.id, c.status, (select o2.payment_key from orders o2 where o2.id = c.order_id);
    return;
  end if;
  select * into o from orders where id = p_order for update;
  if not found or o.owner_id <> p_owner then raise exception 'not_found'; end if;
  if o.status = 'cancelled' then raise exception 'already_cancelled'; end if;
  if o.status <> 'paid' or o.payment_key is null then raise exception 'not_cancellable'; end if;
  if exists (select 1 from payment_cancellations pc where pc.order_id = o.id and pc.status = 'requested') then
    raise exception 'cancel_in_progress';
  end if;
  select * into e from entitlements where order_id = o.id;
  if found then
    if exists (select 1 from credit_reservations r where r.entitlement_id = e.id and r.status = 'reserved') then
      raise exception 'credits_in_use';
    end if;
    if exists (select 1 from credit_ledger l where l.entitlement_id = e.id and l.kind = 'finalize') then
      raise exception 'credits_used';
    end if;
  end if;
  insert into payment_cancellations(order_id, owner_id, idempotency_key, reason)
    values (o.id, o.owner_id, p_key, trim(p_reason)) returning * into c;
  insert into audit_log(actor_id, entity_id, action) values (p_owner, o.id::text, 'order:cancel_requested');
  return query select c.id, c.status, o.payment_key;
end $$;

-- Records the provider outcome. Idempotent: finishing a finished cancellation returns its status unchanged.
create function public.finish_test_cancel(p_id uuid, p_ok boolean, p_provider_status text, p_error text)
returns text language plpgsql security definer set search_path=public as $$
declare c payment_cancellations; e entitlements;
begin
  select * into c from payment_cancellations where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.status <> 'requested' then return c.status; end if;
  if not p_ok then
    update payment_cancellations set status = 'failed', provider_status = left(p_provider_status, 40),
      error_code = left(p_error, 80), finished_at = now() where id = c.id;
    insert into audit_log(actor_id, entity_id, action) values (c.owner_id, c.order_id::text, 'order:cancel_failed');
    return 'failed';
  end if;
  perform 1 from orders where id = c.order_id for update;
  update orders set status = 'cancelled' where id = c.order_id;
  select * into e from entitlements where order_id = c.order_id for update;
  if found and e.revoked_at is null then
    update credit_reservations set status = 'released', settled_at = now() where entitlement_id = e.id and status = 'reserved';
    update entitlements set credits = 0, revoked_at = now(), revoke_reason = 'TEST 결제 취소' where id = e.id;
    insert into credit_ledger(entitlement_id, owner_id, kind, delta, balance, note)
      values (e.id, e.owner_id, 'revoke', -e.credits, 0, 'TEST 결제 취소');
  end if;
  update payment_cancellations set status = 'done', provider_status = left(p_provider_status, 40), finished_at = now() where id = c.id;
  insert into audit_log(actor_id, entity_id, action) values (c.owner_id, c.order_id::text, 'order:cancelled');
  return 'done';
end $$;
revoke all on function public.begin_test_cancel(uuid, uuid, text, uuid), public.finish_test_cancel(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.begin_test_cancel(uuid, uuid, text, uuid), public.finish_test_cancel(uuid, boolean, text, text) to service_role;
