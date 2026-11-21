-- Canonical public IDs win over any colliding historical/custom row key.
begin;
create or replace function adme_creator.resolve_reference(p_ref text) returns text language sql stable security definer set search_path='' as $$
 select creator_id from adme_creator.public_refs where public_id=p_ref
 union all
 select creator_id from adme_creator.public_refs where creator_id=p_ref and not exists(select 1 from adme_creator.public_refs where public_id=p_ref)
 limit 1;
$$;
revoke all on function adme_creator.resolve_reference(text) from public,anon,authenticated,service_role;
commit;
