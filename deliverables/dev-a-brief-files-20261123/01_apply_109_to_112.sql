begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Reviewed109 baseline only. CLI/console history formats supported; no history rewrite.
do $preflight$ begin
 if to_regnamespace('adme_brief')is not null or exists(select 1 from storage.buckets where id='adme-campaign-briefs')then raise exception 'STOP: brief namespace/bucket already exists; inspect partial application';end if;
 if(select count(*)from supabase_migrations.schema_migrations)<>109 or exists(select 1 from(values ('202611190001','core'),
('202611190002','operations'),
('202611190003','json_contracts'),
('202611190004','admin_security'),
('202611190005','moderation_locks'),
('202611190006','brand_profiles'),
('202611190007','brand_projection'),
('202611200001','intelligence'),
('202611200002','intelligence_cron'),
('202611200003','intelligence_settings_safe_update'),
('202611200004','youtube_ownership'),
('202611200005','private_operations_functions'),
('202611200006','ops_mfa'),
('202611200007','rate_limits'),
('202611200008','youtube_moderation'),
('202611200010','message_policy'),
('202611200011','draft_read_limits'),
('202611200012','campaign_terms'),
('202611200013','creator_identity'),
('202611200014','creator_read_boundary'),
('202611200015','creator_catalog_quota'),
('202611200016','creator_boundary_activation'),
('202611200017','proposal_visibility'),
('202611200018','conversations'),
('202611200019','review_workflow'),
('202611200020','review_public_boundary'),
('202611200021','ad_history'),
('202611200022','review_withdraw_quota'),
('202611200023','ad_evidence_gate'),
('202611200024','latest_response_consent'),
('202611200025','deliverable_versions'),
('202611200026','recommendation_snapshots'),
('202611200027','recommendation_campaign_delete'),
('202611200028','recommendation_read_budget'),
('202611210035','home_catalog'),
('202611210036','test_billing_boundary'),
('202611210037','filtered_catalog'),
('202611210038','auth_request_budget'),
('202611210039','private_images'),
('202611210040','brand_logo_projection'),
('202611210041','public_creator_references'),
('202611210042','normalized_public_read'),
('202611210043','image_transport_limit'),
('202611210044','service_budget_usage'),
('202611210045','reference_precedence'),
('202611210046','filter_reference_epoch'),
('202611210047','consent_versions'),
('202611210048','sensitive_boundaries'),
('202611210049','ingestion_recovery'),
('202611210050','source_budget_public_refs'),
('202611210051','brand_public_text'),
('202611210052','checkpoint_quota_reservation'),
('202611210053','withdraw_channel_consent'),
('202611210054','consent_rollout_boundary'),
('202611210055','publication_transactions'),
('202611210056','publication_guard_record'),
('202611210057','global_withdrawal_receipts'),
('202611210058','deletion_quarantine'),
('202611210059','deletion_private_helpers'),
('202611210060','deletion_owned_jobs'),
('202611220061','ad_timeline'),
('202611220062','metric_history'),
('202611220063','ad_cursor_reference'),
('202611220064','metric_filters'),
('202611220065','admin_support'),
('202611220066','metric_metadata_guard'),
('202611220067','history_permission'),
('202611220068','saved_searches'),
('20261122115249','youtube_marketplace'),
('20261122115930','marketplace_chat'),
('20261122224757','featured_youtube_directory'),
('20261122231018','youtube_profile_details'),
('20261122231403','youtube_profile_contact'),
('20261122231628','youtube_profile_claim_sync'),
('202611230075','main_integration_guards'),
('202611230076','worker_integration'),
('202611230077','worker_budget_compatibility'),
('20261123055918','youtube_directory_topic_projection'),
('20261123100004','claims'),
('20261123100005','profile_fields'),
('20261123100006','creator_search'),
('20261123100007','campaign_recruiting'),
('20261123100008','saved_lists'),
('20261123100009','proposal_events'),
('20261123100010','notifications'),
('20261123100011','report_queue'),
('20261123100012','privacy_exports'),
('20261123100013','private_uploads'),
('20261123100014','safety_blocks'),
('20261123100015','retention_tombstones'),
('20261123100016','ops_stats'),
('20261123100017','product_events'),
('20261123100018','preferences_consent'),
('20261123100019','notes_compare'),
('20261123100020','matching_feedback'),
('20261123100021','ai_usage'),
('20261123100022','email_outbox_delivery'),
('20261123100023','selection_review'),
('20261123100024','ops_metrics_inquiries'),
('20261123100025','usage_ledger'),
('20261123100026','promotion_slots'),
('20261123100027','test_cancellation'),
('20261123100028','reconcile_marketplace'),
('20261123100029','archived_report_appeal'),
('20261123110001','youtube_public_boundary'),
('20261123112401','youtube_directory_pagination'),
('20261123113123','youtube_directory_cursor_integer'),
('20261123114341','saved_catalog_list_compatibility'),
('20261123114636','promotion_public_reference_boundary'))e(version,name)left join supabase_migrations.schema_migrations m using(version)where m.version is null or m.name is distinct from e.name)then raise exception 'STOP: unsupported or partial baseline';end if;
 if exists(select 1 from(values ('public.account_access()','c8a42ee135dfd69a3fa5b394489c85e9e5164aae20de7ac056a9877620dbb169'),
('adme_privacy.actor_active(uuid)','c89d398376f3f0236f1fe101680dd12694cdd3adfc7a882d238e72f01ada10e5'),
('public.valid_campaign_dto(jsonb)','1f7ff768ac74377b58d7a7cae133ca31293b001c51809d47592cb4e5fe2593a1'),
('public.admin_mfa_recent()','a32d1945484d3ebce2c296743449e80470d790a7857b83ca492bedc3a51a0b2d'),
('adme_creator.catalog_dto(public.creators)','cdfee7a38e71a1954e20e6d04602b4d399dd4bc27b2814515c659a78884759fc'),
('public.create_creator_proposal(uuid,text,text,text)','93c748d1154f808ad0f127ffeac633696fcc023b9db5f77e280d3bec0a772492'),
('public.serve_promotion_slots(boolean)','c23da4d37a83710d878a8132e90c433fecda7dfe7090596bf0d65eb042342ef1'))e(signature,hash)where to_regprocedure(e.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(e.signature)),'UTF8')),'hex')is distinct from e.hash)then raise exception 'STOP: baseline permission/DTO contract mismatch';end if;
end $preflight$;

-- 20261123121526 SHA256 cf429536d001e8aa8c7fc364dbc165182891263502c0fa8d0af23b7b4988074b
-- D042: isolated owner-only campaign brief files; USER policy/retention activation is separate.
create schema adme_brief;
revoke all on schema adme_brief from public,anon,authenticated,service_role;
-- Resolve only the explicitly granted gateways/helpers; every table remains ungranted and RLS protected.
grant usage on schema adme_brief to authenticated,service_role;
create table adme_brief.controls(singleton boolean primary key default true check(singleton),enabled boolean not null default false,policy_ref text,retention_days integer,
 check(not enabled or(length(btrim(policy_ref))between 8 and 200 and retention_days between 1 and 365 and policy_ref is not null and retention_days is not null)));
insert into adme_brief.controls(singleton)values(true);
create table adme_brief.files(id uuid primary key,campaign_id uuid not null references public.campaigns(id)on delete cascade,owner_id uuid not null references public.profiles(id)deferrable initially deferred,
 path text not null unique,mime text not null check(mime in('image/png','image/jpeg','image/webp','application/pdf')),size_bytes integer not null check(size_bytes between 1 and 4194304),
 name text not null check(length(name)between 1 and 120),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),expires_at timestamptz not null,created_at timestamptz not null default statement_timestamp(),
 check(path~'^[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp|pdf)$'and split_part(path,'/',1)=campaign_id::text and split_part(split_part(path,'/',2),'.',1)=id::text));
create table adme_brief.state(campaign_id uuid primary key references public.campaigns(id)on delete cascade,owner_id uuid not null references public.profiles(id)deferrable initially deferred,
 revision integer not null default 0 check(revision between 0 and 200),active_file uuid references adme_brief.files(id)deferrable initially deferred);
create table adme_brief.versions(campaign_id uuid not null references public.campaigns(id)on delete cascade,revision integer not null check(revision between 1 and 200),
 owner_id uuid not null references public.profiles(id)deferrable initially deferred,file_id uuid references adme_brief.files(id)deferrable initially deferred,action text not null check(action in('upload','restore','clear')),
 request_key uuid not null,fingerprint bytea not null check(octet_length(fingerprint)=32),created_at timestamptz not null default statement_timestamp(),primary key(campaign_id,revision),unique(campaign_id,request_key));
create index brief_file_owner110 on adme_brief.files(owner_id,campaign_id);
alter table adme_brief.controls enable row level security;alter table adme_brief.files enable row level security;alter table adme_brief.state enable row level security;alter table adme_brief.versions enable row level security;
revoke all on all tables in schema adme_brief from public,anon,authenticated,service_role;
create function adme_brief.immutable()returns trigger language plpgsql set search_path=''as $$begin
 if tg_op='DELETE'and pg_trigger_depth()>1 and not exists(select 1 from public.campaigns where id=old.campaign_id)then return old;end if;
 raise check_violation using message='brief history is immutable';end;$$;
create trigger brief_files_immutable before update or delete on adme_brief.files for each row execute function adme_brief.immutable();
create trigger brief_versions_immutable before update or delete on adme_brief.versions for each row execute function adme_brief.immutable();
create function adme_brief.owner_context(p_campaign uuid,p_actor uuid)returns boolean language sql stable security definer set search_path=''as $$
 select p_actor is not null and adme_privacy.actor_active(p_actor)and exists(select 1 from public.campaigns c join public.profiles p on p.id=c.owner_id where c.id=p_campaign and c.owner_id=p_actor and p.role='brand');$$;
create function adme_brief.fingerprint(p_action text,p_file uuid,p_metadata jsonb)returns bytea language sql immutable set search_path=''as $$select sha256(convert_to(jsonb_build_array(p_action,p_file,p_metadata)::text,'UTF8'));$$;
create function adme_brief.retry(p_campaign uuid,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare v adme_brief.versions;begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 if p_key is null then raise invalid_parameter_value;end if;
 select *into v from adme_brief.versions where campaign_id=p_campaign and request_key=p_key and owner_id=auth.uid();
 if not found then return null;end if;
 if v.fingerprint is distinct from adme_brief.fingerprint(p_action,p_file,p_metadata)then raise unique_violation using message='request content changed';end if;
 return jsonb_build_object('revision',v.revision,'fileId',v.file_id);end;$$;
create function public.campaign_brief_retry(p_campaign uuid,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language sql stable security invoker set search_path=''as $$select adme_brief.retry($1,$2,$3,$4,$5);$$;
create function adme_brief.change(p_actor uuid,p_campaign uuid,p_expected integer,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare s adme_brief.state;v adme_brief.versions;p adme_brief.controls;fp bytea;begin
 if not adme_brief.owner_context(p_campaign,p_actor)then raise no_data_found;end if;
 perform 1 from public.campaigns where id=p_campaign and owner_id=p_actor for update;
 if p_key is null or p_expected is null or p_expected not between 0 and 200 or p_action is null or p_action not in('upload','restore','clear')then raise invalid_parameter_value;end if;
 fp:=adme_brief.fingerprint(p_action,p_file,p_metadata);
 select *into v from adme_brief.versions where campaign_id=p_campaign and request_key=p_key;
 if found then if v.owner_id is distinct from p_actor or v.fingerprint is distinct from fp then raise unique_violation;end if;return jsonb_build_object('revision',v.revision,'fileId',v.file_id);end if;
 insert into adme_brief.state(campaign_id,owner_id)values(p_campaign,p_actor)on conflict do nothing;
 select *into s from adme_brief.state where campaign_id=p_campaign and owner_id=p_actor for update;
 if not found then raise insufficient_privilege;end if;
 if s.revision<>p_expected then raise serialization_failure using message='brief changed';end if;
 if s.revision>=200 then raise program_limit_exceeded;end if;
 if p_action<>'clear'then select *into p from adme_brief.controls where singleton and enabled;if not found then raise insufficient_privilege using message='brief policy pending';end if;end if;
 perform adme_ops.require_quota('brief_change',p_actor::text,30,60);
 if p_action='upload'then
  if p_file is null or p_metadata is null or jsonb_typeof(p_metadata)<>'object'or(select count(*)from jsonb_object_keys(p_metadata))<>5 or exists(select 1 from jsonb_object_keys(p_metadata)k where k not in('path','name','mime','size','sha256'))then raise invalid_parameter_value;end if;
  if jsonb_typeof(p_metadata->'path')is distinct from'string'or jsonb_typeof(p_metadata->'name')is distinct from'string'or jsonb_typeof(p_metadata->'mime')is distinct from'string'or jsonb_typeof(p_metadata->'sha256')is distinct from'string'or jsonb_typeof(p_metadata->'size')is distinct from'number'or p_metadata->>'size'!~'^[0-9]{1,7}$'then raise invalid_parameter_value;end if;
  if(select count(*)from adme_brief.files where campaign_id=p_campaign)>=20 then raise program_limit_exceeded;end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='adme-campaign-briefs'and o.name=p_metadata->>'path'and(o.metadata->>'size')::bigint=(p_metadata->>'size')::bigint and o.metadata->>'mimetype'=p_metadata->>'mime')then raise invalid_parameter_value using message='verified object missing';end if;
  insert into adme_brief.files(id,campaign_id,owner_id,path,mime,size_bytes,name,sha256,expires_at)values(p_file,p_campaign,p_actor,p_metadata->>'path',p_metadata->>'mime',(p_metadata->>'size')::integer,p_metadata->>'name',p_metadata->>'sha256',statement_timestamp()+make_interval(days=>p.retention_days));
 elsif p_action='restore'then
  if p_metadata is not null or p_file is null or not exists(select 1 from adme_brief.files x where x.id=p_file and x.owner_id=p_actor and x.campaign_id=p_campaign and x.expires_at>statement_timestamp())then raise no_data_found;end if;
 else if p_file is not null or p_metadata is not null then raise invalid_parameter_value;end if;end if;
 update adme_brief.state set active_file=p_file,revision=s.revision+1 where campaign_id=p_campaign;
 insert into adme_brief.versions(campaign_id,revision,owner_id,file_id,action,request_key,fingerprint)values(p_campaign,s.revision+1,p_actor,p_file,p_action,p_key,fp);
 return jsonb_build_object('revision',s.revision+1,'fileId',p_file);
end;$$;
create function public.campaign_brief_change(p_actor uuid,p_campaign uuid,p_expected integer,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_brief.change($1,$2,$3,$4,$5,$6,$7);$$;
create function adme_brief.page(p_campaign uuid)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare result jsonb;begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 perform adme_ops.require_quota('brief_read',auth.uid()::text,120,60);
 select jsonb_build_object('version',1,'enabled',(select enabled from adme_brief.controls where singleton),'revision',coalesce((select revision from adme_brief.state where campaign_id=p_campaign and owner_id=auth.uid()),0),
 'activeFile',(select s.active_file from adme_brief.state s join adme_brief.files f on f.id=s.active_file and f.expires_at>statement_timestamp()where s.campaign_id=p_campaign and s.owner_id=auth.uid()),
 'files',coalesce((select jsonb_agg(to_jsonb(r)order by r."createdAt"desc)from(select case when f.expires_at>statement_timestamp()then f.id end as "fileId",case when f.expires_at>statement_timestamp()then f.name end as name,f.mime,f.size_bytes as size,f.created_at as "createdAt"from adme_brief.files f where f.campaign_id=p_campaign and f.owner_id=auth.uid()order by f.created_at desc,f.id limit 20)r),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(r)order by r.revision desc)from(
 select v.revision,v.created_at as "createdAt",v.action,case when f.expires_at>statement_timestamp()then f.id end as "fileId",case when f.expires_at>statement_timestamp()then f.name else null end as name,f.mime,f.size_bytes as size
 from adme_brief.versions v left join adme_brief.files f on f.id=v.file_id and f.campaign_id=v.campaign_id and f.owner_id=v.owner_id where v.campaign_id=p_campaign and v.owner_id=auth.uid()order by v.revision desc limit 20)r),'[]'::jsonb))into result;return result;
end;$$;
create function public.campaign_brief_page(p_campaign uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_brief.page($1);$$;
create function adme_brief.file(p_campaign uuid,p_file uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 return(select jsonb_build_object('path',f.path,'name',f.name)from adme_brief.files f where f.id=p_file and f.campaign_id=p_campaign and f.owner_id=auth.uid()and f.expires_at>statement_timestamp()and exists(select 1 from adme_brief.versions v where v.campaign_id=p_campaign and v.file_id=f.id and v.owner_id=auth.uid()));end;$$;
create function public.campaign_brief_file(p_campaign uuid,p_file uuid)returns jsonb language sql stable security invoker set search_path=''as $$select adme_brief.file($1,$2);$$;
create function adme_brief.readable(p_path text)returns boolean language sql stable security definer set search_path=''as $$select exists(select 1 from adme_brief.files f where f.path=p_path and f.owner_id=auth.uid()and f.expires_at>statement_timestamp()and adme_brief.owner_context(f.campaign_id,auth.uid())and exists(select 1 from adme_brief.versions v where v.campaign_id=f.campaign_id and v.file_id=f.id and v.owner_id=auth.uid()));$$;
revoke all on all functions in schema adme_brief from public,anon,authenticated,service_role;
revoke all on function public.campaign_brief_retry(uuid,uuid,text,uuid,jsonb),public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb),public.campaign_brief_page(uuid),public.campaign_brief_file(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function adme_brief.retry(uuid,uuid,text,uuid,jsonb),adme_brief.page(uuid),adme_brief.file(uuid,uuid),adme_brief.readable(text),public.campaign_brief_retry(uuid,uuid,text,uuid,jsonb),public.campaign_brief_page(uuid),public.campaign_brief_file(uuid,uuid)to authenticated;
grant execute on function adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb),public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('adme-campaign-briefs','adme-campaign-briefs',false,4194304,array['image/png','image/jpeg','image/webp','application/pdf']);
create policy campaign_brief_owner110 on storage.objects for select to authenticated using(bucket_id='adme-campaign-briefs'and adme_brief.readable(name));
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123121526','campaign_brief_file_versions',array[$adme_brief_source$-- D042: isolated owner-only campaign brief files; USER policy/retention activation is separate.
begin;
create schema adme_brief;
revoke all on schema adme_brief from public,anon,authenticated,service_role;
-- Resolve only the explicitly granted gateways/helpers; every table remains ungranted and RLS protected.
grant usage on schema adme_brief to authenticated,service_role;
create table adme_brief.controls(singleton boolean primary key default true check(singleton),enabled boolean not null default false,policy_ref text,retention_days integer,
 check(not enabled or(length(btrim(policy_ref))between 8 and 200 and retention_days between 1 and 365 and policy_ref is not null and retention_days is not null)));
insert into adme_brief.controls(singleton)values(true);
create table adme_brief.files(id uuid primary key,campaign_id uuid not null references public.campaigns(id)on delete cascade,owner_id uuid not null references public.profiles(id)deferrable initially deferred,
 path text not null unique,mime text not null check(mime in('image/png','image/jpeg','image/webp','application/pdf')),size_bytes integer not null check(size_bytes between 1 and 4194304),
 name text not null check(length(name)between 1 and 120),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),expires_at timestamptz not null,created_at timestamptz not null default statement_timestamp(),
 check(path~'^[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp|pdf)$'and split_part(path,'/',1)=campaign_id::text and split_part(split_part(path,'/',2),'.',1)=id::text));
create table adme_brief.state(campaign_id uuid primary key references public.campaigns(id)on delete cascade,owner_id uuid not null references public.profiles(id)deferrable initially deferred,
 revision integer not null default 0 check(revision between 0 and 200),active_file uuid references adme_brief.files(id)deferrable initially deferred);
create table adme_brief.versions(campaign_id uuid not null references public.campaigns(id)on delete cascade,revision integer not null check(revision between 1 and 200),
 owner_id uuid not null references public.profiles(id)deferrable initially deferred,file_id uuid references adme_brief.files(id)deferrable initially deferred,action text not null check(action in('upload','restore','clear')),
 request_key uuid not null,fingerprint bytea not null check(octet_length(fingerprint)=32),created_at timestamptz not null default statement_timestamp(),primary key(campaign_id,revision),unique(campaign_id,request_key));
create index brief_file_owner110 on adme_brief.files(owner_id,campaign_id);
alter table adme_brief.controls enable row level security;alter table adme_brief.files enable row level security;alter table adme_brief.state enable row level security;alter table adme_brief.versions enable row level security;
revoke all on all tables in schema adme_brief from public,anon,authenticated,service_role;
create function adme_brief.immutable()returns trigger language plpgsql set search_path=''as $$begin
 if tg_op='DELETE'and pg_trigger_depth()>1 and not exists(select 1 from public.campaigns where id=old.campaign_id)then return old;end if;
 raise check_violation using message='brief history is immutable';end;$$;
create trigger brief_files_immutable before update or delete on adme_brief.files for each row execute function adme_brief.immutable();
create trigger brief_versions_immutable before update or delete on adme_brief.versions for each row execute function adme_brief.immutable();
create function adme_brief.owner_context(p_campaign uuid,p_actor uuid)returns boolean language sql stable security definer set search_path=''as $$
 select p_actor is not null and adme_privacy.actor_active(p_actor)and exists(select 1 from public.campaigns c join public.profiles p on p.id=c.owner_id where c.id=p_campaign and c.owner_id=p_actor and p.role='brand');$$;
create function adme_brief.fingerprint(p_action text,p_file uuid,p_metadata jsonb)returns bytea language sql immutable set search_path=''as $$select sha256(convert_to(jsonb_build_array(p_action,p_file,p_metadata)::text,'UTF8'));$$;
create function adme_brief.retry(p_campaign uuid,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare v adme_brief.versions;begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 if p_key is null then raise invalid_parameter_value;end if;
 select *into v from adme_brief.versions where campaign_id=p_campaign and request_key=p_key and owner_id=auth.uid();
 if not found then return null;end if;
 if v.fingerprint is distinct from adme_brief.fingerprint(p_action,p_file,p_metadata)then raise unique_violation using message='request content changed';end if;
 return jsonb_build_object('revision',v.revision,'fileId',v.file_id);end;$$;
create function public.campaign_brief_retry(p_campaign uuid,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language sql stable security invoker set search_path=''as $$select adme_brief.retry($1,$2,$3,$4,$5);$$;
create function adme_brief.change(p_actor uuid,p_campaign uuid,p_expected integer,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
declare s adme_brief.state;v adme_brief.versions;p adme_brief.controls;fp bytea;begin
 if not adme_brief.owner_context(p_campaign,p_actor)then raise no_data_found;end if;
 perform 1 from public.campaigns where id=p_campaign and owner_id=p_actor for update;
 if p_key is null or p_expected is null or p_expected not between 0 and 200 or p_action is null or p_action not in('upload','restore','clear')then raise invalid_parameter_value;end if;
 fp:=adme_brief.fingerprint(p_action,p_file,p_metadata);
 select *into v from adme_brief.versions where campaign_id=p_campaign and request_key=p_key;
 if found then if v.owner_id is distinct from p_actor or v.fingerprint is distinct from fp then raise unique_violation;end if;return jsonb_build_object('revision',v.revision,'fileId',v.file_id);end if;
 insert into adme_brief.state(campaign_id,owner_id)values(p_campaign,p_actor)on conflict do nothing;
 select *into s from adme_brief.state where campaign_id=p_campaign and owner_id=p_actor for update;
 if not found then raise insufficient_privilege;end if;
 if s.revision<>p_expected then raise serialization_failure using message='brief changed';end if;
 if s.revision>=200 then raise program_limit_exceeded;end if;
 if p_action<>'clear'then select *into p from adme_brief.controls where singleton and enabled;if not found then raise insufficient_privilege using message='brief policy pending';end if;end if;
 perform adme_ops.require_quota('brief_change',p_actor::text,30,60);
 if p_action='upload'then
  if p_file is null or p_metadata is null or jsonb_typeof(p_metadata)<>'object'or(select count(*)from jsonb_object_keys(p_metadata))<>5 or exists(select 1 from jsonb_object_keys(p_metadata)k where k not in('path','name','mime','size','sha256'))then raise invalid_parameter_value;end if;
  if jsonb_typeof(p_metadata->'path')is distinct from'string'or jsonb_typeof(p_metadata->'name')is distinct from'string'or jsonb_typeof(p_metadata->'mime')is distinct from'string'or jsonb_typeof(p_metadata->'sha256')is distinct from'string'or jsonb_typeof(p_metadata->'size')is distinct from'number'or p_metadata->>'size'!~'^[0-9]{1,7}$'then raise invalid_parameter_value;end if;
  if(select count(*)from adme_brief.files where campaign_id=p_campaign)>=20 then raise program_limit_exceeded;end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='adme-campaign-briefs'and o.name=p_metadata->>'path'and(o.metadata->>'size')::bigint=(p_metadata->>'size')::bigint and o.metadata->>'mimetype'=p_metadata->>'mime')then raise invalid_parameter_value using message='verified object missing';end if;
  insert into adme_brief.files(id,campaign_id,owner_id,path,mime,size_bytes,name,sha256,expires_at)values(p_file,p_campaign,p_actor,p_metadata->>'path',p_metadata->>'mime',(p_metadata->>'size')::integer,p_metadata->>'name',p_metadata->>'sha256',statement_timestamp()+make_interval(days=>p.retention_days));
 elsif p_action='restore'then
  if p_metadata is not null or p_file is null or not exists(select 1 from adme_brief.files x where x.id=p_file and x.owner_id=p_actor and x.campaign_id=p_campaign and x.expires_at>statement_timestamp())then raise no_data_found;end if;
 else if p_file is not null or p_metadata is not null then raise invalid_parameter_value;end if;end if;
 update adme_brief.state set active_file=p_file,revision=s.revision+1 where campaign_id=p_campaign;
 insert into adme_brief.versions(campaign_id,revision,owner_id,file_id,action,request_key,fingerprint)values(p_campaign,s.revision+1,p_actor,p_file,p_action,p_key,fp);
 return jsonb_build_object('revision',s.revision+1,'fileId',p_file);
end;$$;
create function public.campaign_brief_change(p_actor uuid,p_campaign uuid,p_expected integer,p_key uuid,p_action text,p_file uuid,p_metadata jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_brief.change($1,$2,$3,$4,$5,$6,$7);$$;
create function adme_brief.page(p_campaign uuid)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare result jsonb;begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 perform adme_ops.require_quota('brief_read',auth.uid()::text,120,60);
 select jsonb_build_object('version',1,'enabled',(select enabled from adme_brief.controls where singleton),'revision',coalesce((select revision from adme_brief.state where campaign_id=p_campaign and owner_id=auth.uid()),0),
 'activeFile',(select s.active_file from adme_brief.state s join adme_brief.files f on f.id=s.active_file and f.expires_at>statement_timestamp()where s.campaign_id=p_campaign and s.owner_id=auth.uid()),
 'files',coalesce((select jsonb_agg(to_jsonb(r)order by r."createdAt"desc)from(select case when f.expires_at>statement_timestamp()then f.id end as "fileId",case when f.expires_at>statement_timestamp()then f.name end as name,f.mime,f.size_bytes as size,f.created_at as "createdAt"from adme_brief.files f where f.campaign_id=p_campaign and f.owner_id=auth.uid()order by f.created_at desc,f.id limit 20)r),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(r)order by r.revision desc)from(
 select v.revision,v.created_at as "createdAt",v.action,case when f.expires_at>statement_timestamp()then f.id end as "fileId",case when f.expires_at>statement_timestamp()then f.name else null end as name,f.mime,f.size_bytes as size
 from adme_brief.versions v left join adme_brief.files f on f.id=v.file_id and f.campaign_id=v.campaign_id and f.owner_id=v.owner_id where v.campaign_id=p_campaign and v.owner_id=auth.uid()order by v.revision desc limit 20)r),'[]'::jsonb))into result;return result;
end;$$;
create function public.campaign_brief_page(p_campaign uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_brief.page($1);$$;
create function adme_brief.file(p_campaign uuid,p_file uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 if not adme_brief.owner_context(p_campaign,auth.uid())then raise no_data_found;end if;
 return(select jsonb_build_object('path',f.path,'name',f.name)from adme_brief.files f where f.id=p_file and f.campaign_id=p_campaign and f.owner_id=auth.uid()and f.expires_at>statement_timestamp()and exists(select 1 from adme_brief.versions v where v.campaign_id=p_campaign and v.file_id=f.id and v.owner_id=auth.uid()));end;$$;
create function public.campaign_brief_file(p_campaign uuid,p_file uuid)returns jsonb language sql stable security invoker set search_path=''as $$select adme_brief.file($1,$2);$$;
create function adme_brief.readable(p_path text)returns boolean language sql stable security definer set search_path=''as $$select exists(select 1 from adme_brief.files f where f.path=p_path and f.owner_id=auth.uid()and f.expires_at>statement_timestamp()and adme_brief.owner_context(f.campaign_id,auth.uid())and exists(select 1 from adme_brief.versions v where v.campaign_id=f.campaign_id and v.file_id=f.id and v.owner_id=auth.uid()));$$;
revoke all on all functions in schema adme_brief from public,anon,authenticated,service_role;
revoke all on function public.campaign_brief_retry(uuid,uuid,text,uuid,jsonb),public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb),public.campaign_brief_page(uuid),public.campaign_brief_file(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function adme_brief.retry(uuid,uuid,text,uuid,jsonb),adme_brief.page(uuid),adme_brief.file(uuid,uuid),adme_brief.readable(text),public.campaign_brief_retry(uuid,uuid,text,uuid,jsonb),public.campaign_brief_page(uuid),public.campaign_brief_file(uuid,uuid)to authenticated;
grant execute on function adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb),public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('adme-campaign-briefs','adme-campaign-briefs',false,4194304,array['image/png','image/jpeg','image/webp','application/pdf']);
create policy campaign_brief_owner110 on storage.objects for select to authenticated using(bucket_id='adme-campaign-briefs'and adme_brief.readable(name));
notify pgrst,'reload schema';
commit;
$adme_brief_source$]);

-- 20261123122650 SHA256 f8d78bd9cbed11971a0fb0ca670e3908729c762bfa5e1ffda1a90a0e63696ffe
-- D042 forward addition: store the server-validated upload attestation and policy reference.
-- Existing110 rows remain unknown (NULL); never invent historical consent.
alter table adme_brief.files add column rights_confirmed boolean,add column policy_ref text,
 add constraint brief_attestation111 check(rights_confirmed is not true or(policy_ref is not null and length(btrim(policy_ref))between 8 and 200));
do $$declare definition text;needle text:='name,sha256,expires_at)values';ending text:='statement_timestamp()+make_interval(days=>p.retention_days));';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,needle)=0 or strpos(definition,ending)=0 then raise exception 'Expected reviewed brief upload writer missing';end if;
 definition:=replace(definition,needle,'name,sha256,expires_at,rights_confirmed,policy_ref)values');
 execute replace(definition,ending,'statement_timestamp()+make_interval(days=>p.retention_days),true,p.policy_ref);');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123122650','brief_upload_attestation_snapshot',array[$adme_brief_source$-- D042 forward addition: store the server-validated upload attestation and policy reference.
-- Existing110 rows remain unknown (NULL); never invent historical consent.
begin;
alter table adme_brief.files add column rights_confirmed boolean,add column policy_ref text,
 add constraint brief_attestation111 check(rights_confirmed is not true or(policy_ref is not null and length(btrim(policy_ref))between 8 and 200));
do $$declare definition text;needle text:='name,sha256,expires_at)values';ending text:='statement_timestamp()+make_interval(days=>p.retention_days));';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,needle)=0 or strpos(definition,ending)=0 then raise exception 'Expected reviewed brief upload writer missing';end if;
 definition:=replace(definition,needle,'name,sha256,expires_at,rights_confirmed,policy_ref)values');
 execute replace(definition,ending,'statement_timestamp()+make_interval(days=>p.retention_days),true,p.policy_ref);');
end;$$;
notify pgrst,'reload schema';
commit;
$adme_brief_source$]);

-- 20261123123531 SHA256 71a7c31ac654199ebeb39e736798faf3653008e0adba123413ea524ad74bde96
-- D042 forward budget alignment: all brand brief files share the existing20-file account cap.
do $$declare definition text;old_lock text:='perform 1 from public.campaigns where id=p_campaign and owner_id=p_actor for update;';old_count text:='from adme_brief.files where campaign_id=p_campaign)>=20';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,old_lock)=0 or strpos(definition,old_count)=0 then raise exception 'Expected reviewed brief writer/budget missing';end if;
 definition:=replace(definition,old_lock,'perform pg_advisory_xact_lock(hashtextextended(''brief-owner:''||p_actor::text,0));'||chr(10)||' '||old_lock);
 execute replace(definition,old_count,'from adme_brief.files where owner_id=p_actor)>=20');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123123531','brief_account_budget',array[$adme_brief_source$-- D042 forward budget alignment: all brand brief files share the existing20-file account cap.
begin;
do $$declare definition text;old_lock text:='perform 1 from public.campaigns where id=p_campaign and owner_id=p_actor for update;';old_count text:='from adme_brief.files where campaign_id=p_campaign)>=20';begin
 definition:=pg_get_functiondef('adme_brief.change(uuid,uuid,integer,uuid,text,uuid,jsonb)'::regprocedure);
 if strpos(definition,old_lock)=0 or strpos(definition,old_count)=0 then raise exception 'Expected reviewed brief writer/budget missing';end if;
 definition:=replace(definition,old_lock,'perform pg_advisory_xact_lock(hashtextextended(''brief-owner:''||p_actor::text,0));'||chr(10)||' '||old_lock);
 execute replace(definition,old_count,'from adme_brief.files where owner_id=p_actor)>=20');
end;$$;
notify pgrst,'reload schema';
commit;
$adme_brief_source$]);
notify pgrst,'reload schema';
commit;
