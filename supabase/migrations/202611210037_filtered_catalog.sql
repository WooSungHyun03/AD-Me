-- D034/D076: bounded server-side filtering, keyset pagination and shared quota.
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
