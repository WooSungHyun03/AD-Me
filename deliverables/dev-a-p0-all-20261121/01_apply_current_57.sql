begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-erasure-quarantine-20261121'));
-- Exact57 baseline; an existing custom DataAPI hook requires developer review.
do $$begin
 if(select count(*) from supabase_migrations.schema_migrations)<>57 or exists(select 1 from supabase_migrations.schema_migrations where version not in('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028','202611210035','202611210036','202611210037','202611210038','202611210039','202611210040','202611210041','202611210042','202611210043','202611210044','202611210045','202611210046','202611210047','202611210048','202611210049','202611210050','202611210051','202611210052','202611210053','202611210054','202611210055','202611210056','202611210057'))or to_regnamespace('adme_privacy')is not null then raise exception 'STOP: expected reviewed57 baseline';end if;
 if exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig)cfg(value)where cfg.value like 'pgrst.db_pre_request=%' and cfg.value<>'pgrst.db_pre_request=')then raise exception 'STOP: preserve and review existing DataAPI hook';end if;
 if md5(replace(pg_get_functiondef('adme_upload.room_allowed(uuid,boolean)'::regprocedure),E'\r\n',E'\n'))<>'52ac1d28f0872916090c5fea707edf01' or md5(replace(pg_get_functiondef('adme_upload.brand_logo(uuid)'::regprocedure),E'\r\n',E'\n'))<>'a93337dcb5186011ba9ac7b02e1232d1' then raise exception 'STOP: reviewed file access helpers required';end if;
end$$;

-- SOURCE 202611210058_deletion_quarantine.sql
-- D014 independent runtime: durable request, immediate data-access stop, no unapproved erasure.
create schema adme_privacy;
revoke all on schema adme_privacy from public,anon,authenticated,service_role;
grant usage on schema adme_privacy to anon,authenticated,service_role;
create table adme_privacy.requests(
 id uuid primary key,actor_id uuid not null unique,receipt_hash bytea not null check(octet_length(receipt_hash)=32),
 reauth_at timestamptz not null,accepted_at timestamptz not null default clock_timestamp(),
 state text not null default 'quarantining' check(state in('quarantining','waiting_retention','waiting_review','erasing','erased','retry_required')),
 lease uuid,lease_until timestamptz,attempts int not null default 0 check(attempts between 0 and 3),available_at timestamptz not null default now(),
 auth_restricted boolean not null default false,storage_revoked boolean not null default false,version int not null default 0,error_code text,
 check(reauth_at<=accepted_at and accepted_at-reauth_at<=interval '5 minutes')
);
create table adme_privacy.quarantine_files(
 request_id uuid not null references adme_privacy.requests(id),file_id uuid not null,source_path text not null,
 quarantine_path text not null unique,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),bytes int not null check(bytes between 1 and 5242880),source_state text not null check(source_state in('pending','verified')),
 phase text not null default 'pending' check(phase in('pending','copied','source_removed','absent_pending')),primary key(request_id,file_id)
);
alter table adme_privacy.requests enable row level security;alter table adme_privacy.quarantine_files enable row level security;
create table adme_privacy.intake(singleton boolean primary key default true check(singleton),enabled boolean not null default false,review_ref text,check(not enabled or(review_ref is not null and length(btrim(review_ref))between 8 and 200)));
alter table adme_privacy.intake enable row level security;
insert into adme_privacy.intake(singleton)values(true);
revoke all on all tables in schema adme_privacy from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('adme-privacy-quarantine','adme-privacy-quarantine',false,5242880,array['image/png']);
create function adme_privacy.actor_active(p_actor uuid)returns boolean language sql stable security definer set search_path='' as $$select p_actor is null or not exists(select 1 from adme_privacy.requests where actor_id=p_actor);$$;
create function adme_privacy.enforce_actor()returns void language plpgsql volatile security definer set search_path='' as $$begin
 if auth.uid() is not null then perform pg_advisory_xact_lock_shared(hashtextextended('privacy:'||auth.uid()::text,0));end if;
 if not adme_privacy.actor_active(auth.uid()) then raise insufficient_privilege using message='account deletion access restriction';end if;
end;$$;
create function adme_privacy.storage_active(p_bucket text,p_name text)returns boolean language sql stable security definer set search_path='' as $$
 select adme_privacy.actor_active(auth.uid()) and not exists(select 1 from storage.objects o join adme_privacy.requests r on(o.owner_id=r.actor_id::text or o.owner=r.actor_id or split_part(o.name,'/',1)=r.actor_id::text)where o.bucket_id=p_bucket and o.name=p_name);
$$;
create function adme_privacy.storage_write_guard()returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then perform pg_advisory_xact_lock_shared(hashtextextended('privacy:'||auth.uid()::text,0));end if;
 if not adme_privacy.actor_active(auth.uid()) or(new.bucket_id<>'adme-privacy-quarantine' and exists(select 1 from adme_privacy.requests where actor_id::text=split_part(new.name,'/',1)))then raise insufficient_privilege using message='deleted account storage path restricted';end if;
 return new;
end;$$;
create trigger deletion_storage_write_guard before insert or update on storage.objects for each row execute function adme_privacy.storage_write_guard();
-- pre_request is DataAPI only. Storage and realtime table access are gated independently below.
do $$declare item record;begin
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value) where r.rolname='authenticator' and cfg.value like 'pgrst.db_pre_request=%' and cfg.value<>'pgrst.db_pre_request=')then raise exception 'STOP: existing DataAPI hook needs steward review';end if;
 for item in select tablename from pg_tables where schemaname='public' loop
  execute format('create policy deletion_actor_restriction on public.%I as restrictive for all to authenticated using(adme_privacy.actor_active(auth.uid())) with check(adme_privacy.actor_active(auth.uid()))',item.tablename);
 end loop;
end;$$;
create policy deletion_storage_restriction on storage.objects as restrictive for all to authenticated using(adme_privacy.storage_active(bucket_id,name))with check(adme_privacy.actor_active(auth.uid()));
create policy quarantine_never_client on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'adme-privacy-quarantine')with check(bucket_id<>'adme-privacy-quarantine');
-- Both sides' file descriptors/byte access stop during quarantine, including service logo projection.
do $$declare body text;begin
 body:=pg_get_functiondef('adme_upload.room_allowed(uuid,boolean)'::regprocedure);
 if position('p.id=p_room and' in body)=0 then raise exception 'STOP: reviewed room access helper required';end if;
 execute replace(body,'p.id=p_room and','p.id=p_room and adme_privacy.actor_active(p.brand_id) and adme_privacy.actor_active(p.creator_user_id) and');
 body:=pg_get_functiondef('adme_upload.brand_logo(uuid)'::regprocedure);
 if position('where b.id=p_brand and' in body)=0 then raise exception 'STOP: reviewed logo access helper required';end if;
 execute replace(body,'where b.id=p_brand and','where b.id=p_brand and adme_privacy.actor_active(b.owner_id) and');
end;$$;

create function public.deletion_attempt(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if p_actor is null then raise invalid_parameter_value;end if;perform adme_ops.require_quota('deletion_reauth',p_actor::text,5,900);
end;$$;
create function public.deletion_intake_status()returns boolean language sql stable security definer set search_path='' as $$select enabled from adme_privacy.intake where singleton;$$;
create function public.deletion_edge_budget(p_ip text,p_request text)returns int language plpgsql security definer set search_path='' as $$declare a int;b int;begin
 if(p_ip is not null and p_ip !~ '^[a-f0-9]{64}$')or p_request is null or p_request !~ '^[a-f0-9]{64}$'then raise invalid_parameter_value;end if;
 a:=adme_ops.take_quota('deletion_edge',coalesce(p_ip,'untrusted-shared'),60,60);b:=adme_ops.take_quota('deletion_receipt',p_request,30,60);return greatest(a,b);
end;$$;
create function public.account_access()returns boolean language sql stable security invoker set search_path='' as $$select auth.uid() is not null and adme_privacy.actor_active(auth.uid());$$;
create function public.deletion_status(p_id uuid,p_receipt text)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'state',state,'acceptedAt',accepted_at,'authRestricted',auth_restricted,'storageRevoked',storage_revoked,'errorCode',error_code)
 from adme_privacy.requests where id=p_id and receipt_hash=extensions.digest(convert_to(p_receipt,'UTF8'),'sha256');
$$;
create function public.deletion_accept(p_actor uuid,p_id uuid,p_receipt text,p_reauth timestamptz)returns jsonb language plpgsql security definer set search_path='' as $$
declare existing adme_privacy.requests;begin
 if p_actor is null or p_id is null or p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' or p_reauth is null or p_reauth>clock_timestamp()+interval '5 seconds' or clock_timestamp()-p_reauth>interval '5 minutes' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy:'||p_actor::text,0));
 select * into existing from adme_privacy.requests where actor_id=p_actor or id=p_id;
 if found then if existing.actor_id<>p_actor or existing.id<>p_id or existing.receipt_hash<>extensions.digest(convert_to(p_receipt,'UTF8'),'sha256')then raise unique_violation;end if;return public.deletion_status(p_id,p_receipt);end if;
 if not(select enabled from adme_privacy.intake where singleton)then raise insufficient_privilege;end if;
 if not exists(select 1 from auth.users where id=p_actor)then raise no_data_found;end if;
 insert into adme_privacy.requests(id,actor_id,receipt_hash,reauth_at)values(p_id,p_actor,extensions.digest(convert_to(p_receipt,'UTF8'),'sha256'),least(p_reauth,clock_timestamp()));
 -- Publication restriction is not consent fabrication, and is not full erasure.
 update public.creators set published=false,profile=profile||'{"published":false,"owner_consent":false}'::jsonb where owner_id=p_actor;
 update public.brand_profiles set published=false where owner_id=p_actor;
 update public.campaigns set status='closed' where owner_id=p_actor;
 update adme_ops.channel_claims set consent_at=null where owner_id=p_actor;
 update adme_creator.identities set owner_consent=false,publication_status='private' where creator_id in(select r.id from adme_creator.records r join public.creators c on c.id=r.legacy_creator_id where c.owner_id=p_actor);
 insert into adme_privacy.quarantine_files(request_id,file_id,source_path,quarantine_path,sha256,bytes,source_state)
 select p_id,id,object_path,p_id::text||'/'||id::text||'.png',sha256,bytes,state from adme_upload.files where owner_id=p_actor;
 return public.deletion_status(p_id,p_receipt);
end;$$;
create function public.deletion_claim(p_id uuid,p_receipt text)returns jsonb language plpgsql security definer set search_path='' as $$
declare r adme_privacy.requests;begin
 select * into r from adme_privacy.requests where id=p_id and receipt_hash=extensions.digest(convert_to(p_receipt,'UTF8'),'sha256')for update;
 if not found or r.state in('waiting_retention','waiting_review','erased') or r.attempts>=3 or r.available_at>now() or r.lease_until>now()then return null;end if;
 update adme_privacy.requests set lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,state='quarantining',error_code=null,version=version+1 where id=p_id returning * into r;
 return jsonb_build_object('id',r.id,'actorId',r.actor_id,'lease',r.lease,'authRestricted',r.auth_restricted,'files',coalesce((select jsonb_agg(jsonb_build_object('id',file_id,'source',source_path,'target',quarantine_path,'hash',sha256,'bytes',bytes,'sourceState',source_state,'phase',phase))from(select * from adme_privacy.quarantine_files where request_id=r.id and phase not in('source_removed','absent_pending') order by file_id limit 5)f),'[]'::jsonb));
end;$$;
create function public.deletion_checkpoint(p_id uuid,p_lease uuid,p_file uuid,p_phase text,p_error boolean default false)returns boolean language plpgsql security definer set search_path='' as $$
declare r adme_privacy.requests;begin
 select * into r from adme_privacy.requests where id=p_id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 if p_error then update adme_privacy.requests set state='retry_required',lease=null,lease_until=null,available_at=now()+make_interval(secs=>least(1800,30*(2^attempts)::int)),error_code='QUARANTINE_RETRY_REQUIRED' where id=p_id;return true;end if;
 if p_file is null and p_phase='auth_restricted' then update adme_privacy.requests set auth_restricted=true where id=p_id;
 elsif p_file is not null and p_phase in('copied','source_removed','absent_pending')then
  update adme_privacy.quarantine_files set phase=p_phase where request_id=p_id and file_id=p_file and(case p_phase when 'copied' then phase in('pending','copied')when 'absent_pending' then source_state='pending' and phase in('pending','absent_pending')else phase in('copied','source_removed')end);if not found then raise invalid_parameter_value;end if;
 elsif p_file is null and p_phase='release' then
  if exists(select 1 from storage.objects o where(o.owner_id=r.actor_id::text or o.owner=r.actor_id or split_part(o.name,'/',1)=r.actor_id::text)and not exists(select 1 from adme_privacy.quarantine_files f where f.request_id=p_id and o.bucket_id='adme-private-images' and f.source_path=o.name and f.phase in('pending','copied')))then
   update adme_privacy.requests set state='waiting_review',error_code='UNRECOGNIZED_STORAGE_OBJECTS',lease=null,lease_until=null,storage_revoked=false where id=p_id;
  else
   update adme_privacy.requests set storage_revoked=not exists(select 1 from adme_privacy.quarantine_files where request_id=p_id and phase not in('source_removed','absent_pending')),state=case when auth_restricted and not exists(select 1 from adme_privacy.quarantine_files where request_id=p_id and phase not in('source_removed','absent_pending'))then 'waiting_retention' else 'quarantining' end,lease=null,lease_until=null,attempts=0,version=version+1 where id=p_id;
  end if;
 else raise invalid_parameter_value;end if;return true;
end;$$;
revoke all on all functions in schema adme_privacy from public,anon,authenticated,service_role;
grant execute on function adme_privacy.actor_active(uuid),adme_privacy.enforce_actor(),adme_privacy.storage_active(text,text) to anon,authenticated,service_role;
revoke all on function public.deletion_intake_status(),public.deletion_edge_budget(text,text),public.account_access(),public.deletion_attempt(uuid),public.deletion_status(uuid,text),public.deletion_accept(uuid,uuid,text,timestamptz),public.deletion_claim(uuid,text),public.deletion_checkpoint(uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.account_access() to authenticated;
grant execute on function public.deletion_intake_status() to anon,authenticated,service_role;
grant execute on function public.deletion_edge_budget(text,text),public.deletion_attempt(uuid),public.deletion_status(uuid,text),public.deletion_accept(uuid,uuid,text,timestamptz),public.deletion_claim(uuid,text),public.deletion_checkpoint(uuid,uuid,uuid,text,boolean) to service_role;
alter role authenticator set pgrst.db_pre_request='adme_privacy.enforce_actor';
notify pgrst,'reload config';notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611210058','deletion_quarantine',array[$erasure_source$-- D014 independent runtime: durable request, immediate data-access stop, no unapproved erasure.
begin;
create schema adme_privacy;
revoke all on schema adme_privacy from public,anon,authenticated,service_role;
grant usage on schema adme_privacy to anon,authenticated,service_role;
create table adme_privacy.requests(
 id uuid primary key,actor_id uuid not null unique,receipt_hash bytea not null check(octet_length(receipt_hash)=32),
 reauth_at timestamptz not null,accepted_at timestamptz not null default clock_timestamp(),
 state text not null default 'quarantining' check(state in('quarantining','waiting_retention','waiting_review','erasing','erased','retry_required')),
 lease uuid,lease_until timestamptz,attempts int not null default 0 check(attempts between 0 and 3),available_at timestamptz not null default now(),
 auth_restricted boolean not null default false,storage_revoked boolean not null default false,version int not null default 0,error_code text,
 check(reauth_at<=accepted_at and accepted_at-reauth_at<=interval '5 minutes')
);
create table adme_privacy.quarantine_files(
 request_id uuid not null references adme_privacy.requests(id),file_id uuid not null,source_path text not null,
 quarantine_path text not null unique,sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),bytes int not null check(bytes between 1 and 5242880),source_state text not null check(source_state in('pending','verified')),
 phase text not null default 'pending' check(phase in('pending','copied','source_removed','absent_pending')),primary key(request_id,file_id)
);
alter table adme_privacy.requests enable row level security;alter table adme_privacy.quarantine_files enable row level security;
create table adme_privacy.intake(singleton boolean primary key default true check(singleton),enabled boolean not null default false,review_ref text,check(not enabled or(review_ref is not null and length(btrim(review_ref))between 8 and 200)));
alter table adme_privacy.intake enable row level security;
insert into adme_privacy.intake(singleton)values(true);
revoke all on all tables in schema adme_privacy from public,anon,authenticated,service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('adme-privacy-quarantine','adme-privacy-quarantine',false,5242880,array['image/png']);
create function adme_privacy.actor_active(p_actor uuid)returns boolean language sql stable security definer set search_path='' as $$select p_actor is null or not exists(select 1 from adme_privacy.requests where actor_id=p_actor);$$;
create function adme_privacy.enforce_actor()returns void language plpgsql volatile security definer set search_path='' as $$begin
 if auth.uid() is not null then perform pg_advisory_xact_lock_shared(hashtextextended('privacy:'||auth.uid()::text,0));end if;
 if not adme_privacy.actor_active(auth.uid()) then raise insufficient_privilege using message='account deletion access restriction';end if;
end;$$;
create function adme_privacy.storage_active(p_bucket text,p_name text)returns boolean language sql stable security definer set search_path='' as $$
 select adme_privacy.actor_active(auth.uid()) and not exists(select 1 from storage.objects o join adme_privacy.requests r on(o.owner_id=r.actor_id::text or o.owner=r.actor_id or split_part(o.name,'/',1)=r.actor_id::text)where o.bucket_id=p_bucket and o.name=p_name);
$$;
create function adme_privacy.storage_write_guard()returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null then perform pg_advisory_xact_lock_shared(hashtextextended('privacy:'||auth.uid()::text,0));end if;
 if not adme_privacy.actor_active(auth.uid()) or(new.bucket_id<>'adme-privacy-quarantine' and exists(select 1 from adme_privacy.requests where actor_id::text=split_part(new.name,'/',1)))then raise insufficient_privilege using message='deleted account storage path restricted';end if;
 return new;
end;$$;
create trigger deletion_storage_write_guard before insert or update on storage.objects for each row execute function adme_privacy.storage_write_guard();
-- pre_request is DataAPI only. Storage and realtime table access are gated independently below.
do $$declare item record;begin
 if exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value) where r.rolname='authenticator' and cfg.value like 'pgrst.db_pre_request=%' and cfg.value<>'pgrst.db_pre_request=')then raise exception 'STOP: existing DataAPI hook needs steward review';end if;
 for item in select tablename from pg_tables where schemaname='public' loop
  execute format('create policy deletion_actor_restriction on public.%I as restrictive for all to authenticated using(adme_privacy.actor_active(auth.uid())) with check(adme_privacy.actor_active(auth.uid()))',item.tablename);
 end loop;
end;$$;
create policy deletion_storage_restriction on storage.objects as restrictive for all to authenticated using(adme_privacy.storage_active(bucket_id,name))with check(adme_privacy.actor_active(auth.uid()));
create policy quarantine_never_client on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'adme-privacy-quarantine')with check(bucket_id<>'adme-privacy-quarantine');
-- Both sides' file descriptors/byte access stop during quarantine, including service logo projection.
do $$declare body text;begin
 body:=pg_get_functiondef('adme_upload.room_allowed(uuid,boolean)'::regprocedure);
 if position('p.id=p_room and' in body)=0 then raise exception 'STOP: reviewed room access helper required';end if;
 execute replace(body,'p.id=p_room and','p.id=p_room and adme_privacy.actor_active(p.brand_id) and adme_privacy.actor_active(p.creator_user_id) and');
 body:=pg_get_functiondef('adme_upload.brand_logo(uuid)'::regprocedure);
 if position('where b.id=p_brand and' in body)=0 then raise exception 'STOP: reviewed logo access helper required';end if;
 execute replace(body,'where b.id=p_brand and','where b.id=p_brand and adme_privacy.actor_active(b.owner_id) and');
end;$$;

create function public.deletion_attempt(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 if p_actor is null then raise invalid_parameter_value;end if;perform adme_ops.require_quota('deletion_reauth',p_actor::text,5,900);
end;$$;
create function public.deletion_intake_status()returns boolean language sql stable security definer set search_path='' as $$select enabled from adme_privacy.intake where singleton;$$;
create function public.deletion_edge_budget(p_ip text,p_request text)returns int language plpgsql security definer set search_path='' as $$declare a int;b int;begin
 if(p_ip is not null and p_ip !~ '^[a-f0-9]{64}$')or p_request is null or p_request !~ '^[a-f0-9]{64}$'then raise invalid_parameter_value;end if;
 a:=adme_ops.take_quota('deletion_edge',coalesce(p_ip,'untrusted-shared'),60,60);b:=adme_ops.take_quota('deletion_receipt',p_request,30,60);return greatest(a,b);
end;$$;
create function public.account_access()returns boolean language sql stable security invoker set search_path='' as $$select auth.uid() is not null and adme_privacy.actor_active(auth.uid());$$;
create function public.deletion_status(p_id uuid,p_receipt text)returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'state',state,'acceptedAt',accepted_at,'authRestricted',auth_restricted,'storageRevoked',storage_revoked,'errorCode',error_code)
 from adme_privacy.requests where id=p_id and receipt_hash=extensions.digest(convert_to(p_receipt,'UTF8'),'sha256');
$$;
create function public.deletion_accept(p_actor uuid,p_id uuid,p_receipt text,p_reauth timestamptz)returns jsonb language plpgsql security definer set search_path='' as $$
declare existing adme_privacy.requests;begin
 if p_actor is null or p_id is null or p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' or p_reauth is null or p_reauth>clock_timestamp()+interval '5 seconds' or clock_timestamp()-p_reauth>interval '5 minutes' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('privacy:'||p_actor::text,0));
 select * into existing from adme_privacy.requests where actor_id=p_actor or id=p_id;
 if found then if existing.actor_id<>p_actor or existing.id<>p_id or existing.receipt_hash<>extensions.digest(convert_to(p_receipt,'UTF8'),'sha256')then raise unique_violation;end if;return public.deletion_status(p_id,p_receipt);end if;
 if not(select enabled from adme_privacy.intake where singleton)then raise insufficient_privilege;end if;
 if not exists(select 1 from auth.users where id=p_actor)then raise no_data_found;end if;
 insert into adme_privacy.requests(id,actor_id,receipt_hash,reauth_at)values(p_id,p_actor,extensions.digest(convert_to(p_receipt,'UTF8'),'sha256'),least(p_reauth,clock_timestamp()));
 -- Publication restriction is not consent fabrication, and is not full erasure.
 update public.creators set published=false,profile=profile||'{"published":false,"owner_consent":false}'::jsonb where owner_id=p_actor;
 update public.brand_profiles set published=false where owner_id=p_actor;
 update public.campaigns set status='closed' where owner_id=p_actor;
 update adme_ops.channel_claims set consent_at=null where owner_id=p_actor;
 update adme_creator.identities set owner_consent=false,publication_status='private' where creator_id in(select r.id from adme_creator.records r join public.creators c on c.id=r.legacy_creator_id where c.owner_id=p_actor);
 insert into adme_privacy.quarantine_files(request_id,file_id,source_path,quarantine_path,sha256,bytes,source_state)
 select p_id,id,object_path,p_id::text||'/'||id::text||'.png',sha256,bytes,state from adme_upload.files where owner_id=p_actor;
 return public.deletion_status(p_id,p_receipt);
end;$$;
create function public.deletion_claim(p_id uuid,p_receipt text)returns jsonb language plpgsql security definer set search_path='' as $$
declare r adme_privacy.requests;begin
 select * into r from adme_privacy.requests where id=p_id and receipt_hash=extensions.digest(convert_to(p_receipt,'UTF8'),'sha256')for update;
 if not found or r.state in('waiting_retention','waiting_review','erased') or r.attempts>=3 or r.available_at>now() or r.lease_until>now()then return null;end if;
 update adme_privacy.requests set lease=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,state='quarantining',error_code=null,version=version+1 where id=p_id returning * into r;
 return jsonb_build_object('id',r.id,'actorId',r.actor_id,'lease',r.lease,'authRestricted',r.auth_restricted,'files',coalesce((select jsonb_agg(jsonb_build_object('id',file_id,'source',source_path,'target',quarantine_path,'hash',sha256,'bytes',bytes,'sourceState',source_state,'phase',phase))from(select * from adme_privacy.quarantine_files where request_id=r.id and phase not in('source_removed','absent_pending') order by file_id limit 5)f),'[]'::jsonb));
end;$$;
create function public.deletion_checkpoint(p_id uuid,p_lease uuid,p_file uuid,p_phase text,p_error boolean default false)returns boolean language plpgsql security definer set search_path='' as $$
declare r adme_privacy.requests;begin
 select * into r from adme_privacy.requests where id=p_id and lease=p_lease and lease_until>now()for update;if not found then return false;end if;
 if p_error then update adme_privacy.requests set state='retry_required',lease=null,lease_until=null,available_at=now()+make_interval(secs=>least(1800,30*(2^attempts)::int)),error_code='QUARANTINE_RETRY_REQUIRED' where id=p_id;return true;end if;
 if p_file is null and p_phase='auth_restricted' then update adme_privacy.requests set auth_restricted=true where id=p_id;
 elsif p_file is not null and p_phase in('copied','source_removed','absent_pending')then
  update adme_privacy.quarantine_files set phase=p_phase where request_id=p_id and file_id=p_file and(case p_phase when 'copied' then phase in('pending','copied')when 'absent_pending' then source_state='pending' and phase in('pending','absent_pending')else phase in('copied','source_removed')end);if not found then raise invalid_parameter_value;end if;
 elsif p_file is null and p_phase='release' then
  if exists(select 1 from storage.objects o where(o.owner_id=r.actor_id::text or o.owner=r.actor_id or split_part(o.name,'/',1)=r.actor_id::text)and not exists(select 1 from adme_privacy.quarantine_files f where f.request_id=p_id and o.bucket_id='adme-private-images' and f.source_path=o.name and f.phase in('pending','copied')))then
   update adme_privacy.requests set state='waiting_review',error_code='UNRECOGNIZED_STORAGE_OBJECTS',lease=null,lease_until=null,storage_revoked=false where id=p_id;
  else
   update adme_privacy.requests set storage_revoked=not exists(select 1 from adme_privacy.quarantine_files where request_id=p_id and phase not in('source_removed','absent_pending')),state=case when auth_restricted and not exists(select 1 from adme_privacy.quarantine_files where request_id=p_id and phase not in('source_removed','absent_pending'))then 'waiting_retention' else 'quarantining' end,lease=null,lease_until=null,attempts=0,version=version+1 where id=p_id;
  end if;
 else raise invalid_parameter_value;end if;return true;
end;$$;
revoke all on all functions in schema adme_privacy from public,anon,authenticated,service_role;
grant execute on function adme_privacy.actor_active(uuid),adme_privacy.enforce_actor(),adme_privacy.storage_active(text,text) to anon,authenticated,service_role;
revoke all on function public.deletion_intake_status(),public.deletion_edge_budget(text,text),public.account_access(),public.deletion_attempt(uuid),public.deletion_status(uuid,text),public.deletion_accept(uuid,uuid,text,timestamptz),public.deletion_claim(uuid,text),public.deletion_checkpoint(uuid,uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.account_access() to authenticated;
grant execute on function public.deletion_intake_status() to anon,authenticated,service_role;
grant execute on function public.deletion_edge_budget(text,text),public.deletion_attempt(uuid),public.deletion_status(uuid,text),public.deletion_accept(uuid,uuid,text,timestamptz),public.deletion_claim(uuid,text),public.deletion_checkpoint(uuid,uuid,uuid,text,boolean) to service_role;
alter role authenticator set pgrst.db_pre_request='adme_privacy.enforce_actor';
notify pgrst,'reload config';notify pgrst,'reload schema';
commit;
$erasure_source$]);

-- SOURCE 202611210059_deletion_private_helpers.sql
-- Forward hardening: callers may check only their own active state, not probe arbitrary actors.
create function adme_privacy.request_allowed()returns boolean language sql stable security definer set search_path='' as $$select adme_privacy.actor_active(auth.uid());$$;
revoke all on function adme_privacy.request_allowed() from public,anon,authenticated,service_role;
grant execute on function adme_privacy.request_allowed() to anon,authenticated,service_role;
do $$declare item record;begin
 for item in select schemaname,tablename from pg_policies where policyname='deletion_actor_restriction'loop
  execute format('alter policy deletion_actor_restriction on %I.%I using(adme_privacy.request_allowed()) with check(adme_privacy.request_allowed())',item.schemaname,item.tablename);
 end loop;
end;$$;
alter policy deletion_storage_restriction on storage.objects with check(adme_privacy.request_allowed());
alter function public.account_access() security definer;
revoke all on function adme_privacy.actor_active(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611210059','deletion_private_helpers',array[$erasure_source$-- Forward hardening: callers may check only their own active state, not probe arbitrary actors.
begin;
create function adme_privacy.request_allowed()returns boolean language sql stable security definer set search_path='' as $$select adme_privacy.actor_active(auth.uid());$$;
revoke all on function adme_privacy.request_allowed() from public,anon,authenticated,service_role;
grant execute on function adme_privacy.request_allowed() to anon,authenticated,service_role;
do $$declare item record;begin
 for item in select schemaname,tablename from pg_policies where policyname='deletion_actor_restriction'loop
  execute format('alter policy deletion_actor_restriction on %I.%I using(adme_privacy.request_allowed()) with check(adme_privacy.request_allowed())',item.schemaname,item.tablename);
 end loop;
end;$$;
alter policy deletion_storage_restriction on storage.objects with check(adme_privacy.request_allowed());
alter function public.account_access() security definer;
revoke all on function adme_privacy.actor_active(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$erasure_source$]);

-- SOURCE 202611210060_deletion_owned_jobs.sql
-- Requests stop already queued/leased user-owned collection; global approved jobs remain separate.
do $$declare body text;needle text:='update adme_ops.channel_claims set consent_at=null where owner_id=p_actor;';begin
 body:=pg_get_functiondef('public.deletion_accept(uuid,uuid,text,timestamptz)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed deletion accept function required';end if;
 execute replace(body,needle,needle||' update adme_ops.jobs set status=''failed'',lease=null,lease_until=null,finished_at=clock_timestamp(),error_code=''ACCOUNT_DELETION'',output=null where owner_id=p_actor and status in(''queued'',''running'');');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611210060','deletion_owned_jobs',array[$erasure_source$-- Requests stop already queued/leased user-owned collection; global approved jobs remain separate.
begin;
do $$declare body text;needle text:='update adme_ops.channel_claims set consent_at=null where owner_id=p_actor;';begin
 body:=pg_get_functiondef('public.deletion_accept(uuid,uuid,text,timestamptz)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed deletion accept function required';end if;
 execute replace(body,needle,needle||' update adme_ops.jobs set status=''failed'',lease=null,lease_until=null,finished_at=clock_timestamp(),error_code=''ACCOUNT_DELETION'',output=null where owner_id=p_actor and status in(''queued'',''running'');');
end;$$;
notify pgrst,'reload schema';
commit;
$erasure_source$]);
commit;
