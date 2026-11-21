-- D080: apply the same public-contact boundary to brands while keeping the
-- explicit private business contact purpose and owner correction access.
begin;
do $$begin if exists(select 1 from public.brand_profiles where published and(not adme_creator.safe_public_text(brand_name) or not adme_creator.safe_public_text(industry) or not adme_creator.safe_public_text(introduction))) then raise exception 'STOP: review and withdraw existing contaminated public brand text first';end if;end;$$;
create function adme_creator.brand_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.brand_name) or not adme_creator.safe_public_text(new.industry) or not adme_creator.safe_public_text(new.introduction)) then raise check_violation using message='exclude private contacts from public brand text';end if;return new;
end;$$;
create trigger brand_public_text_guard before insert or update on public.brand_profiles for each row execute function adme_creator.brand_text_guard();
create policy brand_public_text_read on public.brand_profiles as restrictive for select to anon,authenticated using(owner_id=auth.uid() or(adme_creator.safe_public_text(brand_name) and adme_creator.safe_public_text(industry) and adme_creator.safe_public_text(introduction)));
-- This pure string predicate reveals no rows or identifiers.
grant usage on schema adme_creator to anon;
grant execute on function adme_creator.safe_public_text(text) to anon,authenticated;
revoke all on function adme_creator.brand_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
