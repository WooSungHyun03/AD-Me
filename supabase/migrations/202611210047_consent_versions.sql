-- D073: immutable policy snapshot and server-timed purpose-specific consent.
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
