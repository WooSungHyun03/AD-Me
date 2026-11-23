begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-p0-finish-20261121'));
-- USER SQL Editor: STOP on any mismatch. Exact reviewed34 baseline only.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>34
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028'))
 or to_regnamespace('adme_release') is not null
 or to_regnamespace('adme_upload') is not null
 or to_regclass('adme_creator.public_refs') is not null
 or to_regclass('adme_creator.publication_policies') is not null
 or md5(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure))<>'6c6f240a0cd71028dedb0a8790393783'
 or md5(pg_get_functiondef('public.create_test_order(text)'::regprocedure))<>'fa52a9c01f90f02e10e902592320fa57'
 or md5(pg_get_functiondef('public.finalize_test_order(uuid,uuid,text,integer)'::regprocedure))<>'267ea2666c37fa33f758943243faa593'
 or md5(pg_get_functiondef('public.recommendation_page(uuid,uuid)'::regprocedure))<>'342b9b105d11543a48132ec79ada6b18'
 then raise exception 'STOP: expected reviewed34 source/DB baseline; developer review required';end if;
end $gate$;
-- Retain old-source public IDs during additive staging; this is not the final privacy boundary.
set local adme.opaque_staging='on';

-- SOURCE 202611210035_home_catalog.sql
-- D081: current public catalogue, never inferred verified identities.
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

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210035','home_catalog',array[$p0_source$-- D081: current public catalogue, never inferred verified identities.
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
$p0_source$]);

-- SOURCE 202611210036_test_billing_boundary.sql
-- D008/D065: app flags alone never enable direct database TEST orders.
create schema adme_release;
revoke all on schema adme_release from public,anon,authenticated,service_role;
grant usage on schema adme_release to anon,authenticated,service_role;
create table adme_release.billing_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default false,release_ref text,changed_at timestamptz);
alter table adme_release.billing_boundary enable row level security;
revoke all on adme_release.billing_boundary from public,anon,authenticated,service_role;
insert into adme_release.billing_boundary(singleton) values(true);
create function adme_release.billing_enabled() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select enabled from adme_release.billing_boundary where singleton),false); $$;
create function adme_release.set_test_billing(p_enabled boolean,p_release text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_enabled is null or p_release is null or length(btrim(p_release)) not between 7 and 100 then raise invalid_parameter_value; end if;
 update adme_release.billing_boundary set enabled=p_enabled,release_ref=btrim(p_release),changed_at=statement_timestamp() where singleton;
end;
$$;
alter function public.create_test_order(text) set schema adme_release;
alter function adme_release.create_test_order(text) rename to create_order_legacy;
alter function public.finalize_test_order(uuid,uuid,text,integer) set schema adme_release;
alter function adme_release.finalize_test_order(uuid,uuid,text,integer) rename to finalize_order_legacy;
create function adme_release.create_order(p_sku text) returns public.orders language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.create_order_legacy(p_sku);
end;
$$;
create function adme_release.finalize_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.finalize_order_legacy(p_order,p_owner,p_payment_key,p_amount);
end;
$$;
create function public.create_test_order(p_sku text) returns public.orders language sql volatile security invoker set search_path='' as $$ select adme_release.create_order($1); $$;
create function public.finalize_test_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_release.finalize_order($1,$2,$3,$4); $$;
create function public.test_billing_available() returns boolean language sql stable security invoker set search_path='' as $$ select adme_release.billing_enabled(); $$;
create policy test_products_boundary on public.products as restrictive for select to anon,authenticated using(adme_release.billing_enabled());
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog() where adme_release.billing_enabled(); $$;
revoke all on all functions in schema adme_release from public,anon,authenticated,service_role;
grant execute on function adme_release.billing_enabled() to anon,authenticated,service_role;
grant execute on function adme_release.create_order(text) to authenticated;
grant execute on function adme_release.finalize_order(uuid,uuid,text,integer) to service_role;
revoke all on function public.create_test_order(text),public.finalize_test_order(uuid,uuid,text,integer),public.test_billing_available() from public,anon,authenticated,service_role;
grant execute on function public.create_test_order(text) to authenticated;
grant execute on function public.finalize_test_order(uuid,uuid,text,integer) to service_role;
grant execute on function public.test_billing_available() to anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210036','test_billing_boundary',array[$p0_source$-- D008/D065: app flags alone never enable direct database TEST orders.
begin;
create schema adme_release;
revoke all on schema adme_release from public,anon,authenticated,service_role;
grant usage on schema adme_release to anon,authenticated,service_role;
create table adme_release.billing_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default false,release_ref text,changed_at timestamptz);
alter table adme_release.billing_boundary enable row level security;
revoke all on adme_release.billing_boundary from public,anon,authenticated,service_role;
insert into adme_release.billing_boundary(singleton) values(true);
create function adme_release.billing_enabled() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select enabled from adme_release.billing_boundary where singleton),false); $$;
create function adme_release.set_test_billing(p_enabled boolean,p_release text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_enabled is null or p_release is null or length(btrim(p_release)) not between 7 and 100 then raise invalid_parameter_value; end if;
 update adme_release.billing_boundary set enabled=p_enabled,release_ref=btrim(p_release),changed_at=statement_timestamp() where singleton;
end;
$$;
alter function public.create_test_order(text) set schema adme_release;
alter function adme_release.create_test_order(text) rename to create_order_legacy;
alter function public.finalize_test_order(uuid,uuid,text,integer) set schema adme_release;
alter function adme_release.finalize_test_order(uuid,uuid,text,integer) rename to finalize_order_legacy;
create function adme_release.create_order(p_sku text) returns public.orders language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.create_order_legacy(p_sku);
end;
$$;
create function adme_release.finalize_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not adme_release.billing_enabled() then raise exception 'TEST billing disabled' using errcode='PT404'; end if;
 return adme_release.finalize_order_legacy(p_order,p_owner,p_payment_key,p_amount);
end;
$$;
create function public.create_test_order(p_sku text) returns public.orders language sql volatile security invoker set search_path='' as $$ select adme_release.create_order($1); $$;
create function public.finalize_test_order(p_order uuid,p_owner uuid,p_payment_key text,p_amount integer) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_release.finalize_order($1,$2,$3,$4); $$;
create function public.test_billing_available() returns boolean language sql stable security invoker set search_path='' as $$ select adme_release.billing_enabled(); $$;
create policy test_products_boundary on public.products as restrictive for select to anon,authenticated using(adme_release.billing_enabled());
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog() where adme_release.billing_enabled(); $$;
revoke all on all functions in schema adme_release from public,anon,authenticated,service_role;
grant execute on function adme_release.billing_enabled() to anon,authenticated,service_role;
grant execute on function adme_release.create_order(text) to authenticated;
grant execute on function adme_release.finalize_order(uuid,uuid,text,integer) to service_role;
revoke all on function public.create_test_order(text),public.finalize_test_order(uuid,uuid,text,integer),public.test_billing_available() from public,anon,authenticated,service_role;
grant execute on function public.create_test_order(text) to authenticated;
grant execute on function public.finalize_test_order(uuid,uuid,text,integer) to service_role;
grant execute on function public.test_billing_available() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210037_filtered_catalog.sql
-- D034/D076: bounded server-side filtering, keyset pagination and shared quota.
create index creator_filter_categories on public.creators using gin ((profile->'categories')) where published and moderation_status='allowed';
create index creator_filter_platforms on public.creators using gin ((profile->'platforms')) where published and moderation_status='allowed';
create index creator_filter_vibes on public.creators using gin ((profile->'vibes')) where published and moderation_status='allowed';
create function adme_creator.filtered_page(p_filters jsonb,p_cursor text,p_limit int,p_demo boolean) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f jsonb:=p_filters; field text; val text; low_value numeric; high_value numeric; cursor_value jsonb; signature text; rows_value jsonb; result jsonb; sort_value text; cursor_id text; cursor_name text; cursor_number numeric;
begin
 if f is null or jsonb_typeof(f)<>'object' or p_limit is null or p_limit not between 1 and 100 or p_demo is null
 or exists(select 1 from jsonb_object_keys(f) k where k not in('query','categories','platforms','tags','minPrice','maxPrice','minFollowers','maxFollowers','available','sort')) then raise invalid_parameter_value; end if;
 if jsonb_typeof(f->'query') is distinct from 'string' or length(f->>'query')>120 or jsonb_typeof(f->'available') is distinct from 'boolean' or jsonb_typeof(f->'sort') is distinct from 'string' or f->>'sort' not in('name','price','followers') then raise invalid_parameter_value; end if;
 foreach field in array array['categories','platforms','tags'] loop
 if jsonb_typeof(f->field) is distinct from 'array' or jsonb_array_length(f->field)>8 then raise invalid_parameter_value; end if;
 if exists(select 1 from jsonb_array_elements(f->field) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 50) then raise invalid_parameter_value; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(f->'platforms') v where v not in('instagram','youtube','tiktok')) then raise invalid_parameter_value; end if;
 foreach field in array array['minPrice','maxPrice','minFollowers','maxFollowers'] loop
 val:=f->>field;
 if jsonb_typeof(f->field) is distinct from 'string' or val is null or (val<>'' and (val !~ '^[0-9]{1,11}$' or val::numeric>case when field like '%Price' then 100000000 else 10000000000 end)) then raise invalid_parameter_value; end if;
 end loop;
 if (f->>'minPrice'<>'' and f->>'maxPrice'<>'' and (f->>'minPrice')::numeric>(f->>'maxPrice')::numeric)
 or(f->>'minFollowers'<>'' and f->>'maxFollowers'<>'' and (f->>'minFollowers')::numeric>(f->>'maxFollowers')::numeric) then raise invalid_parameter_value; end if;
 signature:=md5(jsonb_build_array(f,p_demo)::text);sort_value:=f->>'sort';
 if p_cursor is not null then
 if length(p_cursor)>1500 then raise invalid_parameter_value; end if;
 begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;
 exception when others then raise invalid_parameter_value; end;
 if cursor_value->>'h' is distinct from signature or cursor_value->>'v' is distinct from '1' or length(cursor_value->>'i') not between 1 and 100 or length(cursor_value->>'n')>80 then raise invalid_parameter_value; end if;
 cursor_id:=cursor_value->>'i';cursor_name:=cursor_value->>'n';
 if cursor_id is null or cursor_name is null or coalesce(cursor_value->>'k','') !~ '^-?[0-9]{1,12}$' then raise invalid_parameter_value; end if;
 cursor_number:=(cursor_value->>'k')::numeric;
 end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 with source as materialized(select adme_creator.catalog_dto(cr) d from public.creators cr where cr.published and cr.moderation_status='allowed'
 and (jsonb_array_length(f->'categories')=0 or cr.profile->'categories' ?| array(select jsonb_array_elements_text(f->'categories')))
 and (jsonb_array_length(f->'platforms')=0 or cr.profile->'platforms' ?| array(select jsonb_array_elements_text(f->'platforms')))
 and (jsonb_array_length(f->'tags')=0 or cr.profile->'vibes' ?| array(select jsonb_array_elements_text(f->'tags')))),
 visible as(select d from source where d is not null and (p_demo or d->'is_demo'='false'::jsonb)),
 filtered as materialized(select d,d->>'seed_id' i,d->>'name' n,
 case when sort_value='price' then (d->>'price_min_krw')::numeric when sort_value='followers' then coalesce(-(d->>'followers')::numeric,10000000001) else 0 end k from visible
 where (btrim(f->>'query')='' or position(lower(normalize(btrim(f->>'query'),NFKC)) in lower(normalize(concat(d->>'name',' ',d->>'handle',' ',(select string_agg(t,' ') from jsonb_array_elements_text(d->'vibes') t),' ',d->>'bio'),NFKC)))>0)
 and (f->'available'='false'::jsonb or d->'is_available'='true'::jsonb)
 and (f->>'minPrice'='' or (d->>'price_max_krw')::numeric>=(f->>'minPrice')::numeric)
 and (f->>'maxPrice'='' or (d->>'price_min_krw')::numeric<=(f->>'maxPrice')::numeric)
 and (f->>'minFollowers'='' or (d->>'followers')::numeric>=(f->>'minFollowers')::numeric)
 and (f->>'maxFollowers'='' or (d->>'followers')::numeric<=(f->>'maxFollowers')::numeric)),
 page as(select *,row_number() over(order by k,n collate "ko-KR-x-icu",i collate "C") rn from filtered
 where p_cursor is null or (k,n collate "ko-KR-x-icu",i collate "C")>(cursor_number,cursor_name collate "ko-KR-x-icu",cursor_id collate "C") order by k,n collate "ko-KR-x-icu",i collate "C" limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(d order by rn) from page where rn<=p_limit),'[]'::jsonb),
 'nextCursor',case when exists(select 1 from page where rn>p_limit) then (select replace(encode(convert_to(jsonb_build_object('v',1,'h',signature,'i',i,'n',n,'k',k)::text,'UTF8'),'base64'),chr(10),'') from page where rn=p_limit) else null end,
 'total',(select count(*) from filtered)) into result;
 with visible as materialized(select adme_creator.catalog_dto(cr) d from public.creators cr),
 fields as(select d from visible where d is not null and (p_demo or d->'is_demo'='false'::jsonb)),
 categories as(select distinct v from fields cross join lateral jsonb_array_elements_text(d->'categories') v order by v limit 1000),
 tags as(select distinct v from fields cross join lateral jsonb_array_elements_text(d->'vibes') v order by v limit 1000)
 select result||jsonb_build_object('facets',jsonb_build_object('categories',coalesce((select jsonb_agg(v order by v) from categories),'[]'::jsonb),'tags',coalesce((select jsonb_agg(v order by v) from tags),'[]'::jsonb))) into result;
 return result;
end;
$$;
create function public.creator_filter_page(p_filters jsonb,p_cursor text default null,p_limit int default 24,p_demo boolean default false) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_creator.filtered_page($1,$2,$3,$4); $$;
revoke all on function adme_creator.filtered_page(jsonb,text,int,boolean),public.creator_filter_page(jsonb,text,int,boolean) from public,anon,authenticated,service_role;
grant execute on function adme_creator.filtered_page(jsonb,text,int,boolean),public.creator_filter_page(jsonb,text,int,boolean) to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210037','filtered_catalog',array[$p0_source$-- D034/D076: bounded server-side filtering, keyset pagination and shared quota.
begin;
create index creator_filter_categories on public.creators using gin ((profile->'categories')) where published and moderation_status='allowed';
create index creator_filter_platforms on public.creators using gin ((profile->'platforms')) where published and moderation_status='allowed';
create index creator_filter_vibes on public.creators using gin ((profile->'vibes')) where published and moderation_status='allowed';
create function adme_creator.filtered_page(p_filters jsonb,p_cursor text,p_limit int,p_demo boolean) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f jsonb:=p_filters; field text; val text; low_value numeric; high_value numeric; cursor_value jsonb; signature text; rows_value jsonb; result jsonb; sort_value text; cursor_id text; cursor_name text; cursor_number numeric;
begin
 if f is null or jsonb_typeof(f)<>'object' or p_limit is null or p_limit not between 1 and 100 or p_demo is null
 or exists(select 1 from jsonb_object_keys(f) k where k not in('query','categories','platforms','tags','minPrice','maxPrice','minFollowers','maxFollowers','available','sort')) then raise invalid_parameter_value; end if;
 if jsonb_typeof(f->'query') is distinct from 'string' or length(f->>'query')>120 or jsonb_typeof(f->'available') is distinct from 'boolean' or jsonb_typeof(f->'sort') is distinct from 'string' or f->>'sort' not in('name','price','followers') then raise invalid_parameter_value; end if;
 foreach field in array array['categories','platforms','tags'] loop
 if jsonb_typeof(f->field) is distinct from 'array' or jsonb_array_length(f->field)>8 then raise invalid_parameter_value; end if;
 if exists(select 1 from jsonb_array_elements(f->field) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 50) then raise invalid_parameter_value; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(f->'platforms') v where v not in('instagram','youtube','tiktok')) then raise invalid_parameter_value; end if;
 foreach field in array array['minPrice','maxPrice','minFollowers','maxFollowers'] loop
 val:=f->>field;
 if jsonb_typeof(f->field) is distinct from 'string' or val is null or (val<>'' and (val !~ '^[0-9]{1,11}$' or val::numeric>case when field like '%Price' then 100000000 else 10000000000 end)) then raise invalid_parameter_value; end if;
 end loop;
 if (f->>'minPrice'<>'' and f->>'maxPrice'<>'' and (f->>'minPrice')::numeric>(f->>'maxPrice')::numeric)
 or(f->>'minFollowers'<>'' and f->>'maxFollowers'<>'' and (f->>'minFollowers')::numeric>(f->>'maxFollowers')::numeric) then raise invalid_parameter_value; end if;
 signature:=md5(jsonb_build_array(f,p_demo)::text);sort_value:=f->>'sort';
 if p_cursor is not null then
 if length(p_cursor)>1500 then raise invalid_parameter_value; end if;
 begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;
 exception when others then raise invalid_parameter_value; end;
 if cursor_value->>'h' is distinct from signature or cursor_value->>'v' is distinct from '1' or length(cursor_value->>'i') not between 1 and 100 or length(cursor_value->>'n')>80 then raise invalid_parameter_value; end if;
 cursor_id:=cursor_value->>'i';cursor_name:=cursor_value->>'n';
 if cursor_id is null or cursor_name is null or coalesce(cursor_value->>'k','') !~ '^-?[0-9]{1,12}$' then raise invalid_parameter_value; end if;
 cursor_number:=(cursor_value->>'k')::numeric;
 end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 with source as materialized(select adme_creator.catalog_dto(cr) d from public.creators cr where cr.published and cr.moderation_status='allowed'
 and (jsonb_array_length(f->'categories')=0 or cr.profile->'categories' ?| array(select jsonb_array_elements_text(f->'categories')))
 and (jsonb_array_length(f->'platforms')=0 or cr.profile->'platforms' ?| array(select jsonb_array_elements_text(f->'platforms')))
 and (jsonb_array_length(f->'tags')=0 or cr.profile->'vibes' ?| array(select jsonb_array_elements_text(f->'tags')))),
 visible as(select d from source where d is not null and (p_demo or d->'is_demo'='false'::jsonb)),
 filtered as materialized(select d,d->>'seed_id' i,d->>'name' n,
 case when sort_value='price' then (d->>'price_min_krw')::numeric when sort_value='followers' then coalesce(-(d->>'followers')::numeric,10000000001) else 0 end k from visible
 where (btrim(f->>'query')='' or position(lower(normalize(btrim(f->>'query'),NFKC)) in lower(normalize(concat(d->>'name',' ',d->>'handle',' ',(select string_agg(t,' ') from jsonb_array_elements_text(d->'vibes') t),' ',d->>'bio'),NFKC)))>0)
 and (f->'available'='false'::jsonb or d->'is_available'='true'::jsonb)
 and (f->>'minPrice'='' or (d->>'price_max_krw')::numeric>=(f->>'minPrice')::numeric)
 and (f->>'maxPrice'='' or (d->>'price_min_krw')::numeric<=(f->>'maxPrice')::numeric)
 and (f->>'minFollowers'='' or (d->>'followers')::numeric>=(f->>'minFollowers')::numeric)
 and (f->>'maxFollowers'='' or (d->>'followers')::numeric<=(f->>'maxFollowers')::numeric)),
 page as(select *,row_number() over(order by k,n collate "ko-KR-x-icu",i collate "C") rn from filtered
 where p_cursor is null or (k,n collate "ko-KR-x-icu",i collate "C")>(cursor_number,cursor_name collate "ko-KR-x-icu",cursor_id collate "C") order by k,n collate "ko-KR-x-icu",i collate "C" limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(d order by rn) from page where rn<=p_limit),'[]'::jsonb),
 'nextCursor',case when exists(select 1 from page where rn>p_limit) then (select replace(encode(convert_to(jsonb_build_object('v',1,'h',signature,'i',i,'n',n,'k',k)::text,'UTF8'),'base64'),chr(10),'') from page where rn=p_limit) else null end,
 'total',(select count(*) from filtered)) into result;
 with visible as materialized(select adme_creator.catalog_dto(cr) d from public.creators cr),
 fields as(select d from visible where d is not null and (p_demo or d->'is_demo'='false'::jsonb)),
 categories as(select distinct v from fields cross join lateral jsonb_array_elements_text(d->'categories') v order by v limit 1000),
 tags as(select distinct v from fields cross join lateral jsonb_array_elements_text(d->'vibes') v order by v limit 1000)
 select result||jsonb_build_object('facets',jsonb_build_object('categories',coalesce((select jsonb_agg(v order by v) from categories),'[]'::jsonb),'tags',coalesce((select jsonb_agg(v order by v) from tags),'[]'::jsonb))) into result;
 return result;
end;
$$;
create function public.creator_filter_page(p_filters jsonb,p_cursor text default null,p_limit int default 24,p_demo boolean default false) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_creator.filtered_page($1,$2,$3,$4); $$;
revoke all on function adme_creator.filtered_page(jsonb,text,int,boolean),public.creator_filter_page(jsonb,text,int,boolean) from public,anon,authenticated,service_role;
grant execute on function adme_creator.filtered_page(jsonb,text,int,boolean),public.creator_filter_page(jsonb,text,int,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210038_auth_request_budget.sql
-- D076: committed attempt reservations before Auth/provider calls. Hashes only.
create function adme_ops.auth_budget(p_action text,p_ip text,p_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare retry int; wait_seconds int:=0; ip_limit int; account_limit int; seconds int;
begin
 if p_action is null or p_action not in('login','signup','resend','recovery','search') then raise invalid_parameter_value; end if;
 if (p_ip is not null and p_ip !~ '^[a-f0-9]{64}$') or(p_account is not null and p_account !~ '^[a-f0-9]{64}$') then raise invalid_parameter_value; end if;
 seconds:=case when p_action in('login','search') then 60 else 3600 end;
 ip_limit:=case p_action when 'login' then 20 when 'search' then 60 else 10 end;
 account_limit:=case p_action when 'login' then 10 when 'search' then 60 else 5 end;
 if p_ip is null and p_account is null then
 retry:=adme_ops.take_quota('auth_shared_'||p_action,'untrusted-edge',100,60);
 return jsonb_build_object('allowed',retry=0,'retryAfter',retry,'mode','shared'); end if;
 if p_ip is not null then retry:=adme_ops.take_quota('auth_ip_'||p_action,p_ip,ip_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 if p_account is not null then retry:=adme_ops.take_quota('auth_account_'||p_action,p_account,account_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 return jsonb_build_object('allowed',wait_seconds=0,'retryAfter',wait_seconds,'mode','trusted');
end;
$$;
create function public.auth_edge_budget(p_action text,p_ip text,p_account text) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_ops.auth_budget($1,$2,$3); $$;
create function public.auth_shared_budget(p_action text) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_ops.auth_budget($1,null,null); $$;
revoke all on function adme_ops.auth_budget(text,text,text),public.auth_edge_budget(text,text,text),public.auth_shared_budget(text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.auth_budget(text,text,text) to service_role;
grant execute on function public.auth_shared_budget(text) to anon,authenticated;
grant execute on function public.auth_edge_budget(text,text,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210038','auth_request_budget',array[$p0_source$-- D076: committed attempt reservations before Auth/provider calls. Hashes only.
begin;
create function adme_ops.auth_budget(p_action text,p_ip text,p_account text) returns jsonb language plpgsql security definer set search_path='' as $$
declare retry int; wait_seconds int:=0; ip_limit int; account_limit int; seconds int;
begin
 if p_action is null or p_action not in('login','signup','resend','recovery','search') then raise invalid_parameter_value; end if;
 if (p_ip is not null and p_ip !~ '^[a-f0-9]{64}$') or(p_account is not null and p_account !~ '^[a-f0-9]{64}$') then raise invalid_parameter_value; end if;
 seconds:=case when p_action in('login','search') then 60 else 3600 end;
 ip_limit:=case p_action when 'login' then 20 when 'search' then 60 else 10 end;
 account_limit:=case p_action when 'login' then 10 when 'search' then 60 else 5 end;
 if p_ip is null and p_account is null then
 retry:=adme_ops.take_quota('auth_shared_'||p_action,'untrusted-edge',100,60);
 return jsonb_build_object('allowed',retry=0,'retryAfter',retry,'mode','shared'); end if;
 if p_ip is not null then retry:=adme_ops.take_quota('auth_ip_'||p_action,p_ip,ip_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 if p_account is not null then retry:=adme_ops.take_quota('auth_account_'||p_action,p_account,account_limit,seconds);wait_seconds:=greatest(wait_seconds,retry); end if;
 return jsonb_build_object('allowed',wait_seconds=0,'retryAfter',wait_seconds,'mode','trusted');
end;
$$;
create function public.auth_edge_budget(p_action text,p_ip text,p_account text) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_ops.auth_budget($1,$2,$3); $$;
create function public.auth_shared_budget(p_action text) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_ops.auth_budget($1,null,null); $$;
revoke all on function adme_ops.auth_budget(text,text,text),public.auth_edge_budget(text,text,text),public.auth_shared_budget(text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.auth_budget(text,text,text) to service_role;
grant execute on function public.auth_shared_budget(text) to anon,authenticated;
grant execute on function public.auth_edge_budget(text,text,text) to service_role;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210039_private_images.sql
-- D012/D051: immutable normalized PNGs; participants rechecked on every access.
create schema adme_upload;
revoke all on schema adme_upload from public,anon,authenticated,service_role;
grant usage on schema adme_upload to authenticated,service_role;
create table adme_upload.files(
 id uuid primary key,owner_id uuid not null references public.profiles(id),purpose text not null check(purpose in('brand_logo','message_image')),
 proposal_id uuid references public.proposals(id),name text not null check(length(name) between 1 and 120 and name !~ '[[:cntrl:]/\\]'),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),bytes int not null check(bytes between 1 and 5242880),
 state text not null default 'pending' check(state in('pending','verified')),message_id uuid unique references public.messages(id),
 object_path text generated always as(owner_id::text||'/'||id::text||'.png') stored,created_at timestamptz not null default now(),
 check((purpose='brand_logo' and proposal_id is null)or(purpose='message_image' and proposal_id is not null))
);
create table adme_upload.brand_logos(owner_id uuid primary key references public.profiles(id),file_id uuid not null references adme_upload.files(id));
create index upload_room_files on adme_upload.files(proposal_id,created_at desc,id desc);
alter table adme_upload.files enable row level security;alter table adme_upload.brand_logos enable row level security;
revoke all on all tables in schema adme_upload from public,anon,authenticated,service_role;
create function adme_upload.room_allowed(p_room uuid,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.proposals p where p.id=p_room and auth.uid() in(p.brand_id,p.creator_user_id) and p.status<>'rejected'
 and (not p_write or (p.status in('accepted','submitted','revision_requested') and adme_delivery.writable(p))));
$$;
create function adme_upload.attempt() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role() not in('brand','creator') then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_attempt_minute',auth.uid()::text,20,60);
 perform adme_ops.require_quota('upload_attempt_hour',auth.uid()::text,100,3600);
end;
$$;
create function adme_upload.reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language plpgsql security definer set search_path='' as $$
declare f adme_upload.files;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_id is null or p_name is null or length(p_name) not between 1 and 120 or p_name ~ '[[:cntrl:]/\\]' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 5242880 then raise invalid_parameter_value; end if;
 if not ((p_purpose='brand_logo' and p_proposal is null and public.my_role()='brand') or(p_purpose='message_image' and adme_upload.room_allowed(p_proposal,true))) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into f from adme_upload.files where id=p_id;
 if found then
 if f.owner_id<>auth.uid() then raise insufficient_privilege; end if;
 if (f.purpose,f.proposal_id,f.name,f.sha256,f.bytes) is distinct from (p_purpose,p_proposal,p_name,p_sha256,p_bytes) then raise unique_violation; end if;
 else
 perform adme_ops.require_quota('upload_new',auth.uid()::text,20,3600);
 insert into adme_upload.files(id,owner_id,purpose,proposal_id,name,sha256,bytes) values(p_id,auth.uid(),p_purpose,p_proposal,p_name,p_sha256,p_bytes) returning * into f;
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_path,'state',f.state,'sha256',f.sha256);
end;
$$;
create function adme_upload.verify_file(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language plpgsql security definer set search_path='' as $$
begin
 update adme_upload.files set state='verified' where id=p_id and owner_id=p_owner and sha256=p_hash and bytes=p_bytes;
 if not found then raise invalid_parameter_value; end if;
end;
$$;
create function adme_upload.publish_message(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f adme_upload.files; result uuid;
begin
 select * into f from adme_upload.files where id=p_id for update;
 if auth.uid() is null or f.id is null or f.owner_id<>auth.uid() or f.purpose<>'message_image' or f.state<>'verified' or not adme_upload.room_allowed(f.proposal_id,true) then raise insufficient_privilege; end if;
 if f.message_id is not null then return f.message_id; end if;
 result:=adme_messaging.send(f.proposal_id,f.id,'이미지 첨부: '||f.name,'message',null);
 update adme_upload.files set message_id=result where id=f.id;
 return result;
end;
$$;
create function adme_upload.access_file(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f adme_upload.files;
begin
 select * into f from adme_upload.files where id=p_id;
 if auth.uid() is null or f.id is null or f.state<>'verified' or not((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and f.message_id is not null and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_download',auth.uid()::text,60,60);
 return jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name,'bytes',f.bytes,'sha256',f.sha256);
end;
$$;
create function adme_upload.room_files(p_room uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not adme_upload.room_allowed(p_room,false) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_list',auth.uid()::text,60,60);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bytes',bytes,'messageId',message_id) order by created_at desc,id desc) from(select * from adme_upload.files where proposal_id=p_room and state='verified' and message_id is not null order by created_at desc,id desc limit 20) f),'[]'::jsonb);
end;
$$;
create function adme_upload.save_brand(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 if p_logo is not null and not exists(select 1 from adme_upload.files where id=p_logo and owner_id=auth.uid() and purpose='brand_logo' and state='verified') then raise insufficient_privilege; end if;
 result:=public.save_brand_account(p_name,p_brand_name,p_industry,p_introduction,p_published,p_contact_name,p_contact_email,p_contact_visibility);
 if p_logo is null then delete from adme_upload.brand_logos where owner_id=auth.uid();
 else insert into adme_upload.brand_logos(owner_id,file_id) values(auth.uid(),p_logo) on conflict(owner_id) do update set file_id=excluded.file_id; end if;
 return result;
end;
$$;
create function adme_upload.brand_logo(p_brand uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 perform adme_ops.require_quota('brand_logo',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name) into result from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified';
 return result;
end;
$$;
-- Descriptor helpers are callable only through guarded API RPCs. Public logo
-- descriptors are service-only to keep object paths/owner IDs out of public DTOs.
create function adme_upload.storage_write(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and f.owner_id=auth.uid() and f.state='pending' and f.created_at>now()-interval '30 minutes' and ((f.purpose='brand_logo' and public.my_role()='brand')or(f.purpose='message_image' and adme_upload.room_allowed(f.proposal_id,true))));
$$;
create function adme_upload.storage_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and ((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and (f.owner_id=auth.uid() or(f.state='verified' and f.message_id is not null)) and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('adme-private-images','adme-private-images',false,5242880,array['image/png']);
create policy private_image_insert on storage.objects for insert to authenticated with check(bucket_id='adme-private-images' and adme_upload.storage_write(name));
create policy private_image_read on storage.objects for select to authenticated using(bucket_id='adme-private-images' and adme_upload.storage_read(name));
-- No client UPDATE/DELETE: verified bytes cannot be replaced or removed behind a reference.
create function public.image_upload_attempt() returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.attempt(); $$;
create function public.image_upload_reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.reserve($1,$2,$3,$4,$5,$6); $$;
create function public.image_upload_verify(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.verify_file($1,$2,$3,$4); $$;
create function public.image_message_publish(p_id uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.publish_message($1); $$;
create function public.image_file_access(p_id uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.access_file($1); $$;
create function public.image_room_files(p_room uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.room_files($1); $$;
create function public.save_brand_account_logo(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.save_brand($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create function public.image_brand_logo(p_brand uuid) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_upload.brand_logo($1); $$;
revoke all on all functions in schema adme_upload from public,anon,authenticated,service_role;
grant execute on function adme_upload.attempt(),adme_upload.reserve(uuid,text,uuid,text,text,int),adme_upload.publish_message(uuid),adme_upload.access_file(uuid),adme_upload.room_files(uuid),adme_upload.save_brand(text,text,text,text,boolean,text,text,text,uuid),adme_upload.storage_write(text),adme_upload.storage_read(text) to authenticated;
grant execute on function adme_upload.verify_file(uuid,uuid,text,int) to service_role;
revoke all on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_upload_verify(uuid,uuid,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid),public.image_brand_logo(uuid) from public,anon,authenticated,service_role;
grant execute on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid) to authenticated;
grant execute on function public.image_upload_verify(uuid,uuid,text,int),public.image_brand_logo(uuid) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210039','private_images',array[$p0_source$-- D012/D051: immutable normalized PNGs; participants rechecked on every access.
begin;
create schema adme_upload;
revoke all on schema adme_upload from public,anon,authenticated,service_role;
grant usage on schema adme_upload to authenticated,service_role;
create table adme_upload.files(
 id uuid primary key,owner_id uuid not null references public.profiles(id),purpose text not null check(purpose in('brand_logo','message_image')),
 proposal_id uuid references public.proposals(id),name text not null check(length(name) between 1 and 120 and name !~ '[[:cntrl:]/\\]'),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),bytes int not null check(bytes between 1 and 5242880),
 state text not null default 'pending' check(state in('pending','verified')),message_id uuid unique references public.messages(id),
 object_path text generated always as(owner_id::text||'/'||id::text||'.png') stored,created_at timestamptz not null default now(),
 check((purpose='brand_logo' and proposal_id is null)or(purpose='message_image' and proposal_id is not null))
);
create table adme_upload.brand_logos(owner_id uuid primary key references public.profiles(id),file_id uuid not null references adme_upload.files(id));
create index upload_room_files on adme_upload.files(proposal_id,created_at desc,id desc);
alter table adme_upload.files enable row level security;alter table adme_upload.brand_logos enable row level security;
revoke all on all tables in schema adme_upload from public,anon,authenticated,service_role;
create function adme_upload.room_allowed(p_room uuid,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.proposals p where p.id=p_room and auth.uid() in(p.brand_id,p.creator_user_id) and p.status<>'rejected'
 and (not p_write or (p.status in('accepted','submitted','revision_requested') and adme_delivery.writable(p))));
$$;
create function adme_upload.attempt() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role() not in('brand','creator') then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_attempt_minute',auth.uid()::text,20,60);
 perform adme_ops.require_quota('upload_attempt_hour',auth.uid()::text,100,3600);
end;
$$;
create function adme_upload.reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language plpgsql security definer set search_path='' as $$
declare f adme_upload.files;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_id is null or p_name is null or length(p_name) not between 1 and 120 or p_name ~ '[[:cntrl:]/\\]' or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 5242880 then raise invalid_parameter_value; end if;
 if not ((p_purpose='brand_logo' and p_proposal is null and public.my_role()='brand') or(p_purpose='message_image' and adme_upload.room_allowed(p_proposal,true))) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into f from adme_upload.files where id=p_id;
 if found then
 if f.owner_id<>auth.uid() then raise insufficient_privilege; end if;
 if (f.purpose,f.proposal_id,f.name,f.sha256,f.bytes) is distinct from (p_purpose,p_proposal,p_name,p_sha256,p_bytes) then raise unique_violation; end if;
 else
 perform adme_ops.require_quota('upload_new',auth.uid()::text,20,3600);
 insert into adme_upload.files(id,owner_id,purpose,proposal_id,name,sha256,bytes) values(p_id,auth.uid(),p_purpose,p_proposal,p_name,p_sha256,p_bytes) returning * into f;
 end if;
 return jsonb_build_object('id',f.id,'path',f.object_path,'state',f.state,'sha256',f.sha256);
end;
$$;
create function adme_upload.verify_file(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language plpgsql security definer set search_path='' as $$
begin
 update adme_upload.files set state='verified' where id=p_id and owner_id=p_owner and sha256=p_hash and bytes=p_bytes;
 if not found then raise invalid_parameter_value; end if;
end;
$$;
create function adme_upload.publish_message(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare f adme_upload.files; result uuid;
begin
 select * into f from adme_upload.files where id=p_id for update;
 if auth.uid() is null or f.id is null or f.owner_id<>auth.uid() or f.purpose<>'message_image' or f.state<>'verified' or not adme_upload.room_allowed(f.proposal_id,true) then raise insufficient_privilege; end if;
 if f.message_id is not null then return f.message_id; end if;
 result:=adme_messaging.send(f.proposal_id,f.id,'이미지 첨부: '||f.name,'message',null);
 update adme_upload.files set message_id=result where id=f.id;
 return result;
end;
$$;
create function adme_upload.access_file(p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare f adme_upload.files;
begin
 select * into f from adme_upload.files where id=p_id;
 if auth.uid() is null or f.id is null or f.state<>'verified' or not((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and f.message_id is not null and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_download',auth.uid()::text,60,60);
 return jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name,'bytes',f.bytes,'sha256',f.sha256);
end;
$$;
create function adme_upload.room_files(p_room uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if not adme_upload.room_allowed(p_room,false) then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('upload_list',auth.uid()::text,60,60);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'bytes',bytes,'messageId',message_id) order by created_at desc,id desc) from(select * from adme_upload.files where proposal_id=p_room and state='verified' and message_id is not null order by created_at desc,id desc limit 20) f),'[]'::jsonb);
end;
$$;
create function adme_upload.save_brand(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 if p_logo is not null and not exists(select 1 from adme_upload.files where id=p_logo and owner_id=auth.uid() and purpose='brand_logo' and state='verified') then raise insufficient_privilege; end if;
 result:=public.save_brand_account(p_name,p_brand_name,p_industry,p_introduction,p_published,p_contact_name,p_contact_email,p_contact_visibility);
 if p_logo is null then delete from adme_upload.brand_logos where owner_id=auth.uid();
 else insert into adme_upload.brand_logos(owner_id,file_id) values(auth.uid(),p_logo) on conflict(owner_id) do update set file_id=excluded.file_id; end if;
 return result;
end;
$$;
create function adme_upload.brand_logo(p_brand uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 perform adme_ops.require_quota('brand_logo',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name) into result from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified';
 return result;
end;
$$;
-- Descriptor helpers are callable only through guarded API RPCs. Public logo
-- descriptors are service-only to keep object paths/owner IDs out of public DTOs.
create function adme_upload.storage_write(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and f.owner_id=auth.uid() and f.state='pending' and f.created_at>now()-interval '30 minutes' and ((f.purpose='brand_logo' and public.my_role()='brand')or(f.purpose='message_image' and adme_upload.room_allowed(f.proposal_id,true))));
$$;
create function adme_upload.storage_read(p_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_upload.files f where f.object_path=p_name and ((f.purpose='brand_logo' and f.owner_id=auth.uid() and public.my_role()='brand')or(f.purpose='message_image' and (f.owner_id=auth.uid() or(f.state='verified' and f.message_id is not null)) and adme_upload.room_allowed(f.proposal_id,false) and exists(select 1 from public.proposals p where p.id=f.proposal_id and adme_delivery.writable(p)))));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('adme-private-images','adme-private-images',false,5242880,array['image/png']);
create policy private_image_insert on storage.objects for insert to authenticated with check(bucket_id='adme-private-images' and adme_upload.storage_write(name));
create policy private_image_read on storage.objects for select to authenticated using(bucket_id='adme-private-images' and adme_upload.storage_read(name));
-- No client UPDATE/DELETE: verified bytes cannot be replaced or removed behind a reference.
create function public.image_upload_attempt() returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.attempt(); $$;
create function public.image_upload_reserve(p_id uuid,p_purpose text,p_proposal uuid,p_name text,p_sha256 text,p_bytes int) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.reserve($1,$2,$3,$4,$5,$6); $$;
create function public.image_upload_verify(p_id uuid,p_owner uuid,p_hash text,p_bytes int) returns void language sql volatile security invoker set search_path='' as $$ select adme_upload.verify_file($1,$2,$3,$4); $$;
create function public.image_message_publish(p_id uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.publish_message($1); $$;
create function public.image_file_access(p_id uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.access_file($1); $$;
create function public.image_room_files(p_room uuid) returns jsonb language sql volatile security invoker set search_path='' as $$ select adme_upload.room_files($1); $$;
create function public.save_brand_account_logo(p_name text,p_brand_name text,p_industry text,p_introduction text,p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text,p_logo uuid) returns uuid language sql volatile security invoker set search_path='' as $$ select adme_upload.save_brand($1,$2,$3,$4,$5,$6,$7,$8,$9); $$;
create function public.image_brand_logo(p_brand uuid) returns jsonb language sql volatile security definer set search_path='' as $$ select adme_upload.brand_logo($1); $$;
revoke all on all functions in schema adme_upload from public,anon,authenticated,service_role;
grant execute on function adme_upload.attempt(),adme_upload.reserve(uuid,text,uuid,text,text,int),adme_upload.publish_message(uuid),adme_upload.access_file(uuid),adme_upload.room_files(uuid),adme_upload.save_brand(text,text,text,text,boolean,text,text,text,uuid),adme_upload.storage_write(text),adme_upload.storage_read(text) to authenticated;
grant execute on function adme_upload.verify_file(uuid,uuid,text,int) to service_role;
revoke all on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_upload_verify(uuid,uuid,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid),public.image_brand_logo(uuid) from public,anon,authenticated,service_role;
grant execute on function public.image_upload_attempt(),public.image_upload_reserve(uuid,text,uuid,text,text,int),public.image_message_publish(uuid),public.image_file_access(uuid),public.image_room_files(uuid),public.save_brand_account_logo(text,text,text,text,boolean,text,text,text,uuid) to authenticated;
grant execute on function public.image_upload_verify(uuid,uuid,text,int),public.image_brand_logo(uuid) to service_role;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210040_brand_logo_projection.sql
create function public.brand_logo_available(p_brand uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform adme_ops.require_quota('brand_logo_meta',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 return exists(select 1 from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified');
end;
$$;
revoke all on function public.brand_logo_available(uuid) from public,anon,authenticated,service_role;
grant execute on function public.brand_logo_available(uuid) to anon,authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210040','brand_logo_projection',array[$p0_source$begin;
create function public.brand_logo_available(p_brand uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform adme_ops.require_quota('brand_logo_meta',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 return exists(select 1 from public.brand_profiles b join adme_upload.brand_logos l on l.owner_id=b.owner_id join adme_upload.files f on f.id=l.file_id where b.id=p_brand and (b.published or b.owner_id=auth.uid()) and f.state='verified');
end;
$$;
revoke all on function public.brand_logo_available(uuid) from public,anon,authenticated,service_role;
grant execute on function public.brand_logo_available(uuid) to anon,authenticated;
commit;
$p0_source$]);

-- SOURCE 202611210041_public_creator_references.sql
-- D075: public IDs are independent of Auth UIDs. Original PKs/FKs stay intact.
create table adme_creator.public_refs(creator_id text primary key references public.creators(id) on delete cascade,public_id text not null unique default('c-'||gen_random_uuid()::text));
create table adme_creator.reference_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default true,release_ref text,activated_at timestamptz);
alter table adme_creator.public_refs enable row level security;alter table adme_creator.reference_boundary enable row level security;
revoke all on adme_creator.public_refs,adme_creator.reference_boundary from public,anon,authenticated,service_role;
insert into adme_creator.public_refs(creator_id) select id from public.creators;
insert into adme_creator.reference_boundary(singleton,enabled) values(true,current_setting('adme.opaque_staging',true) is distinct from 'on');
create function adme_creator.sync_public_ref() returns trigger language plpgsql security definer set search_path='' as $$begin insert into adme_creator.public_refs(creator_id) values(new.id);return new;end;$$;
create trigger creator_public_ref_insert after insert on public.creators for each row execute function adme_creator.sync_public_ref();
create function adme_creator.reference_guard() returns trigger language plpgsql set search_path='' as $$begin if tg_op='DELETE' or(old.enabled and not new.enabled)or(old.release_ref is not null and(new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at)) then raise check_violation;end if;return new;end;$$;
create trigger reference_boundary_guard before update or delete on adme_creator.reference_boundary for each row execute function adme_creator.reference_guard();
create function adme_creator.activate_public_refs(p_release text) returns void language plpgsql security invoker set search_path='' as $$begin if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value;end if;update adme_creator.reference_boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;end;$$;
create function adme_creator.public_reference(p_creator text) returns text language sql stable security definer set search_path='' as $$
 select case when not(select enabled from adme_creator.reference_boundary where singleton) or(c.id ~ '^creator-[0-9]{3}$' and c.profile->'is_demo'='true'::jsonb) then c.id else r.public_id end from public.creators c join adme_creator.public_refs r on r.creator_id=c.id where c.id=p_creator;
$$;
create function adme_creator.resolve_reference(p_ref text) returns text language sql stable security definer set search_path='' as $$select creator_id from adme_creator.public_refs where creator_id=p_ref or public_id=p_ref limit 1;$$;
do $$begin execute replace(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure),'FUNCTION adme_creator.catalog_dto(','FUNCTION adme_creator.catalog_dto_legacy_ref(');end;$$;
create or replace function adme_creator.catalog_dto(p_row public.creators) returns jsonb language sql stable security definer set search_path='' as $$select adme_creator.catalog_dto_legacy_ref(p_row)||jsonb_build_object('seed_id',adme_creator.public_reference(p_row.id));$$;
-- Resolve old/new references before existing role/consent/moderation rules. Old
-- private entry points lose client execution; all original row IDs stay intact.
do $wrap$
declare f record; args text; call_args text; role_name text; allowed boolean[]; names text[]:=array['anon','authenticated','service_role']; idx int;
begin
 for f in select p.*,n.nspname,pg_get_function_identity_arguments(p.oid) identity_args,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result_type
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='adme_creator' and p.proname in('create_proposal','proposal_allowed'))or(n.nspname='adme_review' and p.proname in('public_records','submit','validate_ad','validate_submission')) loop
 allowed:=array[has_function_privilege('anon',f.oid,'execute'),has_function_privilege('authenticated',f.oid,'execute'),has_function_privilege('service_role',f.oid,'execute')];
 select string_agg(case when a='p_creator' then 'adme_creator.resolve_reference(p_creator)' else quote_ident(a) end,',' order by n) into call_args from unnest(f.proargnames) with ordinality q(a,n);
 execute replace(pg_get_functiondef(f.oid),format('FUNCTION %I.%I(',f.nspname,f.proname),format('FUNCTION %I.%I(',f.nspname,f.proname||'_legacy_ref'));
 execute format('revoke all on function %I.%I(%s) from public,anon,authenticated,service_role',f.nspname,f.proname||'_legacy_ref',f.identity_args);
 execute format('create or replace function %I.%I(%s) returns %s language sql %s security definer set search_path='''' as %L',f.nspname,f.proname,f.args,f.result_type,case when f.provolatile='v' then 'volatile' else 'stable' end,format('select %I.%I(%s);',f.nspname,f.proname||'_legacy_ref',call_args));
 execute format('revoke all on function %I.%I(%s) from public,anon,authenticated,service_role',f.nspname,f.proname,f.identity_args);
 for idx in 1..3 loop if allowed[idx] then execute format('grant execute on function %I.%I(%s) to %I',f.nspname,f.proname,f.identity_args,names[idx]);end if;end loop;
 end loop;
end;$wrap$;
create or replace function adme_creator.catalog_page_rows(p_after text,p_limit int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 with rows as(select adme_creator.public_reference(c.id) id,adme_creator.catalog_dto(c) d from public.creators c),
 visible as(select *,row_number()over(order by id collate "C") n from rows where d is not null and id collate "C">p_after collate "C" order by id collate "C" limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(d order by id collate "C") filter(where n<=p_limit),'[]'::jsonb),'nextCursor',case when count(*)>p_limit then(select id from visible where n=p_limit) else null end) into result from visible;
 return result;
end;$$;
create or replace function adme_creator.saved_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c)) order by c.id collate "C") from public.saved_creators s join public.creators c on c.id=s.creator_id where s.owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create or replace function adme_creator.proposal_choices(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ca public.campaigns;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into ca from public.campaigns where id=p_campaign and moderation_status='allowed';if not found then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',adme_creator.public_reference(c.id),'name',c.profile->>'name') order by c.id collate "C") from public.creators c where adme_creator.catalog_dto(c) is not null and c.owner_id is not null and((ca.owner_id=auth.uid() and public.my_role()='brand')or(ca.status='published' and c.owner_id=auth.uid() and public.my_role()='creator'))),'[]'::jsonb);
end;$$;
do $$begin execute replace(pg_get_functiondef('adme_creator.hot_catalog()'::regprocedure),'FUNCTION adme_creator.hot_catalog(','FUNCTION adme_creator.hot_catalog_legacy_ref(');end;$$;
create or replace function adme_creator.hot_catalog() returns table(creator_id text,profile jsonb,expires_at timestamptz) language sql stable security definer set search_path='' as $$select adme_creator.public_reference(h.creator_id),h.profile,h.expires_at from adme_creator.hot_catalog_legacy_ref() h;$$;
create function adme_creator.public_one(p_ref text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if p_ref is null or length(p_ref) not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 return(select adme_creator.catalog_dto(c) from public.creators c where c.id=adme_creator.resolve_reference(p_ref));
end;$$;
create function adme_creator.toggle_saved(p_ref text) returns boolean language plpgsql security definer set search_path='' as $$
declare id_value text; existed boolean;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 id_value:=adme_creator.resolve_reference(p_ref);
 if id_value is null or not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c) is not null) then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 delete from public.saved_creators where owner_id=auth.uid() and creator_id=id_value returning true into existed;
 if coalesce(existed,false) then return false;end if;
 insert into public.saved_creators(owner_id,creator_id) values(auth.uid(),id_value);return true;
end;$$;
create function public.creator_public_one(p_ref text) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_creator.public_one($1);$$;
create function public.toggle_saved_creator(p_ref text) returns boolean language sql volatile security invoker set search_path='' as $$select adme_creator.toggle_saved($1);$$;
-- Archived result identifiers are projected without rewriting immutable stored scores.
create or replace function adme_recommendation.page(p_campaign uuid,p_snapshot uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare context_value jsonb; s adme_recommendation.snapshots; history jsonb; visible jsonb;
begin
 context_value:=adme_recommendation.context(p_campaign);perform adme_ops.require_quota('recommendation_read',auth.uid()::text,120,60);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb) into history from(select id,created_at from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 20) h;
 if p_snapshot is null then select * into s from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 1;
 else select * into s from adme_recommendation.snapshots where id=p_snapshot and campaign_id=p_campaign and owner_id=auth.uid();if not found then raise insufficient_privilege;end if;end if;
 if s.id is null then return jsonb_build_object('version',1,'campaignId',p_campaign,'snapshot',null,'history',history);end if;
 select coalesce(jsonb_agg(jsonb_set(r||jsonb_build_object('creatorId',c->'id','sourceUrl',case when r->'sourceUrl'=c->'sourceUrl' then r->'sourceUrl' else 'null'::jsonb end),'{input,id}',c->'id') order by(r->>'position')::int),'[]'::jsonb) into visible from jsonb_array_elements(s.results) r join jsonb_array_elements(context_value->'candidates') c on adme_creator.resolve_reference(c->>'id')=adme_creator.resolve_reference(r->>'creatorId');
 return jsonb_build_object('version',1,'campaignId',p_campaign,'history',history,'snapshot',jsonb_build_object('id',s.id,'createdAt',s.created_at,'modelVersion',s.model_version,'sourceContract',s.source_contract,'sourceVersion',s.source_version,'stale',s.source_version<>(context_value->>'sourceVersion'),'input',s.input,'catalogCount',s.catalog_count,'eligibleCount',s.eligible_count,'withheldCount',jsonb_array_length(s.results)-jsonb_array_length(visible),'results',visible));
end;$$;
revoke all on function adme_creator.sync_public_ref(),adme_creator.reference_guard(),adme_creator.activate_public_refs(text),adme_creator.public_reference(text),adme_creator.resolve_reference(text),adme_creator.catalog_dto_legacy_ref(public.creators),adme_creator.catalog_dto(public.creators),adme_creator.hot_catalog_legacy_ref(),adme_creator.hot_catalog(),adme_creator.public_one(text),adme_creator.toggle_saved(text),public.creator_public_one(text),public.toggle_saved_creator(text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.hot_catalog(),adme_creator.public_one(text),public.creator_public_one(text) to anon,authenticated;
grant execute on function adme_creator.toggle_saved(text),public.toggle_saved_creator(text) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210041','public_creator_references',array[$p0_source$-- D075: public IDs are independent of Auth UIDs. Original PKs/FKs stay intact.
begin;
create table adme_creator.public_refs(creator_id text primary key references public.creators(id) on delete cascade,public_id text not null unique default('c-'||gen_random_uuid()::text));
create table adme_creator.reference_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default true,release_ref text,activated_at timestamptz);
alter table adme_creator.public_refs enable row level security;alter table adme_creator.reference_boundary enable row level security;
revoke all on adme_creator.public_refs,adme_creator.reference_boundary from public,anon,authenticated,service_role;
insert into adme_creator.public_refs(creator_id) select id from public.creators;
insert into adme_creator.reference_boundary(singleton,enabled) values(true,current_setting('adme.opaque_staging',true) is distinct from 'on');
create function adme_creator.sync_public_ref() returns trigger language plpgsql security definer set search_path='' as $$begin insert into adme_creator.public_refs(creator_id) values(new.id);return new;end;$$;
create trigger creator_public_ref_insert after insert on public.creators for each row execute function adme_creator.sync_public_ref();
create function adme_creator.reference_guard() returns trigger language plpgsql set search_path='' as $$begin if tg_op='DELETE' or(old.enabled and not new.enabled)or(old.release_ref is not null and(new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at)) then raise check_violation;end if;return new;end;$$;
create trigger reference_boundary_guard before update or delete on adme_creator.reference_boundary for each row execute function adme_creator.reference_guard();
create function adme_creator.activate_public_refs(p_release text) returns void language plpgsql security invoker set search_path='' as $$begin if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value;end if;update adme_creator.reference_boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;end;$$;
create function adme_creator.public_reference(p_creator text) returns text language sql stable security definer set search_path='' as $$
 select case when not(select enabled from adme_creator.reference_boundary where singleton) or(c.id ~ '^creator-[0-9]{3}$' and c.profile->'is_demo'='true'::jsonb) then c.id else r.public_id end from public.creators c join adme_creator.public_refs r on r.creator_id=c.id where c.id=p_creator;
$$;
create function adme_creator.resolve_reference(p_ref text) returns text language sql stable security definer set search_path='' as $$select creator_id from adme_creator.public_refs where creator_id=p_ref or public_id=p_ref limit 1;$$;
do $$begin execute replace(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure),'FUNCTION adme_creator.catalog_dto(','FUNCTION adme_creator.catalog_dto_legacy_ref(');end;$$;
create or replace function adme_creator.catalog_dto(p_row public.creators) returns jsonb language sql stable security definer set search_path='' as $$select adme_creator.catalog_dto_legacy_ref(p_row)||jsonb_build_object('seed_id',adme_creator.public_reference(p_row.id));$$;
-- Resolve old/new references before existing role/consent/moderation rules. Old
-- private entry points lose client execution; all original row IDs stay intact.
do $wrap$
declare f record; args text; call_args text; role_name text; allowed boolean[]; names text[]:=array['anon','authenticated','service_role']; idx int;
begin
 for f in select p.*,n.nspname,pg_get_function_identity_arguments(p.oid) identity_args,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result_type
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='adme_creator' and p.proname in('create_proposal','proposal_allowed'))or(n.nspname='adme_review' and p.proname in('public_records','submit','validate_ad','validate_submission')) loop
 allowed:=array[has_function_privilege('anon',f.oid,'execute'),has_function_privilege('authenticated',f.oid,'execute'),has_function_privilege('service_role',f.oid,'execute')];
 select string_agg(case when a='p_creator' then 'adme_creator.resolve_reference(p_creator)' else quote_ident(a) end,',' order by n) into call_args from unnest(f.proargnames) with ordinality q(a,n);
 execute replace(pg_get_functiondef(f.oid),format('FUNCTION %I.%I(',f.nspname,f.proname),format('FUNCTION %I.%I(',f.nspname,f.proname||'_legacy_ref'));
 execute format('revoke all on function %I.%I(%s) from public,anon,authenticated,service_role',f.nspname,f.proname||'_legacy_ref',f.identity_args);
 execute format('create or replace function %I.%I(%s) returns %s language sql %s security definer set search_path='''' as %L',f.nspname,f.proname,f.args,f.result_type,case when f.provolatile='v' then 'volatile' else 'stable' end,format('select %I.%I(%s);',f.nspname,f.proname||'_legacy_ref',call_args));
 execute format('revoke all on function %I.%I(%s) from public,anon,authenticated,service_role',f.nspname,f.proname,f.identity_args);
 for idx in 1..3 loop if allowed[idx] then execute format('grant execute on function %I.%I(%s) to %I',f.nspname,f.proname,f.identity_args,names[idx]);end if;end loop;
 end loop;
end;$wrap$;
create or replace function adme_creator.catalog_page_rows(p_after text,p_limit int) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 with rows as(select adme_creator.public_reference(c.id) id,adme_creator.catalog_dto(c) d from public.creators c),
 visible as(select *,row_number()over(order by id collate "C") n from rows where d is not null and id collate "C">p_after collate "C" order by id collate "C" limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(d order by id collate "C") filter(where n<=p_limit),'[]'::jsonb),'nextCursor',case when count(*)>p_limit then(select id from visible where n=p_limit) else null end) into result from visible;
 return result;
end;$$;
create or replace function adme_creator.saved_catalog() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c)) order by c.id collate "C") from public.saved_creators s join public.creators c on c.id=s.creator_id where s.owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create or replace function adme_creator.proposal_choices(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ca public.campaigns;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into ca from public.campaigns where id=p_campaign and moderation_status='allowed';if not found then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',adme_creator.public_reference(c.id),'name',c.profile->>'name') order by c.id collate "C") from public.creators c where adme_creator.catalog_dto(c) is not null and c.owner_id is not null and((ca.owner_id=auth.uid() and public.my_role()='brand')or(ca.status='published' and c.owner_id=auth.uid() and public.my_role()='creator'))),'[]'::jsonb);
end;$$;
do $$begin execute replace(pg_get_functiondef('adme_creator.hot_catalog()'::regprocedure),'FUNCTION adme_creator.hot_catalog(','FUNCTION adme_creator.hot_catalog_legacy_ref(');end;$$;
create or replace function adme_creator.hot_catalog() returns table(creator_id text,profile jsonb,expires_at timestamptz) language sql stable security definer set search_path='' as $$select adme_creator.public_reference(h.creator_id),h.profile,h.expires_at from adme_creator.hot_catalog_legacy_ref() h;$$;
create function adme_creator.public_one(p_ref text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 if p_ref is null or length(p_ref) not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 return(select adme_creator.catalog_dto(c) from public.creators c where c.id=adme_creator.resolve_reference(p_ref));
end;$$;
create function adme_creator.toggle_saved(p_ref text) returns boolean language plpgsql security definer set search_path='' as $$
declare id_value text; existed boolean;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 id_value:=adme_creator.resolve_reference(p_ref);
 if id_value is null or not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c) is not null) then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 delete from public.saved_creators where owner_id=auth.uid() and creator_id=id_value returning true into existed;
 if coalesce(existed,false) then return false;end if;
 insert into public.saved_creators(owner_id,creator_id) values(auth.uid(),id_value);return true;
end;$$;
create function public.creator_public_one(p_ref text) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_creator.public_one($1);$$;
create function public.toggle_saved_creator(p_ref text) returns boolean language sql volatile security invoker set search_path='' as $$select adme_creator.toggle_saved($1);$$;
-- Archived result identifiers are projected without rewriting immutable stored scores.
create or replace function adme_recommendation.page(p_campaign uuid,p_snapshot uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare context_value jsonb; s adme_recommendation.snapshots; history jsonb; visible jsonb;
begin
 context_value:=adme_recommendation.context(p_campaign);perform adme_ops.require_quota('recommendation_read',auth.uid()::text,120,60);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb) into history from(select id,created_at from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 20) h;
 if p_snapshot is null then select * into s from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 1;
 else select * into s from adme_recommendation.snapshots where id=p_snapshot and campaign_id=p_campaign and owner_id=auth.uid();if not found then raise insufficient_privilege;end if;end if;
 if s.id is null then return jsonb_build_object('version',1,'campaignId',p_campaign,'snapshot',null,'history',history);end if;
 select coalesce(jsonb_agg(jsonb_set(r||jsonb_build_object('creatorId',c->'id','sourceUrl',case when r->'sourceUrl'=c->'sourceUrl' then r->'sourceUrl' else 'null'::jsonb end),'{input,id}',c->'id') order by(r->>'position')::int),'[]'::jsonb) into visible from jsonb_array_elements(s.results) r join jsonb_array_elements(context_value->'candidates') c on adme_creator.resolve_reference(c->>'id')=adme_creator.resolve_reference(r->>'creatorId');
 return jsonb_build_object('version',1,'campaignId',p_campaign,'history',history,'snapshot',jsonb_build_object('id',s.id,'createdAt',s.created_at,'modelVersion',s.model_version,'sourceContract',s.source_contract,'sourceVersion',s.source_version,'stale',s.source_version<>(context_value->>'sourceVersion'),'input',s.input,'catalogCount',s.catalog_count,'eligibleCount',s.eligible_count,'withheldCount',jsonb_array_length(s.results)-jsonb_array_length(visible),'results',visible));
end;$$;
revoke all on function adme_creator.sync_public_ref(),adme_creator.reference_guard(),adme_creator.activate_public_refs(text),adme_creator.public_reference(text),adme_creator.resolve_reference(text),adme_creator.catalog_dto_legacy_ref(public.creators),adme_creator.catalog_dto(public.creators),adme_creator.hot_catalog_legacy_ref(),adme_creator.hot_catalog(),adme_creator.public_one(text),adme_creator.toggle_saved(text),public.creator_public_one(text),public.toggle_saved_creator(text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.hot_catalog(),adme_creator.public_one(text),public.creator_public_one(text) to anon,authenticated;
grant execute on function adme_creator.toggle_saved(text),public.toggle_saved_creator(text) to authenticated;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210042_normalized_public_read.sql
-- D018: explicit provider policy gate, current consent and latest observations.
create function adme_creator.valid_metric_policy(p jsonb) returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(p)='object' and(select count(*)<=20 and coalesce(bool_and(k ~ '^[a-z][a-z0-9_]{0,79}$' and v in('count','percent','ratio')),true) from jsonb_each_text(p) t(k,v));$$;
create table adme_creator.publication_policies(provider text not null check(provider in('youtube','instagram','tiktok','approved_web')),policy_version text not null,enabled boolean not null default false,permission_ref text not null check(length(btrim(permission_ref)) between 7 and 200),ttl_seconds int not null check(ttl_seconds between 60 and 2592000),metric_units jsonb not null default '{}' check(adme_creator.valid_metric_policy(metric_units)),primary key(provider,policy_version));
alter table adme_creator.publication_policies enable row level security;
revoke all on adme_creator.publication_policies from public,anon,authenticated,service_role;
create function adme_creator.normalized_public(p_ref text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare legacy public.creators; entries jsonb; total int;
begin
 if p_ref is null or length(p_ref) not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select * into legacy from public.creators where id=adme_creator.resolve_reference(p_ref);
 if legacy.id is null or adme_creator.catalog_dto(legacy) is null then return null;end if;
 with visible as materialized(select i.*,p.ttl_seconds,p.metric_units from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version and p.enabled where r.legacy_creator_id=legacy.id and legacy.owner_id is not null and legacy.profile->'owner_consent'='true'::jsonb and i.claim_status='claimed' and i.owner_consent and i.publication_status='published' and i.moderation_status='allowed' and i.observed_at<=statement_timestamp() and i.collected_at<=statement_timestamp()),
 page as(select * from visible order by id limit 10)
 select coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'handle',i.handle,'displayName',i.display_name,'canonicalUrl',i.canonical_url,'observedAt',i.observed_at,'isDemo',legacy.profile->'is_demo','sourceType',i.source_type,'policyVersion',i.policy_version,'canRequestCollaboration',legacy.profile->'is_demo'='false'::jsonb,
 'metrics',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',case when m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds) then null else m.value end,'unit',m.unit,'observedAt',m.observed_at,'collectedAt',m.collected_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind,'stale',m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds)) order by m.name,m.kind) from(select distinct on(name,kind) m.* from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit and m.observed_at<=statement_timestamp() and m.collected_at<=statement_timestamp() order by name,kind,observed_at desc,id desc) m),'[]'::jsonb)) order by i.id) from page i),'[]'::jsonb),(select count(*) from visible) into entries,total;
 return jsonb_build_object('version',1,'creatorId',adme_creator.public_reference(legacy.id),'identities',entries,'truncated',total>10);
end;$$;
create function public.creator_normalized_public(p_ref text) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_creator.normalized_public($1);$$;
revoke all on function adme_creator.valid_metric_policy(jsonb),adme_creator.normalized_public(text),public.creator_normalized_public(text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.normalized_public(text),public.creator_normalized_public(text) to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210042','normalized_public_read',array[$p0_source$-- D018: explicit provider policy gate, current consent and latest observations.
begin;
create function adme_creator.valid_metric_policy(p jsonb) returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(p)='object' and(select count(*)<=20 and coalesce(bool_and(k ~ '^[a-z][a-z0-9_]{0,79}$' and v in('count','percent','ratio')),true) from jsonb_each_text(p) t(k,v));$$;
create table adme_creator.publication_policies(provider text not null check(provider in('youtube','instagram','tiktok','approved_web')),policy_version text not null,enabled boolean not null default false,permission_ref text not null check(length(btrim(permission_ref)) between 7 and 200),ttl_seconds int not null check(ttl_seconds between 60 and 2592000),metric_units jsonb not null default '{}' check(adme_creator.valid_metric_policy(metric_units)),primary key(provider,policy_version));
alter table adme_creator.publication_policies enable row level security;
revoke all on adme_creator.publication_policies from public,anon,authenticated,service_role;
create function adme_creator.normalized_public(p_ref text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare legacy public.creators; entries jsonb; total int;
begin
 if p_ref is null or length(p_ref) not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select * into legacy from public.creators where id=adme_creator.resolve_reference(p_ref);
 if legacy.id is null or adme_creator.catalog_dto(legacy) is null then return null;end if;
 with visible as materialized(select i.*,p.ttl_seconds,p.metric_units from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version and p.enabled where r.legacy_creator_id=legacy.id and legacy.owner_id is not null and legacy.profile->'owner_consent'='true'::jsonb and i.claim_status='claimed' and i.owner_consent and i.publication_status='published' and i.moderation_status='allowed' and i.observed_at<=statement_timestamp() and i.collected_at<=statement_timestamp()),
 page as(select * from visible order by id limit 10)
 select coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'handle',i.handle,'displayName',i.display_name,'canonicalUrl',i.canonical_url,'observedAt',i.observed_at,'isDemo',legacy.profile->'is_demo','sourceType',i.source_type,'policyVersion',i.policy_version,'canRequestCollaboration',legacy.profile->'is_demo'='false'::jsonb,
 'metrics',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',case when m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds) then null else m.value end,'unit',m.unit,'observedAt',m.observed_at,'collectedAt',m.collected_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind,'stale',m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds)) order by m.name,m.kind) from(select distinct on(name,kind) m.* from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit and m.observed_at<=statement_timestamp() and m.collected_at<=statement_timestamp() order by name,kind,observed_at desc,id desc) m),'[]'::jsonb)) order by i.id) from page i),'[]'::jsonb),(select count(*) from visible) into entries,total;
 return jsonb_build_object('version',1,'creatorId',adme_creator.public_reference(legacy.id),'identities',entries,'truncated',total>10);
end;$$;
create function public.creator_normalized_public(p_ref text) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_creator.normalized_public($1);$$;
revoke all on function adme_creator.valid_metric_policy(jsonb),adme_creator.normalized_public(text),public.creator_normalized_public(text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.normalized_public(text),public.creator_normalized_public(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210043_image_transport_limit.sql
-- Leave headroom below standard Vercel request/response limits.
alter table adme_upload.files drop constraint files_bytes_check;
alter table adme_upload.files add constraint files_bytes_check check(bytes between 1 and 4194304);
update storage.buckets set file_size_limit=4194304 where id='adme-private-images';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210043','image_transport_limit',array[$p0_source$-- Leave headroom below standard Vercel request/response limits.
begin;
alter table adme_upload.files drop constraint files_bytes_check;
alter table adme_upload.files add constraint files_bytes_check check(bytes between 1 and 4194304);
update storage.buckets set file_size_limit=4194304 where id='adme-private-images';
commit;
$p0_source$]);

-- SOURCE 202611210044_service_budget_usage.sql
-- Service-only invoker gateway needs schema USAGE, not table grants or RLS bypass.
grant usage on schema adme_ops to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210044','service_budget_usage',array[$p0_source$-- Service-only invoker gateway needs schema USAGE, not table grants or RLS bypass.
begin;
grant usage on schema adme_ops to service_role;
notify pgrst,'reload schema';
commit;
$p0_source$]);

-- SOURCE 202611210045_reference_precedence.sql
-- Canonical public IDs win over any colliding historical/custom row key.
create or replace function adme_creator.resolve_reference(p_ref text) returns text language sql stable security definer set search_path='' as $$
 select creator_id from adme_creator.public_refs where public_id=p_ref
 union all
 select creator_id from adme_creator.public_refs where creator_id=p_ref and not exists(select 1 from adme_creator.public_refs where public_id=p_ref)
 limit 1;
$$;
revoke all on function adme_creator.resolve_reference(text) from public,anon,authenticated,service_role;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210045','reference_precedence',array[$p0_source$-- Canonical public IDs win over any colliding historical/custom row key.
begin;
create or replace function adme_creator.resolve_reference(p_ref text) returns text language sql stable security definer set search_path='' as $$
 select creator_id from adme_creator.public_refs where public_id=p_ref
 union all
 select creator_id from adme_creator.public_refs where creator_id=p_ref and not exists(select 1 from adme_creator.public_refs where public_id=p_ref)
 limit 1;
$$;
revoke all on function adme_creator.resolve_reference(text) from public,anon,authenticated,service_role;
commit;
$p0_source$]);

-- SOURCE 202611210046_filter_reference_epoch.sql
-- A cursor issued before the public-ID read switch must fail, never skip rows.
do $$declare body text; needle text:='signature:=md5(jsonb_build_array(f,p_demo)::text);';begin
 body:=pg_get_functiondef('adme_creator.filtered_page(jsonb,text,integer,boolean)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: filtered catalogue function needs review';end if;
 execute replace(body,needle,'signature:=md5(jsonb_build_array(f,p_demo,(select enabled from adme_creator.reference_boundary where singleton))::text);');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210046','filter_reference_epoch',array[$p0_source$-- A cursor issued before the public-ID read switch must fail, never skip rows.
begin;
do $$declare body text; needle text:='signature:=md5(jsonb_build_array(f,p_demo)::text);';begin
 body:=pg_get_functiondef('adme_creator.filtered_page(jsonb,text,integer,boolean)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: filtered catalogue function needs review';end if;
 execute replace(body,needle,'signature:=md5(jsonb_build_array(f,p_demo,(select enabled from adme_creator.reference_boundary where singleton))::text);');
end;$$;
notify pgrst,'reload schema';
commit;
$p0_source$]);

commit;
