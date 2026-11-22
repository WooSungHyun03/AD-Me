-- D025: unclaimed collected profiles and owner claims. Claim state is separate from moderation (published).
-- owner_id/claim_status change only inside the SECURITY DEFINER functions below, never by direct REST.
alter table creators add column claim_status text not null default 'unclaimed'
  check (claim_status in ('unclaimed','pending','verified','rejected','disputed'));
update creators set claim_status = 'verified' where owner_id is not null;

create function public.guard_creator_claim() returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op = 'INSERT' then
      new.claim_status := 'verified'; -- self-registration: RLS already forces owner_id = auth.uid()
    elsif new.owner_id is distinct from old.owner_id or new.claim_status is distinct from old.claim_status then
      raise exception 'claim fields are managed by claim review';
    end if;
  end if;
  return new;
end $$;
create trigger adme_creator_claim_guard before insert or update on creators
  for each row execute function public.guard_creator_claim();

create table public.creator_claims(
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references creators(id) on delete cascade,
  claimant_id uuid not null references profiles(id) on delete cascade,
  method text not null default 'code' check (method in ('code','oauth')),
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired','disputed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);
create unique index creator_claims_one_pending on creator_claims(creator_id, claimant_id) where status = 'pending';
create index on creator_claims(claimant_id);
create index on creator_claims(status, created_at);
alter table creator_claims enable row level security;
create policy claims_read on creator_claims for select using (claimant_id = auth.uid() or is_admin());
-- No insert/update/delete policies: writes only through RPCs. The code hash is never readable.
revoke all on creator_claims from anon, authenticated;
grant select (id, creator_id, claimant_id, method, status, expires_at, created_at, reviewed_at) on creator_claims to authenticated;

create function public.start_claim(p_creator text)
returns table(claim_id uuid, code text, expires_at timestamptz)
language plpgsql security definer set search_path=public, extensions as $$
declare c creators; v_code text; v_id uuid; v_exp timestamptz := now() + interval '72 hours';
begin
  if auth.uid() is null or my_role() <> 'creator' then raise exception 'forbidden'; end if;
  if exists (select 1 from creators where owner_id = auth.uid()) then raise exception 'already_has_profile'; end if;
  select * into c from creators where id = p_creator for update;
  if not found or c.owner_id is not null or coalesce((c.profile->>'is_demo')::boolean, true)
     or c.claim_status not in ('unclaimed','pending','rejected') then
    raise exception 'not_claimable';
  end if;
  update creator_claims set status = 'expired'
    where creator_claims.status = 'pending' and creator_claims.expires_at <= now()
      and (creator_id = p_creator or claimant_id = auth.uid());
  if exists (select 1 from creator_claims cc where cc.creator_id = p_creator and cc.claimant_id = auth.uid() and cc.status = 'pending') then
    raise exception 'duplicate_claim';
  end if;
  if (select count(*) from creator_claims cc where cc.claimant_id = auth.uid() and cc.status = 'pending') >= 3 then
    raise exception 'too_many_claims';
  end if;
  v_code := 'ADME-' || upper(encode(gen_random_bytes(5), 'hex'));
  insert into creator_claims(creator_id, claimant_id, code_hash, expires_at)
    values (p_creator, auth.uid(), encode(digest(v_code, 'sha256'), 'hex'), v_exp)
    returning id into v_id;
  update creators set claim_status = 'pending' where id = p_creator;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p_creator, 'claim_started');
  return query select v_id, v_code, v_exp;
end $$;

-- Approval needs the code the admin read on the claimed channel; it must hash to the stored value.
create function public.review_claim(p_claim uuid, p_approve boolean, p_code text default null)
returns text language plpgsql security definer set search_path=public, extensions as $$
declare cl creator_claims; c creators;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into cl from creator_claims where id = p_claim for update;
  if not found or cl.status <> 'pending' then raise exception 'not_pending'; end if;
  select * into c from creators where id = cl.creator_id for update;
  if cl.expires_at <= now() then
    update creator_claims set status = 'expired' where id = p_claim;
    update creators set claim_status = case when exists (select 1 from creator_claims where creator_id = c.id and status = 'pending') then 'pending' else 'unclaimed' end where id = c.id;
    return 'expired';
  end if;
  if p_approve then
    if p_code is null or encode(digest(upper(trim(p_code)), 'sha256'), 'hex') <> cl.code_hash then
      raise exception 'code_mismatch';
    end if;
    if c.owner_id is not null then raise exception 'already_owned'; end if;
    if exists (select 1 from creators where owner_id = cl.claimant_id) then raise exception 'claimant_has_profile'; end if;
    update creators set owner_id = cl.claimant_id, claim_status = 'verified' where id = c.id;
    update creator_claims set status = 'verified', reviewed_by = auth.uid(), reviewed_at = now() where id = p_claim;
    update creator_claims set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
      where creator_id = c.id and status = 'pending';
  else
    update creator_claims set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now() where id = p_claim;
    update creators set claim_status = case when exists (select 1 from creator_claims where creator_id = c.id and status = 'pending') then 'pending' else 'unclaimed' end where id = c.id;
  end if;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), c.id, case when p_approve then 'claim_verified' else 'claim_rejected' end);
  return case when p_approve then 'verified' else 'rejected' end;
end $$;
revoke all on function public.start_claim(text), public.review_claim(uuid, boolean, text) from public, anon;
grant execute on function public.start_claim(text), public.review_claim(uuid, boolean, text) to authenticated;

-- Proposals and applications only with ownership-verified profiles.
drop policy proposals_insert on proposals;
create policy proposals_insert on proposals for insert with check(status='pending' and exists(select 1 from campaigns ca join creators cr on cr.id=creator_id where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id and cr.claim_status='verified' and cr.published and ((kind='proposal' and brand_id=auth.uid() and my_role()='brand') or (kind='application' and creator_user_id=auth.uid() and my_role()='creator' and ca.status='published'))));
