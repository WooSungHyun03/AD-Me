-- D086: operational statistics for the admin health view. Sizes and counts only (no rows, no personal data).
create function public.ops_stats() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not is_admin() and coalesce(auth.role(), '') <> 'service_role' then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'auth_users', (select count(*) from auth.users),
    'active_users_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
    'migration', (select max(version) from supabase_migrations.schema_migrations),
    'last_retention', (select jsonb_build_object('status', status, 'at', started_at) from retention_runs order by id desc limit 1),
    'rows', jsonb_build_object(
      'creators', (select count(*) from creators), 'campaigns', (select count(*) from campaigns),
      'proposals', (select count(*) from proposals), 'messages', (select count(*) from messages),
      'notifications', (select count(*) from notifications), 'uploads', (select count(*) from uploads where status = 'ready')));
end $$;
revoke all on function public.ops_stats() from public, anon;
grant execute on function public.ops_stats() to authenticated, service_role;
