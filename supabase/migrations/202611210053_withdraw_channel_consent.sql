-- A global optional-publication withdrawal also revokes the older per-channel
-- consent, so a later profile publication cannot silently revive it.
begin;
do $$declare body text;needle text:='update public.brand_profiles set published=false where owner_id=auth.uid();';begin
 body:=pg_get_functiondef('adme_consent.record_optional(text,text,boolean,uuid)'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed consent function needed';end if;
 execute replace(body,needle,needle||' update adme_ops.channel_claims set consent_at=null where owner_id=auth.uid();');
end;$$;
notify pgrst,'reload schema';
commit;
