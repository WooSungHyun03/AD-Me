-- D075: public IDs are independent of Auth UIDs. Original PKs/FKs stay intact.
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
