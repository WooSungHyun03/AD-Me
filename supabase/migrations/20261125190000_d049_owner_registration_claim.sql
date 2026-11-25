-- DEV-B D049/D026: an owner's own profile registration is "verified" on every write path.
-- guard_creator_claim marked a self-registered row verified/unlocked only when current_user was
-- authenticated/anon. Since D073 profiles are saved through the SECURITY DEFINER save_publication,
-- new self-registered creators stayed 'unclaimed', so the D049 acceptance gate refused every
-- collaboration with them ("creator_unavailable"). INSERT by the signed-in owner of the row now gets
-- the same treatment; UPDATE rules (owner/claim fields, moderation lock) are unchanged so admin claim
-- review RPCs keep working. Collected profiles have no owner until a claim is approved, so an owned
-- 'unclaimed' row can only come from this gap: those rows are backfilled to 'verified'.
begin;
create or replace function public.guard_creator_claim() returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' and new.owner_id is not null and new.owner_id = auth.uid()
     and current_user not in ('authenticated','anon') then
    new.claim_status := 'verified';
    new.moderation_locked := false;
    return new;
  end if;
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      new.claim_status := 'verified';
      new.moderation_locked := false;
    else
      if new.owner_id is distinct from old.owner_id or new.claim_status is distinct from old.claim_status then
        raise exception 'claim fields are managed by claim review';
      end if;
      if new.moderation_locked is distinct from old.moderation_locked then
        raise exception 'moderation lock is managed by admins';
      end if;
      if old.moderation_locked and new.published then
        raise exception 'profile is locked by moderation';
      end if;
    end if;
  end if;
  return new;
end $$;
update public.creators set claim_status = 'verified'
  where owner_id is not null and claim_status = 'unclaimed';
commit;
