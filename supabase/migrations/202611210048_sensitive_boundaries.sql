-- D080: allowed public text and non-sensitive metrics, without new inference.
begin;
create function adme_creator.safe_public_text(p text) returns boolean language sql immutable set search_path='' as $$select coalesce(normalize(p,NFKC) !~* '([0-9]{6}[[:space:]]*-?[[:space:]]*[1-8][0-9]{6})|(01[016789][[:space:].-]?[0-9]{3,4}[[:space:].-]?[0-9]{4})|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})',true);$$;
create function adme_creator.safe_metric_name(p text) returns boolean language sql immutable set search_path='' as $$select p !~* '(^|_)(age|birth|gender|sex|sexual|race|ethnicity|religion|political|health|medical|face|facial|biometric|phone|email|address|emotion)(_|$)';$$;
alter table adme_creator.metric_observations add constraint non_sensitive_metric check(adme_creator.safe_metric_name(name));
alter table adme_creator.identities add constraint non_sensitive_identity_name check(adme_creator.safe_public_text(display_name));
create function adme_creator.public_text_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.published and(not adme_creator.safe_public_text(new.profile->>'name') or not adme_creator.safe_public_text(new.profile->>'bio')) then raise check_violation using message='exclude private contacts and identifiers from public text';end if;return new;
end;$$;
create trigger creator_public_text_guard before insert or update on public.creators for each row execute function adme_creator.public_text_guard();
-- Old contaminated rows are hidden by the public projection until corrected;
-- owner withdrawal still succeeds and no historic content is silently erased.
do $$declare body text;begin body:=pg_get_functiondef('adme_creator.catalog_dto(public.creators)'::regprocedure);
 if position('adme_creator.catalog_dto_legacy_ref(p_row)' in body)=0 then raise exception 'STOP: reviewed public DTO needed';end if;
 execute replace(body,'adme_creator.catalog_dto_legacy_ref(p_row)||','case when adme_creator.safe_public_text(p_row.profile->>''name'') and adme_creator.safe_public_text(p_row.profile->>''bio'') then adme_creator.catalog_dto_legacy_ref(p_row) else null end||');
end;$$;
revoke all on function adme_creator.safe_public_text(text),adme_creator.safe_metric_name(text),adme_creator.public_text_guard() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
