-- D079: retention rules, deletion tombstones and their re-application after a backup restore.
-- Separation rule: tombstones hold only ids and sha256 key hashes (never the deleted content), and do not link
-- to the report that asked for the deletion. The request evidence (reports) and the content (creators) live apart.

create function public.key_hash(k text) returns text language sql immutable set search_path=public, extensions as $$
  select case when k like 'h:%' then k else 'h:' || encode(digest(k, 'sha256'), 'hex') end
$$;

-- Suppression keys were raw urls/handles of deleted profiles; keep only their hashes.
update suppressed_sources set match_key = key_hash(match_key) where match_key not like 'h:%';
create function public.hash_suppressed_key() returns trigger language plpgsql set search_path=public as $$
begin new.match_key := key_hash(new.match_key); return new; end $$;
create trigger adme_suppressed_hash before insert or update on suppressed_sources
  for each row execute function public.hash_suppressed_key();
create or replace function public.guard_suppressed_creator() returns trigger language plpgsql set search_path=public as $$
begin
  if new.owner_id is null and (tg_op = 'INSERT' or (new.published and not old.published))
     and exists(select 1 from suppressed_sources s
                where s.match_key in (select key_hash(k) from unnest(creator_match_keys(new.id, new.profile)) k)) then
    raise exception 'suppressed_source';
  end if;
  return new;
end $$;

create table public.deletion_tombstones(
  id bigint generated always as identity primary key,
  subject_kind text not null check (subject_kind in ('collected_profile','owner_profile','upload')),
  subject_id text not null,
  key_hashes text[] not null default '{}' check (array_to_string(key_hashes, ',') !~ '[^h:0-9a-f,]'),
  requested_at timestamptz not null default now(),
  unique (subject_kind, subject_id)
);
alter table deletion_tombstones enable row level security;
create policy tombstones_admin_read on deletion_tombstones for select using (is_admin());
revoke insert, update, delete on deletion_tombstones from anon, authenticated;

-- Record a tombstone whenever a deletion happens, whatever path performed it.
create function public.tombstone_creator() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.owner_id is null and new.profile->>'name' = '삭제된 프로필' and old.profile->>'name' is distinct from '삭제된 프로필' then
    insert into deletion_tombstones(subject_kind, subject_id, key_hashes)
    values ('collected_profile', new.id, (select coalesce(array_agg(key_hash(k)), '{}') from unnest(creator_match_keys(old.id, old.profile)) k))
    on conflict do nothing;
  elsif new.profile->>'data_source' = 'owner_removed' and old.profile->>'data_source' is distinct from 'owner_removed' then
    insert into deletion_tombstones(subject_kind, subject_id) values ('owner_profile', new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger adme_creator_tombstone after update on creators for each row execute function public.tombstone_creator();
-- An owner re-registering after deletion is their own new choice: drop the owner tombstone so a later restore
-- does not wipe the new profile.
create function public.untombstone_owner() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.profile->>'data_source' is distinct from 'owner_removed' and old.profile->>'data_source' = 'owner_removed' then
    delete from deletion_tombstones where subject_kind = 'owner_profile' and subject_id = new.id;
  end if;
  return new;
end $$;
create trigger adme_creator_untombstone after update on creators for each row execute function public.untombstone_owner();
create function public.tombstone_upload() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'deleted' and old.status <> 'deleted' then
    insert into deletion_tombstones(subject_kind, subject_id) values ('upload', new.id::text) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger adme_upload_tombstone after update on uploads for each row execute function public.tombstone_upload();

-- Backfill: deletions that happened before this migration.
insert into deletion_tombstones(subject_kind, subject_id)
select 'collected_profile', id from creators where owner_id is null and profile->>'name' = '삭제된 프로필'
union all select 'owner_profile', id from creators where profile->>'data_source' = 'owner_removed'
union all select 'upload', id::text from uploads where status = 'deleted'
on conflict do nothing;

-- Off-database copy of the tombstones (ids + hashes only), taken by the server after each deletion.
create function public.tombstone_ledger() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('subject_kind', subject_kind, 'subject_id', subject_id,
    'key_hashes', key_hashes, 'requested_at', requested_at) order by id), '[]') from deletion_tombstones
$$;

-- After restoring a backup: merge the off-database ledger, then re-apply every deletion. Idempotent (retry-safe).
create function public.reapply_tombstones(p_ledger jsonb default '[]') returns jsonb
language plpgsql security definer set search_path=public as $$
declare n_keys int; n_collected int; n_owner int; n_upload int; n_merged int;
begin
  insert into deletion_tombstones(subject_kind, subject_id, key_hashes, requested_at)
  select l.subject_kind, l.subject_id, coalesce(l.key_hashes, '{}'), coalesce(l.requested_at, now())
  from jsonb_to_recordset(coalesce(p_ledger, '[]')) as l(subject_kind text, subject_id text, key_hashes text[], requested_at timestamptz)
  on conflict do nothing;
  get diagnostics n_merged = row_count;

  insert into suppressed_sources(match_key)
  select distinct unnest(key_hashes) from deletion_tombstones where subject_kind = 'collected_profile'
  on conflict do nothing;
  get diagnostics n_keys = row_count;

  update creators c set published = false, moderation_locked = true,
    profile = jsonb_build_object('name','삭제된 프로필','bio','','handle','','categories','[]'::jsonb,'vibes','[]'::jsonb,
      'formats','[]'::jsonb,'platforms','[]'::jsonb,'price_min_krw',null,'price_max_krw',null,'followers',0,
      'is_available',null,'is_demo',coalesce((c.profile->>'is_demo')::boolean,false))
  where c.owner_id is null and c.profile->>'name' is distinct from '삭제된 프로필'
    and exists(select 1 from deletion_tombstones t where t.subject_kind = 'collected_profile'
      and (t.subject_id = c.id or t.key_hashes && (select array_agg(key_hash(k)) from unnest(creator_match_keys(c.id, c.profile)) k)));
  get diagnostics n_collected = row_count;

  update creators c set published = false,
    profile = jsonb_build_object('seed_id','user-' || c.owner_id,'name','삭제된 크리에이터','handle','deleted','bio','',
      'categories','[]'::jsonb,'vibes','[]'::jsonb,'formats','[]'::jsonb,'platforms','[]'::jsonb,'price_min_krw',0,
      'price_max_krw',0,'followers',0,'is_available',false,'published',false,'is_demo',false,'metrics_source','unavailable',
      'data_source','owner_removed','owner_id',c.owner_id,'source_url',null,'portrait_asset',null,'image_placeholder','initials')
  where c.profile->>'data_source' is distinct from 'owner_removed'
    and exists(select 1 from deletion_tombstones t where t.subject_kind = 'owner_profile' and t.subject_id = c.id);
  get diagnostics n_owner = row_count;

  -- The storage object is removed by the upload sweep (rows marked deleted are swept, then purged).
  update uploads u set status = 'deleted', deleted_at = now()
  where u.status = 'ready' and exists(select 1 from deletion_tombstones t where t.subject_kind = 'upload' and t.subject_id = u.id::text);
  get diagnostics n_upload = row_count;

  return jsonb_build_object('merged', n_merged, 'suppressed_keys', n_keys, 'collected_profiles', n_collected,
    'owner_profiles', n_owner, 'uploads', n_upload);
end $$;

-- Retention job: every run is recorded with its status and per-class counts (never content).
create table public.retention_runs(
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok','failed')),
  counts jsonb not null default '{}',
  error text
);
alter table retention_runs enable row level security;
create policy retention_runs_admin_read on retention_runs for select using (is_admin());
revoke insert, update, delete on retention_runs from anon, authenticated;

-- Periods mirror src/lib/privacy-retention.ts (RETENTION_RULES).
create function public.run_retention(p_now timestamptz default now()) returns jsonb
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
    delete from retention_runs where started_at < p_now - interval '1 year';
    insert into retention_runs(status, counts, finished_at) values ('ok', c, now());
  exception when others then
    -- The partial work above is rolled back; the failure itself is kept so the next run (retry) is visible.
    insert into retention_runs(status, error, finished_at) values ('failed', left(sqlerrm, 200), now());
    return jsonb_build_object('error', left(sqlerrm, 200));
  end;
  return c;
end $$;

-- Server-only (service role, from admin routes / scheduled job). No direct user access.
revoke all on function public.tombstone_ledger() from public, anon, authenticated;
revoke all on function public.reapply_tombstones(jsonb) from public, anon, authenticated;
revoke all on function public.run_retention(timestamptz) from public, anon, authenticated;
grant execute on function public.tombstone_ledger() to service_role;
grant execute on function public.reapply_tombstones(jsonb) to service_role;
grant execute on function public.run_retention(timestamptz) to service_role;
revoke all on function public.tombstone_creator() from public, anon, authenticated;
revoke all on function public.untombstone_owner() from public, anon, authenticated;
revoke all on function public.tombstone_upload() from public, anon, authenticated;
