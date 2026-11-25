-- DEV-B D038: CSV shortlist import commits public creator references in one transaction.
-- The import route previously read public.creators directly, which the creator read boundary
-- (D075) denies to brands, so every row failed. This authenticated-only gateway resolves each
-- reference, applies the same catalog visibility gate as add_saved_list_item, confines the
-- write to the caller's own list and is all-or-nothing. Existing tables and RLS are unchanged.
begin;

create function adme_creator.list_import(p_list uuid,p_refs text[])returns int language plpgsql volatile security definer set search_path=''as $$
declare r text;id_value text;added int:=0;n int;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_list is null or p_refs is null or cardinality(p_refs)not between 1 and 500 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('saved_list_import',auth.uid()::text,20,3600);
 if not exists(select 1 from public.saved_lists l where l.id=p_list and l.owner_id=auth.uid())then raise insufficient_privilege;end if;
 foreach r in array p_refs loop
  if r is null or length(r)not between 1 and 100 then raise invalid_parameter_value;end if;
  id_value:=adme_creator.resolve_reference(r);
  -- Any hidden/unknown reference aborts the whole import; the route re-validates rows first.
  if id_value is null or not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
  insert into public.saved_list_items(list_id,owner_id,creator_id)values(p_list,auth.uid(),id_value)on conflict(list_id,creator_id)do nothing;
  get diagnostics n=row_count;added:=added+n;
 end loop;
 return added;
end;$$;

create function public.import_saved_list_items(p_list uuid,p_refs text[])returns int language sql volatile security invoker set search_path=''as $$select adme_creator.list_import($1,$2);$$;

revoke all on function adme_creator.list_import(uuid,text[]),public.import_saved_list_items(uuid,text[])from public,anon,authenticated,service_role;
grant execute on function adme_creator.list_import(uuid,text[]),public.import_saved_list_items(uuid,text[])to authenticated;
notify pgrst,'reload schema';
commit;
