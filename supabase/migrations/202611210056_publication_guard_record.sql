-- Forward fix: trigger records have table-specific fields; branch before accessing profile.
begin;
do $$declare body text;needle text:='if tg_op=''UPDATE'' and scope_value=''creator'' and new.profile is not distinct from old.profile and new.published=old.published and new.owner_id=old.owner_id then return new;end if;';begin
 body:=pg_get_functiondef('adme_consent.publication_guard()'::regprocedure);
 if position(needle in body)=0 then raise exception 'STOP: reviewed055 publication guard required';end if;
 execute replace(body,needle,'if scope_value=''creator'' then if tg_op=''UPDATE'' and new.profile is not distinct from old.profile and new.published=old.published and new.owner_id=old.owner_id then return new;end if;end if;');
end;$$;
notify pgrst,'reload schema';
commit;
