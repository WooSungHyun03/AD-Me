-- D075: preserve safe public-reference gateways after main retires saved_creators.
begin;
create or replace function adme_creator.saved_catalog()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c))order by c.id collate "C")
 from public.saved_list_items s join public.saved_lists l on l.id=s.list_id and l.owner_id=s.owner_id join public.creators c on c.id=s.creator_id
 where s.owner_id=auth.uid()and l.is_default),'[]'::jsonb);
end;$$;
create or replace function adme_creator.toggle_saved(p_ref text)returns boolean language plpgsql security definer set search_path=''as $$
declare id_value text;existed boolean;list_value uuid;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);if id_value is null then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 select id into list_value from public.saved_lists where owner_id=auth.uid()and is_default;
 if list_value is not null then
  delete from public.saved_list_items where list_id=list_value and owner_id=auth.uid()and creator_id=id_value returning true into existed;
  if coalesce(existed,false)then return false;end if;
 end if;
 if not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 list_value:=public.ensure_default_list();if list_value is null then raise check_violation using message='default list unavailable';end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(list_value,auth.uid(),id_value);return true;
end;$$;
revoke all on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)to authenticated;
notify pgrst,'reload schema';
commit;
