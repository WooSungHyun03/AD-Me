-- D073: atomic, policy-bound publication saves; old rows are not backfilled as consent.
begin;
alter table adme_consent.events add column scope text not null default 'global' check(scope in('global','creator','brand'));
alter table adme_consent.events alter column recorded_at set default clock_timestamp();
create table adme_consent.publication_boundary(singleton boolean primary key default true check(singleton),enabled boolean not null,release_ref text,activated_at timestamptz);
alter table adme_consent.publication_boundary enable row level security;
revoke all on adme_consent.publication_boundary from public,anon,authenticated,service_role;
insert into adme_consent.publication_boundary(singleton,enabled)values(true,current_setting('adme.publication_staging',true) is distinct from 'on');
create trigger publication_boundary_guard before update or delete on adme_consent.publication_boundary for each row execute function adme_consent.boundary_guard();
create function adme_consent.activate_publication(p_release text)returns void language plpgsql security invoker set search_path='' as $$begin
 if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value;end if;
 update adme_consent.publication_boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp())where singleton;
end;$$;
create table adme_consent.publication_requests(actor_id uuid not null references auth.users(id) on delete cascade,request_key uuid not null,scope text not null check(scope in('creator','brand')),payload_hash bytea not null check(octet_length(payload_hash)=32),transaction_id bigint not null,result jsonb,created_at timestamptz not null default statement_timestamp(),primary key(actor_id,request_key));
alter table adme_consent.publication_requests enable row level security;
revoke all on adme_consent.publication_requests from public,anon,authenticated,service_role;

create function adme_consent.publication_context(p_scope text,p_owner uuid)returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=p_owner and exists(select 1 from adme_consent.publication_requests r where r.actor_id=p_owner and r.scope=p_scope and r.request_key::text=current_setting('adme.publication_request',true) and r.transaction_id=txid_current() and r.result is null);
$$;
create function adme_consent.publication_guard()returns trigger language plpgsql security definer set search_path='' as $$
declare scope_value text:=case when tg_table_name='creators' then 'creator' else 'brand' end;owner_value uuid;was_public boolean:=false;is_public boolean:=false;v text;
begin
 -- Owner SQL fixtures/migrations do not impersonate consent. PostgREST uses authenticator session_user.
 if session_user in('postgres','supabase_admin') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op<>'INSERT' then owner_value:=old.owner_id;was_public:=old.published;end if;
 if tg_op<>'DELETE' then owner_value:=new.owner_id;is_public:=new.published;end if;
 if tg_op='UPDATE' and scope_value='creator' and new.profile is not distinct from old.profile and new.published=old.published and new.owner_id=old.owner_id then return new;end if;
 if adme_consent.publication_context(scope_value,owner_value) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if not(select enabled from adme_consent.publication_boundary where singleton) then if tg_op='DELETE' then return old;else return new;end if;end if;
 if is_public then raise insufficient_privilege using message='versioned publication transaction required';end if;
 -- A privacy restriction never needs a still-active policy. Only record the actor's own withdrawal.
 if was_public and auth.uid()=owner_value and not exists(select 1 from adme_consent.events where actor_id=owner_value and request_key::text=current_setting('adme.global_withdrawal',true) and purpose='profile_publication' and not accepted and scope='global')then
  select version into v from adme_consent.events where actor_id=owner_value and purpose='profile_publication' and accepted and scope in(scope_value,'global') order by recorded_at desc,id desc limit 1;
  v:=coalesce(v,adme_consent.current_policy()->>'version');
  insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key,scope)values(owner_value,v,'profile_publication',false,'settings',gen_random_uuid(),scope_value);
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger creator_publication_transaction before insert or update or delete on public.creators for each row execute function adme_consent.publication_guard();
create trigger brand_publication_transaction before insert or update or delete on public.brand_profiles for each row execute function adme_consent.publication_guard();

-- Serialize global withdrawal with scoped saves; a replayed old grant must not republish.
do $$declare body text;needle text:='if auth.uid() is null then raise insufficient_privilege;end if;';begin
 body:=pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure);
 if position(needle in body)=0 or position('if not p_accept then' in body)=0 then raise exception 'STOP: reviewed optional consent function required';end if;
 body:=replace(body,needle,needle||' perform pg_advisory_xact_lock(hashtextextended(''publication:''||auth.uid()::text,0));');
 body:=replace(body,'if not p_accept then','if not p_accept then perform set_config(''adme.global_withdrawal'',p_key::text,true);');
 body:=replace(body,'if found then if e.version','if found then if e.scope<>''global'' then raise invalid_parameter_value;end if; if e.version');
 body:=replace(body,'return jsonb_build_object(''id'',e.id','perform set_config(''adme.global_withdrawal'','''',true); return jsonb_build_object(''id'',e.id');
 execute body;
end;$$;

-- Gate the legacy definer RPC too, including no-op base writes followed by logo attachment changes.
do $$declare body text;begin
 body:=pg_get_functiondef('public.save_brand_account(text,text,text,text,boolean,text,text,text)'::regprocedure);
 if position('begin' in lower(body))=0 then raise exception 'STOP: reviewed brand writer required';end if;
 body:=regexp_replace(body,'\mbegin\M', 'begin if p_published and (select enabled from adme_consent.publication_boundary where singleton) and session_user not in(''postgres'',''supabase_admin'') and not adme_consent.publication_context(''brand'',auth.uid()) then raise insufficient_privilege using message=''versioned publication transaction required'';end if;', 'i');
 execute body;
end;$$;

create function adme_consent.save_publication(p_scope text,p_data jsonb,p_version text,p_hash text,p_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r adme_consent.publication_requests;p adme_consent.policies;fingerprint bytea;result_value jsonb;accepted_value boolean;profile_value jsonb;id_value text;brand_value uuid;event_value uuid;
begin
 if actor is null or p_scope not in('creator','brand') or public.my_role() is distinct from p_scope then raise insufficient_privilege;end if;
 if p_key is null or p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>16384 or jsonb_typeof(p_data->'published') is distinct from 'boolean' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('publication:'||actor::text,0));
 fingerprint:=extensions.digest(convert_to(jsonb_build_array(p_scope,p_data,p_version,p_hash)::text,'UTF8'),'sha256');
 select * into r from adme_consent.publication_requests where actor_id=actor and request_key=p_key;
 if found then
  if r.scope<>p_scope or r.payload_hash<>fingerprint or r.result is null then raise invalid_parameter_value using message='publication request key conflict';end if;
  return r.result; -- Receipt only: never replay a stale mutation after later withdrawal.
 end if;
 if exists(select 1 from adme_consent.events where actor_id=actor and request_key=p_key and purpose='profile_publication')then raise invalid_parameter_value;end if;
 accepted_value:=(p_data->>'published')::boolean;
 select * into p from adme_consent.policies where version=p_version and document_hash=p_hash and(not accepted_value or active) for share;
 if not found then raise insufficient_privilege using message='current reviewed publication policy required';end if;
 if p.version is distinct from(adme_consent.current_policy()->>'version')then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('consent_change',actor::text,30,60);
 insert into adme_consent.publication_requests(actor_id,request_key,scope,payload_hash,transaction_id)values(actor,p_key,p_scope,fingerprint,txid_current());
 perform set_config('adme.publication_request',p_key::text,true);
 if p_scope='creator' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in('name','bio','social_url','portfolio_url','owner_consent','categories','vibes','formats','platforms','price_min_krw','price_max_krw','is_available','published')) or jsonb_typeof(p_data->'owner_consent') is distinct from 'boolean' then raise invalid_parameter_value;end if;
  id_value:='user-'||actor::text;
  profile_value:=p_data||jsonb_build_object('seed_id',id_value,'handle','self_reported','followers',0,'metrics_source','unavailable','is_demo',false,'data_source','owner_registration','source_url',nullif(p_data->>'social_url',''),'portrait_asset',null,'image_placeholder','initials','owner_id',actor);
  if not public.valid_creator_dto(profile_value) or jsonb_array_length(p_data->'categories')<1 or jsonb_array_length(p_data->'vibes')<1 or jsonb_array_length(p_data->'formats')<1 or jsonb_array_length(p_data->'platforms')<1
    or exists(select 1 from jsonb_array_elements_text(p_data->'platforms') k where k not in('instagram','youtube','tiktok'))
    or (accepted_value and (coalesce(p_data->>'social_url','')<>'' or coalesce(p_data->>'portfolio_url','')<>'') and p_data->'owner_consent'<>'true'::jsonb)
    then raise invalid_parameter_value;end if;
  if (p_data->>'price_min_krw')::numeric<>trunc((p_data->>'price_min_krw')::numeric) or (p_data->>'price_max_krw')::numeric<>trunc((p_data->>'price_max_krw')::numeric)
   or exists(select 1 from jsonb_array_elements_text(p_data->'categories') k where length(k)>50)
   or exists(select 1 from jsonb_array_elements_text(p_data->'vibes') k where length(k)>30)
   or exists(select 1 from jsonb_array_elements_text(p_data->'formats') k where length(k)>40)then raise invalid_parameter_value;end if;
  insert into public.creators(id,owner_id,published,profile)values(id_value,actor,accepted_value,profile_value)
   on conflict(id)do update set published=excluded.published,profile=excluded.profile where creators.owner_id=actor;
  if not found then raise insufficient_privilege;end if;
  result_value:=jsonb_build_object('id',id_value);
 else
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in('name','brandName','industry','introduction','published','contactName','contactEmail','contactVisibility','logoUploadId'))then raise invalid_parameter_value;end if;
  if p_data?'logoUploadId' then
   brand_value:=adme_upload.save_brand(p_data->>'name',p_data->>'brandName',p_data->>'industry',p_data->>'introduction',accepted_value,p_data->>'contactName',p_data->>'contactEmail',p_data->>'contactVisibility',(p_data->>'logoUploadId')::uuid);
  else
   brand_value:=public.save_brand_account(p_data->>'name',p_data->>'brandName',p_data->>'industry',p_data->>'introduction',accepted_value,p_data->>'contactName',p_data->>'contactEmail',p_data->>'contactVisibility');
  end if;
  result_value:=jsonb_build_object('brandId',brand_value,'ok',true);
 end if;
 insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key,scope)values(actor,p.version,'profile_publication',accepted_value,'settings',p_key,p_scope)returning id into event_value;
 update adme_consent.publication_requests set result=result_value where actor_id=actor and request_key=p_key;
 perform set_config('adme.publication_request','',true);
 return result_value;
end;$$;
create function public.save_publication(p_scope text,p_data jsonb,p_version text,p_hash text,p_key uuid)returns jsonb language sql volatile security invoker set search_path='' as $$select adme_consent.save_publication($1,$2,$3,$4,$5);$$;
create function public.my_consent_history_v2()returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'purpose',purpose,'accepted',accepted,'recordedAt',recorded_at,'scope',scope)order by recorded_at desc,id desc)from(select * from adme_consent.events where actor_id=auth.uid() order by recorded_at desc,id desc limit 50)e),'[]'::jsonb);
$$;
revoke all on function adme_consent.activate_publication(text),adme_consent.publication_context(text,uuid),adme_consent.publication_guard(),adme_consent.save_publication(text,jsonb,text,text,uuid),public.save_publication(text,jsonb,text,text,uuid),public.my_consent_history_v2() from public,anon,authenticated,service_role;
grant execute on function adme_consent.save_publication(text,jsonb,text,text,uuid),public.save_publication(text,jsonb,text,text,uuid),public.my_consent_history_v2() to authenticated;
notify pgrst,'reload schema';
commit;
