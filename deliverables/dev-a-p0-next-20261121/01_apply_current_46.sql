begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-p0-next-20261121'));
-- USER: exact reviewed46 baseline; no history editing or partial apply.
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>46
 or exists(select 1 from supabase_migrations.schema_migrations where version not in('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028','202611210035','202611210036','202611210037','202611210038','202611210039','202611210040','202611210041','202611210042','202611210043','202611210044','202611210045','202611210046'))
 or to_regnamespace('adme_consent') is not null
 or to_regclass('adme_ops.source_runtime_policies') is not null
 or to_regprocedure('adme_creator.safe_public_text(text)') is not null
 or md5(pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure))<>'d46fff28525db21e7c7fd749cbe98657'
 or md5(pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure))<>'4920091e80ed9c04d95f9542dd40d8ce'
 or md5(pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure))<>'af7bb1591609c61091ed716831d34acc'
 then raise exception 'STOP: expected reviewed46 baseline; developer must inspect actual state';end if;
end $gate$;

set local adme.consent_staging='on';

-- SOURCE 202611210047_consent_versions.sql
-- D073: immutable policy snapshot and server-timed purpose-specific consent.
create schema adme_consent;
revoke all on schema adme_consent from public,anon,authenticated,service_role;
grant usage on schema adme_consent to anon,authenticated;
create table adme_consent.policies(version text primary key,document_hash text not null check(document_hash ~ '^[a-f0-9]{64}$'),active boolean not null default false,review_ref text,approved_at timestamptz,check(not active or(length(review_ref) between 8 and 200 and approved_at is not null)));
create table adme_consent.events(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id) on delete cascade,version text not null references adme_consent.policies(version),purpose text not null check(purpose in('terms','privacy','adult_beta','profile_publication')),accepted boolean not null,method text not null check(method in('signup','settings')),request_key uuid not null,recorded_at timestamptz not null default statement_timestamp(),unique(actor_id,request_key,purpose));
create index consent_actor_history on adme_consent.events(actor_id,recorded_at desc,id desc);
alter table adme_consent.policies enable row level security;alter table adme_consent.events enable row level security;
revoke all on all tables in schema adme_consent from public,anon,authenticated,service_role;
insert into adme_consent.policies(version,document_hash) values('beta-20261121-1','b2f185171c49b2a9f35e42e8519275895b3f15bf5e8561b26f5fb63ec1247bb2');
create function adme_consent.immutable_event() returns trigger language plpgsql set search_path='' as $$begin if tg_op='UPDATE' or exists(select 1 from auth.users where id=old.actor_id) then raise check_violation using message='consent event immutable';end if;return old;end;$$;
create trigger immutable_consent before update or delete on adme_consent.events for each row execute function adme_consent.immutable_event();
create function adme_consent.policy_guard() returns trigger language plpgsql set search_path='' as $$begin if tg_op='DELETE' or new.version<>old.version or new.document_hash<>old.document_hash or(old.review_ref is not null and(new.review_ref is distinct from old.review_ref or new.approved_at is distinct from old.approved_at)) then raise check_violation;end if;return new;end;$$;
create trigger immutable_policy before update or delete on adme_consent.policies for each row execute function adme_consent.policy_guard();
create function adme_consent.approve(p_version text,p_hash text,p_review text) returns void language plpgsql security invoker set search_path='' as $$begin
 if p_review is null or length(btrim(p_review)) not between 8 and 200 then raise invalid_parameter_value;end if;
 update adme_consent.policies set active=true,review_ref=coalesce(review_ref,btrim(p_review)),approved_at=coalesce(approved_at,statement_timestamp()) where version=p_version and document_hash=p_hash;
 if not found then raise invalid_parameter_value;end if;
end;$$;
create function adme_consent.current_policy() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('version',version,'documentHash',document_hash,'approved',active) from adme_consent.policies where version='beta-20261121-1';$$;
-- GoTrue (including direct public Auth requests) cannot create an unacknowledged
-- account. DB-owner fixtures/migrations do not impersonate a person's consent.
create function adme_consent.signup_record() returns trigger language plpgsql security definer set search_path='' as $$
declare p adme_consent.policies;key_value uuid:=gen_random_uuid();purpose_value text;
begin
 if session_user in('postgres','supabase_admin') then return new;end if;
 select * into p from adme_consent.policies where version=new.raw_user_meta_data->>'policy_version' and document_hash=new.raw_user_meta_data->>'policy_hash' and active for share;
 if p.version is null or new.raw_user_meta_data->'terms_accepted' is distinct from 'true'::jsonb or new.raw_user_meta_data->'privacy_accepted' is distinct from 'true'::jsonb or new.raw_user_meta_data->'adult_beta_confirmed' is distinct from 'true'::jsonb then raise check_violation using message='approved policy and explicit adult beta acknowledgement required';end if;
 foreach purpose_value in array array['terms','privacy','adult_beta'] loop
 insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key) values(new.id,p.version,purpose_value,true,'signup',key_value);
 end loop;return new;
end;$$;
create trigger adme_user_policy after insert on auth.users for each row execute function adme_consent.signup_record();
create function adme_consent.record_optional(p_version text,p_hash text,p_accept boolean,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e adme_consent.events;p adme_consent.policies;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if p_accept is null or p_key is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into e from adme_consent.events where actor_id=auth.uid() and request_key=p_key and purpose='profile_publication';
 if found then if e.version<>p_version or e.accepted<>p_accept or p_hash is distinct from(select document_hash from adme_consent.policies where version=e.version) then raise invalid_parameter_value;end if;
 else
 select * into p from adme_consent.policies where version=p_version and document_hash=p_hash and(not p_accept or active) for share;
 if not found then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('consent_change',auth.uid()::text,30,60);
 insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key) values(auth.uid(),p.version,'profile_publication',p_accept,'settings',p_key) returning * into e;
 end if;
 if not p_accept then
 update public.creators set published=false,profile=profile||jsonb_build_object('owner_consent',false,'published',false) where owner_id=auth.uid();
 update public.brand_profiles set published=false where owner_id=auth.uid();
 update adme_creator.identities set owner_consent=false,publication_status='private' where creator_id in(select r.id from adme_creator.records r join public.creators c on c.id=r.legacy_creator_id where c.owner_id=auth.uid());
 end if;
 return jsonb_build_object('id',e.id,'version',e.version,'purpose',e.purpose,'accepted',e.accepted,'recordedAt',e.recorded_at);
end;$$;
create function adme_consent.history() returns jsonb language plpgsql stable security definer set search_path='' as $$begin if auth.uid() is null then raise insufficient_privilege;end if;return coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'purpose',purpose,'accepted',accepted,'recordedAt',recorded_at) order by recorded_at desc,id desc) from(select * from adme_consent.events where actor_id=auth.uid() order by recorded_at desc,id desc limit 50)e),'[]'::jsonb);end;$$;
create function public.current_consent_policy() returns jsonb language sql stable security invoker set search_path='' as $$select adme_consent.current_policy();$$;
create function public.my_consent_history() returns jsonb language sql stable security invoker set search_path='' as $$select adme_consent.history();$$;
create function public.record_publication_consent(p_version text,p_hash text,p_accept boolean,p_key uuid) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_consent.record_optional($1,$2,$3,$4);$$;
revoke all on all functions in schema adme_consent from public,anon,authenticated,service_role;
grant execute on function adme_consent.current_policy() to anon,authenticated;
grant execute on function adme_consent.history(),adme_consent.record_optional(text,text,boolean,uuid) to authenticated;
revoke all on function public.current_consent_policy(),public.my_consent_history(),public.record_publication_consent(text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.current_consent_policy() to anon,authenticated;
grant execute on function public.my_consent_history(),public.record_publication_consent(text,text,boolean,uuid) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210047','consent_versions',array[$next_source$-- D073: immutable policy snapshot and server-timed purpose-specific consent.
begin;
create schema adme_consent;
revoke all on schema adme_consent from public,anon,authenticated,service_role;
grant usage on schema adme_consent to anon,authenticated;
create table adme_consent.policies(version text primary key,document_hash text not null check(document_hash ~ '^[a-f0-9]{64}$'),active boolean not null default false,review_ref text,approved_at timestamptz,check(not active or(length(review_ref) between 8 and 200 and approved_at is not null)));
create table adme_consent.events(id uuid primary key default gen_random_uuid(),actor_id uuid not null references auth.users(id) on delete cascade,version text not null references adme_consent.policies(version),purpose text not null check(purpose in('terms','privacy','adult_beta','profile_publication')),accepted boolean not null,method text not null check(method in('signup','settings')),request_key uuid not null,recorded_at timestamptz not null default statement_timestamp(),unique(actor_id,request_key,purpose));
create index consent_actor_history on adme_consent.events(actor_id,recorded_at desc,id desc);
alter table adme_consent.policies enable row level security;alter table adme_consent.events enable row level security;
revoke all on all tables in schema adme_consent from public,anon,authenticated,service_role;
insert into adme_consent.policies(version,document_hash) values('beta-20261121-1','b2f185171c49b2a9f35e42e8519275895b3f15bf5e8561b26f5fb63ec1247bb2');
create function adme_consent.immutable_event() returns trigger language plpgsql set search_path='' as $$begin if tg_op='UPDATE' or exists(select 1 from auth.users where id=old.actor_id) then raise check_violation using message='consent event immutable';end if;return old;end;$$;
create trigger immutable_consent before update or delete on adme_consent.events for each row execute function adme_consent.immutable_event();
create function adme_consent.policy_guard() returns trigger language plpgsql set search_path='' as $$begin if tg_op='DELETE' or new.version<>old.version or new.document_hash<>old.document_hash or(old.review_ref is not null and(new.review_ref is distinct from old.review_ref or new.approved_at is distinct from old.approved_at)) then raise check_violation;end if;return new;end;$$;
create trigger immutable_policy before update or delete on adme_consent.policies for each row execute function adme_consent.policy_guard();
create function adme_consent.approve(p_version text,p_hash text,p_review text) returns void language plpgsql security invoker set search_path='' as $$begin
 if p_review is null or length(btrim(p_review)) not between 8 and 200 then raise invalid_parameter_value;end if;
 update adme_consent.policies set active=true,review_ref=coalesce(review_ref,btrim(p_review)),approved_at=coalesce(approved_at,statement_timestamp()) where version=p_version and document_hash=p_hash;
 if not found then raise invalid_parameter_value;end if;
end;$$;
create function adme_consent.current_policy() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('version',version,'documentHash',document_hash,'approved',active) from adme_consent.policies where version='beta-20261121-1';$$;
-- GoTrue (including direct public Auth requests) cannot create an unacknowledged
-- account. DB-owner fixtures/migrations do not impersonate a person's consent.
create function adme_consent.signup_record() returns trigger language plpgsql security definer set search_path='' as $$
declare p adme_consent.policies;key_value uuid:=gen_random_uuid();purpose_value text;
begin
 if session_user in('postgres','supabase_admin') then return new;end if;
 select * into p from adme_consent.policies where version=new.raw_user_meta_data->>'policy_version' and document_hash=new.raw_user_meta_data->>'policy_hash' and active for share;
 if p.version is null or new.raw_user_meta_data->'terms_accepted' is distinct from 'true'::jsonb or new.raw_user_meta_data->'privacy_accepted' is distinct from 'true'::jsonb or new.raw_user_meta_data->'adult_beta_confirmed' is distinct from 'true'::jsonb then raise check_violation using message='approved policy and explicit adult beta acknowledgement required';end if;
 foreach purpose_value in array array['terms','privacy','adult_beta'] loop
 insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key) values(new.id,p.version,purpose_value,true,'signup',key_value);
 end loop;return new;
end;$$;
create trigger adme_user_policy after insert on auth.users for each row execute function adme_consent.signup_record();
create function adme_consent.record_optional(p_version text,p_hash text,p_accept boolean,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e adme_consent.events;p adme_consent.policies;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if p_accept is null or p_key is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into e from adme_consent.events where actor_id=auth.uid() and request_key=p_key and purpose='profile_publication';
 if found then if e.version<>p_version or e.accepted<>p_accept or p_hash is distinct from(select document_hash from adme_consent.policies where version=e.version) then raise invalid_parameter_value;end if;
 else
 select * into p from adme_consent.policies where version=p_version and document_hash=p_hash and(not p_accept or active) for share;
 if not found then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('consent_change',auth.uid()::text,30,60);
 insert into adme_consent.events(actor_id,version,purpose,accepted,method,request_key) values(auth.uid(),p.version,'profile_publication',p_accept,'settings',p_key) returning * into e;
 end if;
 if not p_accept then
 update public.creators set published=false,profile=profile||jsonb_build_object('owner_consent',false,'published',false) where owner_id=auth.uid();
 update public.brand_profiles set published=false where owner_id=auth.uid();
 update adme_creator.identities set owner_consent=false,publication_status='private' where creator_id in(select r.id from adme_creator.records r join public.creators c on c.id=r.legacy_creator_id where c.owner_id=auth.uid());
 end if;
 return jsonb_build_object('id',e.id,'version',e.version,'purpose',e.purpose,'accepted',e.accepted,'recordedAt',e.recorded_at);
end;$$;
create function adme_consent.history() returns jsonb language plpgsql stable security definer set search_path='' as $$begin if auth.uid() is null then raise insufficient_privilege;end if;return coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'purpose',purpose,'accepted',accepted,'recordedAt',recorded_at) order by recorded_at desc,id desc) from(select * from adme_consent.events where actor_id=auth.uid() order by recorded_at desc,id desc limit 50)e),'[]'::jsonb);end;$$;
create function public.current_consent_policy() returns jsonb language sql stable security invoker set search_path='' as $$select adme_consent.current_policy();$$;
create function public.my_consent_history() returns jsonb language sql stable security invoker set search_path='' as $$select adme_consent.history();$$;
create function public.record_publication_consent(p_version text,p_hash text,p_accept boolean,p_key uuid) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_consent.record_optional($1,$2,$3,$4);$$;
revoke all on all functions in schema adme_consent from public,anon,authenticated,service_role;
grant execute on function adme_consent.current_policy() to anon,authenticated;
grant execute on function adme_consent.history(),adme_consent.record_optional(text,text,boolean,uuid) to authenticated;
revoke all on function public.current_consent_policy(),public.my_consent_history(),public.record_publication_consent(text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.current_consent_policy() to anon,authenticated;
grant execute on function public.my_consent_history(),public.record_publication_consent(text,text,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210048_sensitive_boundaries.sql
-- D080: allowed public text and non-sensitive metrics, without new inference.
create function adme_creator.safe_public_text(p text) returns boolean language sql immutable set search_path='' as $$select coalesce(normalize(p,NFKC) !~* '([0-9]{6}[[:space:]]*-?[[:space:]]*[1-8][0-9]{6})|(01[016789][[:space:].-]?[0-9]{3,4}[[:space:].-]?[0-9]{4})|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})',true);$$;
create function adme_creator.safe_metric_name(p text) returns boolean language sql immutable set search_path='' as $$select p !~* '(^|_)(age|birth|gender|sex|sexual|race|ethnicity|religion|political|health|medical|face|facial|biometric|phone|email|address|emotion)(_|$)';$$;
alter table adme_creator.metric_observations add constraint non_sensitive_metric check(adme_creator.safe_metric_name(name));
alter table adme_creator.identities add constraint non_sensitive_identity_name check(adme_creator.safe_public_text(display_name));
create function adme_creator.public_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.profile->>'name') or not adme_creator.safe_public_text(new.profile->>'bio')) then raise check_violation using message='exclude private contacts and identifiers from public text';end if;return new;
end;$$;
create trigger creator_public_text_guard before insert or update on public.creators for each row execute function adme_creator.public_text_guard();
-- Old contaminated rows are hidden by the public projection until corrected;
-- owner withdrawal still succeeds and no historic content is silently erased.
do $$declare body text;begin body:=pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure);
 if position('adme_creator.catalog_dto_legacy_ref(p_row)' in body)=0 then raise exception 'STOP: reviewed public DTO needed';end if;
 execute replace(body,'adme_creator.catalog_dto_legacy_ref(p_row)||','case when adme_creator.safe_public_text(p_row.profile->>''name'') and adme_creator.safe_public_text(p_row.profile->>''bio'') then adme_creator.catalog_dto_legacy_ref(p_row) else null end||');
end;$$;
revoke all on function adme_creator.safe_public_text(text),adme_creator.safe_metric_name(text),adme_creator.public_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210048','sensitive_boundaries',array[$next_source$-- D080: allowed public text and non-sensitive metrics, without new inference.
begin;
create function adme_creator.safe_public_text(p text) returns boolean language sql immutable set search_path='' as $$select coalesce(normalize(p,NFKC) !~* '([0-9]{6}[[:space:]]*-?[[:space:]]*[1-8][0-9]{6})|(01[016789][[:space:].-]?[0-9]{3,4}[[:space:].-]?[0-9]{4})|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})',true);$$;
create function adme_creator.safe_metric_name(p text) returns boolean language sql immutable set search_path='' as $$select p !~* '(^|_)(age|birth|gender|sex|sexual|race|ethnicity|religion|political|health|medical|face|facial|biometric|phone|email|address|emotion)(_|$)';$$;
alter table adme_creator.metric_observations add constraint non_sensitive_metric check(adme_creator.safe_metric_name(name));
alter table adme_creator.identities add constraint non_sensitive_identity_name check(adme_creator.safe_public_text(display_name));
create function adme_creator.public_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.profile->>'name') or not adme_creator.safe_public_text(new.profile->>'bio')) then raise check_violation using message='exclude private contacts and identifiers from public text';end if;return new;
end;$$;
create trigger creator_public_text_guard before insert or update on public.creators for each row execute function adme_creator.public_text_guard();
-- Old contaminated rows are hidden by the public projection until corrected;
-- owner withdrawal still succeeds and no historic content is silently erased.
do $$declare body text;begin body:=pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure);
 if position('adme_creator.catalog_dto_legacy_ref(p_row)' in body)=0 then raise exception 'STOP: reviewed public DTO needed';end if;
 execute replace(body,'adme_creator.catalog_dto_legacy_ref(p_row)||','case when adme_creator.safe_public_text(p_row.profile->>''name'') and adme_creator.safe_public_text(p_row.profile->>''bio'') then adme_creator.catalog_dto_legacy_ref(p_row) else null end||');
end;$$;
revoke all on function adme_creator.safe_public_text(text),adme_creator.safe_metric_name(text),adme_creator.public_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210049_ingestion_recovery.sql
-- D021: preserve legacy entry points; policy-gated bounded checkpoint recovery.
create table adme_ops.source_runtime_policies(
 version text primary key check(length(version) between 1 and 80),provider text not null check(provider='youtube'),enabled boolean not null default false,
 cache_seconds integer not null check(cache_seconds between 60 and 2592000),job_seconds integer not null check(job_seconds between 60 and 604800),
 tombstone_seconds integer not null check(tombstone_seconds between 60 and 31536000),daily_units integer not null check(daily_units between 1 and 1000),
 max_attempts integer not null check(max_attempts between 1 and 3),review_ref text not null check(length(btrim(review_ref)) between 8 and 200));
create unique index one_active_source_runtime_policy on adme_ops.source_runtime_policies(provider) where enabled;
create table adme_ops.source_tombstones(resource_hash bytea primary key,policy_version text not null references adme_ops.source_runtime_policies(version),request_ref uuid not null,expires_at timestamptz not null,created_at timestamptz not null default statement_timestamp());
alter table adme_ops.source_runtime_policies enable row level security;alter table adme_ops.source_tombstones enable row level security;
revoke all on adme_ops.source_runtime_policies,adme_ops.source_tombstones from public,anon,authenticated,service_role;
alter table adme_ops.jobs add column checkpoint jsonb not null default '{}' check(jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=16000),
 add column heartbeat_at timestamptz,add column source_policy text references adme_ops.source_runtime_policies(version),
 add column max_attempts integer not null default 3 check(max_attempts between 1 and 3),
 add column coalesced_into uuid references adme_ops.jobs(id) on delete set null;
alter table adme_ops.channels add column source_policy text references adme_ops.source_runtime_policies(version),add column expires_at timestamptz;
create function adme_ops.resource_hash(p_channel text) returns bytea language sql immutable set search_path='' as $$select sha256(convert_to('youtube:'||p_channel,'UTF8'));$$;
create function adme_ops.source_deleted(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.source_tombstones where resource_hash=adme_ops.resource_hash(p_channel) and expires_at>statement_timestamp());$$;
create function adme_ops.youtube_daily_limit() returns integer language sql stable security definer set search_path='' as $$select coalesce((select daily_units from adme_ops.source_runtime_policies where provider='youtube' and enabled),0);$$;
create function adme_ops.channel_fresh(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.channels c join adme_ops.source_runtime_policies p on p.version=c.source_policy and p.enabled where c.channel_id=p_channel and c.expires_at>statement_timestamp() and c.fetched_at<=statement_timestamp() and not adme_ops.source_deleted(c.channel_id));$$;
create function adme_ops.cache_source_guard() returns trigger language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;v jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.channel_id,0));
 if adme_ops.source_deleted(new.channel_id) then raise insufficient_privilege using message='source deleted';end if;
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled for share;
 if not found then raise insufficient_privilege using message='source policy pending';end if;
 if length(new.title) not between 1 and 100 or not adme_creator.safe_public_text(new.title) or jsonb_typeof(new.videos)<>'array' or jsonb_array_length(new.videos)>5 then raise check_violation;end if;
 for v in select value from jsonb_array_elements(new.videos) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('id','title','publishedAt')) or jsonb_typeof(v->'id') is distinct from 'string' or v->>'id' !~ '^[A-Za-z0-9_-]{11}$' or jsonb_typeof(v->'title') is distinct from 'string' or length(v->>'title') not between 1 and 300 or not adme_creator.safe_public_text(v->>'title') or jsonb_typeof(v->'publishedAt') is distinct from 'string' or v->>'publishedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise check_violation;end if;
 perform (v->>'publishedAt')::timestamptz;
 end loop;
 new.source_policy:=p.version;new.fetched_at:=statement_timestamp();new.expires_at:=statement_timestamp()+make_interval(secs=>p.cache_seconds);return new;
end;$$;
create trigger cache_source_boundary before insert or update of title,subscriber_count,videos,fetched_at on adme_ops.channels for each row execute function adme_ops.cache_source_guard();
create function adme_ops.identity_tombstone_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.provider='youtube' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.external_id,0));if adme_ops.source_deleted(new.external_id) and not(tg_op='UPDATE' and old.provider=new.provider and old.external_id=new.external_id and not new.owner_consent and new.publication_status='private') then raise insufficient_privilege using message='source deleted';end if;end if;return new;
end;$$;
create trigger identity_source_tombstone before insert or update on adme_creator.identities for each row execute function adme_ops.identity_tombstone_guard();
-- Keep the original function OIDs so cached public SQL gateways cannot retain a
-- bypass to the old implementation. Only ungranted internal copies are created.
do $$declare n text;body text;begin foreach n in array array['ops_worker_claim','ops_worker_finish'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if body is null then raise exception 'STOP: reviewed worker functions needed';end if;
 if n='ops_worker_claim' then
 if position('then 1000 else 30 end' in body)=0 then raise exception 'STOP: reviewed daily budget needed';end if;
 body:=replace(body,'then 1000 else 30 end','then adme_ops.youtube_daily_limit() else 30 end');end if;
 execute replace(body,'FUNCTION adme_ops.'||n||'(','FUNCTION adme_ops.'||n||'_before49(');
 end loop;end;$$;
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p adme_ops.source_runtime_policies;result jsonb;j adme_ops.jobs;begin
 perform adme_ops.verify_worker(p_token);perform pg_advisory_xact_lock(hashtext('adme-source-claim-v1'));
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled;
 if not found then
 update adme_ops.jobs set available_at=statement_timestamp()+interval '30 minutes',error_code='SOURCE_POLICY_PENDING' where kind like 'youtube_%' and status='queued' and available_at<=now();
 else
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,finished_at=now(),error_code='SOURCE_JOB_EXPIRED' where kind like 'youtube_%' and status in('queued','running') and(created_at+make_interval(secs=>p.job_seconds)<=now() or attempts>=max_attempts and(status='queued' or lease_until<=now()));
 update adme_ops.jobs a set status=b.status,finished_at=b.finished_at,error_code=b.error_code,coalesced_into=null from adme_ops.jobs b where a.coalesced_into=b.id and a.status='queued' and b.status in('done','failed');
 update adme_ops.jobs set status='done',finished_at=now(),error_code='CACHE_HIT' where kind='youtube_channel' and status='queued' and adme_ops.channel_fresh(input);
 update adme_ops.jobs a set coalesced_into=b.id,available_at=greatest(b.available_at,coalesce(b.lease_until,now()+interval '6 minutes')),error_code='COALESCED_PENDING' from adme_ops.jobs b where a.kind='youtube_channel' and a.status='queued' and b.kind=a.kind and b.input=a.input and b.id<>a.id and b.coalesced_into is null and(b.status='running' or b.status='queued' and(b.created_at,b.id)<(a.created_at,a.id));
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='SOURCE_DELETED',finished_at=now() where kind in('youtube_channel','youtube_claim') and status in('queued','running') and adme_ops.source_deleted(case when kind='youtube_claim' then split_part(input,':',2) else input end);
 end if;
 result:=adme_ops.ops_worker_claim_before49(p_token);if result is null then return null;end if;
 select * into j from adme_ops.jobs where id=(result->>'id')::uuid;
 if j.kind like 'youtube_%' then
 update adme_ops.jobs set source_policy=p.version,max_attempts=p.max_attempts,heartbeat_at=now(),checkpoint=case when checkpoint ? 'completed' then jsonb_set(checkpoint,'{completed}',coalesce((select jsonb_agg(v) from jsonb_array_elements(checkpoint->'completed') v where adme_ops.channel_fresh(v#>>'{}')),'[]'::jsonb)) else checkpoint end where id=j.id returning * into j;
 result:=result||jsonb_build_object('checkpoint',j.checkpoint,'policyVersion',p.version,'cacheTtlSeconds',p.cache_seconds);
 if j.kind='youtube_daily' then result:=result||jsonb_build_object('refresh',(select coalesce(jsonb_agg(channel_id),'[]'::jsonb) from(select channel_id from adme_ops.channels where not adme_ops.channel_fresh(channel_id) order by fetched_at,channel_id limit 20)c));end if;
 end if;return result;
end;$$;
create or replace function adme_ops.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed integer) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;accepted boolean;channel text;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then update adme_ops.jobs set status='failed',error_code='SOURCE_POLICY_CHANGED',lease=null,lease_until=null,finished_at=now() where id=j.id;return false;end if;
 if j.kind='youtube_channel' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||j.input,0));if adme_ops.source_deleted(j.input) then return false;end if;end if;
 end if;
 if j.kind='youtube_channel' and p_error is null and p_result='[]'::jsonb and j.checkpoint->'completed' ? j.input and adme_ops.channel_fresh(j.input) then
 update adme_ops.jobs set status='done',lease=null,lease_until=null,finished_at=now(),error_code=null,elapsed_ms=p_elapsed where id=p_id;accepted:=true;
 else accepted:=adme_ops.ops_worker_finish_before49(p_token,p_id,p_lease,p_result,p_error,p_elapsed);end if;
 if accepted then update adme_ops.jobs a set status=b.status,available_at=b.available_at,finished_at=b.finished_at,error_code=case when b.status='done' then 'COALESCED' else b.error_code end,coalesced_into=case when b.status in('done','failed') then null else a.coalesced_into end from adme_ops.jobs b where a.coalesced_into=b.id and b.id=p_id and a.status='queued';end if;
 return accepted;
end;$$;
create function adme_ops.worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;begin perform adme_ops.verify_worker(p_token);
 select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled;if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then return false;end if;end if;
 update adme_ops.jobs set heartbeat_at=now(),lease_until=least(now()+interval '6 minutes',case when p.version is null then now()+interval '6 minutes' else j.created_at+make_interval(secs=>p.job_seconds) end) where id=p_id;return true;
end;$$;
create function adme_ops.worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;completed jsonb;accepted boolean;p adme_ops.source_runtime_policies;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;
 if not found or j.kind not in('youtube_channel','youtube_daily') then raise insufficient_privilege;end if;
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or not adme_ops.job_enabled(j.kind) or j.created_at+make_interval(secs=>p.job_seconds)<=now() then raise insufficient_privilege;end if;
 if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>25 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_candidates)) or exists(select 1 from jsonb_array_elements(p_candidates) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^UC[A-Za-z0-9_-]{22}$') then raise invalid_parameter_value;end if;
 if j.kind='youtube_channel' and p_candidates is distinct from jsonb_build_array(j.input) then raise invalid_parameter_value;end if;
 if j.checkpoint ? 'candidates' and j.checkpoint->'candidates' is distinct from p_candidates then raise invalid_parameter_value;end if;
 completed:=coalesce(j.checkpoint->'completed','[]'::jsonb);
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value from jsonb_array_elements(p_candidates) where adme_ops.channel_fresh(value#>>'{}')) x;
 if p_result is not null and p_result<>'[]'::jsonb then
 if jsonb_typeof(p_result)<>'array' or jsonb_array_length(p_result)>25 or exists(select 1 from jsonb_array_elements(p_result) v where not p_candidates ? (v->>'id')) then raise invalid_parameter_value;end if;
 -- Existing validated finish stores this bounded batch atomically; restore the
 -- lease inside the same transaction before anything can observe completion.
 accepted:=adme_ops.ops_worker_finish(p_token,p_id,p_lease,p_result,null,0);if not accepted then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value->'id' from jsonb_array_elements(p_result)) x;
 update adme_ops.jobs set status='running',lease=p_lease,lease_until=j.lease_until,finished_at=null,error_code=null,output=null where id=j.id;
 end if;
 update adme_ops.jobs set checkpoint=jsonb_build_object('version',1,'candidates',p_candidates,'completed',completed),heartbeat_at=now() where id=j.id returning checkpoint into completed;
 return completed;
end;$$;
create function adme_ops.forget_channel(p_channel text,p_request uuid,p_policy text) returns void language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;begin
 if p_channel is null or p_channel !~ '^UC[A-Za-z0-9_-]{22}$' or p_request is null then raise invalid_parameter_value;end if;
 select * into p from adme_ops.source_runtime_policies where version=p_policy;if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||p_channel,0));
 insert into adme_ops.source_tombstones(resource_hash,policy_version,request_ref,expires_at) values(adme_ops.resource_hash(p_channel),p.version,p_request,statement_timestamp()+make_interval(secs=>p.tombstone_seconds)) on conflict(resource_hash) do update set expires_at=greatest(adme_ops.source_tombstones.expires_at,excluded.expires_at),request_ref=excluded.request_ref,policy_version=excluded.policy_version;
 delete from adme_ops.channels where channel_id=p_channel;
 update adme_ops.channel_claims set verified_at=null,consent_at=null where channel_id=p_channel;
 update adme_creator.identities set owner_consent=false,publication_status='private' where provider='youtube' and external_id=p_channel;
 update adme_ops.jobs set status='failed',error_code='SOURCE_DELETED',lease=null,lease_until=null,finished_at=now() where status in('queued','running') and(kind='youtube_channel' and input=p_channel or kind='youtube_claim' and split_part(input,':',2)=p_channel or checkpoint->'candidates' ? p_channel);
end;$$;
-- TTL is evaluated against the exact policy used by the last fetch, never a
-- newly approved policy retroactively applied to old cache entries.
do $$declare n text;body text;needle text:='ch.fetched_at>now()-interval ''30 days''';begin foreach n in array array['ops_own_channels','ops_public_channels'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed channel read needed';end if;
 execute replace(body,needle,'adme_ops.channel_fresh(ch.channel_id)');end loop;end;$$;
create function public.ops_worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language sql volatile security invoker set search_path='' as $$select adme_ops.worker_heartbeat($1,$2,$3);$$;
create function public.ops_worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_ops.worker_checkpoint($1,$2,$3,$4,$5);$$;
create function public.ingestion_forget_channel(p_channel text,p_request uuid,p_policy text) returns void language sql volatile security invoker set search_path='' as $$select adme_ops.forget_channel($1,$2,$3);$$;
revoke all on function adme_ops.resource_hash(text),adme_ops.source_deleted(text),adme_ops.youtube_daily_limit(),adme_ops.channel_fresh(text),adme_ops.cache_source_guard(),adme_ops.identity_tombstone_guard(),adme_ops.ops_worker_claim_before49(text),adme_ops.ops_worker_finish_before49(text,uuid,uuid,jsonb,text,integer),adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb),adme_ops.forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function adme_ops.forget_channel(text,uuid,text) to service_role;
revoke all on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb),public.ingestion_forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function public.ingestion_forget_channel(text,uuid,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210049','ingestion_recovery',array[$next_source$-- D021: preserve legacy entry points; policy-gated bounded checkpoint recovery.
begin;
create table adme_ops.source_runtime_policies(
 version text primary key check(length(version) between 1 and 80),provider text not null check(provider='youtube'),enabled boolean not null default false,
 cache_seconds integer not null check(cache_seconds between 60 and 2592000),job_seconds integer not null check(job_seconds between 60 and 604800),
 tombstone_seconds integer not null check(tombstone_seconds between 60 and 31536000),daily_units integer not null check(daily_units between 1 and 1000),
 max_attempts integer not null check(max_attempts between 1 and 3),review_ref text not null check(length(btrim(review_ref)) between 8 and 200));
create unique index one_active_source_runtime_policy on adme_ops.source_runtime_policies(provider) where enabled;
create table adme_ops.source_tombstones(resource_hash bytea primary key,policy_version text not null references adme_ops.source_runtime_policies(version),request_ref uuid not null,expires_at timestamptz not null,created_at timestamptz not null default statement_timestamp());
alter table adme_ops.source_runtime_policies enable row level security;alter table adme_ops.source_tombstones enable row level security;
revoke all on adme_ops.source_runtime_policies,adme_ops.source_tombstones from public,anon,authenticated,service_role;
alter table adme_ops.jobs add column checkpoint jsonb not null default '{}' check(jsonb_typeof(checkpoint)='object' and octet_length(checkpoint::text)<=16000),
 add column heartbeat_at timestamptz,add column source_policy text references adme_ops.source_runtime_policies(version),
 add column max_attempts integer not null default 3 check(max_attempts between 1 and 3),
 add column coalesced_into uuid references adme_ops.jobs(id) on delete set null;
alter table adme_ops.channels add column source_policy text references adme_ops.source_runtime_policies(version),add column expires_at timestamptz;
create function adme_ops.resource_hash(p_channel text) returns bytea language sql immutable set search_path='' as $$select sha256(convert_to('youtube:'||p_channel,'UTF8'));$$;
create function adme_ops.source_deleted(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.source_tombstones where resource_hash=adme_ops.resource_hash(p_channel) and expires_at>statement_timestamp());$$;
create function adme_ops.youtube_daily_limit() returns integer language sql stable security definer set search_path='' as $$select coalesce((select daily_units from adme_ops.source_runtime_policies where provider='youtube' and enabled),0);$$;
create function adme_ops.channel_fresh(p_channel text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from adme_ops.channels c join adme_ops.source_runtime_policies p on p.version=c.source_policy and p.enabled where c.channel_id=p_channel and c.expires_at>statement_timestamp() and c.fetched_at<=statement_timestamp() and not adme_ops.source_deleted(c.channel_id));$$;
create function adme_ops.cache_source_guard() returns trigger language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;v jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.channel_id,0));
 if adme_ops.source_deleted(new.channel_id) then raise insufficient_privilege using message='source deleted';end if;
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled for share;
 if not found then raise insufficient_privilege using message='source policy pending';end if;
 if length(new.title) not between 1 and 100 or not adme_creator.safe_public_text(new.title) or jsonb_typeof(new.videos)<>'array' or jsonb_array_length(new.videos)>5 then raise check_violation;end if;
 for v in select value from jsonb_array_elements(new.videos) loop
 if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_object_keys(v) k where k not in('id','title','publishedAt')) or jsonb_typeof(v->'id') is distinct from 'string' or v->>'id' !~ '^[A-Za-z0-9_-]{11}$' or jsonb_typeof(v->'title') is distinct from 'string' or length(v->>'title') not between 1 and 300 or not adme_creator.safe_public_text(v->>'title') or jsonb_typeof(v->'publishedAt') is distinct from 'string' or v->>'publishedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise check_violation;end if;
 perform (v->>'publishedAt')::timestamptz;
 end loop;
 new.source_policy:=p.version;new.fetched_at:=statement_timestamp();new.expires_at:=statement_timestamp()+make_interval(secs=>p.cache_seconds);return new;
end;$$;
create trigger cache_source_boundary before insert or update of title,subscriber_count,videos,fetched_at on adme_ops.channels for each row execute function adme_ops.cache_source_guard();
create function adme_ops.identity_tombstone_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.provider='youtube' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||new.external_id,0));if adme_ops.source_deleted(new.external_id) and not(tg_op='UPDATE' and old.provider=new.provider and old.external_id=new.external_id and not new.owner_consent and new.publication_status='private') then raise insufficient_privilege using message='source deleted';end if;end if;return new;
end;$$;
create trigger identity_source_tombstone before insert or update on adme_creator.identities for each row execute function adme_ops.identity_tombstone_guard();
-- Keep the original function OIDs so cached public SQL gateways cannot retain a
-- bypass to the old implementation. Only ungranted internal copies are created.
do $$declare n text;body text;begin foreach n in array array['ops_worker_claim','ops_worker_finish'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if body is null then raise exception 'STOP: reviewed worker functions needed';end if;
 if n='ops_worker_claim' then
 if position('then 1000 else 30 end' in body)=0 then raise exception 'STOP: reviewed daily budget needed';end if;
 body:=replace(body,'then 1000 else 30 end','then adme_ops.youtube_daily_limit() else 30 end');end if;
 execute replace(body,'FUNCTION adme_ops.'||n||'(','FUNCTION adme_ops.'||n||'_before49(');
 end loop;end;$$;
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p adme_ops.source_runtime_policies;result jsonb;j adme_ops.jobs;begin
 perform adme_ops.verify_worker(p_token);perform pg_advisory_xact_lock(hashtext('adme-source-claim-v1'));
 select * into p from adme_ops.source_runtime_policies where provider='youtube' and enabled;
 if not found then
 update adme_ops.jobs set available_at=statement_timestamp()+interval '30 minutes',error_code='SOURCE_POLICY_PENDING' where kind like 'youtube_%' and status='queued' and available_at<=now();
 else
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,finished_at=now(),error_code='SOURCE_JOB_EXPIRED' where kind like 'youtube_%' and status in('queued','running') and(created_at+make_interval(secs=>p.job_seconds)<=now() or attempts>=max_attempts and(status='queued' or lease_until<=now()));
 update adme_ops.jobs a set status=b.status,finished_at=b.finished_at,error_code=b.error_code,coalesced_into=null from adme_ops.jobs b where a.coalesced_into=b.id and a.status='queued' and b.status in('done','failed');
 update adme_ops.jobs set status='done',finished_at=now(),error_code='CACHE_HIT' where kind='youtube_channel' and status='queued' and adme_ops.channel_fresh(input);
 update adme_ops.jobs a set coalesced_into=b.id,available_at=greatest(b.available_at,coalesce(b.lease_until,now()+interval '6 minutes')),error_code='COALESCED_PENDING' from adme_ops.jobs b where a.kind='youtube_channel' and a.status='queued' and b.kind=a.kind and b.input=a.input and b.id<>a.id and b.coalesced_into is null and(b.status='running' or b.status='queued' and(b.created_at,b.id)<(a.created_at,a.id));
 update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='SOURCE_DELETED',finished_at=now() where kind in('youtube_channel','youtube_claim') and status in('queued','running') and adme_ops.source_deleted(case when kind='youtube_claim' then split_part(input,':',2) else input end);
 end if;
 result:=adme_ops.ops_worker_claim_before49(p_token);if result is null then return null;end if;
 select * into j from adme_ops.jobs where id=(result->>'id')::uuid;
 if j.kind like 'youtube_%' then
 update adme_ops.jobs set source_policy=p.version,max_attempts=p.max_attempts,heartbeat_at=now(),checkpoint=case when checkpoint ? 'completed' then jsonb_set(checkpoint,'{completed}',coalesce((select jsonb_agg(v) from jsonb_array_elements(checkpoint->'completed') v where adme_ops.channel_fresh(v#>>'{}')),'[]'::jsonb)) else checkpoint end where id=j.id returning * into j;
 result:=result||jsonb_build_object('checkpoint',j.checkpoint,'policyVersion',p.version,'cacheTtlSeconds',p.cache_seconds);
 if j.kind='youtube_daily' then result:=result||jsonb_build_object('refresh',(select coalesce(jsonb_agg(channel_id),'[]'::jsonb) from(select channel_id from adme_ops.channels where not adme_ops.channel_fresh(channel_id) order by fetched_at,channel_id limit 20)c));end if;
 end if;return result;
end;$$;
create or replace function adme_ops.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed integer) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;accepted boolean;channel text;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then update adme_ops.jobs set status='failed',error_code='SOURCE_POLICY_CHANGED',lease=null,lease_until=null,finished_at=now() where id=j.id;return false;end if;
 if j.kind='youtube_channel' then perform pg_advisory_xact_lock(hashtextextended('youtube:'||j.input,0));if adme_ops.source_deleted(j.input) then return false;end if;end if;
 end if;
 if j.kind='youtube_channel' and p_error is null and p_result='[]'::jsonb and j.checkpoint->'completed' ? j.input and adme_ops.channel_fresh(j.input) then
 update adme_ops.jobs set status='done',lease=null,lease_until=null,finished_at=now(),error_code=null,elapsed_ms=p_elapsed where id=p_id;accepted:=true;
 else accepted:=adme_ops.ops_worker_finish_before49(p_token,p_id,p_lease,p_result,p_error,p_elapsed);end if;
 if accepted then update adme_ops.jobs a set status=b.status,available_at=b.available_at,finished_at=b.finished_at,error_code=case when b.status='done' then 'COALESCED' else b.error_code end,coalesced_into=case when b.status in('done','failed') then null else a.coalesced_into end from adme_ops.jobs b where a.coalesced_into=b.id and b.id=p_id and a.status='queued';end if;
 return accepted;
end;$$;
create function adme_ops.worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;p adme_ops.source_runtime_policies;begin perform adme_ops.verify_worker(p_token);
 select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;if not found then return false;end if;
 if not adme_ops.job_enabled(j.kind) then return false;end if;
 if j.kind like 'youtube_%' then select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled;if not found or j.created_at+make_interval(secs=>p.job_seconds)<=now() then return false;end if;end if;
 update adme_ops.jobs set heartbeat_at=now(),lease_until=least(now()+interval '6 minutes',case when p.version is null then now()+interval '6 minutes' else j.created_at+make_interval(secs=>p.job_seconds) end) where id=p_id;return true;
end;$$;
create function adme_ops.worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare j adme_ops.jobs;completed jsonb;accepted boolean;p adme_ops.source_runtime_policies;
begin
 perform adme_ops.verify_worker(p_token);select * into j from adme_ops.jobs where id=p_id and status='running' and lease=p_lease and lease_until>now() for update;
 if not found or j.kind not in('youtube_channel','youtube_daily') then raise insufficient_privilege;end if;
 select * into p from adme_ops.source_runtime_policies where version=j.source_policy and enabled for share;
 if not found or not adme_ops.job_enabled(j.kind) or j.created_at+make_interval(secs=>p.job_seconds)<=now() then raise insufficient_privilege;end if;
 if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates)>25 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_candidates)) or exists(select 1 from jsonb_array_elements(p_candidates) v where jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^UC[A-Za-z0-9_-]{22}$') then raise invalid_parameter_value;end if;
 if j.kind='youtube_channel' and p_candidates is distinct from jsonb_build_array(j.input) then raise invalid_parameter_value;end if;
 if j.checkpoint ? 'candidates' and j.checkpoint->'candidates' is distinct from p_candidates then raise invalid_parameter_value;end if;
 completed:=coalesce(j.checkpoint->'completed','[]'::jsonb);
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value from jsonb_array_elements(p_candidates) where adme_ops.channel_fresh(value#>>'{}')) x;
 if p_result is not null and p_result<>'[]'::jsonb then
 if jsonb_typeof(p_result)<>'array' or jsonb_array_length(p_result)>25 or exists(select 1 from jsonb_array_elements(p_result) v where not p_candidates ? (v->>'id')) then raise invalid_parameter_value;end if;
 -- Existing validated finish stores this bounded batch atomically; restore the
 -- lease inside the same transaction before anything can observe completion.
 accepted:=adme_ops.ops_worker_finish(p_token,p_id,p_lease,p_result,null,0);if not accepted then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(distinct v),'[]'::jsonb) into completed from(select jsonb_array_elements(completed)v union all select value->'id' from jsonb_array_elements(p_result)) x;
 update adme_ops.jobs set status='running',lease=p_lease,lease_until=j.lease_until,finished_at=null,error_code=null,output=null where id=j.id;
 end if;
 update adme_ops.jobs set checkpoint=jsonb_build_object('version',1,'candidates',p_candidates,'completed',completed),heartbeat_at=now() where id=j.id returning checkpoint into completed;
 return completed;
end;$$;
create function adme_ops.forget_channel(p_channel text,p_request uuid,p_policy text) returns void language plpgsql security definer set search_path='' as $$declare p adme_ops.source_runtime_policies;begin
 if p_channel is null or p_channel !~ '^UC[A-Za-z0-9_-]{22}$' or p_request is null then raise invalid_parameter_value;end if;
 select * into p from adme_ops.source_runtime_policies where version=p_policy;if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('youtube:'||p_channel,0));
 insert into adme_ops.source_tombstones(resource_hash,policy_version,request_ref,expires_at) values(adme_ops.resource_hash(p_channel),p.version,p_request,statement_timestamp()+make_interval(secs=>p.tombstone_seconds)) on conflict(resource_hash) do update set expires_at=greatest(adme_ops.source_tombstones.expires_at,excluded.expires_at),request_ref=excluded.request_ref,policy_version=excluded.policy_version;
 delete from adme_ops.channels where channel_id=p_channel;
 update adme_ops.channel_claims set verified_at=null,consent_at=null where channel_id=p_channel;
 update adme_creator.identities set owner_consent=false,publication_status='private' where provider='youtube' and external_id=p_channel;
 update adme_ops.jobs set status='failed',error_code='SOURCE_DELETED',lease=null,lease_until=null,finished_at=now() where status in('queued','running') and(kind='youtube_channel' and input=p_channel or kind='youtube_claim' and split_part(input,':',2)=p_channel or checkpoint->'candidates' ? p_channel);
end;$$;
-- TTL is evaluated against the exact policy used by the last fetch, never a
-- newly approved policy retroactively applied to old cache entries.
do $$declare n text;body text;needle text:='ch.fetched_at>now()-interval ''30 days''';begin foreach n in array array['ops_own_channels','ops_public_channels'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed channel read needed';end if;
 execute replace(body,needle,'adme_ops.channel_fresh(ch.channel_id)');end loop;end;$$;
create function public.ops_worker_heartbeat(p_token text,p_id uuid,p_lease uuid) returns boolean language sql volatile security invoker set search_path='' as $$select adme_ops.worker_heartbeat($1,$2,$3);$$;
create function public.ops_worker_checkpoint(p_token text,p_id uuid,p_lease uuid,p_candidates jsonb,p_result jsonb) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_ops.worker_checkpoint($1,$2,$3,$4,$5);$$;
create function public.ingestion_forget_channel(p_channel text,p_request uuid,p_policy text) returns void language sql volatile security invoker set search_path='' as $$select adme_ops.forget_channel($1,$2,$3);$$;
revoke all on function adme_ops.resource_hash(text),adme_ops.source_deleted(text),adme_ops.youtube_daily_limit(),adme_ops.channel_fresh(text),adme_ops.cache_source_guard(),adme_ops.identity_tombstone_guard(),adme_ops.ops_worker_claim_before49(text),adme_ops.ops_worker_finish_before49(text,uuid,uuid,jsonb,text,integer),adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb),adme_ops.forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_ops.worker_heartbeat(text,uuid,uuid),adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function adme_ops.forget_channel(text,uuid,text) to service_role;
revoke all on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb),public.ingestion_forget_channel(text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.ops_worker_heartbeat(text,uuid,uuid),public.ops_worker_checkpoint(text,uuid,uuid,jsonb,jsonb) to anon;
grant execute on function public.ingestion_forget_channel(text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210050_source_budget_public_refs.sql
-- Forward fix after49: low configured budgets defer work rather than passing an
-- invalid cost to the shared limiter; public YouTube links use the same opaque IDs.
do $$declare body text;needle text:='result:=adme_ops.ops_worker_claim_before49(p_token);';begin
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed49 claim needed';end if;
 execute replace(body,needle,'if p.version is not null then update adme_ops.jobs set available_at=to_timestamp((floor(extract(epoch from statement_timestamp())/86400)+1)*86400),error_code=''SOURCE_BUDGET_INSUFFICIENT'' where status=''queued'' and kind like ''youtube_%'' and case kind when ''youtube_daily'' then 130 when ''youtube_channel'' then 3 else 1 end>p.daily_units;end if; '||needle);
 body:=pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure);
 if position('creator.id as creator_id' in body)=0 then raise exception 'STOP: reviewed public channel DTO needed';end if;
 execute replace(body,'creator.id as creator_id','adme_creator.public_reference(creator.id) as creator_id');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210050','source_budget_public_refs',array[$next_source$-- Forward fix after49: low configured budgets defer work rather than passing an
-- invalid cost to the shared limiter; public YouTube links use the same opaque IDs.
begin;
do $$declare body text;needle text:='result:=adme_ops.ops_worker_claim_before49(p_token);';begin
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed49 claim needed';end if;
 execute replace(body,needle,'if p.version is not null then update adme_ops.jobs set available_at=to_timestamp((floor(extract(epoch from statement_timestamp())/86400)+1)*86400),error_code=''SOURCE_BUDGET_INSUFFICIENT'' where status=''queued'' and kind like ''youtube_%'' and case kind when ''youtube_daily'' then 130 when ''youtube_channel'' then 3 else 1 end>p.daily_units;end if; '||needle);
 body:=pg_get_functiondef('adme_ops.ops_public_channels(text)'::regprocedure);
 if position('creator.id as creator_id' in body)=0 then raise exception 'STOP: reviewed public channel DTO needed';end if;
 execute replace(body,'creator.id as creator_id','adme_creator.public_reference(creator.id) as creator_id');
end;$$;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210051_brand_public_text.sql
-- D080: apply the same public-contact boundary to brands while keeping the
-- explicit private business contact purpose and owner correction access.
do $$begin if exists(select 1 from public.brand_profiles where published and(not adme_creator.safe_public_text(brand_name) or not adme_creator.safe_public_text(industry) or not adme_creator.safe_public_text(introduction))) then raise exception 'STOP: review and withdraw existing contaminated public brand text first';end if;end;$$;
create function adme_creator.brand_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.brand_name) or not adme_creator.safe_public_text(new.industry) or not adme_creator.safe_public_text(new.introduction)) then raise check_violation using message='exclude private contacts from public brand text';end if;return new;
end;$$;
create trigger brand_public_text_guard before insert or update on public.brand_profiles for each row execute function adme_creator.brand_text_guard();
create policy brand_public_text_read on public.brand_profiles as restrictive for select to anon,authenticated using(owner_id=auth.uid() or(adme_creator.safe_public_text(brand_name) and adme_creator.safe_public_text(industry) and adme_creator.safe_public_text(introduction)));
-- This pure string predicate reveals no rows or identifiers.
grant usage on schema adme_creator to anon;
grant execute on function adme_creator.safe_public_text(text) to anon,authenticated;
revoke all on function adme_creator.brand_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210051','brand_public_text',array[$next_source$-- D080: apply the same public-contact boundary to brands while keeping the
-- explicit private business contact purpose and owner correction access.
begin;
do $$begin if exists(select 1 from public.brand_profiles where published and(not adme_creator.safe_public_text(brand_name) or not adme_creator.safe_public_text(industry) or not adme_creator.safe_public_text(introduction))) then raise exception 'STOP: review and withdraw existing contaminated public brand text first';end if;end;$$;
create function adme_creator.brand_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.brand_name) or not adme_creator.safe_public_text(new.industry) or not adme_creator.safe_public_text(new.introduction)) then raise check_violation using message='exclude private contacts from public brand text';end if;return new;
end;$$;
create trigger brand_public_text_guard before insert or update on public.brand_profiles for each row execute function adme_creator.brand_text_guard();
create policy brand_public_text_read on public.brand_profiles as restrictive for select to anon,authenticated using(owner_id=auth.uid() or(adme_creator.safe_public_text(brand_name) and adme_creator.safe_public_text(industry) and adme_creator.safe_public_text(introduction)));
-- This pure string predicate reveals no rows or identifiers.
grant usage on schema adme_creator to anon;
grant execute on function adme_creator.safe_public_text(text) to anon,authenticated;
revoke all on function adme_creator.brand_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210052_checkpoint_quota_reservation.sql
-- Internal conservative weight175 retains the old100 search buffer plus <=75
-- ordinary calls. It is NOT current provider billing/quota accounting: current
-- Google docs put search in a separate bucket. Enforce that bucket separately
-- with a rolling24h cap, which is stricter than Pacific-midnight reset.
alter table adme_ops.source_runtime_policies add column search_calls_24h integer not null default 5 check(search_calls_24h between 1 and 100);
create function adme_ops.reserve_source_search(p_limit integer) returns integer language plpgsql security definer set search_path='' as $$declare amount bigint;oldest timestamptz;begin
 if p_limit is null or p_limit not between 1 and 100 then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtext('adme-youtube-search-rolling24h'));
 select coalesce(sum(used),0),min(window_start) into amount,oldest from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube' and window_start>statement_timestamp()-interval '24 hours';
 if amount>=p_limit then return greatest(1,ceil(extract(epoch from oldest+interval '24 hours'-statement_timestamp()))::integer);end if;
 insert into adme_ops.rate_windows(scope,subject,window_start,used)values('source_search_24h','youtube',statement_timestamp(),1) on conflict(scope,subject,window_start)do update set used=adme_ops.rate_windows.used+1;return 0;
end;$$;
revoke all on function adme_ops.reserve_source_search(integer) from public,anon,authenticated,service_role;
do $$declare n text;body text;needle text:='when ''youtube_daily'' then 130';begin
 foreach n in array array['ops_worker_claim_before49','ops_worker_claim'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed source budget needed';end if;
 execute replace(body,needle,'when ''youtube_daily'' then 175');end loop;
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 needle:='if j.kind like ''youtube_%'' then';
 if position(needle in body)=0 then raise exception 'STOP: reviewed source lease needed';end if;
 execute replace(body,needle,'if j.kind=''youtube_daily'' and not(j.checkpoint ? ''candidates'') then
 declare retry_seconds integer;start_at timestamptz;begin
 retry_seconds:=adme_ops.reserve_source_search(p.search_calls_24h);
 if retry_seconds>0 then
 update adme_ops.jobs set status=''queued'',attempts=attempts-1,lease=null,lease_until=null,available_at=statement_timestamp()+make_interval(secs=>retry_seconds),error_code=''SOURCE_SEARCH_BUDGET'' where id=j.id;
 -- No lease or provider request was returned. Undo only this internal weight;
 -- provider failures after a returned lease never receive a refund.
 start_at:=to_timestamp(floor(extract(epoch from statement_timestamp())/86400)*86400);
 delete from adme_ops.rate_windows where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used=175;
 update adme_ops.rate_windows set used=used-175 where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used>175;
 return null;end if;end;end if;
 '||needle);
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210052','checkpoint_quota_reservation',array[$next_source$-- Internal conservative weight175 retains the old100 search buffer plus <=75
-- ordinary calls. It is NOT current provider billing/quota accounting: current
-- Google docs put search in a separate bucket. Enforce that bucket separately
-- with a rolling24h cap, which is stricter than Pacific-midnight reset.
begin;
alter table adme_ops.source_runtime_policies add column search_calls_24h integer not null default 5 check(search_calls_24h between 1 and 100);
create function adme_ops.reserve_source_search(p_limit integer) returns integer language plpgsql security definer set search_path='' as $$declare amount bigint;oldest timestamptz;begin
 if p_limit is null or p_limit not between 1 and 100 then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtext('adme-youtube-search-rolling24h'));
 select coalesce(sum(used),0),min(window_start) into amount,oldest from adme_ops.rate_windows where scope='source_search_24h' and subject='youtube' and window_start>statement_timestamp()-interval '24 hours';
 if amount>=p_limit then return greatest(1,ceil(extract(epoch from oldest+interval '24 hours'-statement_timestamp()))::integer);end if;
 insert into adme_ops.rate_windows(scope,subject,window_start,used)values('source_search_24h','youtube',statement_timestamp(),1) on conflict(scope,subject,window_start)do update set used=adme_ops.rate_windows.used+1;return 0;
end;$$;
revoke all on function adme_ops.reserve_source_search(integer) from public,anon,authenticated,service_role;
do $$declare n text;body text;needle text:='when ''youtube_daily'' then 130';begin
 foreach n in array array['ops_worker_claim_before49','ops_worker_claim'] loop
 select pg_get_functiondef(p.oid) into body from pg_proc p where p.pronamespace='adme_ops'::regnamespace and p.proname=n;
 if position(needle in body)=0 then raise exception 'STOP: reviewed source budget needed';end if;
 execute replace(body,needle,'when ''youtube_daily'' then 175');end loop;
 body:=pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure);
 needle:='if j.kind like ''youtube_%'' then';
 if position(needle in body)=0 then raise exception 'STOP: reviewed source lease needed';end if;
 execute replace(body,needle,'if j.kind=''youtube_daily'' and not(j.checkpoint ? ''candidates'') then
 declare retry_seconds integer;start_at timestamptz;begin
 retry_seconds:=adme_ops.reserve_source_search(p.search_calls_24h);
 if retry_seconds>0 then
 update adme_ops.jobs set status=''queued'',attempts=attempts-1,lease=null,lease_until=null,available_at=statement_timestamp()+make_interval(secs=>retry_seconds),error_code=''SOURCE_SEARCH_BUDGET'' where id=j.id;
 -- No lease or provider request was returned. Undo only this internal weight;
 -- provider failures after a returned lease never receive a refund.
 start_at:=to_timestamp(floor(extract(epoch from statement_timestamp())/86400)*86400);
 delete from adme_ops.rate_windows where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used=175;
 update adme_ops.rate_windows set used=used-175 where scope=''provider_day'' and subject=''youtube'' and window_start=start_at and used>175;
 return null;end if;end;end if;
 '||needle);
end;$$;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210053_withdraw_channel_consent.sql
-- A global optional-publication withdrawal also revokes the older per-channel
-- consent, so a later profile publication cannot silently revive it.
do $$declare body text;needle text:='update public.brand_profiles set published=false where owner_id=auth.uid();';begin
 body:=pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed consent function needed';end if;
 execute replace(body,needle,needle||' update adme_ops.channel_claims set consent_at=null where owner_id=auth.uid();');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210053','withdraw_channel_consent',array[$next_source$-- A global optional-publication withdrawal also revokes the older per-channel
-- consent, so a later profile publication cannot silently revive it.
begin;
do $$declare body text;needle text:='update public.brand_profiles set published=false where owner_id=auth.uid();';begin
 body:=pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed consent function needed';end if;
 execute replace(body,needle,needle||' update adme_ops.channel_claims set consent_at=null where owner_id=auth.uid();');
end;$$;
notify pgrst,'reload schema';
commit;
$next_source$]);

-- SOURCE 202611210054_consent_rollout_boundary.sql
-- Additive rollout: reviewed USER packet can retain old signup while staging.
-- Raw migration application defaults strict. Staging is NOT policy completion.
create table adme_consent.boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default true,release_ref text,activated_at timestamptz);
alter table adme_consent.boundary enable row level security;
revoke all on adme_consent.boundary from public,anon,authenticated,service_role;
insert into adme_consent.boundary(singleton,enabled)values(true,current_setting('adme.consent_staging',true) is distinct from 'on');
create function adme_consent.boundary_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or(old.enabled and not new.enabled)or(old.release_ref is not null and(new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at))then raise check_violation;end if;return new;
end;$$;
create trigger consent_boundary_guard before update or delete on adme_consent.boundary for each row execute function adme_consent.boundary_guard();
create function adme_consent.activate_boundary(p_release text)returns void language plpgsql security invoker set search_path='' as $$begin
 if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value;end if;
 update adme_consent.boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp())where singleton;
end;$$;
do $$declare body text;needle text:='if session_user in(''postgres'',''supabase_admin'') then return new;end if;';begin
 body:=pg_get_functiondef('adme_consent.signup_record()'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed consent signup trigger needed';end if;
 execute replace(body,needle,needle||' if not(select enabled from adme_consent.boundary where singleton) and not(new.raw_user_meta_data ? ''policy_version'') then return new;end if;');
end;$$;
revoke all on function adme_consent.boundary_guard(),adme_consent.activate_boundary(text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611210054','consent_rollout_boundary',array[$next_source$-- Additive rollout: reviewed USER packet can retain old signup while staging.
-- Raw migration application defaults strict. Staging is NOT policy completion.
begin;
create table adme_consent.boundary(singleton boolean primary key default true check(singleton),enabled boolean not null default true,release_ref text,activated_at timestamptz);
alter table adme_consent.boundary enable row level security;
revoke all on adme_consent.boundary from public,anon,authenticated,service_role;
insert into adme_consent.boundary(singleton,enabled)values(true,current_setting('adme.consent_staging',true) is distinct from 'on');
create function adme_consent.boundary_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or(old.enabled and not new.enabled)or(old.release_ref is not null and(new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at))then raise check_violation;end if;return new;
end;$$;
create trigger consent_boundary_guard before update or delete on adme_consent.boundary for each row execute function adme_consent.boundary_guard();
create function adme_consent.activate_boundary(p_release text)returns void language plpgsql security invoker set search_path='' as $$begin
 if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value;end if;
 update adme_consent.boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp())where singleton;
end;$$;
do $$declare body text;needle text:='if session_user in(''postgres'',''supabase_admin'') then return new;end if;';begin
 body:=pg_get_functiondef('adme_consent.signup_record()'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed consent signup trigger needed';end if;
 execute replace(body,needle,needle||' if not(select enabled from adme_consent.boundary where singleton) and not(new.raw_user_meta_data ? ''policy_version'') then return new;end if;');
end;$$;
revoke all on function adme_consent.boundary_guard(),adme_consent.activate_boundary(text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$next_source$]);
commit;
