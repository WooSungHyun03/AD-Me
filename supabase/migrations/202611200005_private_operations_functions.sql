begin;
-- Keep privileged code in the private, non-exposed schema.
grant usage on schema adme_ops to anon, authenticated;
revoke all on function adme_ops.staff_role(), adme_ops.daily_tick(),
  adme_ops.verify_worker(text), adme_ops.capture_ownership()
  from public, anon, authenticated;
alter function public.ops_current_role() set schema adme_ops;
create function public.ops_current_role() returns text
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_current_role();
$$;
revoke all on function public.ops_current_role() from public,anon,authenticated;
grant execute on function public.ops_current_role() to authenticated;

alter function public.ops_dashboard() set schema adme_ops;
create function public.ops_dashboard() returns jsonb
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_dashboard();
$$;
revoke all on function public.ops_dashboard() from public,anon,authenticated;
grant execute on function public.ops_dashboard() to authenticated;

alter function public.ops_admin_command(text,text,text) set schema adme_ops;
create function public.ops_admin_command(p_action text,p_value text,p_extra text default '') returns void
language sql security invoker set search_path='' as $$
  select adme_ops.ops_admin_command($1,$2,$3);
$$;
revoke all on function public.ops_admin_command(text,text,text) from public,anon,authenticated;
grant execute on function public.ops_admin_command(text,text,text) to authenticated;

alter function public.ops_draft_create(text) set schema adme_ops;
create function public.ops_draft_create(p_input text) returns uuid
language sql security invoker set search_path='' as $$
  select adme_ops.ops_draft_create($1);
$$;
revoke all on function public.ops_draft_create(text) from public,anon,authenticated;
grant execute on function public.ops_draft_create(text) to authenticated;

alter function public.ops_draft_get(uuid) set schema adme_ops;
create function public.ops_draft_get(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_draft_get($1);
$$;
revoke all on function public.ops_draft_get(uuid) from public,anon,authenticated;
grant execute on function public.ops_draft_get(uuid) to authenticated;

alter function public.ops_worker_claim(text) set schema adme_ops;
create function public.ops_worker_claim(p_token text) returns jsonb
language sql security invoker set search_path='' as $$
  select adme_ops.ops_worker_claim($1);
$$;
revoke all on function public.ops_worker_claim(text) from public,anon,authenticated;
grant execute on function public.ops_worker_claim(text) to anon;

alter function public.ops_worker_finish(text,uuid,uuid,jsonb,text,int) set schema adme_ops;
create function public.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed int) returns boolean
language sql security invoker set search_path='' as $$
  select adme_ops.ops_worker_finish($1,$2,$3,$4,$5,$6);
$$;
revoke all on function public.ops_worker_finish(text,uuid,uuid,jsonb,text,int) from public,anon,authenticated;
grant execute on function public.ops_worker_finish(text,uuid,uuid,jsonb,text,int) to anon;

alter function public.ops_own_channels() set schema adme_ops;
create function public.ops_own_channels() returns jsonb
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_own_channels();
$$;
revoke all on function public.ops_own_channels() from public,anon,authenticated;
grant execute on function public.ops_own_channels() to authenticated;

alter function public.ops_channel_owner(text,text) set schema adme_ops;
create function public.ops_channel_owner(p_action text,p_channel text) returns void
language sql security invoker set search_path='' as $$
  select adme_ops.ops_channel_owner($1,$2);
$$;
revoke all on function public.ops_channel_owner(text,text) from public,anon,authenticated;
grant execute on function public.ops_channel_owner(text,text) to authenticated;

alter function public.ops_public_channels(text) set schema adme_ops;
create function public.ops_public_channels(p_query text default '') returns jsonb
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_public_channels($1);
$$;
revoke all on function public.ops_public_channels(text) from public,anon,authenticated;
grant execute on function public.ops_public_channels(text) to anon,authenticated;

commit;
