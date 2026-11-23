-- D036: named candidate groups and per-campaign shortlists. Owner-scoped (no team model yet).
create table public.saved_lists(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  campaign_id uuid references campaigns(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  check (not (is_default and campaign_id is not null))
);
create unique index saved_lists_one_default on saved_lists(owner_id) where is_default;
create unique index saved_lists_one_per_campaign on saved_lists(campaign_id) where campaign_id is not null;

create table public.saved_list_items(
  list_id uuid not null references saved_lists(id) on delete cascade,
  creator_id text not null references creators(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, creator_id)
);
create index on saved_list_items(owner_id);

alter table saved_lists enable row level security;
alter table saved_list_items enable row level security;
-- A list may only point at a campaign the same user owns; checked on insert and update.
create policy lists_own on saved_lists for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (campaign_id is null or exists(
    select 1 from campaigns c where c.id = campaign_id and c.owner_id = auth.uid())));
create policy list_items_own on saved_list_items for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists(select 1 from saved_lists l where l.id = list_id and l.owner_id = auth.uid()));

-- Default list flag and campaign link are fixed once created; the default list cannot be deleted by users.
create function public.guard_saved_list() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'DELETE' then
      if old.is_default then raise exception 'default_list_locked'; end if;
      return old;
    end if;
    if tg_op = 'UPDATE' and (new.is_default is distinct from old.is_default or new.campaign_id is distinct from old.campaign_id) then
      raise exception 'list_scope_locked';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger adme_saved_list_guard before update or delete on saved_lists
  for each row execute function public.guard_saved_list();

-- SECURITY INVOKER: creates the caller's default list under RLS if missing.
create function public.ensure_default_list() returns uuid language plpgsql set search_path=public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select id into v from saved_lists where owner_id = auth.uid() and is_default;
  if v is null then
    insert into saved_lists(owner_id, name, is_default) values (auth.uid(), '기본 목록', true)
      on conflict do nothing returning id into v;
    if v is null then select id into v from saved_lists where owner_id = auth.uid() and is_default; end if;
  end if;
  return v;
end $$;
revoke all on function public.ensure_default_list() from public, anon;
grant execute on function public.ensure_default_list() to authenticated;

-- Migrate existing favorites into each owner's default list, then retire the old table.
insert into saved_lists(owner_id, name, is_default)
  select distinct owner_id, '기본 목록', true from saved_creators;
insert into saved_list_items(list_id, creator_id, owner_id, created_at)
  select l.id, s.creator_id, s.owner_id, s.created_at from saved_creators s join saved_lists l on l.owner_id = s.owner_id and l.is_default;
drop table saved_creators;
