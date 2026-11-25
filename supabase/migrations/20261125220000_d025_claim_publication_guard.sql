-- DEV-B D025: claim workflow on collected (ownerless) public profiles under the D073 publication guard.
-- The guard's "metadata-only update" shortcut compared owner_id with '=', which is NULL for ownerless
-- collected profiles, so start_claim (claim_status -> pending) was refused with
-- "versioned publication transaction required" and no collected channel could ever be claimed.
-- 1) owner_id is compared with IS NOT DISTINCT FROM.
-- 2) An audited admin claim approval may attach the first owner to an already-public collected profile
--    when profile content and visibility are unchanged; the new owner's later edits still need a
--    versioned publication transaction. No other owner change is allowed outside that transaction.
begin;
do $$declare body text;
 needle text:='new.published=old.published and new.owner_id=old.owner_id then return new;end if;end if;';
begin
 body:=pg_get_functiondef('adme_consent.publication_guard()'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed publication guard required'; end if;
 body:=replace(body,needle,
  'new.published=old.published and new.owner_id is not distinct from old.owner_id then return new;end if;'
  ||' if tg_op=''UPDATE'' and old.owner_id is null and new.owner_id is not null and new.claim_status=''verified'''
  ||' and new.profile is not distinct from old.profile and new.published=old.published and public.is_admin() then return new;end if;end if;');
 execute body;
end$$;
commit;
