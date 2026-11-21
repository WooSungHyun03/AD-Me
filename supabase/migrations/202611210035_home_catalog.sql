-- D081: current public catalogue, never inferred verified identities.
begin;
create function adme_creator.home_summary(p_demo boolean) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare total_count int; demo_count int; samples jsonb;
begin
 if p_demo is null then raise invalid_parameter_value; end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 with rows as materialized(select cr.id,adme_creator.catalog_dto(cr) dto from public.creators cr),
 visible as(select id,dto from rows where dto is not null and (p_demo or dto->'is_demo'='false'::jsonb)),
 numbered as(select *,row_number() over(order by id collate "C") n from visible)
 select count(*)::int,count(*) filter(where dto->'is_demo'='true'::jsonb)::int,
 coalesce(jsonb_agg(dto order by id collate "C") filter(where n<=3),'[]'::jsonb) into total_count,demo_count,samples from numbered;
 return jsonb_build_object('version',1,'total',total_count,'demo',demo_count,'registered',total_count-demo_count,'asOf',statement_timestamp(),'featured',samples);
end;
$$;
create function public.creator_home_summary(p_demo boolean default false) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_creator.home_summary($1); $$;
revoke all on function adme_creator.home_summary(boolean),public.creator_home_summary(boolean) from public,anon,authenticated,service_role;
grant execute on function adme_creator.home_summary(boolean),public.creator_home_summary(boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
