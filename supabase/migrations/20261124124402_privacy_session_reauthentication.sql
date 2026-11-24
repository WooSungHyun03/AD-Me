-- D074: account-wide last_sign_in_at is not proof for the requesting session.
-- Use the trusted PostgREST JWT's explicit authentication event and live session.
create function adme_privacy.session_reauthenticated() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb := auth.jwt(); entry jsonb; stamp numeric;
  epoch numeric := extract(epoch from statement_timestamp());
begin
  if auth.uid() is null or not exists (
    select 1 from auth.sessions s
    where s.user_id=auth.uid() and s.id::text=claims->>'session_id'
  ) or jsonb_typeof(claims->'amr') is distinct from 'array' then return false; end if;
  for entry in select value from jsonb_array_elements(claims->'amr') loop
    if entry->>'method' in ('password','otp','totp','mfa/totp')
       and jsonb_typeof(entry->'timestamp')='number' then
      stamp := (entry->>'timestamp')::numeric;
      if stamp=trunc(stamp) and abs(stamp)<=9007199254740991
         and stamp<=epoch and stamp>epoch-600 then return true; end if;
    end if;
  end loop;
  return false;
end $$;
revoke all on function adme_privacy.session_reauthenticated() from public,anon,authenticated,service_role;

create or replace function public.create_privacy_export()
returns table(id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path=public,extensions as $$
declare uid uuid := auth.uid(); t text; e privacy_exports;
begin
  if uid is null then raise exception 'forbidden'; end if;
  perform adme_privacy.enforce_actor();
  if not adme_privacy.session_reauthenticated() then raise exception 'reauth_required'; end if;
  -- Serialize the per-account quota check with ticket creation.
  perform pg_advisory_xact_lock(hashtextextended('privacy-export:'||uid::text,0));
  if (select count(*) from privacy_exports x where x.user_id=uid and x.created_at>now()-interval '24 hours')>=5 then
    raise exception 'rate_limited';
  end if;
  t := encode(gen_random_bytes(32),'hex');
  insert into privacy_exports(user_id,token_hash,expires_at)
  values(uid,encode(digest(t,'sha256'),'hex'),now()+interval '15 minutes') returning * into e;
  insert into privacy_access_log(user_id,export_id,action) values(uid,e.id,'created');
  return query select e.id,t,e.expires_at;
end $$;
revoke all on function public.create_privacy_export() from public,anon;
grant execute on function public.create_privacy_export() to authenticated;
