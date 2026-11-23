-- D076: all public catalog pages pass the DB-owned atomic quota boundary.
begin;
alter function adme_creator.catalog_page(text,int) rename to catalog_page_rows;
revoke all on function adme_creator.catalog_page_rows(text,int) from public,anon,authenticated,service_role;
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),
    case when auth.uid() is null then 300 else 60 end,60);
  return adme_creator.catalog_page_rows(p_after,p_limit);
end;
$$;
create or replace function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql volatile security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;
notify pgrst,'reload schema';
commit;
