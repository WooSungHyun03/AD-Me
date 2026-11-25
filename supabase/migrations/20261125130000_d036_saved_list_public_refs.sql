-- DEV-B D036: named candidate groups and campaign shortlists speak public creator references.
-- The browser holds public references (catalog seed_id), never internal creator row IDs. Group
-- membership changes and reads go through authenticated-only gateways that resolve the reference,
-- apply the same catalog visibility gate as the default favourite toggle, and confine every row to
-- the caller's own lists. Existing saved_lists/saved_list_items rows, RLS and triggers are unchanged.
begin;

-- Add a visible catalog creator to one of the caller's lists. Retry-safe: a repeated add returns
-- 'exists' without a second row. Unknown, hidden or foreign lists/creators are indistinguishable.
create function adme_creator.list_add(p_list uuid,p_ref text)returns text language plpgsql volatile security definer set search_path=''as $$
declare id_value text;inserted int;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_list is null or p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 if not exists(select 1 from public.saved_lists l where l.id=p_list and l.owner_id=auth.uid())then raise insufficient_privilege;end if;
 id_value:=adme_creator.resolve_reference(p_ref);
 if id_value is null or not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(p_list,auth.uid(),id_value)on conflict(list_id,creator_id)do nothing;
 get diagnostics inserted=row_count;
 return case when inserted=1 then 'added' else 'exists' end;
end;$$;

-- Remove by public (or legacy) reference from the caller's own list. Returns false when nothing matched.
create function adme_creator.list_remove(p_list uuid,p_ref text)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare id_value text;removed int;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_list is null or p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);
 if id_value is null then return false;end if;
 delete from public.saved_list_items where list_id=p_list and owner_id=auth.uid()and creator_id=id_value;
 get diagnostics removed=row_count;
 return removed>0;
end;$$;

-- Caller's lists with public item DTOs only: reference + display name while the creator remains
-- catalog-visible. A creator hidden after being saved keeps its row (removable) without its name.
create function adme_creator.my_lists()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'is_default',l.is_default,'campaign_id',l.campaign_id,
   'items',coalesce((select jsonb_agg(jsonb_build_object('ref',adme_creator.public_reference(i.creator_id),'name',d.dto->>'name','visible',d.dto is not null)order by i.created_at,i.creator_id collate "C")
     from public.saved_list_items i join public.creators c on c.id=i.creator_id cross join lateral(select adme_creator.catalog_dto(c)dto)d
     where i.list_id=l.id and i.owner_id=auth.uid()),'[]'::jsonb))
   order by l.is_default desc,l.created_at,l.id)
  from public.saved_lists l where l.owner_id=auth.uid()),'[]'::jsonb);
end;$$;

create function public.add_saved_list_item(p_list uuid,p_ref text)returns text language sql volatile security invoker set search_path=''as $$select adme_creator.list_add($1,$2);$$;
create function public.remove_saved_list_item(p_list uuid,p_ref text)returns boolean language sql volatile security invoker set search_path=''as $$select adme_creator.list_remove($1,$2);$$;
create function public.my_saved_lists()returns jsonb language sql stable security invoker set search_path=''as $$select adme_creator.my_lists();$$;

revoke all on function adme_creator.list_add(uuid,text),adme_creator.list_remove(uuid,text),adme_creator.my_lists(),
 public.add_saved_list_item(uuid,text),public.remove_saved_list_item(uuid,text),public.my_saved_lists()from public,anon,authenticated,service_role;
grant execute on function adme_creator.list_add(uuid,text),adme_creator.list_remove(uuid,text),adme_creator.my_lists(),
 public.add_saved_list_item(uuid,text),public.remove_saved_list_item(uuid,text),public.my_saved_lists()to authenticated;
notify pgrst,'reload schema';
commit;
