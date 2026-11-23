-- D059: owner publication preference and operator lock are independent.
begin;
alter table public.creators add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
alter table public.campaigns add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
create table public.moderation_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  entity_kind text not null check (entity_kind in ('creator','campaign')),
  entity_id text not null,
  previous_status text not null,
  next_status text not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from public, anon, authenticated;
grant select on public.moderation_events to authenticated;
create policy moderation_events_admin on public.moderation_events for select to authenticated using(public.is_admin());

create function public.guard_moderation_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if old.moderation_status = 'restricted' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock prevents delete and recreate' using errcode = '42501';
    end if;
    return old;
  end if;
  if (TG_OP = 'INSERT' and new.moderation_status <> 'allowed')
     or (TG_OP = 'UPDATE' and (new.moderation_status is distinct from old.moderation_status)) then
    -- Only the guarded SECURITY DEFINER RPC (postgres) can change a lock.
    -- Even an administrator's direct REST UPDATE must go through the audited RPC.
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock is managed by operators' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_moderation_lock() from public, anon, authenticated;
create trigger creators_moderation_lock before insert or update or delete on public.creators for each row execute function public.guard_moderation_lock();
create trigger campaigns_moderation_lock before insert or update or delete on public.campaigns for each row execute function public.guard_moderation_lock();

drop policy creators_read on public.creators;
create policy creators_read on public.creators for select using(
  (published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
drop policy campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using(
  (status='published' and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
-- Prevent direct proposals using a locked creator/campaign even when caller owns that row.
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert with check (
  status='pending' and exists (
    select 1 from public.campaigns ca join public.creators cr on cr.id=creator_id
    where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((kind='proposal' and brand_id=auth.uid() and public.my_role()='brand')
        or (kind='application' and creator_user_id=auth.uid() and public.my_role()='creator' and ca.status='published'))
  )
);

create function public.moderate_entity(p_kind text,p_id text,p_published boolean,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous text; desired text := case when p_published then 'allowed' else 'restricted' end;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'moderation reason required' using errcode='22023';
  end if;
  if p_kind='creator' then
    select moderation_status into previous from public.creators where id=p_id for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.creators set moderation_status=desired where id=p_id;
  elsif p_kind='campaign' then
    select moderation_status into previous from public.campaigns where id=p_id::uuid for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.campaigns set moderation_status=desired where id=p_id::uuid;
  else raise exception 'invalid entity' using errcode='22023'; end if;
  if previous=desired then return; end if;
  insert into public.moderation_events(actor_id,entity_kind,entity_id,previous_status,next_status,reason)
    values(auth.uid(),p_kind,p_id,previous,desired,btrim(p_reason));
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p_id,'moderate:'||p_kind||':'||desired);
end;
$$;
-- Preserve the old signature; deny unaudited old-client changes until upgraded.
create or replace function public.moderate_entity(p_kind text,p_id text,p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  raise exception 'moderation reason required; upgrade client' using errcode='22023';
end;
$$;
revoke all on function public.moderate_entity(text,text,boolean,text) from public, anon;
grant execute on function public.moderate_entity(text,text,boolean,text) to authenticated;

create or replace function public.active_hot_creators()
returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,c.profile,max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and e.sku='creator_hot'
    and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile order by max(e.expires_at) desc limit 6;
$$;
commit;
