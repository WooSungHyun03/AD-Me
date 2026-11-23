-- D040: private CRM notes (separate table/permissions from proposal messages) and saved 2–3 person comparisons.
create table public.creator_notes(
  owner_id uuid not null references profiles(id) on delete cascade,
  creator_id text not null references creators(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, creator_id)
);
alter table creator_notes enable row level security;
create policy creator_notes_own on creator_notes for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Not even admins read private notes through the API.

create table public.compare_reports(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  creator_ids text[] not null check (cardinality(creator_ids) between 2 and 3),
  share text not null default 'private' check (share in ('private','link')),
  share_token text unique check ((share = 'link') = (share_token is not null)),
  created_at timestamptz not null default now()
);
create index on compare_reports(owner_id, created_at desc);
alter table compare_reports enable row level security;
create policy compare_reports_own on compare_reports for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Turning link sharing on mints an unguessable token; turning it off revokes it.
create function public.set_compare_share() returns trigger language plpgsql set search_path=public, extensions as $$
begin
  if new.share = 'link' and (tg_op = 'INSERT' or old.share <> 'link') then
    new.share_token := encode(gen_random_bytes(18), 'hex');
  elsif new.share = 'private' then
    new.share_token := null;
  elsif tg_op = 'UPDATE' then
    new.share_token := old.share_token; -- clients cannot choose a token
  end if;
  return new;
end $$;
create trigger adme_compare_share before insert or update on compare_reports
  for each row execute function set_compare_share();

-- Shared view: title + creator ids only. Never the owner, notes or anything campaign-related.
create function public.shared_compare(p_token text) returns table(title text, creator_ids text[])
language sql stable security definer set search_path=public as $$
  select title, creator_ids from compare_reports where share = 'link' and share_token = p_token and length(p_token) = 36
$$;
revoke all on function public.shared_compare(text) from public;
grant execute on function public.shared_compare(text) to anon, authenticated;
