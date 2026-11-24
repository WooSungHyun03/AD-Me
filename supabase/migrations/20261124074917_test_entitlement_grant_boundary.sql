-- D001: manual TEST grants obey the same database boundary as paid TEST orders.
-- Preserve the existing RPC signature, administrator/MFA check, audit and recovery.
begin;
create or replace function public.admin_grant_entitlement(p_owner uuid, p_sku text, p_days int, p_credits int, p_note text) returns uuid
language plpgsql security definer set search_path=public as $$
declare item products; v uuid;
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not adme_release.billing_enabled() then
    raise exception 'TEST billing disabled' using errcode = 'PT404';
  end if;
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
revoke all on function public.admin_grant_entitlement(uuid,text,int,int,text) from public,anon,service_role;
grant execute on function public.admin_grant_entitlement(uuid,text,int,int,text) to authenticated;
notify pgrst,'reload schema';
commit;
