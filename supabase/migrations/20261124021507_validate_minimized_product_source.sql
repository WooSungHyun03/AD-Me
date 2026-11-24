-- PR-001: reject source reduced to unusable contact-only content before queue reservation.
begin;
do $patch$
declare d text;changed text;needle text:='v_id:=public.ops_draft_create(';
begin
 d:=pg_get_functiondef('adme_product_conditions.create_request(uuid,text,uuid)'::regprocedure);
 changed:=replace(d,needle,$body$
 if length(v_source->>'name')not between 2 and 100 or length(v_source->>'description')not between 5 and 1200 or length(v_source->>'audience')not between 2 and 160 then raise invalid_parameter_value;end if;
 v_id:=public.ops_draft_create($body$);
 if changed=d then raise exception 'unexpected product create source';end if;
 execute changed;
end;$patch$;
notify pgrst,'reload schema';
commit;
