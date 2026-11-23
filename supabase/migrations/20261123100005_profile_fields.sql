-- D026: null = unknown quote / unknown availability (never 0 or false), platform allowlist,
-- and an admin moderation lock the owner cannot lift by re-publishing.
create or replace function public.valid_creator_dto(p jsonb) returns boolean language sql immutable set search_path=public as $$ select coalesce(
 jsonb_typeof(p)='object' and jsonb_typeof(p->'name')='string' and length(p->>'name') between 2 and 80
 and jsonb_typeof(p->'bio')='string' and length(p->>'bio')<=1000
 and jsonb_typeof(p->'handle')='string' and length(p->>'handle')<=100
 and jsonb_typeof(p->'categories')='array' and jsonb_array_length(p->'categories')<=5 and not jsonb_path_exists(p,'$.categories[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'vibes')='array' and jsonb_array_length(p->'vibes')<=8 and not jsonb_path_exists(p,'$.vibes[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'formats')='array' and jsonb_array_length(p->'formats')<=8 and not jsonb_path_exists(p,'$.formats[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'platforms')='array' and jsonb_array_length(p->'platforms')<=3
 and not jsonb_path_exists(p,'$.platforms[*] ? (@ != "instagram" && @ != "youtube" && @ != "tiktok")')
 and (
   (jsonb_typeof(p->'price_min_krw')='null' and jsonb_typeof(p->'price_max_krw')='null')
   or (jsonb_typeof(p->'price_min_krw')='number' and jsonb_typeof(p->'price_max_krw')='number'
       and (p->>'price_min_krw')::numeric between 0 and 100000000
       and (p->>'price_max_krw')::numeric between (p->>'price_min_krw')::numeric and 100000000)
 )
 and jsonb_typeof(p->'followers')='number' and (p->>'followers')::numeric between 0 and 10000000000
 and jsonb_typeof(p->'is_available') in ('boolean','null') and jsonb_typeof(p->'is_demo')='boolean'
 and (not(p?'social_url') or (jsonb_typeof(p->'social_url')='string' and ((p->>'social_url')='' or (p->>'social_url') like 'https://%')))
 and (not(p?'portfolio_url') or (jsonb_typeof(p->'portfolio_url')='string' and ((p->>'portfolio_url')='' or (p->>'portfolio_url') like 'https://%')))
,false); $$;

alter table creators add column moderation_locked boolean not null default false;

create or replace function public.guard_creator_claim() returns trigger language plpgsql set search_path=public as $$
begin
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

create or replace function public.moderate_entity(p_kind text,p_id text,p_published boolean) returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_kind='creator' then
    update creators set published=p_published, moderation_locked = not p_published where id=p_id;
  elsif p_kind='campaign' and not p_published then
    update campaigns set status='closed' where id=p_id::uuid;
  else
    raise exception 'invalid operation';
  end if;
  insert into audit_log(actor_id,entity_id,action) values(auth.uid(),p_id,'moderate:'||p_kind||':'||p_published::text);
end $$;
