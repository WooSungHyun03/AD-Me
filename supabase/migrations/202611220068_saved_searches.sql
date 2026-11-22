-- D037: private versioned saved conditions; no notification delivery activation.
begin;
create schema adme_search;
revoke all on schema adme_search from public,anon,authenticated,service_role;
create function adme_search.valid_filters(f jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; n text; v jsonb;
begin
 if jsonb_typeof(f)is distinct from'object' then return false;end if;
 if (select count(*)from jsonb_object_keys(f))<>11 or not f ?& array['query','categories','platforms','tags','minPrice','maxPrice','minFollowers','maxFollowers','minEngagement','available','sort']then return false;end if;
 if jsonb_typeof(f->'query')is distinct from'string'or length(f->>'query')>120 or jsonb_typeof(f->'available')is distinct from'boolean'or jsonb_typeof(f->'sort')is distinct from'string'or f->>'sort'not in('name','price','followers')then return false;end if;
 foreach k in array array['categories','platforms','tags']loop
  if jsonb_typeof(f->k)is distinct from'array'then return false;end if;
  if jsonb_array_length(f->k)>8 then return false;end if;
  for v in select value from jsonb_array_elements(f->k)loop
   if jsonb_typeof(v)is distinct from'string'or length(v#>>'{}')not between 1 and 50 then return false;end if;
   if k='platforms'and(v#>>'{}')not in('instagram','youtube','tiktok')then return false;end if;
  end loop;
 end loop;
 foreach k in array array['minPrice','maxPrice','minFollowers','maxFollowers','minEngagement']loop
  if jsonb_typeof(f->k)is distinct from'string'then return false;end if;
  n=f->>k;
  if k='minEngagement'and length(n)>3 then return false;end if;
  if n<>''then
   if n!~'^[0-9]{1,11}$'then return false;end if;
   if n::bigint>(case when k='minEngagement'then 100 when k in('minPrice','maxPrice')then 100000000 else 10000000000 end)then return false;end if;
  end if;
 end loop;
 if f->>'minPrice'<>''and f->>'maxPrice'<>''and(f->>'minPrice')::bigint>(f->>'maxPrice')::bigint then return false;end if;
 if f->>'minFollowers'<>''and f->>'maxFollowers'<>''and(f->>'minFollowers')::bigint>(f->>'maxFollowers')::bigint then return false;end if;
 return true;
end;$$;
create table adme_search.saved_conditions(
 id uuid primary key,owner_id uuid not null references public.profiles(id)on delete cascade,
 name text not null check(length(btrim(name))between 1 and 80),
 filter_version int not null default 1 check(filter_version=1),
 filters jsonb not null check(adme_search.valid_filters(filters)),
 revision int not null default 1 check(revision>0),
 created_at timestamptz not null default statement_timestamp(),updated_at timestamptz not null default statement_timestamp()
);
create index on adme_search.saved_conditions(owner_id,updated_at desc,id);
alter table adme_search.saved_conditions enable row level security;
revoke all on adme_search.saved_conditions from public,anon,authenticated,service_role;
create policy owner_read on adme_search.saved_conditions for select to authenticated using(owner_id=auth.uid()and public.account_access());
create function public.saved_search_list()returns jsonb language plpgsql security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_search_read',auth.uid()::text,60,60);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'filterVersion',filter_version,'filters',filters,'revision',revision)order by updated_at desc,id)from adme_search.saved_conditions where owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create function public.saved_search_put(p_id uuid,p_expected int,p_name text,p_filters jsonb)returns void language plpgsql security definer set search_path=''as $$
declare old adme_search.saved_conditions;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_id is null or p_expected is null or p_expected<0 or p_name is null or length(btrim(p_name))not between 1 and 80 or not coalesce(adme_search.valid_filters(p_filters),false)then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('saved_search_write',auth.uid()::text,30,60);
 perform pg_advisory_xact_lock(hashtext('saved-search'),hashtext(auth.uid()::text));
 select * into old from adme_search.saved_conditions where id=p_id for update;
 if found then
  if old.owner_id<>auth.uid()then raise no_data_found;end if;
  if old.revision<>p_expected then raise exception 'stale revision'using errcode='40001';end if;
  update adme_search.saved_conditions set name=btrim(p_name),filters=p_filters,revision=revision+1,updated_at=statement_timestamp()where id=p_id;
 else
  if p_expected<>0 then raise no_data_found;end if;
  if(select count(*)from adme_search.saved_conditions where owner_id=auth.uid())>=20 then raise exception 'saved search limit'using errcode='54000';end if;
  insert into adme_search.saved_conditions(id,owner_id,name,filters)values(p_id,auth.uid(),btrim(p_name),p_filters);
 end if;
end;$$;
create function public.saved_search_delete(p_id uuid,p_expected int)returns void language plpgsql security definer set search_path=''as $$
declare old adme_search.saved_conditions;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_search_write',auth.uid()::text,30,60);
 select * into old from adme_search.saved_conditions where id=p_id and owner_id=auth.uid()for update;
 if not found then raise no_data_found;end if;
 if p_expected is distinct from old.revision then raise exception 'stale revision'using errcode='40001';end if;
 delete from adme_search.saved_conditions where id=p_id;
end;$$;
revoke all on function adme_search.valid_filters(jsonb),public.saved_search_list(),public.saved_search_put(uuid,int,text,jsonb),public.saved_search_delete(uuid,int)from public,anon,authenticated,service_role;
grant execute on function public.saved_search_list(),public.saved_search_put(uuid,int,text,jsonb),public.saved_search_delete(uuid,int)to authenticated;
notify pgrst,'reload schema';
commit;
