-- Forward hardening: callers may check only their own active state, not probe arbitrary actors.
begin;
create function adme_privacy.request_allowed()returns boolean language sql stable security definer set search_path='' as $$select adme_privacy.actor_active(auth.uid());$$;
revoke all on function adme_privacy.request_allowed() from public,anon,authenticated,service_role;
grant execute on function adme_privacy.request_allowed() to anon,authenticated,service_role;
do $$declare item record;begin
 for item in select schemaname,tablename from pg_policies where policyname='deletion_actor_restriction'loop
  execute format('alter policy deletion_actor_restriction on %I.%I using(adme_privacy.request_allowed()) with check(adme_privacy.request_allowed())',item.schemaname,item.tablename);
 end loop;
end;$$;
alter policy deletion_storage_restriction on storage.objects with check(adme_privacy.request_allowed());
alter function public.account_access() security definer;
revoke all on function adme_privacy.actor_active(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
