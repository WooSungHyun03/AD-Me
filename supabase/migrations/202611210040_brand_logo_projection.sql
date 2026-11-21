begin;
create function public.brand_logo_available(p_brand uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform adme_ops.require_quota('brand_logo_meta',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 return exists(select 1 from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified');
end;
$$;
revoke all on function public.brand_logo_available(uuid) from public,anon,authenticated,service_role;
grant execute on function public.brand_logo_available(uuid) to anon,authenticated;
commit;
