-- D027: private file uploads. Objects live in a private bucket under <owner uuid>/<random uuid>.<ext>.
-- Browsers can never write to storage directly: the server verifies size/extension/magic bytes, then writes with
-- the server-only key. Owners read through short signed URLs; references and deletions are tracked here.

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('private-uploads', 'private-uploads', false, 5242880,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.uploads(
  id uuid primary key,
  owner_id uuid not null references profiles(id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$'),
  mime text not null check (mime in ('image/png','image/jpeg','image/webp','application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  original_name text not null check (length(original_name) between 1 and 120),
  purpose text not null default 'portfolio' check (purpose in ('portfolio')),
  rights_confirmed boolean not null check (rights_confirmed), -- uploader attests they hold the rights
  status text not null default 'ready' check (status in ('ready','deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (split_part(path, '/', 1) = owner_id::text and split_part(split_part(path, '/', 2), '.', 1) = id::text)
);
create index on uploads(owner_id, created_at desc);
create index on uploads(status, deleted_at);
alter table uploads enable row level security;
create policy uploads_read on uploads for select using (owner_id = auth.uid() and status = 'ready');
revoke insert, update, delete on uploads from anon, authenticated;

-- Owner removes a reference; the object itself is removed by the server right away and by the sweep job as backup.
create function public.delete_upload(p_id uuid) returns text
language plpgsql security definer set search_path=public as $$
begin
  update uploads set status = 'deleted', deleted_at = now()
  where id = p_id and owner_id = auth.uid() and status = 'ready';
  if not found then raise exception 'not_found'; end if;
  return 'deleted';
end $$;
revoke all on function public.delete_upload(uuid) from public, anon;
grant execute on function public.delete_upload(uuid) to authenticated;

-- Storage: only the owner may read (sign) an object, and only while its reference is live.
-- No insert/update/delete policy for anon/authenticated: direct uploads, overwrites and deletes are refused.
create policy private_uploads_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'private-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.uploads u where u.path = objects.name and u.owner_id = auth.uid() and u.status = 'ready'));

-- The unused 0001 'portfolios' bucket let browsers upload unverified files straight into storage. Close that
-- bypass: no more direct inserts/deletes there (owner read kept for any existing objects).
drop policy if exists portfolio_insert on storage.objects;
drop policy if exists portfolio_delete on storage.objects;
