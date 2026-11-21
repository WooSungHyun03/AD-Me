-- Additive rollout: reviewed USER packet can retain old signup while staging.
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
